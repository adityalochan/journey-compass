import { describe, expect, it } from "vitest";
import { formatPhone, phoneOk } from "./StayConnected";

describe("formatPhone", () => {
  it("formats North American numbers as you type", () => {
    expect(formatPhone("4")).toBe("+1 (4");
    expect(formatPhone("41655")).toBe("+1 (416) 55");
    expect(formatPhone("4165550123")).toBe("+1 (416) 555-0123");
    expect(formatPhone("1-416-555-0123")).toBe("+1 (416) 555-0123");
    expect(formatPhone("+1 416 555 0123 999")).toBe("+1 (416) 555-0123"); // extra digits dropped
  });
  it("lets backspace walk back through +1", () => {
    expect(formatPhone("+1")).toBe("+1");
    expect(formatPhone("+")).toBe("+");
    expect(formatPhone("")).toBe("");
  });
  it("keeps other countries' own spacing", () => {
    expect(formatPhone("+91 98765 43210")).toBe("+91 98765 43210");
    expect(formatPhone("+44 (20) 7946-0018")).toBe("+44 20 79460018");
  });
});

describe("phoneOk", () => {
  it("needs a full number", () => {
    expect(phoneOk("+1 (416) 555-0123")).toBe(true);
    expect(phoneOk("+1 (416) 555")).toBe(false);
    expect(phoneOk("+91 98765 43210")).toBe(true);
    expect(phoneOk("+44 12")).toBe(false);
  });
});
