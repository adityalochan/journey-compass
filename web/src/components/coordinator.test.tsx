import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import CoordinatorFilters, { applyFilters, EMPTY_FILTERS, type Filters } from "./CoordinatorFilters";
import CoordinatorHero from "./CoordinatorHero";

const day = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); };

const base = {
  first_name: "Asha", last_name: "Rao", email: "asha@example.org", city: "Toronto", stage: "slipping",
  drift_date: day(5), chosen_by: "engine", suggested_channel: "email", next_steps: [{ kind: "course" }],
  do_not_contact: false, request_status: null as string | null,
};
const people = [
  base,
  { ...base, first_name: "Marc", city: "Montreal", stage: "practicing", drift_date: day(40), chosen_by: "ai", suggested_channel: "whatsapp", next_steps: [{ kind: "seva" }] },
  { ...base, first_name: "Wei", city: "Vancouver", stage: "dormant", drift_date: day(-10), next_steps: [{ kind: "call" }], request_status: "requested" },
  { ...base, first_name: "Dan", stage: "drifting", drift_date: null, do_not_contact: true, next_steps: [] },
];
const f = (patch: Partial<Filters>): Filters => ({ ...EMPTY_FILTERS, stages: new Set(), ...patch });
const names = (xs: { first_name: string }[]) => xs.map((p) => p.first_name);

describe("applyFilters", () => {
  it("returns everyone with no filters", () => {
    expect(applyFilters(people, f({}))).toHaveLength(4);
  });
  it("searches name, email and city, ignoring case", () => {
    expect(names(applyFilters(people, f({ q: "montreal" })))).toEqual(["Marc"]);
    expect(names(applyFilters(people, f({ q: "  WEI " })))).toEqual(["Wei"]);
  });
  it("filters by one or more stages", () => {
    expect(names(applyFilters(people, f({ stages: new Set(["slipping", "dormant"]) })))).toEqual(["Asha", "Wei"]);
  });
  it("filters by predicted drift window, or already drifted", () => {
    expect(names(applyFilters(people, f({ drift: "7" })))).toEqual(["Asha"]);
    expect(names(applyFilters(people, f({ drift: "30" })))).toEqual(["Asha"]);
    expect(names(applyFilters(people, f({ drift: "past" })))).toEqual(["Wei"]);
  });
  it("filters by top next step, who picked it, and channel", () => {
    expect(names(applyFilters(people, f({ kind: "seva" })))).toEqual(["Marc"]);
    expect(names(applyFilters(people, f({ pickedBy: "ai" })))).toEqual(["Marc"]);
    expect(names(applyFilters(people, f({ channel: "whatsapp" })))).toEqual(["Marc"]);
  });
  it("combines filters", () => {
    expect(applyFilters(people, f({ q: "toronto", stages: new Set(["practicing"]) }))).toEqual([]);
  });
});

describe("CoordinatorFilters", () => {
  it("shows the count and clears every filter", async () => {
    const onChange = vi.fn();
    render(<CoordinatorFilters people={people} value={f({ q: "asha", drift: "7" })} onChange={onChange} shown={1} />);
    expect(screen.getByText("1 of 4")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ q: "", drift: "any", kind: "any", pickedBy: "any", channel: "any" }));
  });
  it("toggles a stage", async () => {
    const onChange = vi.fn();
    render(<CoordinatorFilters people={people} value={f({})} onChange={onChange} shown={4} />);
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "dormant" }));
    expect([...onChange.mock.calls[0][0].stages]).toEqual(["dormant"]);
  });
});

describe("CoordinatorHero", () => {
  it("counts outreach (not do-not-contact), requests, drifting soon and AI picks", () => {
    render(<CoordinatorHero name="Anita Rao" covers="Anita Rao" people={people} tab="all" onTab={() => {}} />);
    const tile = (label: string) => screen.getByText(label).parentElement!;
    expect(tile("Needs outreach")).toHaveTextContent("2");   // Asha (slipping) + Wei (dormant); Dan is do-not-contact
    expect(tile("Requests")).toHaveTextContent("1");
    expect(tile("Drifting soon")).toHaveTextContent("1");    // Asha, in 5 days
    expect(tile("AI-picked steps")).toHaveTextContent("1");
    expect(tile("Everyone")).toHaveTextContent("4");
    expect(screen.getByText(/Anita\./)).toBeInTheDocument();
    expect(screen.getByText("1 new request")).toBeInTheDocument();
  });
  it("switches tabs from the tiles", async () => {
    const onTab = vi.fn();
    render(<CoordinatorHero name="Anita Rao" covers={null} people={people} tab="all" onTab={onTab} />);
    await userEvent.click(screen.getByText("Requests"));
    expect(onTab).toHaveBeenCalledWith("requests");
  });
});
