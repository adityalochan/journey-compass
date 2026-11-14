"""Load raw data. When the organizers' data arrives, adapt column mapping here only."""
import pandas as pd

from . import config


def load_participants(path=config.PARTICIPANTS_FILE) -> pd.DataFrame:
    return pd.read_csv(path)


def load_activities(path=config.ACTIVITIES_FILE) -> pd.DataFrame:
    df = pd.read_csv(path, parse_dates=["date"])
    return df.sort_values(["participant_id", "date"])
