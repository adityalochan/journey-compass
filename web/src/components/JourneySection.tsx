import type { Participant } from "../../../src/types";

interface Milestone {
  date: string;
  title: string;
  kind: "course" | "seva" | "event";
  place: string;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { day: "numeric", month: "short", year: "numeric" });

// Courses and events only. Contact logs and volunteer notes are internal and never shown here.
function milestones(p: Participant): Milestone[] {
  return [
    ...p.courses.map((c) => ({ date: c.completedAt, title: c.name, kind: "course" as const, place: `${c.city} · with ${c.teacher}` })),
    ...p.events.map((e) => ({ date: e.date, title: e.name, kind: e.type === "seva" ? ("seva" as const) : ("event" as const), place: e.city })),
  ].sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

const LABEL = { course: "Course", seva: "Seva", event: "Event" };

export default function JourneySection({ person }: { person: Participant }) {
  const items = milestones(person);
  const seva = person.events.filter((e) => e.type === "seva").length;

  return (
    <section className="section" id="journey">
      <div className="container">
        <p className="eyebrow">Your journey</p>
        <h2>Every step you've taken</h2>

        <div className="stats">
          <div><strong>{person.courses.length}</strong><span>{person.courses.length === 1 ? "course" : "courses"}</span></div>
          <div><strong>{person.events.length - seva}</strong><span>gatherings</span></div>
          <div><strong>{seva}</strong><span>times of seva</span></div>
          <div><strong>{person.courses[0]?.teacher.split(" ")[0] ?? "—"}</strong><span>your first teacher</span></div>
        </div>

        <ol className="timeline">
          {items.map((m, n) => (
            <li key={n} className={`tl-${m.kind}`}>
              <time>{fmt(m.date)}</time>
              <div className="tl-card">
                <span className={`tag tag-${m.kind}`}>{LABEL[m.kind]}</span>
                <h3>{m.title}</h3>
                <p>{m.place}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
