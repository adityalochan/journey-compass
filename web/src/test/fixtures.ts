// Small made-up people and steps for tests. Not real participants.
import type { Participant } from "../../../src/types";
import type { NextStep } from "../lib/steps";

export function person(over: Partial<Participant> = {}): Participant {
  return {
    id: "p_test", firstName: "Asha", lastName: "Test", email: "asha@example.org", phone: "+1 (416) 555-0100",
    city: "Toronto", province: "ON", language: "en", assignedTo: "Anita Rao", joinedAt: "2025-01-10",
    courses: [{ programId: "hp", name: "Happiness Program", completedAt: "2025-02-01", city: "Toronto", teacher: "Anita Rao" }],
    events: [
      { name: "Weekly satsang", type: "satsang", date: "2025-03-01", city: "Toronto" },
      { name: "Kitchen seva", type: "seva", date: "2025-04-01", city: "Toronto" },
    ],
    invites: 2, contacts: [], signals: { appOpens30d: 1, emailOpens30d: 2, whatsappReplies30d: 0, videoMinutes30d: 5 },
    skills: [], interests: [], notes: [],
    ...over,
  };
}

const iso = (days: number) => {
  const d = new Date(Date.now() + days * 86_400_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T19:00`;
};

export function step(over: Partial<NextStep> = {}): NextStep {
  return { offer_id: "o_sky", name: "Sahaj Samadhi Meditation", kind: "course", when: "Next Saturday", why: "A gentle next step.", start: iso(10), durationMin: 120, ...over };
}
export const inDays = iso;
