/// <reference types="vite/client" />
/**
 * Engine adapter: the website's only link to the recommendation engine.
 *
 * The Python engine writes src/data/engine_output.json (`python -m journey_compass.web_export`):
 * each participant's stage and top 3 next steps, already written for the participant. That file
 * is git-ignored (it holds real programme names and dates from the organisers' data), so it may be
 * missing on a fresh checkout. In that case the stand-in below (PRD §9 stage formula and a small
 * fixed offer list) is used, so the site always works.
 *
 * The UI only depends on `getStage`, `getRecommendations` and the types below.
 */
import type { Participant, Stage } from "../../../src/types";

interface EngineOutput {
  as_of: string;
  participants: Record<string, { stage: Stage; next_steps: NextStep[] }>;
}

// import.meta.glob returns {} when the file doesn't exist, instead of failing the build.
const found = import.meta.glob<EngineOutput>("../../../src/data/engine_output.json", { eager: true, import: "default" });
const engine: EngineOutput | undefined = Object.values(found)[0];

/** True when the site is showing the real engine's output rather than the stand-in. */
export const usingEngine = engine !== undefined;

/** Fixed "today", matching scripts/generate-data.mjs, so the demo is stable. */
export const AS_OF = new Date("2026-11-14T09:00:00-05:00");

const daysSince = (iso: string) => Math.floor((AS_OF.getTime() - new Date(iso).getTime()) / 86_400_000);

export function daysSinceContact(p: Participant): number {
  return p.contacts.length ? Math.min(...p.contacts.map((c) => daysSince(c.at))) : 400;
}

export function getStage(p: Participant): Stage {
  return engine?.participants[p.id]?.stage ?? standInStage(p);
}

function standInStage(p: Participant): Stage {
  const s = p.signals;
  const E = Math.min(100,
    3.2 * Math.min(s.appOpens30d, 20) + 2.4 * Math.min(s.emailOpens30d, 20) +
    5.0 * Math.min(s.whatsappReplies30d, 10) + 0.55 * Math.min(s.videoMinutes30d, 120));
  const days = daysSinceContact(p);
  const has = (id: string) => p.courses.some((c) => c.programId === id);
  const firstCourseDays = Math.max(...p.courses.map((c) => daysSince(c.completedAt)));
  const newestCourseDays = Math.min(...p.courses.map((c) => daysSince(c.completedAt)));

  const recency = 50 * Math.pow(Math.max(0, 1 - days / 240), 1.3);
  const eng = 20 * (E / 100);
  const practice = Math.min(12, 4 + 3 * +(has("part2") || has("sahaj")) + 3 * +has("silence") + 2 * +(newestCourseDays <= 365));
  const rate = p.invites > 0 ? Math.min(1, p.events.length / p.invites) : 0;
  const comm = firstCourseDays <= 21 ? 15 * 0.66 : 15 * rate;
  const score = Math.round(recency + eng + practice + comm);

  if (firstCourseDays <= 21 && score >= 60) return "new";
  if (score >= 62) return "practicing";
  if (score >= 42) return "slipping";
  if (score >= 22) return "drifting";
  return "dormant";
}

export const isActive = (stage: Stage) => stage === "new" || stage === "practicing";

export interface NextStep {
  name: string;
  kind: "course" | "retreat" | "event" | "seva" | "call";
  when: string;
  /** Written to the participant, never internal reasoning about them. */
  why: string;
}

const OFFERS = {
  sahaj: { name: "Sahaj Samadhi Meditation", kind: "course", when: "Nov 22" },
  part2: { name: "SKY Part 2", kind: "course", when: "Nov 28" },
  silence: { name: "Silence Retreat", kind: "course", when: "Dec 5" },
  circle: { name: "40-Day Practice Circle", kind: "event", when: "Starts Nov 18" },
  satsang: { name: "Full Moon Satsang", kind: "event", when: "Nov 24" },
  kitchen: { name: "Community Kitchen Seva", kind: "seva", when: "Nov 21" },
  refresh: { name: "Online Refresh Evening", kind: "event", when: "Dec 9 · online" },
  call: { name: "A conversation with your teacher", kind: "call", when: "Whenever suits you" },
} as const;

/** Up to three next steps, best first. Empty when the person asked not to be contacted. */
export function getRecommendations(p: Participant, stage: Stage): NextStep[] {
  if (p.doNotContact) return [];
  const fromEngine = engine?.participants[p.id]?.next_steps;
  return fromEngine ?? standInRecommendations(p, stage);
}

function standInRecommendations(p: Participant, stage: Stage): NextStep[] {
  const has = (id: string) => p.courses.some((c) => c.programId === id);
  const served = p.events.some((e) => e.type === "seva");
  const teacher = p.assignedTo.split(" ")[0];
  const steps: NextStep[] = [];

  if (isActive(stage)) {
    if (!has("part2")) steps.push({ ...OFFERS.part2, why: "The natural next step after SKY: deepen the practice you already have." });
    if (!has("sahaj")) steps.push({ ...OFFERS.sahaj, why: "Learn an effortless meditation to sit alongside your daily SKY." });
    if ((has("part2") || has("sahaj")) && !has("silence")) steps.push({ ...OFFERS.silence, why: "You've built a strong foundation. A few days of silence takes it deeper." });
    steps.push({ ...OFFERS.kitchen, why: served ? "You've served before. Your hands are welcome again." : "Give back alongside people who share your practice." });
  } else if (stage === "slipping") {
    steps.push({ ...OFFERS.circle, why: "Forty days, a small group, and a gentle way to make the practice daily again." });
    steps.push({ ...OFFERS.satsang, why: "An easy evening of music and meditation with your community." });
    steps.push({ ...OFFERS.kitchen, why: "Sometimes the best way back in is to help out." });
  } else {
    steps.push({ ...OFFERS.call, why: `${teacher} would love to hear how you've been. No agenda.` });
    steps.push({ ...OFFERS.refresh, why: "Refresh your SKY from home in one evening. No travel needed." });
    steps.push({ ...OFFERS.satsang, why: "Come as you are. There's always a place for you." });
  }
  return steps.slice(0, 3);
}
