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
CATALOGUE_DIR = ROOT / "data" / "catalogue"

# "Today" for every day count. The synthetic cohort was generated against a fixed clock,
# so pin it there to keep results stable; other datasets use the real date.
# Override with JC_AS_OF=YYYY-MM-DD.
PINNED_AS_OF = {"synthetic": "2026-11-14"}
AS_OF = os.getenv("JC_AS_OF") or PINNED_AS_OF.get(DATASET)

# The synthetic cohort as generated (JSON). The website reads it directly; for the engine,
# scripts/import_synthetic.py turns it into data/synthetic/*.csv. Its archetype labels are the
# stage model's answer key and are never an engine input.
COHORT_FILE = ROOT / "src" / "data" / "participants.json"
# What the participant website shows (stage + next steps), written by web_export.py. Git-ignored:
# it holds real programme names and dates from the organisers' data.
WEB_EXPORT_FILE = ROOT / "src" / "data" / "engine_output.json"

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
# Courses
# ---------------------------------------------------------------------------------------------
# Usual progression; the first one a person hasn't done is "next on their path".
COURSE_PATH = ["sky", "sahaj", "part2", "dsn"]
# Course name -> short key, for datasets whose activities carry no `subtype`.
COURSE_KEYS = {
    "Art of Living Part 1 (SKY)": "sky",
    "Sahaj Samadhi Meditation": "sahaj",
    "Art of Living Part 2 (Silence Retreat)": "part2",
    "Silence Retreat": "silence",
    "Advanced Meditation (DSN)": "dsn",
    "YES! for Youth": "yes",
}
COURSE_LABELS = {"sky": "SKY", "sahaj": "Sahaj Samadhi", "part2": "Part 2", "silence": "the Silence Retreat",
                 "dsn": "DSN", "yes": "YES!", "blessing": "the Blessing Course", "vtp": "Volunteer Training"}
DEEP_COURSES = {"sahaj", "part2", "silence", "dsn"}   # anything beyond the first course
# A prerequisite is also met by these (YES! is the youth version of SKY).
COURSE_EQUIVALENTS = {"sky": ["yes"]}

# ---------------------------------------------------------------------------------------------
# Recommendations: hard rules
# ---------------------------------------------------------------------------------------------
OFFER_HORIZON_DAYS = 120     # dated offers must start within this many days
# Cities that count as "local" to each other.
METROS = {
    "Greater Toronto": ["Toronto", "Mississauga", "Brampton", "Scarborough", "Markham"],
    "Greater Vancouver": ["Vancouver", "Surrey", "Burnaby"],
    "Greater Montreal": ["Montreal", "Laval"],
}

# ---------------------------------------------------------------------------------------------
# Recommendations: fit score
# ---------------------------------------------------------------------------------------------
# Starting belief: how often someone in each stage takes up each kind of offer (0..1).
# Step 4's feedback loop updates these from real accepts / declines.
ACCEPTANCE_PRIOR = {
    "New":      {"course": 0.20, "retreat": 0.05, "seva": 0.10, "event": 0.35, "reconnect": 0.15},
    "Active":   {"course": 0.25, "retreat": 0.18, "seva": 0.28, "event": 0.30, "reconnect": 0.05},
    "Slipping": {"course": 0.10, "retreat": 0.08, "seva": 0.15, "event": 0.22, "reconnect": 0.18},
    "Drifting": {"course": 0.05, "retreat": 0.05, "seva": 0.06, "event": 0.14, "reconnect": 0.22},
    "Dormant":  {"course": 0.02, "retreat": 0.02, "seva": 0.03, "event": 0.08, "reconnect": 0.20},
}
# Each part of the fit score is 0..1; the score is their weighted sum.
FIT_WEIGHTS = {
    "stage_fit": 2.5,     # how often people in this stage take up this kind of offer
    "commitment": 1.5,    # size of the ask matches their momentum (engagement score)
    "interest": 1.2,      # tags match their skills or interests (stated, or from what they attend)
    "progression": 1.0,   # the natural next course on their path
    "logistics": 0.8,     # starts soon, close by
}
TOP_K = 3
SAME_TYPE_PENALTY = 1.2   # subtracted from an offer whose type is already in the top 3

LLM_MODEL = "claude-opus-5-5"   # used by messaging.py until step 3b replaces it

# ---------------------------------------------------------------------------------------------
# LLM (step 3): optional; the engine runs fully without it
# ---------------------------------------------------------------------------------------------
# Provider, set in .env as JC_LLM_PROVIDER:
#   none   - no LLM: engine picks and template messages (default)
#   groq   - hosted open models, free tier, rate-limited (key: GROQ_API_KEY in .env). For the demo.
#   ollama - a model on this machine; nothing leaves the laptop. For private development.
# Read at call time (llm.py), so changing .env needs no code change.
LLM_PROVIDERS = {
    "groq": {"url": "https://api.groq.com/openai/v1/chat/completions", "model": "openai/gpt-oss-120b",
             "key_env": "GROQ_API_KEY", "requests_per_minute": 25, "local": False},
    "ollama": {"url": "http://localhost:11434/v1/chat/completions", "model": "gemma2:9b",
               "key_env": None, "requests_per_minute": 0, "local": True},
}
LLM_CACHE_FILE = OUTPUT_DIR / "llm_cache.json"
LLM_TIMEOUT_SECONDS = 300
LLM_RETRIES = 3
# Volunteer notes go to a hosted provider only for synthetic data. For anyone real they go to a
# local provider only, unless the organisation approves (JC_LLM_NOTES=1).
NOTES_TO_HOSTED_LLM_DATASETS = {"synthetic"}

SHORTLIST_TOP_N = 5          # the chooser sees the engine's top 5 ...
SHORTLIST_PER_KIND = 3       # ... plus the best 3 allowed offers of each kind, so a wish in the
                             # notes (e.g. a couples retreat) can be met even if it scores low
