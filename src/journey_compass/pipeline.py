"""End-to-end: load -> journey profiles -> next step -> channel -> (optional) message.

Run:  python -m journey_compass.pipeline          (from src/, or with PYTHONPATH=src)
"""
import pandas as pd

from . import config
from .channel import suggest_channel
from .data_loader import load_activities, load_participants
from .journey import build_profiles
from .messaging import draft_message
from .recommender import recommend


def run(with_messages: bool = False) -> pd.DataFrame:
    as_of = pd.Timestamp(config.AS_OF) if config.AS_OF else None
    profiles = build_profiles(load_participants(), load_activities(), as_of=as_of)
    results = []
    for profile in profiles.to_dict("records"):
        step = recommend(profile)
        channel = suggest_channel(profile, step.action)
        results.append({
            **profile,
            "next_action": step.action,
            "next_item": step.item,
            "reason": step.reason,
            "channel": channel,
            "message": draft_message(profile, step, channel) if with_messages else "",
        })
    return pd.DataFrame(results)


if __name__ == "__main__":
    df = run()
    out = config.OUTPUT_DIR / "recommendations.csv"
    df.drop(columns=["courses_taken"]).to_csv(out, index=False)
    print(df[["participant_id", "first_name", "stage", "next_action", "next_item", "channel"]].to_string(index=False))
    print(f"\nSaved {len(df)} rows to {out}")
