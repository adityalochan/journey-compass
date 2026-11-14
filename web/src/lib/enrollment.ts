// Demo-only enrollments, remembered per participant in this browser. Nothing is actually booked.
import { useEffect, useState } from "react";
import type { Participant } from "../../../src/types";
import type { NextStep } from "./engine";

const key = (id: string) => `jc-enrolled-${id}`;

function load(id: string): string[] {
  try { return JSON.parse(localStorage.getItem(key(id)) ?? "[]"); } catch { return []; }
}

export function useEnrollments(personId: string) {
  const [names, setNames] = useState<string[]>(() => load(personId));
  useEffect(() => setNames(load(personId)), [personId]);

  function save(next: string[]) {
    setNames(next);
    try { localStorage.setItem(key(personId), JSON.stringify(next)); } catch { /* storage blocked */ }
  }
  const enroll = (name: string) => save(names.includes(name) ? names : [...names, name]);
  const unenroll = (name: string) => save(names.filter((n) => n !== name));
  return { enrolled: new Set(names), enroll, unenroll };
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
