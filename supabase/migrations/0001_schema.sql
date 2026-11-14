-- Journey Compass schema (Supabase / Postgres).
--
-- Who can see what:
--   participant  a logged-in person linked to a `participants` row. Reads ONLY their own rows in
--                participants, activities, journeys, recommendations (+ the `next_steps` view),
--                interests; reads all offers; creates / updates their own interests.
--   staff        a coordinator listed in `staff`. Reads everything, records outcomes.
--   engine       the nightly Python job, using the service-role key (bypasses RLS). Never ship that
--                key to the website.
-- Volunteer notes, the contact log, engagement signals and the engine's internal reasoning live in
-- staff-only tables, so no participant's browser can ever receive them.

-- ------------------------------------------------------------------------------------------------
-- People
-- ------------------------------------------------------------------------------------------------
create table public.participants (
  id                        text primary key,                 -- engine id, e.g. 'p_001'
  auth_user_id              uuid unique references auth.users (id) on delete set null,
  email                     text unique not null,
  first_name                text not null,
  last_name                 text,
  city                      text,
  province                  text,
  language                  text not null default 'en',
  assigned_to               text,                             -- coordinator's name
  joined_at                 date,
  skills                    text[] not null default '{}',      -- shared by the participant
  interests                 text[] not null default '{}',
  preferred_channel         text check (preferred_channel in ('email', 'whatsapp', 'phone')),
  preferred_channel_source  text check (preferred_channel_source in ('stated', 'inferred', 'default')),
  email_opt_in              boolean not null default false,
  whatsapp_opt_in           boolean not null default false,
  phone_opt_in              boolean not null default false,
  do_not_contact            boolean not null default false,
  created_at                timestamptz not null default now()
);

create table public.staff (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  name        text not null,
  email       text not null,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------------------------------------------
-- History (what the journey board shows)
-- ------------------------------------------------------------------------------------------------
create table public.activities (
  id              bigint generated always as identity primary key,
  participant_id  text not null references public.participants (id) on delete cascade,
  date            date not null,
  activity_type   text not null check (activity_type in ('course', 'event', 'seva', 'retreat')),
  name            text not null,
  subtype         text,
  city            text,
  source          text,
  source_id       text
);
create index on public.activities (participant_id, date);

-- ------------------------------------------------------------------------------------------------
-- Staff-only inputs: never readable by participants
-- ------------------------------------------------------------------------------------------------
create table public.notes (
  id              bigint generated always as identity primary key,
  participant_id  text not null references public.participants (id) on delete cascade,
  note            text not null,
  author          text,
  created_at      timestamptz not null default now()
);

create table public.contacts (
  id              bigint generated always as identity primary key,
  participant_id  text not null references public.participants (id) on delete cascade,
  at              timestamptz not null,
  channel         text not null,
  direction       text not null check (direction in ('in', 'out')),
  summary         text
);
create index on public.contacts (participant_id, at);

create table public.signals (                                 -- app / email / video, last 30 days
  participant_id        text primary key references public.participants (id) on delete cascade,
  app_opens_30d         integer not null default 0,
  email_opens_30d       integer not null default 0,
  whatsapp_replies_30d  integer not null default 0,
  video_minutes_30d     integer not null default 0,
  invites               integer not null default 0,
  updated_at            timestamptz not null default now()
);

-- ------------------------------------------------------------------------------------------------
-- What can be recommended
-- ------------------------------------------------------------------------------------------------
create table public.offers (
  id                text primary key,                          -- e.g. 'seva_kitchen', 'hm_HM-30001089'
  offer_type        text not null check (offer_type in ('course', 'retreat', 'seva', 'event', 'reconnect')),
  name              text not null,
  program_key       text,
  commitment        smallint not null check (commitment between 1 and 5),
  start_date        date,                                      -- null = always available
  start_time        time,                                      -- null when the source has no time
  duration_min      integer,
  city              text,                                      -- null = local centre; 'Online'
  venue             text,
  languages         text[] not null default '{}',              -- empty = any
  tags              text[] not null default '{}',
  prerequisites     text[] not null default '{}',
  audience          text,
  registration_url  text,
  description       text,
  source            text,
  active            boolean not null default true
);

-- ------------------------------------------------------------------------------------------------
-- Engine output (written nightly with the service-role key)
-- ------------------------------------------------------------------------------------------------
create table public.journeys (                                 -- participant-safe: used for the greeting
  participant_id  text primary key references public.participants (id) on delete cascade,
  stage           text not null check (stage in ('new', 'practicing', 'slipping', 'drifting', 'dormant')),
  generated_at    timestamptz not null default now()
);

create table public.recommendations (                          -- what the participant sees, written TO them
  participant_id  text not null references public.participants (id) on delete cascade,
  rank            smallint not null check (rank between 1 and 3),
  offer_id        text not null references public.offers (id),
  name            text not null,
  kind            text not null check (kind in ('course', 'retreat', 'event', 'seva', 'call')),
  when_label      text not null,                               -- 'Feb 11 · online'
  why             text not null,                               -- never notes, stage words or scores
  start_at        timestamp,                                   -- local time; null if unknown
  duration_min    integer,
  online          boolean not null default false,
  generated_at    timestamptz not null default now(),
  primary key (participant_id, rank)
);

create table public.engine_runs (                              -- staff-only: the engine's reasoning
  participant_id      text primary key references public.participants (id) on delete cascade,
  journey_stage       text,                                    -- New / Active / Slipping / Drifting / Dormant
  stage_confidence    real,
  stage_drivers       text,
  engagement_score    real,
  trend_points        real,
  drift_date          date,
  engine_offer_id     text,
  chosen_offer_id     text,
  chosen_by           text check (chosen_by in ('ai', 'engine')),
  coordinator_reason  text,
  channel             text,
  message             text,
  message_source      text,
  generated_at        timestamptz not null default now()
);

-- ------------------------------------------------------------------------------------------------
-- Clicks and outcomes
-- ------------------------------------------------------------------------------------------------
create table public.interests (
  id              uuid primary key default gen_random_uuid(),
  participant_id  text not null references public.participants (id) on delete cascade,
  offer_id        text not null references public.offers (id),
  status          text not null default 'requested' check (status in ('requested', 'booked', 'cancelled')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (participant_id, offer_id)
);

create table public.outcomes (                                 -- recorded by coordinators; feeds learning
  id              bigint generated always as identity primary key,
  participant_id  text not null references public.participants (id) on delete cascade,
  offer_id        text not null references public.offers (id),
  interest_id     uuid references public.interests (id) on delete set null,
  result          text not null check (result in ('attended', 'accepted', 'declined', 'no_response')),
  recorded_by     uuid references public.staff (user_id),
  recorded_at     timestamptz not null default now()
);

-- ------------------------------------------------------------------------------------------------
-- The website reads next steps in exactly the shape of its NextStep type
-- ------------------------------------------------------------------------------------------------
create view public.next_steps with (security_invoker = true) as
select participant_id,
       rank,
       offer_id,
       name,
       kind,
       when_label                                  as "when",
       why,
       to_char(start_at, 'YYYY-MM-DD"T"HH24:MI')   as start,
       duration_min                                as "durationMin",
       online
from public.recommendations;

-- ------------------------------------------------------------------------------------------------
-- Helpers
-- ------------------------------------------------------------------------------------------------
create function public.my_participant_id() returns text
  language sql stable security definer set search_path = public as
$$ select id from public.participants where auth_user_id = auth.uid() $$;

create function public.is_staff() returns boolean
  language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.staff where user_id = auth.uid()) $$;

-- When someone logs in for the first time (magic link), link them to their participant row by email.
create function public.link_participant() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  update public.participants set auth_user_id = new.id
   where lower(email) = lower(new.email) and auth_user_id is null;
  return new;
end
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.link_participant();

-- Keep interests.updated_at current.
create function public.touch_updated_at() returns trigger language plpgsql as
$$ begin new.updated_at = now(); return new; end $$;
create trigger interests_touch before update on public.interests
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------------------------------------
-- Row-level security
-- ------------------------------------------------------------------------------------------------
alter table public.participants     enable row level security;
alter table public.staff            enable row level security;
alter table public.activities       enable row level security;
alter table public.notes            enable row level security;
alter table public.contacts         enable row level security;
alter table public.signals          enable row level security;
alter table public.offers           enable row level security;
alter table public.journeys         enable row level security;
alter table public.recommendations  enable row level security;
alter table public.engine_runs      enable row level security;
alter table public.interests        enable row level security;
alter table public.outcomes         enable row level security;

-- Participants: their own rows only. Staff: everything.
create policy "own or staff" on public.participants for select to authenticated
  using (auth_user_id = auth.uid() or public.is_staff());
create policy "own or staff" on public.activities for select to authenticated
  using (participant_id = public.my_participant_id() or public.is_staff());
create policy "own or staff" on public.journeys for select to authenticated
  using (participant_id = public.my_participant_id() or public.is_staff());
create policy "own or staff" on public.recommendations for select to authenticated
  using (participant_id = public.my_participant_id() or public.is_staff());
create policy "any logged-in user" on public.offers for select to authenticated
  using (true);

-- Interests: participants create and change their own; staff can see and update all.
create policy "own or staff" on public.interests for select to authenticated
  using (participant_id = public.my_participant_id() or public.is_staff());
create policy "create own" on public.interests for insert to authenticated
  with check (participant_id = public.my_participant_id());
create policy "update own or staff" on public.interests for update to authenticated
  using (participant_id = public.my_participant_id() or public.is_staff())
  with check (participant_id = public.my_participant_id() or public.is_staff());

-- Staff-only tables.
create policy "staff only" on public.notes       for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff only" on public.contacts    for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff only" on public.signals     for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff only" on public.engine_runs for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff only" on public.outcomes    for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff see staff" on public.staff  for select to authenticated using (public.is_staff());
