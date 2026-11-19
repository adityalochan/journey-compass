import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addToCalendar, calendarLinks, downloadIcs, placeFor, preferredCalendar, useEnrollments } from "./enrollment";
import { person, step } from "../test/fixtures";

// A fake Supabase: records what would have been written, never touches the real database.
const db = vi.hoisted(() => {
  const s = {
    rows: [] as { offer_id: string; status: string }[],
    upsertError: null as null | { message: string },
    updateError: null as null | { message: string },
    writes: [] as unknown[][],
  };
  const from = (table: string) => ({
    select: () => ({ neq: () => Promise.resolve({ data: [...s.rows], error: null }) }),
    upsert: (row: unknown, opts: unknown) => { s.writes.push(["upsert", table, row, opts]); return Promise.resolve({ error: s.upsertError }); },
    update: (patch: unknown) => {
      const eqs: unknown[][] = [];
      const chain = {
        eq: (k: string, v: unknown) => {
          eqs.push([k, v]);
          if (eqs.length < 2) return chain;
          s.writes.push(["update", table, patch, eqs]);
          return Promise.resolve({ error: s.updateError });
        },
      };
      return chain;
    },
  });
  return { s, supabase: { from } };
});
vi.mock("./supabase", () => ({ supabase: db.supabase, hasSupabaseKey: true }));

const sky = step({ offer_id: "o_sky", name: "Sahaj Samadhi Meditation" });
const satsang = step({ offer_id: "o_sat", name: "Weekly satsang", kind: "event" });
const steps = [sky, satsang];
const flush = () => act(async () => { await Promise.resolve(); }); // let the first load finish

beforeEach(() => {
  db.s.rows = []; db.s.writes = []; db.s.upsertError = null; db.s.updateError = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("useEnrollments", () => {
  it("loads requested and confirmed bookings from Supabase", async () => {
    db.s.rows = [{ offer_id: "o_sky", status: "requested" }, { offer_id: "o_sat", status: "booked" }];
    const { result } = renderHook(() => useEnrollments("p_test", steps));
    await waitFor(() => expect(result.current.enrolled.size).toBe(2));
    expect([...result.current.confirmed]).toEqual(["Weekly satsang"]); // only "booked" counts as confirmed
  });

  it("enroll shows the booking at once and saves a 'requested' row", async () => {
    const { result } = renderHook(() => useEnrollments("p_test", steps));
    await flush();
    await act(() => result.current.enroll("Sahaj Samadhi Meditation"));
    expect(result.current.enrolled.has("Sahaj Samadhi Meditation")).toBe(true);
    expect(result.current.confirmed.size).toBe(0);
    expect(db.s.writes).toContainEqual(["upsert", "interests",
      { participant_id: "p_test", offer_id: "o_sky", status: "requested" }, { onConflict: "participant_id,offer_id" }]);
  });

  it("undoes the booking on screen if saving fails", async () => {
    db.s.upsertError = { message: "network down" };
    const { result } = renderHook(() => useEnrollments("p_test", steps));
    await flush();
    await act(() => result.current.enroll("Sahaj Samadhi Meditation"));
    expect(result.current.enrolled.size).toBe(0);
  });

  it("unenroll marks the row cancelled for this person and offer only", async () => {
    db.s.rows = [{ offer_id: "o_sky", status: "requested" }];
    const { result } = renderHook(() => useEnrollments("p_test", steps));
    await waitFor(() => expect(result.current.enrolled.size).toBe(1));
    await act(() => result.current.unenroll("Sahaj Samadhi Meditation"));
    expect(result.current.enrolled.size).toBe(0);
    expect(db.s.writes).toContainEqual(["update", "interests", { status: "cancelled" }, [["participant_id", "p_test"], ["offer_id", "o_sky"]]]);
  });

  it("puts a confirmed booking back if cancelling fails", async () => {
    db.s.rows = [{ offer_id: "o_sky", status: "booked" }];
    db.s.updateError = { message: "denied" };
    const { result } = renderHook(() => useEnrollments("p_test", steps));
    await waitFor(() => expect(result.current.confirmed.size).toBe(1));
    await act(() => result.current.unenroll("Sahaj Samadhi Meditation"));
    expect(result.current.confirmed.has("Sahaj Samadhi Meditation")).toBe(true);
  });

  it("ignores steps without an offer id (nothing to save)", async () => {
    const { result } = renderHook(() => useEnrollments("p_test", [step({ offer_id: undefined, name: "Loose step" })]));
    await flush();
    await act(() => result.current.enroll("Loose step"));
    expect(db.s.writes).toEqual([]);
  });

  it("picks up a coordinator's confirmation when the tab regains focus", async () => {
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    db.s.rows = [{ offer_id: "o_sky", status: "requested" }];
    const { result } = renderHook(() => useEnrollments("p_test", steps));
    await waitFor(() => expect(result.current.enrolled.size).toBe(1));
    db.s.rows = [{ offer_id: "o_sky", status: "booked" }]; // coordinator accepted
    act(() => { window.dispatchEvent(new Event("focus")); });
    await waitFor(() => expect(result.current.confirmed.has("Sahaj Samadhi Meditation")).toBe(true));
  });

  it("refreshes every 10 seconds while the page is open", async () => {
    vi.useFakeTimers();
    try {
      Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
      const { result } = renderHook(() => useEnrollments("p_test", steps));
      await act(async () => { await Promise.resolve(); });
      db.s.rows = [{ offer_id: "o_sat", status: "booked" }];
      await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
      expect(result.current.confirmed.has("Weekly satsang")).toBe(true);
    } finally { vi.useRealTimers(); }
  });
});

describe("placeFor", () => {
  const p = person();
  it("says Online, a phone call with the coordinator, or the local centre", () => {
    expect(placeFor(step({ online: true }), p)).toBe("Online");
    expect(placeFor(step({ kind: "call", online: false }), p)).toBe("Phone call with Anita Rao");
    expect(placeFor(step({ online: false }), p)).toBe("Art of Living Centre, Toronto");
  });
});

describe("downloadIcs", () => {
  it("builds a calendar file with the step's time, place and teacher", async () => {
    let blob: Blob | undefined;
    URL.createObjectURL = vi.fn((b: Blob) => { blob = b; return "blob:test"; });
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    downloadIcs(step({ start: "2026-12-05T19:00", durationMin: 90 }), person());
    expect(click).toHaveBeenCalled();
    const ics = await new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsText(blob!); });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("DTSTART:20261205T190000");
    expect(ics).toContain("DTEND:20261205T203000");
    expect(ics).toContain("SUMMARY:Sahaj Samadhi Meditation");
    expect(ics).toContain("LOCATION:Art of Living Centre, Toronto");
    expect(ics).toContain("Teacher: Anita Rao");
  });
  it("does nothing for a step with no date", () => {
    URL.createObjectURL = vi.fn();
    downloadIcs(step({ start: null }), person());
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});

describe("Add to calendar, per device", () => {
  const UA = {
    mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Safari/605.1.15",
    iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
    windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
    android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36",
    chromebook: "Mozilla/5.0 (X11; CrOS x86_64 15886.0.0) AppleWebKit/537.36 Chrome/126 Safari/537.36",
  };
  it("Apple devices and Windows get the .ics file; Android and Chromebooks get Google Calendar", () => {
    expect(preferredCalendar(UA.mac)).toBe("ics");
    expect(preferredCalendar(UA.iphone)).toBe("ics");
    expect(preferredCalendar(UA.windows)).toBe("ics");
    expect(preferredCalendar(UA.android)).toBe("google");
    expect(preferredCalendar(UA.chromebook)).toBe("google");
  });

  it("builds filled-in Google Calendar and Outlook.com links", () => {
    const links = calendarLinks(step({ start: "2026-12-05T19:00", durationMin: 90 }), person())!;
    const g = new URL(links.google), o = new URL(links.outlook);
    expect(g.hostname).toBe("calendar.google.com");
    expect(g.searchParams.get("dates")).toBe("20261205T190000/20261205T203000");
    expect(g.searchParams.get("text")).toBe("Sahaj Samadhi Meditation");
    expect(g.searchParams.get("location")).toBe("Art of Living Centre, Toronto");
    expect(o.hostname).toBe("outlook.live.com");
    expect(o.searchParams.get("startdt")).toBe("2026-12-05T19:00:00");
    expect(o.searchParams.get("enddt")).toBe("2026-12-05T20:30:00");
    expect(calendarLinks(step({ start: null }), person())).toBeNull();
  });

  it("on Android, Add to calendar opens Google Calendar instead of downloading a file", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(UA.android);
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    URL.createObjectURL = vi.fn();
    addToCalendar(step({ start: "2026-12-05T19:00" }), person());
    expect(String(open.mock.calls[0][0])).toContain("calendar.google.com");
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("on a Mac, Add to calendar downloads the .ics file", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(UA.mac);
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    URL.createObjectURL = vi.fn(() => "blob:test");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    addToCalendar(step({ start: "2026-12-05T19:00" }), person());
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });
});
