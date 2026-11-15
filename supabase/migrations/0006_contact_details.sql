-- Contact details for outreach: a phone number on each participant, and the coordinator's people
-- list gains phone, consent flags and all three next steps. New view columns go at the end so
-- `create or replace` keeps the existing ones.

alter table public.participants add column phone text;

create or replace view public.coordinator_people with (security_invoker = true) as
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
          from public.notes n where n.participant_id = p.id)         as notes,
       p.phone,
       p.email_opt_in,
       p.whatsapp_opt_in,
       (select coalesce(jsonb_agg(jsonb_build_object(
                 'rank', rec.rank, 'offer_id', rec.offer_id, 'name', rec.name,
                 'kind', rec.kind, 'when', rec.when_label) order by rec.rank), '[]'::jsonb)
          from public.recommendations rec where rec.participant_id = p.id)  as next_steps
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
