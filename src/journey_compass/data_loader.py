"""Load a dataset into one canonical shape. When new data arrives, adapt the mapping here only.

A dataset folder holds:
  participants.csv  required. The first six columns are the original sample schema; anything
                    after them (consent, language, signals, interests, notes) is optional.
  activities.csv    required. participant_id, date, activity_type, name [, subtype, city]
  contacts.csv      optional outreach / reply log: participant_id, at, channel, direction, summary

`Dataset.sources` records which optional inputs are present. The stage model uses it to pick the
variant it can actually feed, so a dataset without a contact log still works.
"""
import os
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd

from . import config

SIGNAL_COLUMNS = list(config.SIGNAL_POINTS)


@dataclass
class Dataset:
    participants: pd.DataFrame
    activities: pd.DataFrame
    contacts: pd.DataFrame
    as_of: pd.Timestamp
    name: str = ""
    sources: set = field(default_factory=set)   # subset of {"contacts", "signals"}


def _bool(series: pd.Series) -> pd.Series:
    # Explicit mapping: a missing value from pandas is NaN, and bool(NaN) is True.
    return series.map(lambda v: v is True or v == 1 or str(v).strip().lower() in {"true", "1", "yes"})


def activity_kind(activity_type: str, subtype: str) -> str:
    """course | retreat | seva | event: the four kinds of touchpoint the score counts."""
    if activity_type in ("course", "seva", "retreat"):
        return activity_type
    return "retreat" if subtype == "retreat" else "event"


def prepare_activities(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"]).dt.normalize()
    for col in ("subtype", "city"):
        if col not in df:
            df[col] = ""
        df[col] = df[col].fillna("").astype(str)
    df["kind"] = [activity_kind(t, s) for t, s in zip(df["activity_type"], df["subtype"])]
    # Short course key: the synthetic data carries it in `subtype`; older data only has the name.
    key = df["subtype"].where(df["subtype"] != "", df["name"].map(config.COURSE_KEYS).fillna(""))
    df["course_key"] = key.where(df["kind"] == "course", "")
    return df.sort_values(["participant_id", "date"], kind="stable").reset_index(drop=True)


def prepare_contacts(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame(columns=["participant_id", "date", "channel", "direction", "summary"])
    df = df.copy()
    df["date"] = pd.to_datetime(df["at"], utc=True).dt.tz_localize(None).dt.normalize()
    return df.sort_values(["participant_id", "date"], kind="stable").reset_index(drop=True)


def prepare_participants(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    for col in ("email_opt_in", "whatsapp_opt_in", "do_not_contact"):
        if col in df:
            df[col] = _bool(df[col])
    for col in SIGNAL_COLUMNS + ["invites"]:
        if col in df:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    return df


def load_dataset(data_dir: Path | None = None, as_of: str | None = None) -> Dataset:
    data_dir = Path(data_dir or config.DATA_DIR)
    participants = prepare_participants(pd.read_csv(data_dir / "participants.csv"))
    activities = prepare_activities(pd.read_csv(data_dir / "activities.csv"))
    contacts_path = data_dir / "contacts.csv"
    contacts = prepare_contacts(pd.read_csv(contacts_path) if contacts_path.exists() else pd.DataFrame())

    as_of = as_of or os.getenv("JC_AS_OF") or config.PINNED_AS_OF.get(data_dir.name)
    as_of = pd.Timestamp(as_of) if as_of else pd.Timestamp.today().normalize()

    sources = set()
    if len(contacts):
        sources.add("contacts")
    if all(c in participants for c in SIGNAL_COLUMNS):
        sources.add("signals")
    return Dataset(participants, activities, contacts, as_of, name=data_dir.name, sources=sources)


# Original entry points, kept for existing callers.
def load_participants(path=config.PARTICIPANTS_FILE) -> pd.DataFrame:
    return prepare_participants(pd.read_csv(path))


def load_activities(path=config.ACTIVITIES_FILE) -> pd.DataFrame:
    return prepare_activities(pd.read_csv(path))
