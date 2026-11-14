"""The offer catalogue: everything the engine is allowed to recommend.

Two files under data/catalogue/:
  standing_offers.csv  always available, committed: seva roles, reconnect options, recurring
                       events at "your local centre" (blank city) or online.
  programmes.csv       real upcoming programmes from the organisers' exports (git-ignored, built
                       locally by scripts/build_catalogue.py). Without it, only standing offers
                       are used.

Columns (blank means "no restriction"):
  offer_type     course | retreat | seva | event | reconnect
  commitment     size of the ask, 1 (drop-in) .. 5 (teacher training)
  start_date     blank = always available
  city           blank = the person's local centre; "Online" = anywhere
  languages      e.g. "fr;en"; blank = any
  tags           matched against interests and skills
  prerequisites  course keys the person must have done
  audience       newcomers | youth | children | corporate; blank = everyone
  start_time     local "HH:MM" of the first session, when the source records it
  duration_min   length of that session in minutes, when known
"""
import pandas as pd

from . import config

COLUMNS = ["offer_id", "offer_type", "name", "program_key", "commitment", "start_date", "end_date",
           "start_time", "duration_min", "city", "venue", "languages", "tags", "prerequisites", "audience",
           "description", "source"]
OFFER_TYPES = ["course", "retreat", "seva", "event", "reconnect"]


def load_catalogue() -> pd.DataFrame:
    frames = [pd.read_csv(config.CATALOGUE_DIR / "standing_offers.csv", dtype=str)]
    programmes = config.CATALOGUE_DIR / "programmes.csv"
    if programmes.exists():
        frames.append(pd.read_csv(programmes, dtype=str))
    cat = pd.concat(frames, ignore_index=True)
    for col in COLUMNS:
        if col not in cat:
            cat[col] = ""
    cat = cat[COLUMNS].fillna("")
    cat["commitment"] = pd.to_numeric(cat["commitment"], errors="coerce").fillna(2).astype(int)
    cat["start_date"] = pd.to_datetime(cat["start_date"].replace("", None), errors="coerce")
    cat["end_date"] = pd.to_datetime(cat["end_date"].replace("", None), errors="coerce")
    return cat.drop_duplicates("offer_id").reset_index(drop=True)
