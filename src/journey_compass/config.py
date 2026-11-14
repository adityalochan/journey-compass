"""Central settings: paths, thresholds, engagement weights and the program catalog. Tune here, not in logic."""
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
MODEL_DIR = ROOT / "models"

# "Today" for every day count. The synthetic cohort was generated against a fixed clock,
# so pin it there to keep results stable; other datasets use the real date.
# Override with JC_AS_OF=YYYY-MM-DD.
PINNED_AS_OF = {"synthetic": "2026-11-14"}
AS_OF = os.getenv("JC_AS_OF") or PINNED_AS_OF.get(DATASET)

PARTICIPANTS_FILE = DATA_DIR / "participants.csv"
ACTIVITIES_FILE = DATA_DIR / "activities.csv"
CONTACTS_FILE = DATA_DIR / "contacts.csv"

# ---------------------------------------------------------------------------------------------
# Journey stages
# ---------------------------------------------------------------------------------------------
STAGES = ["New", "Active", "Slipping", "Drifting", "Dormant"]
# Aditya's dashboard shows three stages; every five-stage label maps onto one of them.
SIMPLE_STAGE = {"New": "Active", "Active": "Active", "Slipping": "Cooling",
                "Drifting": "Cooling", "Dormant": "Dormant"}
# Synthetic generator labels -> stages. Used ONLY to train and evaluate, never as an input.
ARCHETYPE_TO_STAGE = {"new": "New", "practicing": "Active", "slipping": "Slipping",
                      "drifting": "Drifting", "dormant": "Dormant"}
STAGE_MODEL_FILE = MODEL_DIR / "stage_model.json"

# ---------------------------------------------------------------------------------------------
# Engagement score: every touchpoint adds points that fade with a half-life (in days).
# ---------------------------------------------------------------------------------------------
TOUCHPOINT_POINTS = {        # kind: (points, half-life in days)
    "course": (10.0, 180),
    "retreat": (8.0, 150),
    "seva": (5.0, 120),
    "event": (3.0, 60),
    "contact_in": (4.0, 45),   # a message *they* sent us
    "contact_out": (0.5, 30),  # a message we sent; weak, it says little about them
}
# Digital signals cover the last 30 days and have no history, so they count as recent points.
SIGNAL_POINTS = {"app_opens_30d": 0.5, "email_opens_30d": 0.3,
                 "whatsapp_replies_30d": 1.0, "video_minutes_30d": 0.05}
SIGNAL_HALF_LIFE = 30
# Raw points -> 0..100 via 100 * (1 - exp(-points / scale)). 25 puts a typical dormant person
# around 10 and a typical active one around 75, so the scale isn't squeezed against 100.
ENGAGEMENT_SCALE = 25.0
TREND_WINDOW_DAYS = 60       # trend = score now minus score this many days ago
DRIFT_THRESHOLD = 20         # below this score counts as drifted; used for the drift date
NEW_WINDOW_DAYS = 40         # the "40-day" window after a first course

# ---------------------------------------------------------------------------------------------
# Next-step rules (rule-based recommender; replaced in a later step)
# ---------------------------------------------------------------------------------------------
SEVA_MIN_EVENTS = 5    # events attended before suggesting a seva role
RETREAT_MIN_COURSES = 2

# Rough progression of programs; follow-on course = first one not yet taken
COURSE_PATH = [
    "Art of Living Part 1 (SKY)",
    "Sahaj Samadhi Meditation",
    "Art of Living Part 2 (Silence Retreat)",
    "Advanced Meditation (DSN)",
]
# Course name -> short key, for datasets whose activities carry no `subtype`.
COURSE_KEYS = {
    "Art of Living Part 1 (SKY)": "sky",
    "Sahaj Samadhi Meditation": "sahaj",
    "Art of Living Part 2 (Silence Retreat)": "part2",
    "Silence Retreat": "silence",
    "Advanced Meditation (DSN)": "dsn",
    "YES! for Youth": "yes",
}
DEEP_COURSES = {"sahaj", "part2", "silence", "dsn"}   # anything beyond the first course

LLM_MODEL = "claude-opus-5-5"
