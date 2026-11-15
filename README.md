# journey-compass
Personalized follow-up for every participant: journey mapping, next-step recommendation, and AI-written outreach with channel suggestions. Built for the Art of Living Hack4Good hackathon (Topic 1: keep SKY participants connected).

**Live demo:** https://aol-journey.vercel.app (participants) · https://aol-journey.vercel.app/coordinator (coordinators). Demo logins are shared privately with the judges.

| | What it does |
|---|---|
| **Participant site** | Your journey as a game board, AI-picked next steps with one-click enroll, daily Gurudev wisdom, the global community map, ways to stay connected |
| **Coordinator site** | Who needs outreach, new requests, drafted messages with the suggested channel, one-tap outcomes, and a model-insights page per person |
| **Engine** | Learned journey stage + drift date, recommender with hard rules and a fit score, LLM chooser and message writer, nightly run that learns from outcomes |

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
 messaging.py    → personalized draft written by an LLM (Groq or local Ollama; template fallback)
        │
        ▼
 supabase_sync.py → writes journeys, recommendations, drafts to Supabase (nightly GitHub Action)
        │
        ▼
 web/ → participant site + /coordinator (React, reads Supabase with row-level security)
        │
        ▼
 outcomes recorded by coordinators → learning.py updates stage × offer acceptance rates
```
`app/streamlit_app.py` is the earlier local dashboard, kept for exploring the engine offline.

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

## LLM reasoning and messages (step 3, optional)
Without an LLM everything runs on the engine and templates. With one (`JC_LLM_PROVIDER=groq` for
the hosted free tier, `ollama` for a local model; see `.env.example`):

- **Chooser** (`chooser.py`) reads volunteer notes and recent contact summaries and picks one offer
  from a shortlist the hard rules already approved (engine top 5 + best 3 of each kind). It returns
  a reason for the coordinator and a participant-safe angle. Invalid or failed answers keep the
  engine's pick; the engine's pick is always kept in `engine_*` columns.
- **Writer** (`messaging.py`) never sees notes. Every draft is checked (echoed notes, "you
  mentioned", length, subject line, placeholders, language, invented months, greeting by name),
  retried once, then falls back to a template.
- **Privacy:** notes go to a hosted model only for synthetic data; for real people, local only
  unless the organisation approves (`JC_LLM_NOTES=1`).
- **Answer key:** `python -m journey_compass.llm_eval` checks the 10 people we know (currently 9/10
  picks, 10/10 messages; Daniel gets seva instead of the 40-day app challenge he asked about).

```bash
PYTHONPATH=src python -m journey_compass.pipeline --messages   # all 180 people, cached in outputs/
PYTHONPATH=src python -m journey_compass.web_export            # website uses the AI pick + angle
```

## Website (web/)
React 18 + TypeScript + Vite, deployed on Vercel (root directory `web`, auto-deploys `main`).
It reads and writes Supabase directly with the publishable key; row-level security decides what
each person can see (see `supabase/README.md`).

**Participant view** (`/`)
- Sign in with email + password, or an emailed sign-in link (needs Supabase redirect URLs + SMTP set up).
- **Journey board:** past courses and gatherings as squares on a path, a walker at "you are here",
  then booked and suggested steps. A booked step shows *Requested* (dotted neon line) until the
  coordinator accepts it, then *Confirmed* (solid green line); it is only crossed off once attended.
- **Next steps:** the engine's top 3, each with a reason. Enroll writes an `interests` row
  (`requested`); cancelling sets it to `cancelled`. Calendar (.ics) download.
- **Community map:** MapLibre globe (NASA Blue Marble imagery, OpenStreetMap streets, world-city
  lights) with where the community is.
- **Wisdom:** verbatim Gurudev quotes from his official site; background music player
  (public-domain classical + Rishab Rikhiram Sharma sitar pieces used with the artist's permission).
- **Stay connected:** official Art of Living channels, WhatsApp group request, daily-message
  opt-in (demo only: nothing is sent yet).

**Coordinator view** (`/coordinator`, staff only)
- Greeting banner with tiles: needs outreach, new requests, drifting soon, AI-picked steps.
- Search plus filters (stage, predicted drift, top next step, picked by AI or engine, suggested channel); one card per person with their next steps,
  why, a drafted message, contact buttons and outcome chips. Accepting a request marks the
  booking *booked*, which the participant sees as Confirmed.
- **Visualize:** per-person model insights (stage drivers, signals vs the group, timeline) and an
  explorer bubble chart comparing everyone they cover, with axis/size pickers, square-root
  spread, table view and expand to full window.

Both views refresh every 10 seconds and when the tab regains focus, so a booking or an accepted
request shows up on the other side without reloading.

```bash
cd web && npm ci
echo "VITE_SUPABASE_ANON_KEY=<publishable key>" > .env.local   # never the service_role key
npm run dev                                                     # http://127.0.0.1:5173
npm run build
```

## Tests
```bash
cd web && npm test                                   # website: 71 tests (Vitest + Testing Library), Supabase mocked
cd supabase/tests && npm ci && node run.mjs          # database access rules: ends with ALL RLS CHECKS PASSED
PYTHONPATH=src pytest                                # engine (2 chooser tests need the local data/catalogue/programmes.csv)
```
Website tests cover bookings (requested → confirmed, cancel, undo on error, 10-second sync), the journey
board order, next steps and the enroll dialog, sign-in, coordinator filters and summary tiles, the
model-insights maths, phone formatting, map distances, and that every music file and quote source
is in place. `.github/workflows/tests.yml` runs the website and RLS tests on every pull request.

## Project structure
```
web/                        participant + coordinator website (React/TS/Vite, Vercel)
  src/components/           UI: journey board, next steps, globe, coordinator, insights
  src/lib/                  Supabase client, auth, data loading, enrollments, music
  public/                   music, world-cities.geojson, images
supabase/migrations/        schema, row-level security, views (next_steps, coordinator_people)
supabase/tests/             RLS checks (PGlite)
.github/workflows/engine-nightly.yml   nightly engine run → Supabase (07:00 UTC)
app/streamlit_app.py        earlier local Streamlit dashboard
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
  messaging.py              LLM message drafting (with leak checks)
  chooser.py                LLM pick from the approved shortlist, using volunteer notes
  llm.py                    LLM provider wrapper (none / groq / ollama)
  learning.py               outcomes → updated stage × offer acceptance rates
  supabase_sync.py          reads Supabase, runs the engine, writes results back
  web_export.py             JSON export for the site's offline fallback
  pipeline.py               runs everything end to end
scripts/make_sample_data.py   generates the small SYNTHETIC sample set
scripts/import_synthetic.py   converts src/data/participants.json into the CSV schema
scripts/build_catalogue.py    builds data/catalogue/programmes.csv from "Mock data/" (local)
data/synthetic/               180-person SYNTHETIC cohort (default dataset, committed)
                              participants/activities/contacts.csv, generated from src/data/participants.json
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
cp .env.example .env              # optional: JC_LLM_PROVIDER=groq + GROQ_API_KEY (templates are used without it)

python scripts/import_synthetic.py   # only needed if src/data/participants.json changes
PYTHONPATH=src python -m journey_compass.train   # only needed if features or the cohort change
python scripts/build_catalogue.py   # needs the organisers' "Mock data/" folder; without it only standing offers are used
PYTHONPATH=src python -m journey_compass.pipeline
# Pick a dataset with JC_DATASET=synthetic (default) | sample | raw
# The synthetic cohort is pinned to 2026-11-14; override the clock with JC_AS_OF=YYYY-MM-DD
streamlit run app/streamlit_app.py
pytest
```
