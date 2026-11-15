-- Add each next step's sign-up link to the view the website reads. New columns go at the end so
-- `create or replace` keeps the existing ones unchanged.
create or replace view public.next_steps with (security_invoker = true) as
select r.participant_id,
       r.rank,
       r.offer_id,
       r.name,
       r.kind,
       r.when_label                                  as "when",
       r.why,
       to_char(r.start_at, 'YYYY-MM-DD"T"HH24:MI')   as start,
       r.duration_min                                as "durationMin",
       r.online,
       o.registration_url                            as "registrationUrl"
from public.recommendations r
left join public.offers o on o.id = r.offer_id;
