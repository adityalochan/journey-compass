import { describe, expect, it } from "vitest";
import { daysUntil, isActive } from "./steps";
import { inDays, step } from "../test/fixtures";

describe("daysUntil", () => {
  it("counts whole days until the step starts", () => {
    expect(daysUntil(step({ start: inDays(10) }))).toBe(10);
  });
  it("is 0 for a session later today", () => {
    expect(daysUntil(step({ start: inDays(0) }))).toBe(0);
  });
  it("is null for a step with no date (e.g. a call)", () => {
    expect(daysUntil(step({ kind: "call", start: null }))).toBeNull();
  });
  it("never goes below zero for a date in the past", () => {
    expect(daysUntil(step({ start: inDays(-5) }))).toBe(0);
  });
});

describe("isActive", () => {
  it("treats new and practicing as active, the rest as not", () => {
    expect(isActive("new")).toBe(true);
    expect(isActive("practicing")).toBe(true);
    for (const s of ["slipping", "drifting", "dormant"] as const) expect(isActive(s)).toBe(false);
  });
});
