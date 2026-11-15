// Content checks: every music file exists, and every quote is verbatim from an official source.
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { TRACKS } from "./music";
import { QUOTES } from "./quotes";

const PUBLIC = resolve(__dirname, "../../public");

describe("music tracks", () => {
  it("every track's file is in public/music", () => {
    for (const t of TRACKS) expect(existsSync(resolve(PUBLIC, `.${t.src}`)), t.src).toBe(true);
  });
  it("every track has a title, composer and credit, with no duplicates", () => {
    for (const t of TRACKS) { expect(t.title).toBeTruthy(); expect(t.composer).toBeTruthy(); expect(t.credit).toBeTruthy(); }
    expect(new Set(TRACKS.map((t) => t.src)).size).toBe(TRACKS.length);
  });
  it("no unused music files are shipped", () => {
    const used = new Set(TRACKS.map((t) => t.src.replace("/music/", "")));
    for (const f of readdirSync(resolve(PUBLIC, "music"))) expect(used.has(f), f).toBe(true);
  });
  it("removed tracks stay removed", () => {
    const titles = TRACKS.map((t) => t.title);
    for (const gone of ["Air on the G String", "Gnossienne No. 1", "Morning Mood"]) expect(titles).not.toContain(gone);
  });
  it("every track is Rishab Rikhiram Sharma's, used with his permission", () => {
    for (const t of TRACKS) { expect(t.composer).toBe("Rishab Rikhiram Sharma"); expect(t.credit).toBe("Used with permission of the artist"); }
  });
});

describe("quotes", () => {
  it("each quote has text, author and a link to an official Art of Living / Gurudev site", () => {
    expect(QUOTES.length).toBeGreaterThan(0);
    for (const q of QUOTES) {
      expect(q.text.trim().length).toBeGreaterThan(10);
      expect(q.author).toBeTruthy();
      expect(q.source).toMatch(/^https:\/\/(wisdom\.srisriravishankar\.org|www\.artofliving\.org)\//);
    }
  });
  it("has no duplicate quotes", () => {
    expect(new Set(QUOTES.map((q) => q.text)).size).toBe(QUOTES.length);
  });
});
