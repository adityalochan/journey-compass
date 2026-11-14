"""Journey mapping: turn each participant's history into one profile row with a stage.

Columns the existing recommender and dashboard read are unchanged:
  courses_taken, num_courses, num_events, num_seva, first_date, last_contact, last_activity,
  days_since_last, stage (Active / Cooling / Dormant)
Added in this step:
  journey_stage     New / Active / Slipping / Drifting / Dormant (stage is derived from it)
  stage_confidence  the model's probability for that stage
  stage_drivers     the three facts that pushed hardest towards it, in words
  stage_model       which model made the call (learned: core+contacts+signals, or the rule fallback)
  engagement_score  0-100, decaying points from every touchpoint
  score_breakdown   where those points come from
  trend_points      score now minus score 60 days ago
  days_to_drift     days until the score fades below the drift line if nothing new happens
  drift_date        as_of + days_to_drift
  days_since_contact  days since any contact (ours or theirs), not just activities
"""
import pandas as pd

from .data_loader import Dataset
from .features import compute_features, engagement_breakdown
from .stage_model import assign_stages


def _history(activities: pd.DataFrame, as_of: pd.Timestamp) -> pd.DataFrame:
    rows = []
    for pid, acts in activities[activities["date"] <= as_of].groupby("participant_id"):
        last = acts["date"].max()
        rows.append({
            "participant_id": pid,
            "courses_taken": acts.loc[acts["activity_type"] == "course", "name"].tolist(),
            "num_courses": int((acts["activity_type"] == "course").sum()),
            "num_events": int((acts["activity_type"] == "event").sum()),
            "num_seva": int((acts["activity_type"] == "seva").sum()),
            "first_date": acts["date"].min(),
            "last_contact": last,
            "last_activity": acts.iloc[-1]["name"],
            "days_since_last": (as_of - last).days,
        })
    return pd.DataFrame(rows)


def build_profiles(ds: Dataset, models: dict | None = None) -> pd.DataFrame:
    feats = compute_features(ds)
    stages = assign_stages(ds, feats, models)
    journey = pd.DataFrame({
        "engagement_score": feats["engagement_score"],
        "score_breakdown": [engagement_breakdown(r) for _, r in feats.iterrows()],
        "trend_points": feats["trend_points"],
        "days_to_drift": feats["days_to_drift"].astype(int),
        "drift_date": ds.as_of + pd.to_timedelta(feats["days_to_drift"], unit="D"),
        "days_since_contact": feats["days_since_contact"].astype(int),
    }, index=feats.index).join(stages).reset_index()

    profiles = ds.participants.merge(_history(ds.activities, ds.as_of), on="participant_id", how="left")
    profiles["courses_taken"] = profiles["courses_taken"].apply(lambda v: v if isinstance(v, list) else [])
    return profiles.merge(journey, on="participant_id", how="left")
