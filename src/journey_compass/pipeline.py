"""End-to-end: load -> journey profiles -> top 3 next steps -> channel -> (optional) message.

Rank 1 fills the original next_action / next_item / reason columns (the dashboard reads those);
ranks 2 and 3 are in rec_2_* and rec_3_*.

Run:  python -m journey_compass.pipeline          (from src/, or with PYTHONPATH=src)
"""
import pandas as pd

from . import config
from .channel import suggest_channel
from .data_loader import load_dataset
from .journey import build_profiles
from .messaging import draft_message
from .catalogue import load_catalogue
from .recommender import recommend_top


def run(with_messages: bool = False) -> pd.DataFrame:
    ds = load_dataset()
    catalogue = load_catalogue()
    profiles = build_profiles(ds)
    results = []
    for profile in profiles.to_dict("records"):
        steps = recommend_top(profile, catalogue, ds.as_of)
        step = steps[0]
        channel = suggest_channel(profile, step.action)
        row = {
            **profile,
            "next_action": step.action,
            "next_item": step.item,
            "reason": step.reason,
            "next_offer_id": step.offer_id,
            "next_when": step.when,
            "next_where": step.where,
            "next_score": step.score,
            "channel": channel,
            "message": draft_message(profile, step, channel) if with_messages else "",
        }
        for rank in (2, 3):
            alt = steps[rank - 1] if len(steps) >= rank else None
            row[f"rec_{rank}_action"] = alt.action if alt else ""
            row[f"rec_{rank}_item"] = alt.item if alt else ""
            row[f"rec_{rank}_reason"] = alt.reason if alt else ""
            row[f"rec_{rank}_offer_id"] = alt.offer_id if alt else ""
        results.append(row)
    return pd.DataFrame(results)


if __name__ == "__main__":
    df = run()
    out = config.OUTPUT_DIR / "recommendations.csv"
    df.drop(columns=["courses_taken", "course_keys", "attended"]).to_csv(out, index=False)
    print(df[["participant_id", "first_name", "journey_stage", "stage", "engagement_score", "days_to_drift",
              "next_action", "next_item", "channel"]].to_string(index=False))
    print(f"\nSaved {len(df)} rows to {out}")
