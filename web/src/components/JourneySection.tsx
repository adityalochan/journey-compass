import { useEffect, useState, type CSSProperties } from "react";
import type { Participant } from "../../../src/types";
import { daysUntil, type NextStep } from "../lib/engine";
import { IconCheck, KIND_ICON } from "./Icons";
import Walker, { type Mood } from "./Walker";

type Kind = keyof typeof KIND_ICON;
type State = "past" | "booked" | "here" | "next" | "future";
interface Square { key: string; kind: Kind; state: State; title: string; sub: string; place?: string; step?: NextStep }

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
function buildSquares(p: Participant, steps: NextStep[], enrolled: Set<string>): { squares: Square[]; hidden: number } {
  const past: Square[] = [
    ...p.courses.map((c) => ({ key: `c-${c.programId}`, kind: "course" as Kind, date: c.completedAt, title: c.name, place: `${c.city} · with ${c.teacher}` })),
    ...p.events.map((e, n) => ({ key: `e-${n}`, kind: (e.type === "seva" ? "seva" : "event") as Kind, date: e.date, title: e.name, place: e.city })),
  ]
    .sort((a, b) => +new Date(a.date) - +new Date(b.date))
    .map(({ date, ...s }) => ({ ...s, state: "past" as State, sub: fmt(date) }));

  const hidden = Math.max(0, past.length - MAX_PAST);
  const toSquare = (s: NextStep, state: State): Square => ({
    key: `s-${s.name}`, kind: s.kind, state, title: s.name, sub: state === "booked" ? "Booked" : s.when, step: s,
  });
  const booked = steps.filter((s) => enrolled.has(s.name)).map((s) => toSquare(s, "booked"));
  const open = steps.filter((s) => !enrolled.has(s.name)).map((s, n) => toSquare(s, n === 0 ? "next" : "future"));
  const here: Square = { key: "here", kind: "event", state: "here", title: "You are here", sub: "Today" };

  return { squares: [...past.slice(hidden), ...booked, here, ...open], hidden };
}

interface Props { person: Participant; steps: NextStep[]; enrolled: Set<string>; mood: Mood | null; onOpen: (s: NextStep) => void }

export default function JourneySection({ person, steps, enrolled, mood, onOpen }: Props) {
  const cols = useCols();
  const { squares, hidden } = buildSquares(person, steps, enrolled);
  const nextStep = squares.find((s) => s.state === "next")?.step;
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
          <div><strong>{person.courses[0]?.teacher.split(" ")[0] ?? "—"}</strong><span>your first teacher</span></div>
        </div>

        {hidden > 0 && <p className="board-earlier">+ {hidden} earlier {hidden === 1 ? "step" : "steps"}</p>}

        <div className="board" style={{ "--cols": cols } as CSSProperties} key={person.id}>
          {rows.map((row, r) => (
            <div key={r} className={`board-row ${r % 2 ? "board-row-rev" : ""}`}>
              {row.map((sq, j) => {
                const i = r * cols + j;
                const nextSq = squares[i + 1];
                const seg = !nextSq ? "" : j < row.length - 1 ? "seg-h" : "seg-v";
                const ahead = nextSq && ["next", "future"].includes(nextSq.state) ? "seg-future" : "";
                const Icon = KIND_ICON[sq.kind];
                const days = sq.step ? daysUntil(sq.step) : null;
                const clickable = !!sq.step; // booked squares open the dialog too, to cancel
                return (
                  <div key={sq.key} className={`sq sq-${sq.state} sq-${sq.kind} ${seg} ${ahead}`} style={{ "--i": i } as CSSProperties}>
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
                    <p className="sq-sub">{sq.sub}</p>
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
          <span className="lg lg-seva">Seva</span><span className="lg lg-next">Your next step</span>
        </p>
      </div>
    </section>
  );
}
