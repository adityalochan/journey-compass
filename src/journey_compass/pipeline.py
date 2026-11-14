"""End-to-end: load -> journey profiles -> top 3 next steps -> channel -> (optional) message.

Rank 1 fills the original next_action / next_item / reason columns (the dashboard reads those);
ranks 2 and 3 are in rec_2_* and rec_3_*.

With an LLM configured (JC_LLM_PROVIDER in .env), the chooser reads each person's notes and may
change rank 1; the engine's own pick stays visible in engine_* columns, and `reason` becomes the
chooser's coordinator reason. Without one, the output is the engine's alone.

Run:  python -m journey_compass.pipeline [--messages]      (with PYTHONPATH=src)
"""
import sys

import pandas as pd

from . import config, llm
from .catalogue import load_catalogue
from .channel import suggest_channel
from .chooser import choose, final_top
from .data_loader import load_dataset
from .journey import build_profiles
from .messaging import draft
from .recommender import recommend_top


def _llm_on() -> bool:
    try:
        return llm.provider() is not None
    except llm.LLMUnavailable:
        return False


def run(with_messages: bool = False, progress: bool = False) -> pd.DataFrame:
    ds = load_dataset()
    catalogue = load_catalogue()
    profiles = build_profiles(ds)
    use_llm = _llm_on()
    contacts_by_person = dict(tuple(ds.contacts.groupby("participant_id"))) if len(ds.contacts) else {}
    empty = ds.contacts.iloc[0:0]
    results = []
    for n, profile in enumerate(profiles.to_dict("records"), 1):
        contacts = contacts_by_person.get(profile["participant_id"], empty)
        engine_steps = recommend_top(profile, catalogue, ds.as_of)
        steps, angle, row = engine_steps, "", {}
        if use_llm and engine_steps[0].offer_id:
            choice, shortlist = choose(profile, catalogue, ds.as_of, contacts)
            steps = final_top(shortlist, choice) or engine_steps
            angle = choice.message_angle
            row = {"chosen_by": choice.source, "chooser_note": choice.note,
                   "ai_changed_pick": choice.source == "ai" and choice.offer_id != engine_steps[0].offer_id}
        step = steps[0]
        reason = choice.coordinator_reason if row.get("chosen_by") == "ai" else step.reason
        channel = suggest_channel(profile, step.action)
        message = draft(profile, step, channel, angle, contacts) if with_messages else None
        row = {
            **profile,
            "next_action": step.action,
            "next_item": step.item,
            "reason": reason,
            "next_offer_id": step.offer_id,
            "next_when": step.when,
            "next_where": step.where,
            "next_score": step.score,
            "message_angle": angle,
            "channel": channel,
            "message": message.text if message else "",
            "message_source": message.source if message else "",
            "engine_offer_id": engine_steps[0].offer_id,
            "engine_item": engine_steps[0].item,
            "engine_reason": engine_steps[0].reason,
            **row,
        }
        for rank in (2, 3):
            alt = steps[rank - 1] if len(steps) >= rank else None
            row[f"rec_{rank}_action"] = alt.action if alt else ""
            row[f"rec_{rank}_item"] = alt.item if alt else ""
            row[f"rec_{rank}_reason"] = alt.reason if alt else ""
            row[f"rec_{rank}_offer_id"] = alt.offer_id if alt else ""
        results.append(row)
        if progress and n % 20 == 0:
            print(f"  {n}/{len(profiles)} people", flush=True)
    return pd.DataFrame(results)


if __name__ == "__main__":
    df = run(with_messages="--messages" in sys.argv, progress=True)
    out = config.OUTPUT_DIR / "recommendations.csv"
    df.drop(columns=["courses_taken", "course_keys", "attended"]).to_csv(out, index=False)
    print(df[["participant_id", "first_name", "journey_stage", "stage", "engagement_score", "days_to_drift",
              "next_action", "next_item", "channel"]].to_string(index=False))
    print(f"\nSaved {len(df)} rows to {out}")
    if "chosen_by" in df:
        print(f"Chooser: AI picked for {(df['chosen_by'] == 'ai').sum()}, changed the engine's pick for "
              f"{int(df['ai_changed_pick'].sum())}")
    if "--messages" in sys.argv:
        print(f"Messages: {df['message_source'].value_counts().to_dict()}")
