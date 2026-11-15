import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import NextStepsSection from "./NextStepsSection";
import { person, step } from "../test/fixtures";

const sky = step({ name: "Sahaj Samadhi Meditation" });
const call = step({ name: "Call with Anita", kind: "call", start: null });
const none = new Set<string>();

describe("NextStepsSection", () => {
  it("offers Enroll, and Request a call for a call", async () => {
    const onOpen = vi.fn();
    render(<NextStepsSection person={person()} stage="practicing" steps={[sky, call]} enrolled={none} confirmed={none} onOpen={onOpen} />);
    expect(screen.getByText("Go deeper")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Enroll" }));
    expect(onOpen).toHaveBeenCalledWith(sky);
    expect(screen.getByRole("button", { name: "Request a call" })).toBeInTheDocument();
  });

  it("says the request is waiting, then confirmed once the coordinator accepts", () => {
    const booked = new Set([sky.name]);
    const { rerender } = render(<NextStepsSection person={person()} stage="slipping" steps={[sky]} enrolled={booked} confirmed={none} onOpen={() => {}} />);
    expect(screen.getByRole("status")).toHaveTextContent("Request sent · waiting for your coordinator.");
    rerender(<NextStepsSection person={person()} stage="slipping" steps={[sky]} enrolled={booked} confirmed={booked} onOpen={() => {}} />);
    expect(screen.getByRole("status")).toHaveTextContent("✓ Confirmed by your coordinator. See you there!");
    expect(screen.getByText("Welcome back")).toBeInTheDocument();
  });

  it("respects do-not-contact: no steps, a kind message", () => {
    render(<NextStepsSection person={person()} stage="dormant" steps={[]} enrolled={none} confirmed={none} onOpen={() => {}} />);
    expect(screen.getByText(/You've asked us not to reach out/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
