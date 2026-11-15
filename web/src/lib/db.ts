// Task 4: the signed-in participant's own journey, straight from Supabase.
// Row-level security means every query returns only this person's rows.
// Staff-only data (notes, contacts, signals, engine reasoning) is never read here.
import type { AttendedEvent, Course, Participant, Stage } from "../../../src/types";
import { supabase } from "./supabase";
import type { NextStep } from "./steps";

interface ParticipantRow {
  id: string; first_name: string; last_name: string; email: string; city: string; province: string;
  language: Participant["language"]; assigned_to: string; joined_at: string; skills: string[] | null; interests: string[] | null;
}
interface ActivityRow { date: string; activity_type: string; name: string; subtype: string | null; city: string | null }

export interface MyJourney { me: Participant | null; stage: Stage; steps: NextStep[] }

function toParticipant(row: ParticipantRow, acts: ActivityRow[]): Participant {
  const courses: Course[] = acts.filter((a) => a.activity_type === "course").map((a) => ({
    programId: a.subtype ?? "", name: a.name, completedAt: a.date, city: a.city ?? row.city, teacher: "",
  }));
  const events: AttendedEvent[] = acts.filter((a) => a.activity_type !== "course").map((a) => ({
    name: a.name, type: (a.subtype ?? "satsang") as AttendedEvent["type"], date: a.date, city: a.city ?? row.city,
  }));
  return {
    id: row.id, firstName: row.first_name, lastName: row.last_name, email: row.email, phone: "",
    city: row.city, province: row.province, language: row.language, assignedTo: row.assigned_to ?? "",
    joinedAt: row.joined_at, courses, events, invites: 0, contacts: [],
    signals: { appOpens30d: 0, emailOpens30d: 0, whatsappReplies30d: 0, videoMinutes30d: 0 },
    skills: row.skills ?? [], interests: row.interests ?? [], notes: [],
  };
}

export async function loadMyJourney(): Promise<MyJourney> {
  const [me, acts, journey, steps] = await Promise.all([
    supabase.from("participants")
      .select("id,first_name,last_name,email,city,province,language,assigned_to,joined_at,skills,interests")
      .maybeSingle(),
    supabase.from("activities").select("date,activity_type,name,subtype,city").order("date"),
    supabase.from("journeys").select("stage").maybeSingle(),
    supabase.from("next_steps")
      .select("offer_id,name,kind,when,why,start,durationMin,online,registrationUrl").order("rank"),
  ]);
  const err = me.error ?? acts.error ?? journey.error ?? steps.error;
  if (err) throw new Error(err.message);
  return {
    me: me.data ? toParticipant(me.data as ParticipantRow, (acts.data ?? []) as ActivityRow[]) : null,
    stage: ((journey.data as { stage: Stage } | null)?.stage ?? "practicing"),
    steps: (steps.data ?? []) as NextStep[],
  };
}
