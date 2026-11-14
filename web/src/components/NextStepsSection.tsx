import type { Participant, Stage } from "../../../src/types";
import { daysUntil, isActive, type NextStep } from "../lib/engine";

const KIND_LABEL = { course: "Course", retreat: "Retreat", event: "Gathering", seva: "Seva", call: "Conversation" };

interface Props { person: Participant; stage: Stage; steps: NextStep[]; enrolled: Set<string>; onOpen: (s: NextStep) => void }

export default function NextStepsSection({ stage, steps, enrolled, onOpen }: Props) {
  return (
    <section className="section section-tint" id="next">
      <div className="container">
        <p className="eyebrow">{isActive(stage) ? "Go deeper" : "Welcome back"}</p>
        <h2>Your next steps</h2>

        {steps.length === 0 ? (
          <p className="lede">You've asked us not to reach out, and we respect that. Whenever you're ready, we'll be here.</p>
        ) : (
          <ol className="steps">
            {steps.map((s, n) => {
              const booked = enrolled.has(s.name);
              const days = daysUntil(s);
              return (
                <li key={s.name} className={n === 0 ? "step step-featured" : "step"}>
                  <span className="step-num">{n + 1}</span>
                  <span className={`tag tag-${s.kind}`}>{KIND_LABEL[s.kind]}</span>
                  <h3>{s.name}</h3>
                  <p className="step-when">{s.when}</p>
                  <p>{s.why}</p>
                  <p className="step-badges">
                    {days !== null && <span className="badge">Starts in {days} {days === 1 ? "day" : "days"}</span>}
                    {s.seatsLeft !== undefined && <span className="badge badge-warm">{s.seatsLeft} seats left</span>}
                  </p>
                  {booked ? (
                    <p className="step-done" role="status">
                      Booked. See you there.{" "}
                      <button className="btn-link-danger" onClick={() => onOpen(s)}>Change</button>
                    </p>
                  ) : (
                    <button className={n === 0 ? "btn btn-primary" : "btn btn-ghost"} onClick={() => onOpen(s)}>
                      {s.kind === "call" ? "Request a call" : "Enroll"}
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
