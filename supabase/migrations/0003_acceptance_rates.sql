-- Learning loop output: how often each stage takes up each kind of offer, prior vs learned.
-- Written by the engine (service role) every run; staff can read it to see the loop move.

create table public.acceptance_rates (
  stage       text not null,                     -- New / Active / Slipping / Drifting / Dormant
  offer_type  text not null,
  prior       real not null,
  rate        real not null,
  successes   integer not null default 0,
  trials      integer not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (stage, offer_type)
);

alter table public.acceptance_rates enable row level security;
create policy "staff only" on public.acceptance_rates for select to authenticated using (public.is_staff());
