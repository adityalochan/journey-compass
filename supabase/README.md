# Database (Supabase)

`migrations/0001_schema.sql` is the shared schema: tables, row-level security, the `next_steps`
view the website reads, and the trigger that links a magic-link login to its participant row by email.

**Apply it:** Supabase dashboard → SQL Editor → paste the file → Run (or `supabase db push` with the CLI).

**Who sees what**

| Role | Can read | Can write |
|---|---|---|
| Participant (logged in, email matches a `participants` row) | own `participants`, `activities`, `journeys`, `recommendations` / `next_steps`, `interests`; all `offers` | own `interests` |
| Staff (listed in `staff`) | everything | `interests`, `outcomes`, notes |
| Engine (service-role key, GitHub Actions secret only) | everything | everything (bypasses RLS) |
| Anyone not logged in | nothing | nothing |

`notes`, `contacts`, `signals` and `engine_runs` are staff-only, so a participant's browser can never
receive them.

**Website query:** `supabase.from('next_steps').select('*').order('rank')` returns rows already in
the `NextStep` shape (`name, kind, when, why, start, durationMin, online`), only for the logged-in
person. Their greeting stage: `supabase.from('journeys').select('stage').single()`.

**Test the rules** (no database server needed; uses PGlite):
```bash
cd supabase/tests && npm install && node run.mjs     # ends with ALL RLS CHECKS PASSED
```
