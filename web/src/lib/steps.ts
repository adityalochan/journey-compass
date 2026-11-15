// The participant page's view of a next step. Rows come from Supabase's `next_steps` view (rank order).
// Kept separate from lib/engine.ts so the cohort/engine JSON never ships in the participant bundle.
import type { Stage } from "../../../src/types";

export interface NextStep {
  /** Offer id from Supabase; requests in `interests` are keyed by it. */
  offer_id?: string;
  name: string;
  kind: "course" | "retreat" | "event" | "seva" | "call";
  when: string;
  /** Written to the participant, never internal reasoning about them. */
  why: string;
  /** Local start time, ISO without zone. Absent for a call (arranged personally). */
  start?: string | null;
  durationMin?: number | null;
  /** Real capacity from the offer listing; absent when the gathering is open to all. */
  seatsLeft?: number;
  online?: boolean | null;
  /** Sign-up page for courses and events, when the organisers' listing has one. */
  registrationUrl?: string | null;
}

export const isActive = (stage: Stage) => stage === "new" || stage === "practicing";

/** Whole days from today until the step starts; null when it has no date. */
export function daysUntil(step: NextStep): number | null {
  if (!step.start) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(step.start);
  start.setHours(0, 0, 0, 0); // count calendar days: an evening session 10 days out is "10 days", today is 0
  return Math.max(0, Math.round((start.getTime() - today.getTime()) / 86_400_000));
}
