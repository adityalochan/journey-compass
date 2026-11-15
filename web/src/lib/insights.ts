// Read-only data for the coordinator's "Visualize" page: the model's outputs for one person,
// compared with the other people this coordinator covers. Staff-only tables (RLS).
import { supabase } from "./supabase";

/** The fields of a coordinator_people row the insights page uses. */
export interface CoordPerson {
  participant_id: string;
  first_name: string;
  last_name: string | null;
  city: string | null;
  stage: string | null;              // participant-facing: new / practicing / slipping / drifting / dormant
  journey_stage?: string | null;     // engine label: New / Active / Slipping / Drifting / Dormant
  stage_confidence: number | null;
  stage_drivers: string | null;
  engagement_score: number | null;
  trend_points?: number | null;
  drift_date: string | null;
  chosen_offer_id: string | null;
  chosen_offer_name: string | null;
  chosen_offer_type?: string | null;
  chosen_by: string | null;
  coordinator_reason: string | null;
  suggested_channel: string | null;
  next_steps: { rank: number; offer_id: string; name: string; kind: string; when: string }[];
}

interface SignalRow {
  participant_id: string; app_opens_30d: number; email_opens_30d: number;
  whatsapp_replies_30d: number; video_minutes_30d: number; invites: number;
}
export interface Activity { participant_id: string; date: string; activity_type: string; subtype: string | null; name: string }
export interface Contact { participant_id: string; at: string; channel: string; direction: "in" | "out" }
export interface Rate { stage: string; offer_type: string; rate: number; successes: number; trials: number }

export interface GroupData { signals: Map<string, SignalRow>; activities: Activity[]; contacts: Contact[]; rates: Rate[] }

export async function loadGroup(ids: string[]): Promise<GroupData> {
  const [sig, acts, cons, rates] = await Promise.all([
    supabase.from("signals").select("participant_id,app_opens_30d,email_opens_30d,whatsapp_replies_30d,video_minutes_30d,invites").in("participant_id", ids),
    supabase.from("activities").select("participant_id,date,activity_type,subtype,name").in("participant_id", ids).order("date"),
    supabase.from("contacts").select("participant_id,at,channel,direction").in("participant_id", ids).order("at"),
    supabase.from("acceptance_rates").select("stage,offer_type,rate,successes,trials"),
  ]);
  const err = sig.error ?? acts.error ?? cons.error ?? rates.error;
  if (err) throw new Error(err.message);
  return {
    signals: new Map(((sig.data ?? []) as SignalRow[]).map((s) => [s.participant_id, s])),
    activities: (acts.data ?? []) as Activity[],
    contacts: (cons.data ?? []) as Contact[],
    rates: (rates.data ?? []) as Rate[],
  };
}

const DAY = 86_400_000;
const today = () => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; };

/** One numeric row per person, for the explorer and the comparisons. */
export interface Row {
  id: string; name: string; stage: string;
  engagement: number | null; trend: number | null; confidence: number | null;
  daysToDrift: number | null; daysSinceContact: number | null;
  app: number | null; email: number | null; whatsapp: number | null; video: number | null; invites: number | null;
  courses: number; gatherings: number; seva: number;
}

export function buildRows(people: CoordPerson[], g: GroupData): Row[] {
  const now = today().getTime();
  const lastContact = new Map<string, number>();
  for (const c of g.contacts) lastContact.set(c.participant_id, Math.max(lastContact.get(c.participant_id) ?? 0, new Date(c.at).getTime()));
  const count = (id: string, f: (a: Activity) => boolean) => g.activities.filter((a) => a.participant_id === id && f(a)).length;
  return people.map((p) => {
    const s = g.signals.get(p.participant_id);
    const lc = lastContact.get(p.participant_id);
    return {
      id: p.participant_id, name: `${p.first_name} ${p.last_name ?? ""}`.trim(), stage: p.stage ?? "unknown",
      engagement: p.engagement_score, trend: p.trend_points ?? null,
      confidence: p.stage_confidence == null ? null : Math.round(p.stage_confidence * 100),
      daysToDrift: p.drift_date ? Math.round((new Date(`${p.drift_date}T12:00:00`).getTime() - now) / DAY) : null,
      daysSinceContact: lc ? Math.round((now - lc) / DAY) : null,
      app: s?.app_opens_30d ?? null, email: s?.email_opens_30d ?? null, whatsapp: s?.whatsapp_replies_30d ?? null,
      video: s?.video_minutes_30d ?? null, invites: s?.invites ?? null,
      courses: count(p.participant_id, (a) => a.activity_type === "course" || a.activity_type === "retreat"),
      gatherings: count(p.participant_id, (a) => a.activity_type === "event"),
      seva: count(p.participant_id, (a) => a.activity_type === "seva"),
    };
  });
}

export type MetricKey = Exclude<keyof Row, "id" | "name" | "stage">;
export const METRICS: { key: MetricKey; label: string; short: [string, string]; unit?: string; integer?: boolean }[] = [
  { key: "engagement", label: "Engagement score (model)", short: ["Low engagement","High engagement"] },
  { key: "trend", label: "Engagement trend (model)", short: ["Falling","Rising"] },
  { key: "confidence", label: "Stage confidence (model)", short: ["Less certain","More certain"], unit: "%" },
  { key: "daysToDrift", label: "Days until predicted drift (model)", short: ["Drifting soon","Drift far off"], integer: true },
  { key: "daysSinceContact", label: "Days since last contact", short: ["Recently contacted","Long since contact"], integer: true },
  { key: "app", label: "App opens, last 30 days", short: ["Rarely opens app","Opens app often"], integer: true },
  { key: "email", label: "Email opens, last 30 days", short: ["Ignores email","Opens email"], integer: true },
  { key: "whatsapp", label: "WhatsApp replies, last 30 days", short: ["Silent on WhatsApp","Replies on WhatsApp"], integer: true },
  { key: "video", label: "Video minutes, last 30 days", short: ["Little video","Watches video"], integer: true },
  { key: "invites", label: "Invites received", short: ["Few invites","Many invites"], integer: true },
  { key: "courses", label: "Courses & retreats taken", short: ["Few courses","Many courses"], integer: true },
  { key: "gatherings", label: "Gatherings attended", short: ["Few gatherings","Many gatherings"], integer: true },
  { key: "seva", label: "Times of seva", short: ["Little seva","Lots of seva"], integer: true },
];

export const median = (xs: number[]) => {
  const v = [...xs].sort((a, b) => a - b);
  if (!v.length) return 0;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

/** Stage order is fixed, so each stage keeps its colour whatever the filter. */
export const STAGES = ["new", "practicing", "slipping", "drifting", "dormant"] as const;

/** The engine's acceptance-rate table uses its own stage names. */
export const ENGINE_STAGE: Record<string, string> = {
  new: "New", practicing: "Active", slipping: "Slipping", drifting: "Drifting", dormant: "Dormant",
};
