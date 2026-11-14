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
 recommender.py  → hard rules → fit score → top 3 next steps, each with a reason
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

## Recommendations (step 2)
The catalogue has **standing offers** (`data/catalogue/standing_offers.csv`: seva roles, reconnect
options, recurring events, committed) and **real upcoming programmes** built from the organisers'
exports (`python scripts/build_catalogue.py` → `data/catalogue/programmes.csv`, local only).

For each person:
1. **Hard rules** remove what isn't allowed: do-not-contact, prerequisites, courses already done,
   audience (newcomer intros, youth, children, corporate), language, location (their metro area,
   online, or a residential retreat anywhere), and timing (starts within 120 days).
2. **Fit score**: five parts, each 0–1, weighted in `config.FIT_WEIGHTS`: stage fit (how often
   people in this stage take up this kind of offer; a starting table the step-4 feedback loop will
   learn), size of ask vs momentum, skills/interests, next course on their path, logistics.
3. **Top 3**, pushed towards different kinds of step, each with a reason built from the parts that
   mattered most. Rank 1 fills `next_action` / `next_item` / `reason`; ranks 2–3 are `rec_2_*`, `rec_3_*`.

On the synthetic cohort the most common first suggestion goes to 24% of people (the old rules gave
Sahaj Samadhi to about 70%).

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
  catalogue.py              loads standing offers + real upcoming programmes
  journey.py                one profile row per person, with both stage columns
  recommender.py            hard rules, fit score, top 3 with reasons
  channel.py                channel suggestion
  messaging.py              LLM message drafting
  pipeline.py               runs everything end to end
scripts/make_sample_data.py   generates the small SYNTHETIC sample set
scripts/import_synthetic.py   converts data/synthetic/cohort.json into the CSV schema
scripts/build_catalogue.py    builds data/catalogue/programmes.csv from "Mock data/" (local)
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
python scripts/build_catalogue.py   # needs the organisers' "Mock data/" folder; without it only standing offers are used
PYTHONPATH=src python -m journey_compass.pipeline
# Pick a dataset with JC_DATASET=synthetic (default) | sample | raw
# The synthetic cohort is pinned to 2026-11-14; override the clock with JC_AS_OF=YYYY-MM-DD
streamlit run app/streamlit_app.py
pytest
```
