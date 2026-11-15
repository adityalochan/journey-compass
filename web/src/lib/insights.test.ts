import { describe, expect, it } from "vitest";
import { buildRows, ENGINE_STAGE, METRICS, median, STAGES, type CoordPerson, type GroupData } from "./insights";

const day = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); };

const person = (id: string, over: Partial<CoordPerson> = {}): CoordPerson => ({
  participant_id: id, first_name: "Asha", last_name: "Test", city: "Toronto", stage: "slipping",
  stage_confidence: 0.82, stage_drivers: null, engagement_score: 40, trend_points: -3, drift_date: day(12),
  chosen_offer_id: null, chosen_offer_name: null, chosen_by: "engine", coordinator_reason: null, suggested_channel: "email",
  next_steps: [], ...over,
});

describe("median", () => {
  it("handles odd, even and empty lists", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBe(0);
  });
  it("does not reorder the caller's array", () => {
    const xs = [3, 1, 2];
    median(xs);
    expect(xs).toEqual([3, 1, 2]);
  });
});

describe("buildRows", () => {
  const group: GroupData = {
    signals: new Map([["a", { participant_id: "a", app_opens_30d: 4, email_opens_30d: 2, whatsapp_replies_30d: 1, video_minutes_30d: 30, invites: 3 }]]),
    activities: [
      { participant_id: "a", date: "2025-01-01", activity_type: "course", subtype: null, name: "Happiness Program" },
      { participant_id: "a", date: "2025-02-01", activity_type: "retreat", subtype: null, name: "Silence retreat" },
      { participant_id: "a", date: "2025-03-01", activity_type: "event", subtype: null, name: "Satsang" },
      { participant_id: "a", date: "2025-04-01", activity_type: "seva", subtype: null, name: "Kitchen" },
      { participant_id: "b", date: "2025-04-01", activity_type: "seva", subtype: null, name: "Not Asha's" },
    ],
    contacts: [
      { participant_id: "a", at: `${day(-20)}T12:00:00`, channel: "email", direction: "out" },
      { participant_id: "a", at: `${day(-5)}T12:00:00`, channel: "whatsapp", direction: "in" },
    ],
    rates: [],
  };

  it("turns one coordinator row plus their activity into one numeric row", () => {
    const [r] = buildRows([person("a")], group);
    expect(r).toMatchObject({
      id: "a", name: "Asha Test", stage: "slipping", engagement: 40, trend: -3, confidence: 82,
      daysToDrift: 12, daysSinceContact: 5, app: 4, email: 2, whatsapp: 1, video: 30, invites: 3,
      courses: 2, gatherings: 1, seva: 1, // a retreat counts as a course
    });
  });

  it("uses nulls, not zeros, when the data is missing", () => {
    const [r] = buildRows([person("c", { stage: null, stage_confidence: null, drift_date: null, last_name: null })], group);
    expect(r).toMatchObject({ name: "Asha", stage: "unknown", confidence: null, daysToDrift: null, daysSinceContact: null, app: null, courses: 0 });
  });
});

describe("metric and stage tables", () => {
  it("every metric key exists on a row", () => {
    const [r] = buildRows([person("a")], { signals: new Map(), activities: [], contacts: [], rates: [] });
    for (const m of METRICS) expect(r).toHaveProperty(m.key);
    expect(new Set(METRICS.map((m) => m.key)).size).toBe(METRICS.length);
  });
  it("maps every participant stage to an engine stage", () => {
    for (const s of STAGES) expect(ENGINE_STAGE[s]).toBeTruthy();
  });
});
