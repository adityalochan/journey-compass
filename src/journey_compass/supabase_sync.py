"""Run the engine on the data in Supabase and write the results back.

Reads participants (with consent, signals and notes), activities, contacts and offers. Writes:
  journeys         the stage used for the participant's greeting
  recommendations  the top 3, participant-safe (the website reads them through `next_steps`)
  engine_runs      the coordinator-facing reasoning: stage, drivers, picks, reason, channel
  acceptance_rates the learning loop: recorded outcomes update how often each stage takes up
                   each kind of offer, and the ranking uses the learned rates (learning.py)

Offers come from Supabase, not the local catalogue: a recommendation must reference an offer row.
The dataset name (JC_DATASET, default "synthetic") decides whether notes may go to a hosted LLM,
so set it to something else before this runs on real people's data.

Run:  python -m journey_compass.supabase_sync [--dry-run] [--no-llm] [--messages] [--ai-for WHO]
      (with PYTHONPATH=src)
  --messages   also draft each person's outreach message (AI writer for the AI group, template
               for everyone else)
  --ai-for     limit the AI to some people: comma-separated coordinator names and/or participant
               ids, e.g. --ai-for "Anita Rao,p_002". Everyone else gets the engine's picks.
"""
import os
import sys
from datetime import datetime, timezone

import pandas as pd
from dotenv import load_dotenv

from . import config
from .catalogue import COLUMNS as CATALOGUE_COLUMNS
from .channel import suggest_channel
from .data_loader import Dataset, SIGNAL_COLUMNS, prepare_activities, prepare_contacts, prepare_participants
from .journey import build_profiles
from .learning import as_table, learned_rates
from .messaging import draft, template_message
from .pipeline import _llm_on
from .web_export import WEB_STAGE, person_next_steps

PAGE = 1000


def client():
    from supabase import create_client
    load_dotenv(config.ROOT / ".env")
    url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")
    return create_client(url, key)


def fetch_all(c, table: str, columns: str = "*", order: str | None = None) -> list[dict]:
    rows, start = [], 0
    while True:
        q = c.table(table).select(columns)
        if order:
            q = q.order(order)
        batch = q.range(start, start + PAGE - 1).execute().data
        rows += batch
        if len(batch) < PAGE:
            return rows
        start += PAGE


def _joined(values, sep: str) -> str:
    return sep.join(v for v in values if v)


def participants_frame(people: list[dict], signals: list[dict], notes: list[dict]) -> pd.DataFrame:
    by_signal = {s["participant_id"]: s for s in signals}
    notes_by = {}
    for n in notes:
        notes_by.setdefault(n["participant_id"], []).append(n["note"])
    rows = []
    for p in people:
        s = by_signal.get(p["id"], {})
        rows.append({
            "participant_id": p["id"], "first_name": p["first_name"], "city": p.get("city"),
            "preferred_channel": p.get("preferred_channel"),
            "email_opt_in": p.get("email_opt_in"), "whatsapp_opt_in": p.get("whatsapp_opt_in"),
            "last_name": p.get("last_name"), "province": p.get("province"), "language": p.get("language"),
            "assigned_to": p.get("assigned_to"), "joined_at": p.get("joined_at"),
            "preferred_channel_source": p.get("preferred_channel_source"),
            "do_not_contact": p.get("do_not_contact"), "invites": s.get("invites", 0),
            **{col: s.get(col, 0) for col in SIGNAL_COLUMNS},
            "skills": _joined(p.get("skills") or [], "; "),
            "interests": _joined(p.get("interests") or [], "; "),
            "notes": _joined(notes_by.get(p["id"], []), " | "),
        })
    return prepare_participants(pd.DataFrame(rows))


def offers_frame(offers: list[dict]) -> pd.DataFrame:
    rows = [{
        "offer_id": o["id"], "offer_type": o["offer_type"], "name": o["name"],
        "program_key": o.get("program_key") or "", "commitment": o.get("commitment") or 2,
        "start_date": o.get("start_date"), "end_date": None,
        "start_time": (o.get("start_time") or "")[:5], "duration_min": o.get("duration_min") or "",
        "city": o.get("city") or "", "venue": o.get("venue") or "",
        "languages": ";".join(o.get("languages") or []), "tags": ";".join(o.get("tags") or []),
        "prerequisites": ";".join(o.get("prerequisites") or []), "audience": o.get("audience") or "",
        "description": o.get("description") or "", "source": o.get("source") or "",
    } for o in offers if o.get("active", True)]
    cat = pd.DataFrame(rows, columns=CATALOGUE_COLUMNS)
    cat["commitment"] = pd.to_numeric(cat["commitment"], errors="coerce").fillna(2).astype(int)
    cat["start_date"] = pd.to_datetime(cat["start_date"], errors="coerce")
    cat["end_date"] = pd.to_datetime(cat["end_date"], errors="coerce")
    return cat.reset_index(drop=True)


def load(c) -> tuple[Dataset, pd.DataFrame]:
    people = fetch_all(c, "participants", order="id")
    participants = participants_frame(people, fetch_all(c, "signals"), fetch_all(c, "notes", order="id"))
    activities = prepare_activities(pd.DataFrame(
        fetch_all(c, "activities", "participant_id,date,activity_type,name,subtype,city", order="id")))
    contacts = prepare_contacts(pd.DataFrame(
        fetch_all(c, "contacts", "participant_id,at,channel,direction,summary", order="id")))
    as_of = pd.Timestamp(os.getenv("JC_AS_OF") or config.PINNED_AS_OF.get(config.DATASET)
                         or pd.Timestamp.today().normalize())
    sources = {"contacts"} if len(contacts) else set()
    if all(col in participants for col in SIGNAL_COLUMNS):
        sources.add("signals")
    ds = Dataset(participants, activities, contacts, as_of, name=config.DATASET, sources=sources)
    return ds, offers_frame(fetch_all(c, "offers"))


def learn(c) -> list:
    """Learned acceptance rates from recorded outcomes. Each outcome counts against the stage the
    person had in the run that recommended it, i.e. the engine_runs row before this run."""
    stage_by = {r["participant_id"]: r["journey_stage"]
                for r in fetch_all(c, "engine_runs", "participant_id,journey_stage")}
    type_by = {o["id"]: o["offer_type"] for o in fetch_all(c, "offers", "id,offer_type")}
    rows = [{"stage": stage_by.get(o["participant_id"]), "offer_type": type_by.get(o["offer_id"]),
             "result": o["result"]} for o in fetch_all(c, "outcomes", "participant_id,offer_id,result")]
    return learned_rates(rows)


def _num(value):
    return None if value is None or pd.isna(value) else float(value)


def results(ds: Dataset, cat: pd.DataFrame, use_llm: bool, ai_ids: set | None = None,
            with_messages: bool = False) -> dict:
    """Rows for journeys, recommendations and engine_runs, keyed by table name.

    ai_ids limits the AI to those participants (None = everyone, when use_llm)."""
    offers = cat.set_index("offer_id")
    contacts_by = dict(tuple(ds.contacts.groupby("participant_id"))) if len(ds.contacts) else {}
    empty = ds.contacts.iloc[0:0]
    now = datetime.now(timezone.utc).isoformat()
    out = {"journeys": [], "recommendations": [], "engine_runs": []}
    for profile in build_profiles(ds).to_dict("records"):
        pid = profile["participant_id"]
        contacts = contacts_by.get(pid, empty)
        ai_here = use_llm and (ai_ids is None or pid in ai_ids)
        next_steps, steps, choice = person_next_steps(profile, cat, offers, ds.as_of, contacts, ai_here)
        out["journeys"].append({"participant_id": pid, "stage": WEB_STAGE[profile["journey_stage"]],
                                "generated_at": now})
        for rank, ns in enumerate(next_steps, 1):
            out["recommendations"].append({
                "participant_id": pid, "rank": rank, "offer_id": ns["offer_id"], "name": ns["name"],
                "kind": ns["kind"], "when_label": ns["when"], "why": ns["why"],
                "start_at": ns.get("start"), "duration_min": ns.get("durationMin"),
                "online": ns.get("online", False), "generated_at": now,
            })
        top = steps[0] if steps else None
        ai = choice is not None and choice.source == "ai"
        drift = profile.get("drift_date")
        channel = suggest_channel(profile, top.action) if top else None
        message, message_source = None, None
        if with_messages and top and channel:
            if ai_here:
                d = draft(profile, top, channel, choice.message_angle if ai else "", contacts)
                message, message_source = d.text, d.source
            else:
                message, message_source = template_message(profile, top, channel), "template"
        out["engine_runs"].append({
            "participant_id": pid,
            "journey_stage": profile["journey_stage"],
            "stage_confidence": _num(profile.get("stage_confidence")),
            "stage_drivers": str(profile.get("stage_drivers") or ""),
            "engagement_score": _num(profile.get("engagement_score")),
            "trend_points": _num(profile.get("trend_points")),
            "drift_date": None if drift is None or pd.isna(drift) else str(pd.Timestamp(drift).date()),
            "engine_offer_id": choice.engine_offer_id if choice else (top.offer_id if top else None),
            "chosen_offer_id": top.offer_id if top else None,
            "chosen_by": "ai" if ai else "engine",
            "coordinator_reason": choice.coordinator_reason if ai else (top.reason if top else None),
            "channel": channel,
            "message": message, "message_source": message_source,
            "generated_at": now,
        })
    return out


def write(c, out: dict, rates: list) -> None:
    ids = [r["participant_id"] for r in out["journeys"]]
    now = datetime.now(timezone.utc).isoformat()
    c.table("acceptance_rates").upsert([
        {"stage": r.stage, "offer_type": r.offer_type, "prior": r.prior, "rate": r.rate,
         "successes": r.successes, "trials": r.trials, "updated_at": now} for r in rates
    ], on_conflict="stage,offer_type").execute()
    c.table("journeys").upsert(out["journeys"], on_conflict="participant_id").execute()
    c.table("engine_runs").upsert(out["engine_runs"], on_conflict="participant_id").execute()
    for i in range(0, len(ids), 200):
        c.table("recommendations").delete().in_("participant_id", ids[i:i + 200]).execute()
    for i in range(0, len(out["recommendations"]), 500):
        c.table("recommendations").insert(out["recommendations"][i:i + 500]).execute()


def main(argv: list[str]) -> None:
    c = client()
    ds, cat = load(c)
    use_llm = _llm_on() and "--no-llm" not in argv
    rates = learn(c)
    config.ACCEPTANCE_RATES = as_table(rates)
    moved = [r for r in rates if r.trials]
    print(f"Learning: {sum(r.trials for r in moved)} outcomes")
    for r in moved:
        print(f"  {r.stage:<9} {r.offer_type:<9} {r.prior:.3f} -> {r.rate:.3f}  ({r.successes}/{r.trials} taken up)")
    print(f"{len(ds.participants)} participants, {len(ds.activities)} activities, "
          f"{len(ds.contacts)} contacts, {len(cat)} offers; as of {ds.as_of.date()}; AI {'on' if use_llm else 'off'}")
    ai_ids = None
    if use_llm and "--ai-for" in argv:
        wanted = {w.strip() for w in argv[argv.index("--ai-for") + 1].split(",") if w.strip()}
        people = ds.participants
        ai_ids = set(people.loc[people["participant_id"].isin(wanted) | people["assigned_to"].isin(wanted),
                                "participant_id"])
        print(f"AI limited to {len(ai_ids)} people ({', '.join(sorted(wanted))})")
    with_messages = "--messages" in argv
    out = results(ds, cat, use_llm, ai_ids, with_messages)
    if with_messages:
        sources = pd.Series([r["message_source"] for r in out["engine_runs"] if r["message_source"]]).value_counts()
        print(f"Messages: {sources.to_dict()}")
    stages = pd.Series([r["stage"] for r in out["journeys"]]).value_counts().to_dict()
    print(f"Stages: {stages}")
    print(f"Recommendations: {len(out['recommendations'])} for "
          f"{len({r['participant_id'] for r in out['recommendations']})} people")
    if "--dry-run" in argv:
        print("DRY RUN: nothing written.")
        return
    write(c, out, rates)
    print("Written: journeys, recommendations, engine_runs, acceptance_rates")


if __name__ == "__main__":
    main(sys.argv[1:])
