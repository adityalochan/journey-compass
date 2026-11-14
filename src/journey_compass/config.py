"""Central settings: paths, thresholds, and the program catalog. Tune here, not in logic."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data" / "sample"   # switch to data/raw once the real data arrives
OUTPUT_DIR = ROOT / "outputs"

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
