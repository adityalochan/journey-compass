import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/supabase", () => ({ supabase: { from: vi.fn(), auth: {} }, hasSupabaseKey: true }));
import { Card, canMarkAttended, outcomeState } from "./Coordinator";

// A made-up coordinator row with a pending request.
const person = (over: Record<string, unknown> = {}) => ({
  participant_id: "p_test", first_name: "Amrit", last_name: "Test", email: "amrit@example.org", city: "Brampton",
  stage: "slipping", drift_date: null, do_not_contact: false, next_steps: [], chosen_offer_id: "o1", chosen_offer_name: "Kitchen seva",
  chosen_by: "engine", coordinator_reason: null, suggested_channel: "whatsapp", draft_message: null, notes: null, phone: null,
  latest_outcome: null, request_status: "requested", request_offer_id: "o1", request_offer_name: "Kitchen seva",
  ...over,
}) as never;

describe("outcomeState", () => {
  const rows = (...r: string[]) => r.map((result) => ({ participant_id: "p_test", offer_id: "o1", result })) as never;
  it("Accepted / Declined is one decision: the latest wins", () => {
    expect(outcomeState(person({ request_status: null }), rows("accepted", "declined")).decision).toBe("declined");
    expect(outcomeState(person({ request_status: null }), rows("declined", "accepted")).decision).toBe("accepted");
  });
  it("Attended and No reply are separate marks that can both be on, next to the decision", () => {
    expect(outcomeState(person({ request_status: null }), rows("accepted", "no_response", "attended")))
      .toEqual({ decision: "accepted", attended: true, noReply: true });
  });
  it("ignores outcomes for other offers; a waiting request has no decision; a confirmed booking is Accepted", () => {
    expect(outcomeState(person(), [{ participant_id: "p_test", offer_id: "other", result: "accepted" }] as never).decision).toBeNull();
    expect(outcomeState(person(), rows("accepted")).decision).toBeNull();
    expect(outcomeState(person({ request_status: "booked" }), rows("declined")).decision).toBe("accepted");
  });
  it("after a mark is cleared (no rows left), nothing is on, even if the old latest_outcome says otherwise", () => {
    expect(outcomeState(person({ request_status: null, latest_outcome: "accepted" }), [])).toEqual({ decision: null, attended: false, noReply: false });
  });
});

describe("Attended and the event date", () => {
  const iso = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
  const rows = [{ participant_id: "p_test", offer_id: "o1", result: "attended" }] as never;
  it("can't be marked before the event, or on the day itself; can after it, or when there's no date", () => {
    expect(canMarkAttended(iso(5))).toBe(false);
    expect(canMarkAttended(iso(0))).toBe(false);
    expect(canMarkAttended(iso(-1))).toBe(true);
    expect(canMarkAttended(null)).toBe(true);
  });
  it("an Attended saved before the event date is not shown", () => {
    expect(outcomeState(person({ request_status: "booked" }), rows, iso(5)).attended).toBe(false);
    expect(outcomeState(person({ request_status: "booked" }), rows, iso(-2)).attended).toBe(true);
  });
  it("Attended never shows for a request that isn't accepted, even if it was clicked earlier (no date)", () => {
    expect(outcomeState(person(), rows, null).attended).toBe(false);                               // waiting
    expect(outcomeState(person({ request_status: "cancelled" }), [...(rows as unknown as object[]), { participant_id: "p_test", offer_id: "o1", result: "declined" }] as never, null).attended).toBe(false);
    expect(outcomeState(person({ request_status: "booked" }), rows, null).attended).toBe(true);    // accepted
  });
  it("the Attended chip is greyed out until the request is accepted", () => {
    render(<Card p={person()} onRecord={vi.fn()} onVisualize={vi.fn()} />);
    const chip = screen.getByRole("button", { name: "Attended" });
    expect(chip).toBeDisabled();
    expect(chip).toHaveAttribute("title", "Accept first");
    expect(chip).toHaveAttribute("aria-pressed", "false");
  });
  it("the Attended chip is greyed out before the event, with the date on hover", () => {
    render(<Card p={person({ request_status: "booked" })} eventDate={iso(5)} onRecord={vi.fn()} onVisualize={vi.fn()} />);
    const chip = screen.getByRole("button", { name: "Attended" });
    expect(chip).toBeDisabled();
    expect(chip.getAttribute("title")).toMatch(/^Available after /);
  });
});

describe("Coordinator card: a participant's request", () => {
  it("shows who asked for what, with Accept request and Decline", () => {
    render(<Card p={person()} onRecord={vi.fn()} onVisualize={vi.fn()} />);
    expect(screen.getByRole("group", { name: "Request from Amrit" })).toHaveTextContent("Amrit asked for Kitchen seva");
    expect(screen.getByRole("button", { name: "✓ Accept request" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decline" })).toBeInTheDocument();
  });

  it("Accept saves 'accepted' (which confirms the booking) and blocks double clicks while saving", async () => {
    let finish: () => void = () => {};
    const onRecord = vi.fn(() => new Promise<void>((ok) => { finish = ok; }));
    render(<Card p={person()} onRecord={onRecord} onVisualize={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "✓ Accept request" }));
    expect(onRecord).toHaveBeenCalledWith(expect.objectContaining({ participant_id: "p_test" }), "accepted");
    expect(screen.getByRole("button", { name: "Accepting…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Decline" })).toBeDisabled();
    finish();
    expect(await screen.findByRole("button", { name: "✓ Accept request" })).toBeEnabled();
  });

  it("Decline saves 'declined' (which releases the booking)", async () => {
    const onRecord = vi.fn();
    render(<Card p={person()} onRecord={onRecord} onVisualize={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(onRecord).toHaveBeenCalledWith(expect.anything(), "declined");
  });

  it("after accepting: a Confirmed line instead of the buttons", () => {
    render(<Card p={person({ request_status: "booked" })} onRecord={vi.fn()} onVisualize={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "✓ Accept request" })).toBeNull();
    expect(screen.getAllByRole("status").some((s) => /Confirmed: Kitchen seva/.test(s.textContent ?? ""))).toBe(true);
  });

  it("after declining: says the request was released", () => {
    render(<Card p={person({ request_status: "cancelled" })} onRecord={vi.fn()} onVisualize={vi.fn()} />);
    expect(screen.getByText(/Request declined: Kitchen seva/)).toBeInTheDocument();
  });

  it("while a request waits, neither Accepted nor Declined is on, even if an old 'Accepted' was saved", () => {
    render(<Card p={person({ latest_outcome: "accepted" })} onRecord={vi.fn()} onVisualize={vi.fn()} />);
    expect(screen.getByRole("group", { name: "Outcome for Amrit" })).toHaveTextContent("Outcome:");
    expect(screen.getByRole("button", { name: "Accepted" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Declined" })).toHaveAttribute("aria-pressed", "false");
  });

  it("once accepted, Accepted is on right away", () => {
    render(<Card p={person({ request_status: "booked" })} onRecord={vi.fn()} onVisualize={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Accepted" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Saved: Accepted")).toBeInTheDocument();
  });

  it("Accepted, Attended and No reply can all be on together", () => {
    render(<Card p={person({ request_status: "booked" })} outcome={{ decision: "accepted", attended: true, noReply: true }}
      onRecord={vi.fn()} onVisualize={vi.fn()} />);
    for (const name of ["Accepted", "Attended", "No reply"]) expect(screen.getByRole("button", { name })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Declined" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Saved: Accepted · Attended · No reply")).toBeInTheDocument();
  });

  it("clicking a highlighted chip clears it; clicking an empty one saves it", async () => {
    const onRecord = vi.fn(), onClear = vi.fn();
    render(<Card p={person({ request_status: "booked" })} outcome={{ decision: "accepted", attended: true, noReply: false }}
      onRecord={onRecord} onClear={onClear} onVisualize={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Accepted" }));
    await userEvent.click(screen.getByRole("button", { name: "Attended" }));
    expect(onClear.mock.calls.map((c) => c[1])).toEqual(["accepted", "attended"]);
    await userEvent.click(screen.getByRole("button", { name: "No reply" }));
    await userEvent.click(screen.getByRole("button", { name: "Declined" }));
    expect(onRecord.mock.calls.map((c) => c[1])).toEqual(["no_response", "declined"]);
  });

  it("Declined is shown in red when it is on", () => {
    render(<Card p={person({ request_status: "cancelled" })} outcome={{ decision: "declined", attended: false, noReply: false }}
      onRecord={vi.fn()} onVisualize={vi.fn()} />);
    const declined = screen.getByRole("button", { name: "Declined" });
    expect(declined).toHaveClass("co-chip-declined", "is-on");
    expect(screen.getByText("Saved: Declined")).toHaveClass("co-saved-declined");
  });

  it("no request box for do-not-contact people", () => {
    render(<Card p={person({ do_not_contact: true })} onRecord={vi.fn()} onVisualize={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "✓ Accept request" })).toBeNull();
  });
});
