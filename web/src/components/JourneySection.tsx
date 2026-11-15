import { useEffect, useState, type CSSProperties } from "react";
import type { Participant } from "../../../src/types";
import { daysUntil, type NextStep } from "../lib/steps";
import { IconCheck, KIND_ICON } from "./Icons";
import Walker, { type Mood } from "./Walker";

type Kind = keyof typeof KIND_ICON;
type State = "past" | "booked" | "here" | "next" | "future";
interface Square { key: string; kind: Kind; state: State; title: string; sub: string; place?: string; step?: NextStep; confirmed?: boolean }

const MAX_PAST = 11;
// Date-only strings are parsed as UTC by JS; read them as local dates so they never shift a day.
const fmt = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00` : iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });

/** Board columns by viewport: 4 on desktop, 3 on tablet, 2 on phone. */
function useCols() {
  const pick = () => (window.matchMedia("(max-width: 640px)").matches ? 2 : window.matchMedia("(max-width: 960px)").matches ? 3 : 4);
  const [cols, setCols] = useState(pick);
  useEffect(() => {
    const on = () => setCols(pick());
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return cols;
}

// Courses and events only. Contact logs and volunteer notes are internal and never shown here.
function buildSquares(p: Participant, steps: NextStep[], enrolled: Set<string>, confirmed: Set<string>): { squares: Square[]; hidden: number } {
  const past: Square[] = [
    ...p.courses.map((c) => ({ key: `c-${c.programId}`, kind: "course" as Kind, date: c.completedAt, title: c.name, place: c.teacher ? `${c.city} · with ${c.teacher}` : c.city })),
    ...p.events.map((e, n) => ({ key: `e-${n}`, kind: (e.type === "seva" ? "seva" : "event") as Kind, date: e.date, title: e.name, place: e.city })),
  ]
    .sort((a, b) => +new Date(a.date) - +new Date(b.date))
    .map(({ date, ...s }) => ({ ...s, state: "past" as State, sub: fmt(date) }));

  const hidden = Math.max(0, past.length - MAX_PAST);
  const toSquare = (s: NextStep, state: State): Square => ({
    key: `s-${s.name}`, kind: s.kind, state, title: s.name, sub: state === "booked" ? "Booked" : s.when, step: s,
  });
  // A booked step stays "booked" (green dotted path) until its date has passed; then it joins the walked path.
  const happened = (s: NextStep) => !!s.start && new Date(s.start).getTime() < Date.now();
  const mine = steps.filter((s) => enrolled.has(s.name));
  // Attended (date passed) → behind the character on the walked path; still upcoming → ahead of it.
  const attended = mine.filter(happened).map((s) => ({ ...toSquare(s, "past"), sub: fmt(s.start!.slice(0, 10)) }));
  const booked = mine.filter((s) => !happened(s)).map((s) => {
    const ok = confirmed.has(s.name);
    return { ...toSquare(s, "booked"), confirmed: ok, sub: ok ? "Confirmed" : "Requested" };
  });
  const open = steps.filter((s) => !enrolled.has(s.name)).map((s, n) => toSquare(s, n === 0 ? "next" : "future"));
  const here: Square = { key: "here", kind: "event", state: "here", title: "You are here", sub: "Today" };

  return { squares: [...past.slice(hidden), ...attended, here, ...booked, ...open], hidden };
}

interface Props { person: Participant; steps: NextStep[]; enrolled: Set<string>; confirmed: Set<string>; mood: Mood | null; onOpen: (s: NextStep) => void }

export default function JourneySection({ person, steps, enrolled, confirmed, mood, onOpen }: Props) {
  const cols = useCols();
  const { squares, hidden } = buildSquares(person, steps, enrolled, confirmed);
  // The character heads for the nearest upcoming booking first, otherwise the next suggestion.
  const nextStep = squares.find((s) => s.state === "booked")?.step ?? squares.find((s) => s.state === "next")?.step;
  const seva = person.events.filter((e) => e.type === "seva").length;
  const rows: Square[][] = [];
  for (let n = 0; n < squares.length; n += cols) rows.push(squares.slice(n, n + cols));

  return (
    <section className="section" id="journey">
      <div className="container">
        <p className="eyebrow">Your journey</p>
        <h2>Every step you've taken, and the next one</h2>

        <div className="stats">
          <div><strong>{person.courses.length}</strong><span>{person.courses.length === 1 ? "course" : "courses"}</span></div>
          <div><strong>{person.events.length - seva}</strong><span>gatherings</span></div>
          <div><strong>{seva}</strong><span>times of seva</span></div>
          <div><strong>{person.assignedTo.split(" ")[0] || "—"}</strong><span>your coordinator</span></div>
        </div>

        {hidden > 0 && <p className="board-earlier">+ {hidden} earlier {hidden === 1 ? "step" : "steps"}</p>}

        <div className="board" style={{ "--cols": cols } as CSSProperties} key={person.id}>
          {rows.map((row, r) => (
            <div key={r} className={`board-row ${r % 2 ? "board-row-rev" : ""}`}>
              {row.map((sq, j) => {
                const i = r * cols + j;
                const nextSq = squares[i + 1];
                const seg = !nextSq ? "" : j < row.length - 1 ? "seg-h" : "seg-v";
                // Into a booking: solid green once the coordinator confirmed it, neon dotted while it's only requested.
                const ahead = !nextSq ? ""
                  : nextSq.state === "booked" ? (nextSq.confirmed ? "seg-confirmed" : "seg-booked")
                  : ["next", "future"].includes(nextSq.state) ? "seg-future" : "";
                const Icon = KIND_ICON[sq.kind];
                const days = sq.step ? daysUntil(sq.step) : null;
                const clickable = !!sq.step; // booked squares open the dialog too, to cancel
                return (
                  <div key={sq.key} className={`sq sq-${sq.state} sq-${sq.kind} ${seg} ${ahead}${sq.confirmed ? " sq-confirmed" : ""}`} style={{ "--i": i } as CSSProperties}>
                    {sq.state === "here" ? (
                      <Walker facing={r % 2 ? "left" : "right"} mood={mood}
                        target={nextStep ? { name: nextStep.name, days: daysUntil(nextStep) } : null}
                        onClick={nextStep ? () => onOpen(nextStep) : undefined} />
                    ) : (
                      <button className="node" disabled={!clickable} title={sq.place ?? sq.title}
                        onClick={() => sq.step && onOpen(sq.step)} aria-label={`${sq.title}, ${sq.sub}`}>
                        {sq.state === "booked" ? <IconCheck /> : <Icon />}
                      </button>
                    )}
                    <p className="sq-title">{sq.title}</p>
                    {sq.confirmed ? <span className="sq-confirmed-badge">✓ Confirmed</span> : <p className="sq-sub">{sq.sub}</p>}
                    {sq.state === "next" && sq.step && (
                      <>
                        {days !== null && <span className="badge">Starts in {days} {days === 1 ? "day" : "days"}</span>}
                        <button className="btn btn-primary btn-sm sq-cta" onClick={() => onOpen(sq.step!)}>
                          {sq.step.kind === "call" ? "Request a call" : "Enroll"}
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <p className="board-legend">
          <span className="lg lg-course">Course</span><span className="lg lg-event">Gathering</span>
          <span className="lg lg-seva">Seva</span><span className="lg lg-next">Your next step</span><span className="lg lg-booked">Booked</span>
        </p>
      </div>
    </section>
  );
}
