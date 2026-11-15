// Task 5: enroll / request / cancel are rows in Supabase's `interests` table, keyed by offer_id.
// The UI still asks "is this step booked?" by step name, so the hook maps names <-> offer ids.
import { useCallback, useEffect, useState } from "react";
import type { Participant } from "../../../src/types";
import type { NextStep } from "./steps";
import { supabase } from "./supabase";

export function useEnrollments(participantId: string, steps: NextStep[]) {
  const [offerIds, setOfferIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let live = true;
    supabase.from("interests").select("offer_id,status").neq("status", "cancelled").then(({ data, error }) => {
      if (error) console.error("Loading requests failed:", error.message);
      if (live && data) setOfferIds(new Set(data.map((r: { offer_id: string }) => r.offer_id)));
    });
    return () => { live = false; };
  }, [participantId]);

  const idFor = useCallback((name: string) => steps.find((s) => s.name === name)?.offer_id, [steps]);
  const enrolled = new Set(steps.filter((s) => s.offer_id && offerIds.has(s.offer_id)).map((s) => s.name));

  const change = (offerId: string, on: boolean) =>
    setOfferIds((prev) => { const n = new Set(prev); if (on) n.add(offerId); else n.delete(offerId); return n; });

  async function enroll(name: string) {
    const offerId = idFor(name);
    if (!offerId) return;
    change(offerId, true); // optimistic
    const { error } = await supabase.from("interests").upsert(
      { participant_id: participantId, offer_id: offerId, status: "requested" },
      { onConflict: "participant_id,offer_id" });
    if (error) { console.error("Saving request failed:", error.message); change(offerId, false); }
  }

  async function unenroll(name: string) {
    const offerId = idFor(name);
    if (!offerId) return;
    change(offerId, false); // optimistic
    const { error } = await supabase.from("interests").update({ status: "cancelled" })
      .eq("participant_id", participantId).eq("offer_id", offerId);
    if (error) { console.error("Cancelling failed:", error.message); change(offerId, true); }
  }

  return { enrolled, enroll, unenroll };
}

export function placeFor(step: NextStep, person: Participant): string {
  if (step.online) return "Online";
  if (step.kind === "call") return `Phone call with ${person.assignedTo}`;
  return `Art of Living Centre, ${person.city}`;
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const local = (iso: string) => iso.replace(/[-:]/g, "") + "00";

/** Download an .ics file so the person can add the session to their calendar. */
export function downloadIcs(step: NextStep, person: Participant) {
  if (!step.start) return;
  const end = new Date(new Date(step.start).getTime() + (step.durationMin ?? 60) * 60_000);
  const endIso = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}T${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Journey Compass//EN", "BEGIN:VEVENT",
    `UID:${person.id}-${step.name.replace(/\W+/g, "-")}@journey-compass`,
    `DTSTAMP:${stamp(new Date())}`, `DTSTART:${local(step.start)}`, `DTEND:${local(endIso)}`,
    `SUMMARY:${step.name}`, `LOCATION:${placeFor(step, person)}`,
    `DESCRIPTION:Your next step with Art of Living. Teacher: ${person.assignedTo}.`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `${step.name}.ics` });
  a.click();
  URL.revokeObjectURL(url);
}
