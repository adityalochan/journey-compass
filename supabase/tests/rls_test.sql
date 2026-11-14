-- Row-level security test. Run after auth_stub.sql + migrations/0001_schema.sql on a scratch database.
-- Every check raises an exception if a rule is broken, so "no error" = all rules hold.

-- Supabase grants table privileges to these roles by default; RLS decides which rows.
grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on all tables in schema public to authenticated, anon;
grant execute on all functions in schema public to authenticated, anon;

-- Two participants, one coordinator, some data for each (as the engine / service role would write it).
insert into public.participants (id, email, first_name) values
  ('p_a', 'priya@example.org', 'Priya'), ('p_b', 'marc@example.org', 'Marc');
insert into public.offers (id, offer_type, name, commitment) values
  ('seva_kitchen', 'seva', 'Kitchen seva', 2), ('event_x', 'event', 'Satsang', 1);
update public.offers set registration_url = 'https://example.org/reg/x' where id = 'event_x';
insert into public.activities (participant_id, date, activity_type, name) values
  ('p_a', '2026-03-08', 'course', 'SKY'), ('p_b', '2025-11-16', 'course', 'SKY');
insert into public.notes (participant_id, note) values ('p_a', 'evenings only'), ('p_b', 'retreat with partner');
insert into public.contacts (participant_id, at, channel, direction, summary) values ('p_a', now(), 'email', 'out', 'hi');
insert into public.journeys (participant_id, stage) values ('p_a', 'slipping'), ('p_b', 'drifting');
insert into public.recommendations (participant_id, rank, offer_id, name, kind, when_label, why, start_at, duration_min) values
  ('p_a', 1, 'seva_kitchen', 'Kitchen seva', 'seva', 'At your local centre', 'Your cooking skills...', null, null),
  ('p_b', 1, 'event_x', 'Satsang', 'event', 'Feb 11 · online', 'Practise together.', '2027-02-11 09:30', 60);
insert into public.engine_runs (participant_id, journey_stage, coordinator_reason) values ('p_a', 'Slipping', 'note: evenings');
insert into public.acceptance_rates (stage, offer_type, prior, rate) values ('Slipping', 'seva', 0.15, 0.2);

-- Logging in links the auth user to the participant row by email (trigger).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'Priya@Example.org'),
  ('00000000-0000-0000-0000-00000000000b', 'marc@example.org'),
  ('00000000-0000-0000-0000-0000000000c0', 'coordinator@example.org');
insert into public.staff (user_id, name, email) values ('00000000-0000-0000-0000-0000000000c0', 'Anita', 'coordinator@example.org');

do $$ begin
  if (select auth_user_id from public.participants where id = 'p_a') <> '00000000-0000-0000-0000-00000000000a'
  then raise exception 'login was not linked to the participant row (email match should ignore case)'; end if;
end $$;

-- ---------------- as Priya ----------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
do $$ begin
  if (select count(*) from public.participants) <> 1 then raise exception 'Priya sees other participants'; end if;
  if (select count(*) from public.activities where participant_id <> 'p_a') > 0 then raise exception 'Priya sees others'' activities'; end if;
  if (select count(*) from public.recommendations) <> 1 then raise exception 'Priya sees others'' recommendations'; end if;
  if (select count(*) from public.next_steps) <> 1 then raise exception 'next_steps view leaks other people'; end if;
  if (select count(*) from public.journeys) <> 1 then raise exception 'Priya sees others'' journeys'; end if;
  if (select count(*) from public.notes) <> 0 then raise exception 'Priya can read volunteer notes'; end if;
  if (select count(*) from public.contacts) <> 0 then raise exception 'Priya can read the contact log'; end if;
  if (select count(*) from public.engine_runs) <> 0 then raise exception 'Priya can read the engine''s reasoning'; end if;
  if (select count(*) from public.offers) <> 2 then raise exception 'Priya cannot read offers'; end if;
end $$;

-- She can register interest for herself...
insert into public.interests (participant_id, offer_id) values ('p_a', 'seva_kitchen');
update public.interests set status = 'cancelled' where participant_id = 'p_a';
-- ...but not for someone else.
do $$ begin
  begin
    insert into public.interests (participant_id, offer_id) values ('p_b', 'event_x');
    raise exception 'Priya created an interest for Marc';
  exception when insufficient_privilege then null;  -- blocked by RLS, as it should be
  end;
end $$;
-- And she can't touch Marc's rows (an update simply matches nothing).
reset role;
insert into public.interests (participant_id, offer_id) values ('p_b', 'event_x');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
update public.interests set status = 'cancelled' where participant_id = 'p_b';
reset role;
do $$ begin
  if (select status from public.interests where participant_id = 'p_b') <> 'requested' then raise exception 'Priya changed Marc''s interest'; end if;
end $$;

-- The coordinator queue is staff-only, even for rows about the caller.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
do $$ begin
  if (select count(*) from public.coordinator_queue) <> 0 then raise exception 'Priya can read the coordinator queue'; end if;
  if (select count(*) from public.acceptance_rates) <> 0 then raise exception 'Priya can read the learning table'; end if;
end $$;
reset role;

-- ---------------- as Marc ----------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  if (select string_agg(participant_id, ',') from public.next_steps) <> 'p_b' then raise exception 'Marc sees the wrong next steps'; end if;
  if (select start from public.next_steps) <> '2027-02-11T09:30' then raise exception 'next_steps.start has the wrong format'; end if;
  if (select "registrationUrl" from public.next_steps) <> 'https://example.org/reg/x' then raise exception 'next_steps is missing the registration link'; end if;
  if (select count(*) from public.interests) <> 1 then raise exception 'Marc sees Priya''s interests'; end if;
end $$;

-- ---------------- logged in, but not a participant or staff ----------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ff', false);
do $$ begin
  if (select count(*) from public.participants) + (select count(*) from public.recommendations) <> 0
  then raise exception 'an unknown user can read participant data'; end if;
end $$;

-- ---------------- not logged in ----------------
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  if (select count(*) from public.offers) + (select count(*) from public.participants) <> 0
  then raise exception 'anonymous visitors can read data'; end if;
end $$;

-- ---------------- as the coordinator ----------------
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c0', false);
do $$ begin
  if (select count(*) from public.participants) <> 2 then raise exception 'staff cannot see all participants'; end if;
  if (select count(*) from public.notes) <> 2 then raise exception 'staff cannot read notes'; end if;
  if (select count(*) from public.interests) <> 2 then raise exception 'staff cannot see all interests'; end if;
end $$;
do $$ begin
  if (select count(*) from public.coordinator_queue) <> 2 then raise exception 'staff queue should list both requests'; end if;
  if (select count(*) from public.acceptance_rates) <> 1 then raise exception 'staff cannot read the learning table'; end if;
  if (select notes from public.coordinator_queue where participant_id = 'p_a') <> 'evenings only'
  then raise exception 'queue is missing the volunteer notes'; end if;
  if (select coordinator_reason from public.coordinator_queue where participant_id = 'p_a') <> 'note: evenings'
  then raise exception 'queue is missing the engine reasoning'; end if;
end $$;
insert into public.outcomes (participant_id, offer_id, result, recorded_by)
  values ('p_a', 'seva_kitchen', 'attended', '00000000-0000-0000-0000-0000000000c0');
do $$ begin
  if (select latest_outcome from public.coordinator_queue where participant_id = 'p_a') <> 'attended'
  then raise exception 'queue does not show the latest outcome'; end if;
end $$;
reset role;

select 'ALL RLS CHECKS PASSED' as result;
