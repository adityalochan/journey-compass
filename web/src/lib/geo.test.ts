import { describe, expect, it, vi } from "vitest";
import { CENTRES, distanceKm, geocode, knownCity } from "./geo";

describe("distanceKm", () => {
  it("is zero for the same point", () => {
    expect(distanceKm({ lat: 43.65, lng: -79.38 }, { lat: 43.65, lng: -79.38 })).toBe(0);
  });
  it("gives the real Toronto–Montreal distance (about 504 km)", () => {
    const d = distanceKm({ lat: 43.6532, lng: -79.3832 }, { lat: 45.5019, lng: -73.5674 });
    expect(d).toBeGreaterThan(495);
    expect(d).toBeLessThan(515);
  });
});

describe("knownCity / geocode", () => {
  it("resolves common cities offline, ignoring case", () => {
    expect(knownCity("Toronto")).toMatchObject({ lat: 43.6532, lng: -79.3832 });
    expect(knownCity("VANCOUVER")).not.toBeNull();
    expect(knownCity("Atlantis")).toBeNull();
  });
  it("answers a known city without any network call", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await geocode("Ottawa, ON")).toMatchObject({ lat: 45.4215 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it("asks OpenStreetMap for an unknown place and returns null when nothing matches", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("[]", { status: 200 }));
    expect(await geocode("Nowhere Village")).toBeNull();
    expect(String(fetchSpy.mock.calls[0][0])).toContain("nominatim.openstreetmap.org");
  });
  it("parses an OpenStreetMap hit", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([{ lat: "1.5", lon: "2.5", display_name: "A, B, C, D" }])));
    expect(await geocode("Somewhere")).toEqual({ label: "A, B, C", lat: 1.5, lng: 2.5 });
  });
});

describe("community centres data", () => {
  it("has centres with valid coordinates and ids", () => {
    expect(CENTRES.length).toBeGreaterThan(0);
    for (const c of CENTRES) {
      expect(c.id).toBeTruthy();
      expect(Math.abs(c.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(c.lng)).toBeLessThanOrEqual(180);
    }
    expect(new Set(CENTRES.map((c) => c.id)).size).toBe(CENTRES.length);
  });
});
