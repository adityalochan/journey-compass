> **Archived reference.** This PRD was written for an earlier TypeScript prototype ("Continuity"). The scripts, file paths and numbers it cites no longer exist in this repo. It is kept for its product reasoning (stages, consent rules, channel table, honesty matrix), which the Python engine may adopt piece by piece. The source of truth is the code in `src/journey_compass/` and the README.

# PRD — Continuity

**A follow-up copilot for Art of Living Canada**

| | |
|---|---|
| **Version** | 2.0 — rewritten against verified engine output |
| **Date** | 14 November 2026 |
| **Event** | AOL Hack4Good, 14–15 Nov 2026 |
| **Team** | 2 builders — A: data, scoring, AI layer · B: product, UI, demo narrative |
| **Repository** | `tarunbjoseph/AOLHack4Good` |
| **Brief** | Topic 1 — *Help more people stay connected to the wisdom* |
| **Numbers** | Every figure in this document is produced by `npm run check`, `scripts/report.ts`, `scripts/figures.ts` or `scripts/simulate.ts`. None are hand-typed. |

**What changed from v1.0.** v1.0 claimed 37 people needed a touch, 11 were drifting within a fortnight, and Priya was 8 days from drifting. All three were invented. The engine says 17, 3 and 12. This version replaces every number with engine output, scopes the product to a teacher's caseload, adds consent, and removes a retention chart that could not be defended. The full disposition of every review finding is in `docs/REVIEW-LOG.md`.

---

## 1. One line

**Continuity tells a teacher who among their own students needs them this week, what to offer, and writes the first draft of the message — so follow-up stops being a broadcast and becomes a relationship.**

---

## 2. The problem

The transformation happens in the course. The *retention* happens in the ninety days after it. That window is where people are lost, and it is lost quietly:

- Follow-up is **one-to-many**. Everyone gets the same message regardless of whether they finished last week or two years ago.
- **Nobody is assigned a person.** There is no owner for "Priya, who came in March and has gone silent."
- Signals exist but are not read: course history, event attendance, last contact date, whether someone still opens anything.
- Volunteers spend their energy on **admin and guesswork** instead of on people.

The cost is not dramatic. It is the slow, silent version: someone who felt something real in March, and by November is a name in a spreadsheet that nobody opens.

> **The brief's own success line, verbatim:** *"follow-up feels personal rather than broadcast, and fewer people drift away after their first course."*

Everything here is judged against that sentence.

---

## 3. Why this topic, and not the other seven

| Topic | Why not (for this team, this day) |
|---|---|
| 2. Volunteer super-app | Three products in one day produces three half-products. |
| 3. Seva matching | Safest build, lowest demo voltage. Reads as a directory with filters. **Kept as fallback.** |
| 4. Knowledge Q&A | Commodity. Most of the room will build this. |
| 5. Finance automation | Real pain, back-office demo. No emotional voltage. |
| 6. Open problem | Highest ceiling, no named problem on day one. Too much risk. |
| 7. AI search / AEO | Success is non-deterministic and external. Cannot be proven live in one day. |
| 8. Sovereign assistant | Strong trust narrative, but a chat window with a local-model dependency. **Good second-place story.** |
| **1. Journey + next step** | **Chosen.** Emotional story, measurable outcome, deterministic core, AI load-bearing. |

The strategic bet: judges remember **one person**, not one dashboard. Topic 1 is the only brief that lets us put a named human on screen and change their outcome live.

---

## 4. Goals and how they are measured

### 4.1 Product goals

| # | Goal | Measured by | Target |
|---|---|---|---|
| G1 | At-risk people are contacted before they go quiet | % of slipping/drifting people touched within 7 days of entering the queue | ≥ 60% in a 30-day pilot |
| G2 | Follow-up feels personal | Coordinator rating, "would I send this as-is?" | ≥ 4/5 mean |
| G3 | Retention after the first course | 90-day retention of SKY cohorts vs. baseline | **Not claimed.** Measured, not projected — see §4.3 |
| G4 | Volunteer time returned | Minutes per personalized follow-up | 6 min → ≤ 45 sec |

### 4.2 Hackathon judging goals

| # | Goal | Evidence on stage |
|---|---|---|
| J1 | The problem is undeniable | Two named people with coherent histories, on screen |
| J2 | The AI is load-bearing | Recommendation reasons + a draft a judge would send |
| J3 | It works live | 3 consecutive clean runs, no dead ends, offline fallback |
| J4 | It respects the organisation | Caseload scoping, consent, no dark patterns, data stays local |

### 4.3 The one claim we refuse to make

The Impact screen does **not** display a retention projection. We built one and it failed its own test: with a 240-day recency window, a forward simulation always reports 0% connected at 90 days for anyone not contacted, which is a restatement of the formula, not evidence. It is kept in `src/engine/metrics.ts` as a documented negative result and reproduced by `scripts/simulate.ts`.

What Impact shows instead is summable and checkable: how many people in this caseload cross into a worse stage within 14 days, and how many follow-ups were actually logged. Retention lift is what the pilot measures.

### 4.4 What we are deliberately not optimising

- Number of features. A tight product that survives a bad demo laptop beats a broad one that does not.
- Visual novelty. This should look like a tool a teacher trusts, not a landing page.
- Model sophistication. With 180 records and no outcome labels, a transparent score is the honest choice (§9.6).

---

## 5. Who it is for

| Actor | Context | Job to be done |
|---|---|---|
| **Teacher / senior volunteer** (primary) | Between courses, on a laptop, 34 students, Monday morning | "Tell me who among *my* students needs me this week, and what to say." |
| **Centre coordinator** (secondary) | 8 teachers, 180 participants, needs oversight | "Is anyone falling through? Who is covering whom?" |
| **Participant** (beneficiary, not a user) | Busy, well-intentioned, drifting | "Don't spam me. Notice me once, specifically, at the right moment." |

**Anti-persona:** the marketing team who wants to send a campaign to 50,000 people. Continuity is deliberately the opposite of a broadcast tool and should refuse to become one.

**Why the caseload matters.** The cohort has 8 teachers with 14–34 students each. A tool that shows all 180 to one person recreates the exact problem the brief describes: no one is accountable, and the list is too big to act on. Continuity shows a teacher their own queue first, and the cohort only as an overview.

| Teacher | Students | Need a touch | Crossing within 14 days |
|---|---|---|---|
| Anita Rao | 34 | 17 | 3 |
| Ravi Menon | 29 | 15 | 2 |
| Linda Park | 23 | 10 | 1 |
| Sophie Gagnon | 23 | 9 | 1 |
| David Chen | 19 | 7 | 2 |
| Meera Iyer | 20 | 6 | 0 |
| Harpreet Gill | 15 | 5 | 0 |
| Fatima Noor | 14 | 7 | 0 |

---

## 6. Product principles

Each is a constraint on the build, checked at review.

1. **Explain before you recommend.** Every score and suggestion shows its evidence.
2. **A human sends it.** Continuity never auto-sends. It drafts; the teacher edits and decides.
3. **Dignity over conversion.** No guilt, no urgency theatre, no "they're waiting for you". Someone who has gone quiet is not a lead.
4. **Service is a valid outcome.** The system must be able to recommend *seva* or *a phone call* instead of a paid course. A recommender that only sells courses is a sales tool.
5. **Data stays where it belongs.** Participant data never leaves the machine in the default configuration. Notes are never sent to a model.
6. **Consent is state, not a note.** A contact preference or a do-not-contact flag is a first-class field that changes behaviour, not something buried in free text.
7. **Honest about what it is.** Synthetic data is labelled as such. Projections are labelled as projections. Nothing is rounded up.
8. **Reversible.** One click to log a follow-up; one click to reset the demo state.

---

## 7. Scope

### 7.1 In scope — P0 (must exist)

| Area | Included |
|---|---|
| Data | 180 synthetic participants across 6 provinces and 8 teachers; 10 hand-authored demo cases; consent fields |
| Journey model | 5 stages, 4 weighted signals, per-person explanation, drift-date projection with three states |
| Recommendations | 11 offers, top 3 with reasons, hard eligibility, "serve don't sell" penalties |
| Channel choice | WhatsApp / email / phone / in-person, with a stated reason per person, honouring stated preference |
| Drafting | Local template composer in EN and FR; a draft that quotes at most one fact from the record |
| AI layer | Local model (Ollama) and OpenAI paths; deterministic template always available |
| UI | Today, People, Person sheet, Impact |
| Actions | Edit draft, regenerate, mark sent, undo, local persistence |
| Demo assets | 3-minute script, seeded reset, recorded fallback video |

### 7.2 Out of scope — explicitly

| Excluded | Why |
|---|---|
| Real CRM / WhatsApp Business integration | No credentials, and a failed integration on stage is fatal |
| Authentication, roles, permissions | Single-teacher demo; a role system adds a screen and no story |
| Actually sending | Simulated send with an audit log, stated plainly on stage |
| Mobile layout below 1024px | Demo is a laptop; usable to 1280 only |
| Inbound reply handling / webhooks | No backend to receive them |
| Fine-tuning, embeddings, vector search | Not needed; the intelligence is rules plus structured context |
| Languages beyond EN/FR in draft text | Honest "English draft · translate" chip instead of bad machine translation |
| Production security / PII review | Synthetic data; the production path is documented, not built |

### 7.3 Deferred — P1 (only if ahead)

Tone variants · People stage filters · phone-call script · history timeline · CSV export of today's list · French UI chrome.

### 7.4 Hour budget — honest version

The event spans two days, but the plan targets **one**, because a plan that needs the second day has no buffer.

| Workstream | Hours | State |
|---|---|---|
| Data generator + schema + integrity tests | 3 | **Done** |
| Journey scoring + drift projection | 3 | **Done** |
| Recommendation + channel + consent | 3 | **Done** |
| Contract test suite | 1 | **Done** |
| Draft composer (EN/FR, template) | 2 | — |
| AI server + fallback | 1.5 | — |
| Today screen | 3 | — |
| Person sheet | 4 | — |
| Composer, send, undo, persistence | 2 | — |
| People screen | 1.5 | — |
| Impact screen (no chart) | 1 | — |
| Rehearsal, README, fallback video | 2.5 | — |
| **Total** | **27** | 13 done, **14 remaining** |

Against **20 committed person-hours** (2 × 10), 14 remaining leaves roughly 6 hours of slack — which is not slack, it is the distance between "works" and "survives a hostile question". The cut list in `BUILD-PLAN.md` §7 is applied the moment a block runs long, without debate.

---

## 8. Functional requirements

Each has a testable acceptance criterion. **P0** blocks the demo.

### 8.1 Journeys

**FR-01 — A journey for every participant** · P0
Stage, score, days since contact, drift date and four signal parts for every record.
*Accept:* 180/180 render with no `NaN` or `undefined`; `npm run check` §1 passes.

**FR-02 — Five stages with fixed thresholds** · P0
`new`, `practicing`, `slipping`, `drifting`, `dormant` by the formula in §9.2.
*Accept:* thresholds are constants in one file; distribution is New 24 / Practicing 52 / Slipping 46 / Drifting 31 / Dormant 27.

**FR-03 — Explain the stage** · P0
Each person shows what drives their stage, in plain language.
*Accept:* no score is shown without at least two contributing facts; `drivers` is never a generic sentence (verified for all 180).

**FR-04 — Project drift, with three honest states** · P0
Forward-simulate 200 days with no contact and report the first day the stage degrades.
*Accept:* `projection` is exactly one of `degrades` (with `daysToDrift` and `driftDate`), `stable` (no crossing in 200 days), or `dormant` (already gone, no date shown). Dormant people never display a fabricated date.
*Verified:* Priya `degrades` in 12 days → 2026-11-26; Wei `dormant`; no `stable` records currently exist in the cohort, and the UI must still render the state.

**FR-05 — Rank within a caseload** · P0
Queue ordered by severity tier, then nearest crossing. Healthy people are not in the queue; dormant people come last.
*Accept:* `npm run check` §8 and §9 pass — a slipping person always outranks a drifting one, a drifting one outranks a practicing one, dormant is last, and within a stage the nearest horizon is first.

**FR-06 — Scope to the person who taught them** · P0
The queue is the signed-in teacher's caseload; every draft is signed by that teacher, not a global coordinator.
*Accept:* Anita Rao's queue contains only her 34 students; Priya's draft is signed "Anita" because Anita taught her SKY.

### 8.2 Recommendations

**FR-07 — Top three next steps with reasons** · P0
Rank the 11 offers; show up to three, each with 2–4 evidence lines drawn from the record.
*Accept:* every reason cites a field that exists in that person's record; every person with a contactable record gets at least one recommendation.

**FR-08 — Hard eligibility** · P0
Never recommend a course already taken; never recommend the YES! circle outside Alberta; never recommend Vancouver yoga outside BC.
*Accept:* `npm run check` §6 confirms zero ineligible offers across 180 × 3.

**FR-09 — Serve, don't sell** · P0
People who are slipping, drifting or dormant are penalised on courses and favoured on seva, satsang and calls.
*Accept:* Priya (slipping) gets satsang, not Sahaj, as her top offer. Amrit ("doesn't want to be sold another course") gets the kitchen team at 66 with no course in her top three.

**FR-10 — Choose a channel and justify it** · P0
Channel from evidence: stated preference first, then replies, then opens, then stage.
*Accept:* changing `whatsappReplies30d` from 0 to 3 changes email → WhatsApp; a call offer is never routed to email; `npm run check` §10 passes.

**FR-11 — Consent is honoured** · P0
A stated `contactPreference` overrides every inference. A `doNotContact` record gets no recommendation, no draft, and no queue entry.
*Accept:* 3 records are excluded from all 180-record scans; 9 stated preferences are honoured everywhere.

### 8.3 Drafting

**FR-12 — Draft from the record** · P0
A template composer produces a message ≤ 75 words for WhatsApp and ≤ 120 for email, in the teacher's voice, referencing at most one specific fact.
*Accept:* 10/10 sampled drafts contain the correct first name and one true fact; none contain `{{`, `undefined` or a bracketed placeholder.

**FR-13 — French** · P0
French-language participants get a French draft.
*Accept:* 21 French records produce drafts with no English sentences.

**FR-14 — AI drafting with a silent fallback** · P0
`POST /api/draft` returns `{ text, source }`. On timeout, error, or missing provider, the template draft remains on screen and the source is labelled honestly.
*Accept:* with the server stopped, the composer produces a full draft in under 300 ms and no dialog appears.

**FR-15 — Never invent personal facts** · P0
The model receives structured facts only — never free-text notes. The UI labels output as an editable draft.
*Accept:* prompt inspection shows no `notes` field; the request payload is a whitelist, not the participant object.

**FR-16 — Phone script** · P1
When the channel is phone, produce four lines: opener, question, offer, close.

**FR-17 — Tone variants** · P1
Regenerate changes the opening without changing the facts.

### 8.4 Acting

**FR-18 — Log a follow-up** · P0
Marking sent writes an activity entry and resets the person's days-since-contact.
*Accept:* the day count resets to 0, the entry appears in the log, the counters move.

**FR-19 — Undo** · P0
Undo restores the prior state within the session.

**FR-20 — Persistence** · P1
State survives refresh via localStorage; "Reset demo data" clears it.
*Accept:* refresh preserves sends; reset returns to the exact opening state.

### 8.5 Surfaces

**FR-21 — Today** · P0 — `UX-SPEC.md` §4.1
**FR-22 — Person sheet** · P0 — `UX-SPEC.md` §4.3
**FR-23 — People** · P1 — `UX-SPEC.md` §4.2
**FR-24 — Impact** · P1 — `UX-SPEC.md` §4.4, and **no retention claim**
**FR-25 — Keyboard accessible, visible focus, reduced motion respected** · P0

---

## 9. Model specification

A **transparent scoring model**, not a trained one (§9.6).

### 9.1 Engagement index

```
E = min(100,
      3.2 × min(appOpens30d, 20)
    + 2.4 × min(emailOpens30d, 20)
    + 5.0 × min(whatsappReplies30d, 10)
    + 0.55 × min(videoMinutes30d, 120))
```

### 9.2 Connection score (0–97)

```
days      = days since last contact (400 if none recorded)
recency   = 50 × max(0, 1 − days/240)^1.3
eng       = 20 × (min(100, E) / 100)
practice  = min(12, 4 + 3·has(part2 or sahaj) + 3·has(silence) + 2·newest course ≤ 365d)
rate      = invites > 0 ? min(1, events/invites) : 0
comm      = first course ≤ 21 days ? 15 × 0.66 (= 9.9) : 15 × rate
score     = round(recency + eng + practice + comm)
```

**Maximum is 97, not 100.** No participant can score 100. This is stated so nobody is surprised by a missing top of the scale.

**Stage thresholds**

| Condition | Stage |
|---|---|
| first course ≤ 21 days **and** score ≥ 60 | `new` |
| score ≥ 62 | `practicing` |
| score ≥ 42 | `slipping` |
| score ≥ 22 | `drifting` |
| otherwise | `dormant` |

*Verified by hand:* Priya — 88 days quiet, E=24, one course, 3 of 7 events →
recency 50×(1−88/240)^1.3 = 28.0, eng 4.8, practice 6, comm 6.4 → **45**, `slipping`. Matches the engine.

### 9.3 Drift projection — three states

For `t = 1…200`, with no contact and with `E_t = E·e^(−0.005t)` and `rate_t = rate·e^(−0.005t)`, recompute the score; the first `t` at which the stage rank degrades is `daysToDrift`.

| `projection` | Meaning | UI |
|---|---|---|
| `degrades` | A crossing exists within 200 days | "12 days to drifting" in clay, with the date |
| `stable` | No crossing in 200 days | "Stable for now" in muted |
| `dormant` | Already dormant | "Already dormant" in stone; **no date** |

Participation decays with engagement. Without that, a deep event history makes someone mathematically undriftable and the sheet confidently says "stable" about a person who is plainly leaving.

### 9.4 Recommendations

Additive per-offer rule points with hard filters, clamped to 0–99. Every **positive** contribution appends its reason at the moment the points are awarded, so a bullet always names something that actually scored. Penalties adjust rank silently and never appear as bullets — a bullet is an argument *for* an offer, not against it — and the list is capped at four. Both limits are stated here rather than discovered on stage.

**Hard filters** (`isEligible`): Sahaj excludes anyone who has taken it; Part 2 likewise; Silence likewise; YES! requires the programme *and* Alberta; Yoga requires BC.

**The eleven offers**

| Offer | Kind | Key positive rules | Key penalties |
|---|---|---|---|
| Sahaj Samadhi (Nov 22) | course | +10 not taken, +12 completed SKY, +9 has Part 2, +14 practising, +6 slipping | −8 slipping, −14 drifting, −28 dormant, −22 "not another course" |
| SKY Part 2 (Nov 28) | course | +8 not taken, +14 completed SKY, +8 SKY < 120 days, +12 practising | course penalty |
| Silence Retreat (Dec 5) | course | +6 not taken, +16 has Part 2/Sahaj, +14 notes mention retreat, +8 interest | −30 drifting/dormant, course penalty |
| 40-Day Practice Circle (Nov 18) | event | +8 open restart, +20 new, +14 slipping, +10 engaged but untouched | −12 dormant |
| Full Moon Satsang (Nov 24) | event | +10 open to anyone, +20 slipping, +14 drifting, +6 dormant, +8 community interest | — |
| Community Kitchen Seva (Nov 21) | seva | +6 open role, +18 matching skill, +18 has served, +16 said they want to serve, +8 slipping | −16 dormant |
| Course Registration Seva | seva | +4 flexible, +16 matching skill, +16 asked about helping, +10 practising | −12 dormant |
| A call from their teacher | call | +6 always, +30 dormant, +24 drifting, +12 slipping, +12 deeply engaged then quiet | −14 practising |
| Sri Sri Yoga (Dec 1) | course | +4 alternative entry, +16 yoga interest, +10 practising, +6 BC | course penalty |
| YES! Follow-up Circle (Nov 29) | event | +8 open, +34 came through YES!, +10 slipping, +6 Alberta | — |
| Online Refresh Evening (Dec 9) | event | +4 no travel, +14 dormant, +10 drifting, +6 away > 120 days | — |

*Coverage across 177 contactable records (top-3 appearances):* satsang 101 · sahaj 87 · kitchen seva 75 · 40-day 65 · call 62 · Part 2 57 · refresh 34 · registration seva 29 · silence 16 · yoga 4 · YES! 1.

### 9.5 Channel decision table (first match wins)

| Condition | Channel |
|---|---|
| Offer is a call | phone — always, even if they prefer email (the reason says so) |
| Stated `contactPreference` | that channel |
| Stage is dormant | phone |
| ≥ 1 WhatsApp reply in 30 days | WhatsApp |
| French and ≥ 4 email opens | email |
| ≥ 4 email opens and ≤ 3 app opens | email |
| Stage is new | WhatsApp |
| Otherwise | the offer's default, with the last-known channel as the reason |

### 9.6 Known limitations, stated not hidden

- Thresholds are **heuristics set on synthetic data**, not calibrated probabilities.
- Recency dominates by design. Someone highly engaged but untouched for 200 days scores low — intended, and visible in the explanation.
- The 0.005/day decay constant is an assumption, not a fitted parameter.
- A single message does not rebuild engagement: the simulation puts a low-engagement person back below the line within about ten days. Real retention needs something worth returning to, which is why the recommendations include events and seva, not just courses.
- No causal claim. We cannot prove that following a recommendation improves retention. That is what the pilot is for.
- **Why not ML:** 180 records, no outcome labels. A trained model would fit noise. A transparent score is auditable, correctable and explainable on stage. V2 learns thresholds from real outcomes (§14).

---

## 10. Data contract

### 10.1 Participant

| Field | Type | Notes |
|---|---|---|
| `id` | string | stable key, assigned at creation, never renumbered |
| `firstName`, `lastName` | string | unique in the cohort |
| `email`, `phone` | string | synthetic; unique |
| `city`, `province` | string | drives regional offers |
| `language` | `en·fr·hi·pa·ta·zh` | draft language, channel |
| `assignedTo` | string | the teacher who owns this person — **and signs the draft** |
| `joinedAt`, `courses[]`, `events[]`, `contacts[]` | — | journey history; no entry predates `joinedAt` |
| `invites` | number | denominator for attendance |
| `signals` | object | app opens, email opens, WhatsApp replies, video minutes (30d) |
| `skills`, `interests` | string[] | seva matching |
| `notes` | string[] | volunteer observations — **shown to the human, never sent to a model** |
| `contactPreference?` | Channel | overrides inference |
| `doNotContact?` | boolean | hard stop |

Full schema: `src/types.ts`. Generator: `scripts/generate-data.mjs`.

### 10.2 Synthetic, and labelled

The brief says "built and demoed on the sample participant data provided". We do not have that file.

- **Today:** 180 synthetic participants, deterministic seed `20261114`, hand-authored for 10 demo cases.
- Names are drawn from hardcoded first/last name pools; every full name, email and phone is unique, and no entry predates the person's join date (`npm run check` §11–12).
- **Swap path:** replace `src/data/participants.json`; add a field mapping in `src/data/adapters.ts` (P1). Nothing downstream changes.
- **On stage:** *"This is a synthetic cohort matching the schema we were given; the real file drops in here."* Never imply it is real.

### 10.3 Honesty matrix

| Layer | Demo status | Production path |
|---|---|---|
| Participant data | Synthetic, schema-matched | CRM export |
| Scoring | Transparent heuristic | Calibrated on outcomes |
| Drafting (template) | Deterministic, local | Same |
| Drafting (AI) | Real local model or OpenAI, structured facts only | Self-hosted model |
| Sending | Simulated, logged | WhatsApp Business / email API |
| Storage | Browser localStorage | Postgres + audit log |

---

## 11. What the product looks like

Full wireframes, tokens and states: `docs/UX-SPEC.md`. In words:

**Today** opens on Anita's morning. *"Good morning, Anita. Seventeen of your thirty-four students need a touch this week. Three of them cross into drifting within a fortnight."* Four numbers, a single drift line showing her caseload by stage, and a queue of six named people — Priya first, because she has the shortest distance to her next stage and has not fallen yet.

**The Person sheet** is the product. Her name is the largest thing on screen. Below it: her stage, and *"12 days to drifting"*. A score of 45 with four labelled bars showing where it came from — 28 of 50 for contact, 5 of 20 for engagement, 6 of 12 for practice, 6 of 15 for community — and one sentence: *"88 days since the last touch, and engagement has gone quiet."* Then the recommendation: **Full Moon Satsang, Nov 24, via WhatsApp**, with three reasons, and two alternatives beneath it. Then the draft, already written, editable, 60-something words. A footer: *64 words · template*. One button: **Mark as sent**.

**People** is the whole cohort of 180 as a table, searchable, filterable by stage — the answer to *"is this real, or is it three made-up people?"*

**Impact** shows what happened and what is coming: 17 people in someone's week, 3 crossings inside a fortnight, the follow-ups logged, and the time returned — labelled as arithmetic on a stated assumption. No retention curve, and a line saying why.

**Design direction:** calm, literate, unsentimental. Warm ivory, deep indigo, marigold. A serif for names and numbers, a clean grotesque for the interface. No emoji, no gradients, no guilt mechanics.

**The screen that wins the room:** Priya Raman's sheet. 88 days of silence that somebody noticed, a 12-day window, and a specific paragraph already written.

---

## 12. Demo narrative (3:00)

All numbers below are engine output for the demo state.

| Time | On screen | Say |
|---|---|---|
| 0:00 | Today | "Anita has thirty-four students. Seventeen need a touch this week. Three cross into drifting inside a fortnight." |
| 0:20 | Click Priya | "Priya Raman. SKY in March. Then eighty-eight days of silence. Nobody noticed." |
| 0:35 | Person sheet — why | "The system noticed. Her engagement is 24 out of 100, she has missed four of seven invitations, and she is twelve days from drifting." |
| 0:55 | Recommendation | "Full Moon Satsang, on the 24th. Not a course — she is slipping, and the honest next step is a room she already knows." |
| 1:15 | Composer | "And here is the message. Not a template with her name dropped in." *Read it aloud.* |
| 1:40 | Regenerate, local model | "Runs on a local model. Her notes never leave this laptop." |
| 2:00 | Mark as sent | "One click. Logged, attributed, and the queue updates." |
| 2:10 | Amrit Kaur | "Amrit runs the langar kitchen and told us she does not want to be sold another course. The system recommends the kitchen team — 66 points — and there is no course in her top three." |
| 2:30 | Impact | "Seventeen people in someone's week. Three crossings inside a fortnight. We are not claiming a retention lift — that is what the pilot measures." |
| 2:45 | Close | "One centre, thirty days, then we replace the thresholds with what actually worked." |

**Non-negotiables:** the draft is read **aloud**; the reason is **specific enough to repeat**; the Amrit contrast appears. Those three beats are the argument.

---

## 13. Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | LLM slow or down during demo | Med | High | Template draft is instant and always present; AI is an additive button |
| R2 | AI invents a personal detail | Med | High | Structured-facts-only payload, no notes; editable output; template fallback |
| R3 | Demo laptop or network fails | Med | High | Runs fully offline from `dist`; recorded video as plan B |
| R4 | Judge asks "is this real data?" | High | Med | Synthetic stated up front; honesty matrix rehearsed |
| R5 | Scope creep into Topic 2/3 | High | High | Cut list applied immediately; G2 rejects new scope |
| R6 | Two-person merge conflicts | Med | Med | Frozen interfaces; no cross-editing |
| R7 | Reads as surveillance | Low | High | Caseload scoping, consent fields, no message-content analysis, no guilt copy |
| R8 | "Why not a real model?" | High | Med | One rehearsed sentence: no labels, so a transparent score is the honest choice |
| R9 | Copy sounds like marketing | Med | High | Voice rules; every draft read aloud at G4 |
| R10 | Optimism about hours | High | Med | 14 remaining against 20 committed; cut list pre-agreed |

---

## 14. After the hackathon

A 30-day pilot with one centre:

1. Import the real cohort. Freeze the heuristic.
2. Ask teachers to accept or override each recommendation. Overrides become labels.
3. Fit thresholds and offer weights on those labels.
4. Measure: % of at-risk contacted in 7 days, 90-day retention, teacher time per follow-up.
5. Only then consider a learned model — and keep the explanation surface.

The product becomes a learning loop, not a smarter oracle.

---

## 15. Assumptions and open questions

| # | Item | Assumption | Owner |
|---|---|---|---|
| A1 | Sample data | Not received; synthetic schema-matched cohort is acceptable and labelled | Both |
| A2 | Demo length | 3 minutes + Q&A | B |
| A3 | Judging weights | Impact and clarity dominate; not a model contest | Both |
| A4 | Second builder's role | Owns UI and narrative | Both |
| A5 | Language scope | EN + FR drafts only | Both |
| A6 | Deploy | Local `npm run demo`; no hosting dependency | A |
| A7 | Sender | The teacher who taught them (`assignedTo`) | Both |

**Open:** Q1 does the official sample data arrive before 18:00? Q2 is the demo 3 or 5 minutes? Q3 is a hosted URL required?

---

## 16. Definition of done

1. `npm run demo` serves a production build from a clean checkout on one port.
2. `npm run check` passes all 12 sections.
3. The 3-minute script runs three times consecutively with no dead end, no placeholder, no visible error.
4. Every recommendation on screen carries at least two specific, true reasons.
5. With the AI server stopped, drafting still works and says so.
6. No console errors; typecheck and build clean.
7. README explains the problem, the model, the honesty matrix, and how to swap in real data.
8. A recorded fallback video exists and has been played on a second machine.
9. `docs/REVIEW-LOG.md` shows a pass at G0–G5.

---

## Appendix A — Decision log

| # | Decision | Rejected | Why |
|---|---|---|---|
| D1 | Topic 1 | Topics 2–8 | Best impact ÷ risk; §3 |
| D2 | Rules + transparent score | Trained classifier | No labels; explainability is the demo asset |
| D3 | Local model first | Cloud-only | Data sovereignty; works offline |
| D4 | No real send integration | WhatsApp API | Credentials, failure modes, no story gain |
| D5 | Person sheet over a chat UI | Conversational assistant | The story is a person, not a prompt box |
| D6 | Scope to a teacher's caseload | One cohort-wide list | 180 people is the problem, not the interface |
| D7 | Sender = the teacher who taught them | One global coordinator | The cheapest fix that makes it feel real |
| D8 | No retention projection | Simulated 90-day curve | The curve was a tautology (§4.3) |
| D9 | Urgency = next intake + drift date | "8 days to drifting" | Invented urgency is the fastest way to lose a judge |
| D10 | 180 synthetic participants | 20 hand-written | Cohort-level numbers need a cohort |

## Appendix B — What exists at v2.0

Data generator, integrity tests, journey engine with drift projection, 11-offer recommender with channel and consent handling, metrics module, and this document set. **The UI does not exist.** No UI code is written until G2 passes on paper.

Verify with:

```
npm run data      # regenerate the cohort deterministically
npm run check     # 12 integrity sections
npx tsx scripts/report.ts    # every hero figure quoted above
npx tsx scripts/figures.ts   # caseloads, crossings, time arithmetic
npx tsx scripts/simulate.ts  # the negative result behind §4.3
```
