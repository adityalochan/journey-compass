import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import JourneySection, { buildSquares } from "./JourneySection";
import { inDays, person, step } from "../test/fixtures";

const sky = step({ offer_id: "o1", name: "Sahaj Samadhi Meditation" });
const satsang = step({ offer_id: "o2", name: "Weekly satsang", kind: "event", start: inDays(3) });
const call = step({ offer_id: "o3", name: "Call with Anita", kind: "call", start: null });
const none = new Set<string>();

describe("buildSquares (the journey board's order)", () => {
  it("puts the past first, then 'you are here', then suggestions with the first one as next", () => {
    const { squares } = buildSquares(person(), [sky, satsang, call], none, none);
    expect(squares.map((s) => s.state)).toEqual(["past", "past", "past", "here", "next", "future", "future"]);
    expect(squares.slice(0, 3).map((s) => s.title)).toEqual(["Happiness Program", "Weekly satsang", "Kitchen seva"]); // by date
  });

  it("puts a booking right after 'you are here', ahead of open suggestions", () => {
    const { squares } = buildSquares(person(), [sky, satsang, call], new Set(["Weekly satsang"]), none);
    const after = squares.slice(squares.findIndex((s) => s.state === "here") + 1);
    expect(after.map((s) => [s.title, s.state])).toEqual([
      ["Weekly satsang", "booked"], ["Sahaj Samadhi Meditation", "next"], ["Call with Anita", "future"],
    ]);
  });

  it("labels a booking Requested until the coordinator confirms it", () => {
    const booked = new Set(["Weekly satsang"]);
    const requested = buildSquares(person(), [satsang], booked, none).squares.find((s) => s.state === "booked")!;
    expect(requested).toMatchObject({ sub: "Requested", confirmed: false });
    const confirmed = buildSquares(person(), [satsang], booked, booked).squares.find((s) => s.state === "booked")!;
    expect(confirmed).toMatchObject({ sub: "Confirmed", confirmed: true });
  });

  it("moves a booking behind the walker only once its date has passed", () => {
    const past = step({ offer_id: "o4", name: "Last week's satsang", kind: "event", start: inDays(-7) });
    const { squares } = buildSquares(person(), [past, sky], new Set(["Last week's satsang"]), none);
    const here = squares.findIndex((s) => s.state === "here");
    expect(squares.findIndex((s) => s.title === "Last week's satsang")).toBeLessThan(here);
    expect(squares.find((s) => s.title === "Last week's satsang")!.state).toBe("past");
  });

  it("keeps the board short by hiding the oldest past steps", () => {
    const events = Array.from({ length: 20 }, (_, n) => ({ name: `Satsang ${n}`, type: "satsang" as const, date: `2025-01-${String(n + 1).padStart(2, "0")}`, city: "Toronto" }));
    const { squares, hidden } = buildSquares(person({ courses: [], events }), [], none, none);
    expect(hidden).toBe(9);
    expect(squares.filter((s) => s.state === "past")).toHaveLength(11);
    expect(squares[0].title).toBe("Satsang 9"); // the newest 11 stay
  });
});

describe("JourneySection", () => {
  it("shows counts, the coordinator and a ✓ Confirmed badge", () => {
    const booked = new Set(["Weekly satsang"]);
    render(<JourneySection person={person()} steps={[satsang, sky]} enrolled={booked} confirmed={booked} mood={null} onOpen={() => {}} />);
    expect(screen.getByText("Anita")).toBeInTheDocument();
    expect(screen.getByText("✓ Confirmed")).toBeInTheDocument();
    expect(screen.getByText("You are here")).toBeInTheDocument();
  });
});
