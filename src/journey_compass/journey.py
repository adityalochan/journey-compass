"""Journey mapping: turn each participant's activity history into one profile row."""
import pandas as pd

from . import config


def stage_for(days_since_last: int) -> str:
    if days_since_last <= config.ACTIVE_DAYS:
        return "Active"
    if days_since_last <= config.COOLING_DAYS:
        return "Cooling"
    return "Dormant"


def build_profiles(participants: pd.DataFrame, activities: pd.DataFrame,
                   as_of: pd.Timestamp | None = None) -> pd.DataFrame:
    as_of = as_of or pd.Timestamp.today().normalize()
    rows = []
    for pid, acts in activities.groupby("participant_id"):
        courses = acts.loc[acts["activity_type"] == "course", "name"].tolist()
        last = acts["date"].max()
        days = (as_of - last).days
        rows.append({
            "participant_id": pid,
            "courses_taken": courses,
            "num_courses": len(courses),
            "num_events": int((acts["activity_type"] == "event").sum()),
            "num_seva": int((acts["activity_type"] == "seva").sum()),
            "first_date": acts["date"].min(),
            "last_contact": last,
            "last_activity": acts.iloc[-1]["name"],
            "days_since_last": days,
            "stage": stage_for(days),
        })
    profiles = pd.DataFrame(rows)
    return participants.merge(profiles, on="participant_id", how="left")
