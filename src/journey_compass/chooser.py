"""Step 3a: an LLM reads the notes and picks one offer from a shortlist the engine already approved.

The shortlist is the engine's top 5 plus the best 3 allowed offers of each kind (course, retreat,
seva, event, reconnect). Every offer on it has passed the hard rules, so whatever the model picks
is allowed. The model returns JSON:
  offer_id            must be on the shortlist, otherwise the engine's pick stands
  coordinator_reason  one sentence for the coordinator; may cite the note it used
  message_angle       a participant-safe angle for the message writer (step 3b), no notes in it

If there is no provider, no notes, or the answer is invalid, the engine's pick stands and
`Choice.note` says why. Nothing here can make the pipeline fail.

Try it:  python -m journey_compass.chooser p_001 p_002 p_003      (JC_LLM_PROVIDER in .env)
"""
import json
import re
import sys
import time
from dataclasses import dataclass

import pandas as pd

from . import config, llm
from .recommender import NextStep, best_per_type, is_do_not_contact, recommend_top

SYSTEM = """You help Art of Living volunteer coordinators choose ONE next step for a past participant.
You get facts about the person, sometimes volunteer notes and recent contact summaries, and a shortlist of
offers. Every offer on the shortlist already passed the eligibility rules (consent, prerequisites, location,
language, dates). The first ones are ranked by a scoring engine; the rest are the best option of each kind.

Choose the single best offer for this person right now, in this order of priority:
1. A wish the person has expressed (in the notes or their own replies) comes first. If they want to serve,
   choose a seva role; if they asked about a kind of retreat or course, choose the closest match. "Not
   another course" rules out courses only; it does not mean they want less.
2. Respect stated constraints (time, family, work, travel) and what they do not want.
3. If the notes express no wish, people with low engagement need a small, easy ask.
4. Otherwise prefer the engine's ranking.

Return a JSON object with exactly these keys:
  "offer_id": one id from the shortlist, copied exactly
  "coordinator_reason": one sentence, at most 30 words, for the coordinator, naming the fact or note you used
  "message_angle": one phrase, at most 15 words, that a message to the participant can build on. It is
     read by the participant, so it must not mention or hint at notes, contact history or internal records."""


@dataclass
class Choice:
    offer_id: str
    source: str                 # "ai" or "engine"
    coordinator_reason: str
    message_angle: str
    engine_offer_id: str
    note: str = ""              # why the engine's pick stands, or "cached"
    model: str = ""


def shortlist(profile: dict, cat: pd.DataFrame, as_of: pd.Timestamp) -> list[NextStep]:
    top = recommend_top(profile, cat, as_of, k=config.SHORTLIST_TOP_N)
    seen = {s.offer_id for s in top}
    extra = best_per_type(profile, cat, as_of, n=config.SHORTLIST_PER_KIND)
    return [s for s in top if s.offer_id] + [s for s in extra if s.offer_id not in seen]


def _has_context(profile: dict, contacts: pd.DataFrame) -> bool:
    notes = str(profile.get("notes") or "").strip()
    return bool(notes and notes != "nan") or contacts["summary"].fillna("").str.strip().ne("").any()


def facts(profile: dict, contacts: pd.DataFrame, as_of: pd.Timestamp, with_notes: bool) -> str:
    """What the model is told. Times are numbers of days, never words like 'recently'."""
    lines = [
        f"First name: {profile['first_name']} | city: {profile.get('city')} | language: {profile.get('language', 'en')}",
        f"Stage: {profile.get('journey_stage')} | engagement {profile.get('engagement_score', 0):.0f}/100 "
        f"| 60-day trend {profile.get('trend_points', 0):+.0f}",
        f"Courses done: {', '.join(profile.get('courses_taken') or []) or 'none'}",
        f"Events attended: {profile.get('num_events', 0)} | seva done: {profile.get('num_seva', 0)} "
        f"| last activity: {profile.get('last_activity')} ({profile.get('days_since_last')} days ago)",
        f"Skills: {profile.get('skills') or 'not recorded'} | interests: {profile.get('interests') or 'not recorded'}",
    ]
    if with_notes:
        lines.append(f"Volunteer notes: {profile.get('notes') or 'none'}")
        recent = contacts.sort_values("date").tail(3)
        if len(recent):
            lines.append("Recent contacts:")
            lines += [f"  {(as_of - r.date).days} days ago, {r.channel}, {'from them' if r.direction == 'in' else 'from us'}: "
                      f"{r.summary}" for r in recent.itertuples()]
    else:
        lines.append("Volunteer notes and contact summaries: not shared with this model.")
    return "\n".join(lines)


def _candidates(steps: list[NextStep], cat: pd.DataFrame) -> str:
    commitment = cat.set_index("offer_id")["commitment"]
    return "\n".join(f"- id={s.offer_id} | {s.offer_type} | {s.item} | where: {s.where} | when: {s.when} "
                     f"| size of ask {commitment.get(s.offer_id, '?')}/5 | engine score {s.score} | engine: {s.reason}"
                     for s in steps)


def _parse(text: str, valid_ids: set) -> dict:
    text = re.sub(r"^```(?:json)?|```$", "", str(text or "").strip(), flags=re.M).strip()
    data = json.loads(text)
    if not isinstance(data, dict):
        raise ValueError("answer is not a JSON object")
    if data.get("offer_id") not in valid_ids:
        raise ValueError(f"offer_id {data.get('offer_id')!r} is not on the shortlist")
    for key in ("coordinator_reason", "message_angle"):
        if not str(data.get(key, "")).strip():
            raise ValueError(f"missing {key}")
    return {"offer_id": data["offer_id"],
            "coordinator_reason": " ".join(str(data["coordinator_reason"]).split()[:40]),
            "message_angle": " ".join(str(data["message_angle"]).split()[:20])}


def choose(profile: dict, cat: pd.DataFrame, as_of: pd.Timestamp, contacts: pd.DataFrame) -> tuple[Choice, list[NextStep]]:
    """Returns the choice and the shortlist it was made from."""
    steps = shortlist(profile, cat, as_of) if not is_do_not_contact(profile) else []
    if not steps:
        return Choice("", "engine", "", "", "", note="no allowed offers / do not contact"), steps
    engine = steps[0]

    def keep_engine(why: str, model: str = "") -> tuple[Choice, list[NextStep]]:
        return Choice(engine.offer_id, "engine", engine.reason, "", engine.offer_id, note=why, model=model), steps

    try:
        p = llm.provider()
    except llm.LLMUnavailable as e:
        return keep_engine(str(e))
    if p is None:
        return keep_engine("no LLM configured")
    if not _has_context(profile, contacts):
        return keep_engine("no notes or contact summaries to read")

    prompt = facts(profile, contacts, as_of, llm.notes_allowed(p)) + "\n\nShortlist:\n" + _candidates(steps, cat)
    try:
        text, info = llm.chat(SYSTEM, prompt, as_json=True)
        data = _parse(text, {s.offer_id for s in steps})
    except llm.LLMUnavailable as e:
        return keep_engine(str(e), p.model)
    except (ValueError, json.JSONDecodeError) as e:
        return keep_engine(f"invalid answer: {e}", p.model)
    return Choice(data["offer_id"], "ai", data["coordinator_reason"], data["message_angle"], engine.offer_id,
                  note="cached" if info["cached"] else "", model=info["model"]), steps


# ---------------------------------------------------------------------------------------------
# Try it on a few people
# ---------------------------------------------------------------------------------------------
def main(pids: list[str]) -> None:
    from .catalogue import load_catalogue
    from .data_loader import load_dataset
    from .journey import build_profiles

    ds = load_dataset()
    cat = load_catalogue()
    profiles = build_profiles(ds).set_index("participant_id")
    names = cat.set_index("offer_id")["name"]
    changed = 0
    for pid in pids:
        profile = profiles.loc[pid].to_dict() | {"participant_id": pid}
        t = time.time()
        choice, steps = choose(profile, cat, ds.as_of, ds.contacts[ds.contacts["participant_id"] == pid])
        took = time.time() - t
        changed += choice.source == "ai" and choice.offer_id != choice.engine_offer_id
        print(f"\n{profile['first_name']} ({profile['journey_stage']}, {profile['city']}) | shortlist of {len(steps)}"
              f" | {choice.source}{' ' + choice.model if choice.model else ''} | {took:.1f}s {choice.note}")
        print(f"  notes:  {profile.get('notes')}")
        print(f"  engine: {names.get(choice.engine_offer_id, '-')}")
        if choice.source == "ai":
            mark = "same" if choice.offer_id == choice.engine_offer_id else "CHANGED"
            print(f"  AI:     {names.get(choice.offer_id)}  [{mark}]")
            print(f"  why:    {choice.coordinator_reason}")
            print(f"  angle:  {choice.message_angle}")
    print(f"\nAI changed the engine's pick for {changed} of {len(pids)} people.")


if __name__ == "__main__":
    main(sys.argv[1:] or [f"p_{i:03d}" for i in range(1, 11)])
