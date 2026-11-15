-- Coordinator side: each staff login covers one coordinator's people (participants.assigned_to).
-- A staff row with covers = null sees everyone (an administrator).

alter table public.staff add column covers text;

create function public.my_coverage() returns text
  language sql stable security definer set search_path = public as
$$ select covers from public.staff where user_id = auth.uid() $$;

-- True when the caller is staff and the participant is one of theirs.
create function public.covers_participant(assigned text) returns boolean
  language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.staff s
                   where s.user_id = auth.uid() and (s.covers is null or s.covers = assigned)) $$;

-- Everyone the coordinator looks after, most urgent first: stage, drift date, the engine's reason,
-- the suggested channel and drafted message, their latest request and the latest outcome.
create view public.coordinator_people with (security_invoker = true) as
select p.id                    as participant_id,
       p.first_name,
       p.last_name,
       p.email,
       p.city,
       p.language,
       p.assigned_to,
       p.preferred_channel,
       p.do_not_contact,
       j.stage,
       r.journey_stage,
       r.stage_confidence,
       r.stage_drivers,
       r.engagement_score,
       r.trend_points,
       r.drift_date,
       r.chosen_offer_id,
       o.name                  as chosen_offer_name,
       o.offer_type            as chosen_offer_type,
       r.chosen_by,
       r.engine_offer_id,
       r.coordinator_reason,
       r.channel               as suggested_channel,
       r.message               as draft_message,
       r.message_source,
       li.offer_id             as request_offer_id,
       li.offer_name           as request_offer_name,
       li.status               as request_status,
       li.created_at           as requested_at,
       (select oc.result from public.outcomes oc where oc.participant_id = p.id
         order by oc.recorded_at desc, oc.id desc limit 1)           as latest_outcome,
       (select string_agg(n.note, ' | ' order by n.id)
          from public.notes n where n.participant_id = p.id)         as notes
from public.participants p
left join public.journeys j    on j.participant_id = p.id
left join public.engine_runs r on r.participant_id = p.id
left join public.offers o      on o.id = r.chosen_offer_id
left join lateral (
  select i.offer_id, ofr.name as offer_name, i.status, i.created_at
    from public.interests i join public.offers ofr on ofr.id = i.offer_id
   where i.participant_id = p.id
   order by i.created_at desc limit 1
) li on true
where public.covers_participant(p.assigned_to);

-- The request queue follows the same coverage.
create or replace view public.coordinator_queue with (security_invoker = true) as
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
where public.covers_participant(p.assigned_to);
