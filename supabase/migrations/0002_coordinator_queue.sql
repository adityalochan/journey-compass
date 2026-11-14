-- Coordinator queue: one row per request (interests), with everything the /coordinator page shows.
-- Staff only. The view runs with the caller's rights (security_invoker), so row-level security on
-- every joined table still applies, and the is_staff() filter keeps participants out entirely.

create view public.coordinator_queue with (security_invoker = true) as
select i.id                    as interest_id,
       i.status,
       i.created_at            as requested_at,
       i.updated_at,
       p.id                    as participant_id,
       p.first_name,
       p.last_name,
       p.email,
       p.city,
       p.language,
       p.assigned_to,
       p.preferred_channel,
       p.do_not_contact,
       o.id                    as offer_id,
       o.name                  as offer_name,
       o.offer_type,
       o.start_date            as offer_start_date,
       o.registration_url,
       j.stage,
       r.journey_stage,
       r.stage_confidence,
       r.stage_drivers,
       r.engagement_score,
       r.drift_date,
       r.chosen_offer_id,
       r.chosen_by,
       r.coordinator_reason,
       r.channel               as suggested_channel,
       r.message               as draft_message,
       (select string_agg(n.note, ' | ' order by n.id)
          from public.notes n where n.participant_id = p.id)          as notes,
       (select oc.result from public.outcomes oc
         where oc.participant_id = i.participant_id and oc.offer_id = i.offer_id
         order by oc.recorded_at desc, oc.id desc limit 1)            as latest_outcome
from public.interests i
join public.participants p on p.id = i.participant_id
join public.offers o       on o.id = i.offer_id
left join public.journeys j    on j.participant_id = i.participant_id
left join public.engine_runs r on r.participant_id = i.participant_id
where public.is_staff();
