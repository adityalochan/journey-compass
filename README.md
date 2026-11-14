# journey-compass
Personalized follow-up for every participant: journey mapping, next-step recommendation, and AI-written outreach with channel suggestions. Built for the Art of Living hackathon.

## The problem
After SKY, follow-up treats everyone as one group, so people quietly drift away. Journey Compass looks at each participant's history and suggests **one fitting next step**: a follow-on course, a retreat, a seva role, or re-engagement. It drafts a personal message and suggests the channel to send it on.

## How it works
```
participants.csv + activities.csv
        │
        ▼
 journey.py      → one profile per person (courses, events, seva, last contact, stage)
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

## Project structure
```
app/streamlit_app.py        Streamlit dashboard
src/journey_compass/
  config.py                 paths, thresholds, course path, model
  data_loader.py            load CSVs (adapt here for the real data)
  journey.py                journey mapping + stage (Active / Cooling / Dormant)
  recommender.py            next-step rules
  channel.py                channel suggestion
  messaging.py              LLM message drafting
  pipeline.py               runs everything end to end
scripts/make_sample_data.py generates SYNTHETIC sample data
data/sample/                synthetic data (committed)
data/raw/                   real hackathon data (git-ignored)
notebooks/                  exploration
tests/                      pytest tests
outputs/                    generated results (git-ignored)
```

## Quickstart
```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env              # add ANTHROPIC_API_KEY (optional; templates are used without it)

python scripts/make_sample_data.py
PYTHONPATH=src python -m journey_compass.pipeline
streamlit run app/streamlit_app.py
pytest
```
