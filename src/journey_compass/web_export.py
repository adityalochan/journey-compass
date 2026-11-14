"""Write what the participant website shows: each person's stage and top 3 next steps.

Run:  python -m journey_compass.web_export        (with PYTHONPATH=src)
Writes src/data/engine_output.json, which web/src/lib/engine.ts reads. The file is git-ignored:
it contains real programme names and dates from the organisers' data, so it is built locally.

Everything in this file is bundled into the website and visible to anyone using it, so it holds
only participant-safe content:
  stage       used by the site to pick a greeting; never shown as a word or a score
  next_steps  name, kind, when, why -- `why` is written TO the participant
It never holds coordinator reasons, scores, engagement numbers, notes or contact history.
"""
import json

import pandas as pd

from . import config
from .catalogue import load_catalogue
from .data_loader import load_dataset
from .journey import build_profiles
from .recommender import NextStep, is_do_not_contact, recommend_top

WEB_STAGE = {"New": "new", "Active": "practicing", "Slipping": "slipping",
             "Drifting": "drifting", "Dormant": "dormant"}


def web_kind(step: NextStep) -> str:
    """The website's card kinds: course | retreat | seva | event | call."""
    if step.offer_type == "reconnect":
        return "call" if step.offer_id == "reconnect_call" else "event"
    return step.offer_type


def web_when(offer: pd.Series) -> str:
    """'Jan 2 · Montreal', 'Feb 11 · online', 'At your local centre', 'Whenever suits you'."""
    city = offer["city"]
    if pd.isna(offer["start_date"]):
        if offer["offer_type"] == "reconnect" and city == "":
            return "Whenever suits you"
        return "Online, whenever suits you" if city == "Online" else "At your local centre"
    d = offer["start_date"]
    place = "online" if city == "Online" else (city or "your local centre")
    return f"{d:%b} {d.day} · {place}"


def web_name(step: NextStep, offer: pd.Series) -> str:
    """Drop a trailing ' - Toronto' / ' - Online' (Eventbrite style): the `when` line says where."""
    head, _, tail = step.item.rpartition(" - ")
    return head if head and tail.strip() in {offer["city"], "Online"} else step.item


def _words(value) -> set:
    return {v.strip().lower() for v in str(value or "").split(";") if v.strip() and str(value) != "nan"}


def participant_why(step: NextStep, offer: pd.Series, profile: dict) -> str:
    """One warm sentence to the participant. Uses only what they have shared with us themselves
    (skills, interests, courses done), never notes, stage or scores. Step 3b can replace this with
    an LLM-written line."""
    tags = _words(offer["tags"])
    skill = sorted(tags & _words(profile.get("skills")))
    online = offer["city"] == "Online"
    if step.offer_type == "reconnect":
        if step.offer_id == "reconnect_call":
            first = str(profile.get("assigned_to") or "").split(" ")[0]
            return f"{first or 'Your teacher'} would love to hear how you've been. No agenda."
        return "Refresh your practice from home. No travel, no commitment."
    if step.offer_type == "seva":
        if skill:
            return f"Your {skill[0]} skills would make a real difference here."
        return "Give back alongside people who share your practice."
    if step.offer_type == "course":
        if "next on their path" in step.reason:
            return "The natural next step from where you are: deepen the practice you already have."
        if "yoga" in tags:
            return "Bring more yoga and breath into your week."
        if "ayurveda" in tags:
            return "Simple, practical ways to look after body and mind."
        return "A chance to go deeper into your practice."
    if step.offer_type == "retreat":
        if "family" in tags:
            return "Time away you can share with someone close to you."
        return "A few days away from the everyday to rest and go deeper."
    # events
    if "yoga" in tags:
        return "Gentle yoga and breath with your community."
    if tags & {"satsang", "community"}:
        return "An easy way to be with your community, with music and meditation."
    return "Practise together from home." if online else "Practise together with your community."


def build(k: int = config.TOP_K) -> dict:
    ds = load_dataset()
    cat = load_catalogue()
    offers = cat.set_index("offer_id")
    profiles = build_profiles(ds)
    people = {}
    for profile in profiles.to_dict("records"):
        steps = [] if is_do_not_contact(profile) else [s for s in recommend_top(profile, cat, ds.as_of, k) if s.offer_id]
        people[profile["participant_id"]] = {
            "stage": WEB_STAGE[profile["journey_stage"]],
            "next_steps": [{"offer_id": s.offer_id, "name": web_name(s, offers.loc[s.offer_id]), "kind": web_kind(s),
                            "when": web_when(offers.loc[s.offer_id]),
                            "why": participant_why(s, offers.loc[s.offer_id], profile)} for s in steps],
        }
    return {"as_of": str(ds.as_of.date()), "dataset": ds.name, "participants": people}


def main() -> None:
    out = build()
    config.WEB_EXPORT_FILE.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    n = len(out["participants"])
    print(f"Wrote stage + next steps for {n} people to {config.WEB_EXPORT_FILE.relative_to(config.ROOT)}")


if __name__ == "__main__":
    main()
