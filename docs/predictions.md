# Journey Compass – where the predictions happen

Tarun Joseph & Aditya Sharma · Hack4Good 2026

Six predictions, but only **one trained ML model** (the stage classifier). The others are transparent formulas, an LLM and a Bayesian update: ML only where we had labels to learn from.

All run nightly in `src/journey_compass/` (via `supabase_sync.py`, started by the GitHub Action `engine-nightly.yml`).

> **One-liner for the demo:** "One small, explainable ML model for *where* each person is, a projection for *when* they'll drift, rules plus a score for *what* to offer, an LLM that reads the notes no formula can, and a Bayesian loop that learns from every outcome."

---

## 1. Engagement score (0–100) – formula, not ML
- **Code:** `features.py` → `_decayed_points()`, `to_engagement()`; weights in `config.py` → `TOUCHPOINT_POINTS`
- **How:** every touchpoint earns points that fade with a half-life; `score = 100 × (1 − e^(−points / 25))`

| Touchpoint | Points | Half-life |
|---|---|---|
| Course | 10 | 180 days |
| Retreat | 8 | 150 days |
| Seva | 5 | 120 days |
| Event | 3 | 60 days |
| Message *they* sent | 4 | 45 days |
| Message we sent | 0.5 | 30 days |

App opens, email opens, WhatsApp replies and video minutes add smaller points (30-day half-life).
- **Inputs:** dated activities, contact log, app/email/video signals
- **Output:** score 0–100, plus a 60-day trend (score now minus 60 days ago)
- **Show in demo:** Visualize page; "engagement score" in the explorer chart

## 2. Journey stage – the trained ML model
- **Code:** `stage_model.py` (train + predict); model in `models.py` → `SoftmaxModel`; trained weights in `models/stage_model.json`
- **Model:** multinomial logistic regression (softmax), plain NumPy, Adam optimiser, L2 regularisation chosen by 5-fold cross-validation (λ = 0.003). Small on purpose: 180 labelled people, and the weights stay readable.
- **Dependent variable (target):** stage, 5 classes: New / Active / Slipping / Drifting / Dormant (labels from the synthetic generator; never an input)
- **Independent variables (20, full variant; counts log-transformed):**
  - Behaviour (12): days since last activity; days since first course (capped at 180); within 40-day "new" window; engagement now; engagement 60 days ago; 60-day trend; has done a deeper course; events in last 90 days; events in last year; seva in last year; seva overall; touchpoints in last 90 days
  - Contact log (4): days since last contact; days since they last replied; replies in last 180 days; our unanswered messages
  - Signals (4): app opens, email opens, WhatsApp replies, video minutes (30 days)
  - Deliberately excluded: number of courses, number of retreats, invitations received (they only predicted stage because of how the synthetic generator was built)
- **Output:** stage, confidence (top probability), and the 3 inputs that pushed hardest ("Why the model predicts…")
- **Accuracy:** 91.1% cross-validated (20 inputs); 90.6% behaviour-only (12 inputs, used when a dataset lacks contacts/signals); rule baseline 85.6%. Measured on 180 synthetic people, so optimistic for real data.
- **Show in demo:** stage badge on coordinator cards; "Why the model predicts" and stage confidence on Visualize

## 3. Predicted drift date – forward projection
- **Code:** `features.py` → `_days_to_drift()`
- **How:** projects today's points forward day by day (each fading at its half-life), assuming nothing new happens; the first day the score drops below **20** is the drift date (looks up to 2 years ahead)
- **Inputs:** current points per touchpoint kind and signal points
- **Output:** days until drift → drift date
- **Show in demo:** "DRIFTS IN 65 DAYS" on a card, the **Drifting soon** tile (within 14 days), the drift filter

## 4. Next-step ranking – rules + weighted score
- **Code:** `recommender.py` → `eligibility()` (hard rules), `score()` (fit), `recommend_top()` (top 3); weights in `config.FIT_WEIGHTS`
- **Hard rules (never bend):** do-not-contact, prerequisites, no repeated course, audience, language, location, timing
- **Fit score** = 2.5 × stage fit + 1.5 × commitment + 1.2 × interest + 1.0 × progression + 0.8 × logistics (each 0–1)
  - stage fit: learned acceptance rate for this stage and kind of offer
  - commitment: size of the ask vs momentum (engagement score)
  - interest: tags vs their skills, interests, what they attend
  - progression: natural next course on their path
  - logistics: starts soon, close by
- **Inputs:** person's profile and stage + the offer catalogue
- **Output:** a varied top 3 (different kinds of step), each with a reason
- **Show in demo:** the 3 next steps and "Why" on each card; participant's Next steps

## 5. AI chooser + message writer – LLM
- **Code:** `chooser.py` (pick), `messaging.py` (draft), `llm.py` (provider); `config.LLM_PROVIDERS`
- **Model:** **GPT-OSS-120B** (OpenAI open-weight) on **Groq**; local option Gemma 2 9B via Ollama (nothing leaves the laptop)
- **Chooser:** input = person facts + volunteer notes + recent contact summaries + a rule-approved shortlist (engine top 5 + best 3 of each kind); output = one offer ID, a reason for the coordinator, an angle for the message. Anything not on the shortlist → the engine's pick stands.
- **Writer:** never sees notes; drafts checked for leaked notes, invented dates, length, language; retried once, then a template
- **Answer key:** 9/10 picks, 10/10 messages (`llm_eval.py`)
- **Show in demo:** "(AI, from notes)" after the reason, the **AI-picked steps** tile, the drafted message

## 6. Learning loop – Bayesian update (beta-binomial)
- **Code:** `learning.py` → `learned_rates()`; starting rates in `config.ACCEPTANCE_PRIOR`
- **How:** `rate = (prior × 20 + successes) / (20 + outcomes)`; the prior counts as 20 imagined outcomes. Accepted / attended = success; declined / no reply = failure.
- **Inputs:** outcomes recorded by coordinators, per (stage, kind of offer)
- **Output:** updated acceptance rates → feed **stage fit** in #4 on the next night's run
- **Show in demo:** the **Outcome** row on each card ("this is what the engine learns from")

---

**Not a prediction:** suggested channel (`channel.py`) is a rule: stated preference always wins; quiet for over 180 days → volunteer phone call; otherwise WhatsApp / email / SMS by opt-in.
