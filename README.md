# journey-compass
Personalized follow-up for every participant: journey mapping, next-step recommendation, and AI-written outreach with channel suggestions. Built for the Art of Living hackathon.

## The problem
After SKY, follow-up treats everyone as one group, so people quietly drift away. Journey Compass looks at each participant's history and suggests **one fitting next step**: a follow-on course, a retreat, a seva role, or re-engagement. It drafts a personal message and suggests the channel to send it on.

## How it works
```
participants.csv + activities.csv
        │
        ▼
 journey.py      → one profile per person + engagement score, trend, drift date
 stage_model.py  → learned stage: New / Active / Slipping / Drifting / Dormant (+ why)
        │
        ▼
 recommender.py  → next step + human-readable reason (rule-based)
        │
        ▼
 channel.py      → WhatsApp / Email / SMS / volunteer phone call
        │
        ▼
 messaging.py    → personalized draft written by Claude (template fallback)
        │
        ▼
 app/streamlit_app.py → coordinator dashboard
```

## Journey stages (step 1)
Every touchpoint adds points that fade with a half-life (a course: 10 pts, halving every 180 days;
a satsang: 3 pts every 60 days; a message they sent: 4 pts every 45 days). The total becomes a
0–100 **engagement score**, with a 60-day **trend** and a projected **drift date**. Weights live in
`config.py`.

The **stage** comes from a small logistic-regression classifier trained on the synthetic cohort's
hidden labels (never an input). Each person gets their stage, its probability and the three facts
that pushed hardest towards it. `journey_stage` has five stages; `stage` keeps the dashboard's three
(New/Active → Active, Slipping/Drifting → Cooling, Dormant → Dormant).

| Stage method (180 synthetic people) | Accuracy |
|---|---|
| Score cut-offs (rule baseline, cut-offs read off this same data) | 86% |
| Learned, behaviour only (works on any dataset) | 91% (5-fold cross-validated) |
| Learned, + contact log + app/email/video signals | 91% (5-fold cross-validated) |

Number of courses, number of retreats and invitations received are kept out of the stage model on
purpose: in the synthetic data they predict the stage only because of how the generator built each
archetype (with them the full model scored 95%, for the wrong reasons).

The labels came from the same recipe that generated the data, so these numbers are optimistic
for real people.

## Project structure
```
app/streamlit_app.py        Streamlit dashboard
src/journey_compass/
  config.py                 paths, thresholds, course path, model
  data_loader.py            load CSVs (adapt here for the real data)
  features.py               decaying engagement score, trend, drift date, model inputs
  models.py                 small numpy logistic-regression model, saved as JSON
  stage_model.py            learned 5-stage classifier (+ rule fallback), with reasons
  train.py                  trains the stage model on the synthetic cohort
  journey.py                one profile row per person, with both stage columns
  recommender.py            next-step rules
  channel.py                channel suggestion
  messaging.py              LLM message drafting
  pipeline.py               runs everything end to end
scripts/make_sample_data.py   generates the small SYNTHETIC sample set
scripts/import_synthetic.py   converts data/synthetic/cohort.json into the CSV schema
data/synthetic/               180-person SYNTHETIC cohort (default dataset, committed)
  cohort.json                   source; participants/activities/contacts.csv are generated from it
data/sample/                  small SYNTHETIC set (committed)
data/raw/                     real hackathon data (git-ignored)
models/stage_model.json       trained stage model (committed, so the demo works without training)
Mock data/                    organisers' mock exports: kept local, git-ignored
docs/archive/                 earlier PRD, kept for reference only
notebooks/                  exploration
tests/                      pytest tests
outputs/                    generated results (git-ignored)
```

## Quickstart
```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env              # add ANTHROPIC_API_KEY (optional; templates are used without it)

python scripts/import_synthetic.py   # only needed if cohort.json changes
PYTHONPATH=src python -m journey_compass.train   # only needed if features or the cohort change
PYTHONPATH=src python -m journey_compass.pipeline
# Pick a dataset with JC_DATASET=synthetic (default) | sample | raw
# The synthetic cohort is pinned to 2026-11-14; override the clock with JC_AS_OF=YYYY-MM-DD
streamlit run app/streamlit_app.py
pytest
```
