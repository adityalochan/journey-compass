import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import EnrollDialog from "./EnrollDialog";
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

  it("opens the registration page when the step has one", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const p = props();
    render(<EnrollDialog {...p} step={step({ registrationUrl: "https://www.artofliving.org/ca-en/register" })} alreadyBooked={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Confirm my spot" }));
    expect(open).toHaveBeenCalledWith("https://www.artofliving.org/ca-en/register", "_blank", "noopener");
    expect(screen.getByText("Almost there!")).toBeInTheDocument();
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
