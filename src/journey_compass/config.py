"""Central settings: paths, thresholds, and the program catalog. Tune here, not in logic."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# Which folder under data/ to run on:
#   synthetic - 180-person cohort with contacts, signals and consent flags (default)
#   sample    - small generated set from scripts/make_sample_data.py
#   raw       - the organisers' data, once it arrives (git-ignored)
DATASET = os.getenv("JC_DATASET", "synthetic")
DATA_DIR = ROOT / "data" / DATASET
OUTPUT_DIR = ROOT / "outputs"

# "Today" for every day count. The synthetic cohort was generated against a fixed clock,
# so pin it there to keep results stable; other datasets use the real date.
# Override with JC_AS_OF=YYYY-MM-DD.
AS_OF = os.getenv("JC_AS_OF") or ("2026-11-14" if DATASET == "synthetic" else None)

PARTICIPANTS_FILE = DATA_DIR / "participants.csv"
ACTIVITIES_FILE = DATA_DIR / "activities.csv"

# Journey stages by days since last contact
ACTIVE_DAYS = 30
COOLING_DAYS = 90      # 31-90 days -> cooling; above -> dormant

# Next-step rules
SEVA_MIN_EVENTS = 5    # events attended before suggesting a seva role
RETREAT_MIN_COURSES = 2

# Rough progression of programs; follow-on course = first one not yet taken
COURSE_PATH = [
    "Art of Living Part 1 (SKY)",
    "Sahaj Samadhi Meditation",
    "Art of Living Part 2 (Silence Retreat)",
    "Advanced Meditation (DSN)",
]

LLM_MODEL = "claude-opus-5-5"
