import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import EnrollDialog, { usableRegistrationUrl } from "./EnrollDialog";
import { person, step } from "../test/fixtures";

const sky = step({ name: "Sahaj Samadhi Meditation" });
const props = () => ({ person: person(), onConfirm: vi.fn(), onCancel: vi.fn(), onClose: vi.fn() });

describe("EnrollDialog", () => {
  it("confirming books the step and does not offer cancel straight away", async () => {
    const p = props();
    render(<EnrollDialog {...p} step={sky} alreadyBooked={false} />);
    expect(screen.getByText("Art of Living Centre, Toronto")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Confirm my spot" }));
    expect(p.onConfirm).toHaveBeenCalledOnce();
    expect(screen.getByText("Request sent")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel my spot" })).toBeNull();
    expect(screen.getByRole("button", { name: "Add to calendar" })).toBeInTheDocument();
  });

  it("reopening a booking offers cancel, then shows only 'Back to my journey'", async () => {
    const p = props();
    render(<EnrollDialog {...p} step={sky} alreadyBooked />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel my spot" }));
    expect(p.onCancel).toHaveBeenCalledOnce();
    expect(screen.getByText("Booking cancelled")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm my spot" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Back to my journey" }));
    expect(p.onClose).toHaveBeenCalled();
  });

  it("a call asks the coordinator to call, with no calendar file", async () => {
    const p = props();
    render(<EnrollDialog {...p} step={step({ name: "Call", kind: "call", start: null })} alreadyBooked={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Yes, ask Anita to call me" }));
    expect(screen.getByText("Anita will call you soon")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add to calendar" })).toBeNull();
  });

  it("a real registration page is offered as a button; no new tab opens by itself", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const p = props();
    render(<EnrollDialog {...p} step={step({ registrationUrl: "https://www.artofliving.org/ca-en/register" })} alreadyBooked={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Confirm my spot" }));
    expect(open).not.toHaveBeenCalled();
    expect(screen.getByText("Almost there!")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open registration page" })).toHaveAttribute("href", "https://www.artofliving.org/ca-en/register");
  });

  it("placeholder links from the mock data are ignored: the step books like any other", async () => {
    for (const url of ["https://www.eventbrite.com/e/eb-0700000592", "https://members.artofliving.org/reg/HM-30002541"]) {
      const p = props();
      const { unmount } = render(<EnrollDialog {...p} step={step({ registrationUrl: url })} alreadyBooked={false} />);
      await userEvent.click(screen.getByRole("button", { name: "Confirm my spot" }));
      expect(screen.getByText("Request sent")).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Open registration page" })).toBeNull();
      unmount();
    }
  });

  it("closes on Escape, and on 'Not now'", async () => {
    const p = props();
    render(<EnrollDialog {...p} step={sky} alreadyBooked={false} />);
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(p.onClose).toHaveBeenCalledTimes(2);
    expect(p.onConfirm).not.toHaveBeenCalled();
  });
});

describe("usableRegistrationUrl", () => {
  it("keeps real links and drops the mock placeholders", () => {
    expect(usableRegistrationUrl("https://www.eventbrite.ca/e/happiness-program-tickets-123456789012")).toContain("eventbrite.ca");
    expect(usableRegistrationUrl("https://www.eventbrite.com/e/eb-0700000592")).toBeNull();
    expect(usableRegistrationUrl("https://members.artofliving.org/reg/HM-30002541")).toBeNull();
    expect(usableRegistrationUrl(null)).toBeNull();
  });
});
