import { useState } from "react";
import type { Participant, Stage } from "../../../src/types";
import { getRecommendations, isActive } from "../lib/engine";

const KIND_LABEL = { course: "Course", event: "Gathering", seva: "Seva", call: "Conversation" };

export default function NextStepsSection({ person, stage }: { person: Participant; stage: Stage }) {
  const steps = getRecommendations(person, stage);
  const [interested, setInterested] = useState<string | null>(null);

  return (
    <section className="section section-tint" id="next">
      <div className="container">
        <p className="eyebrow">{isActive(stage) ? "Go deeper" : "Welcome back"}</p>
        <h2>Your next steps</h2>

        {steps.length === 0 ? (
          <p className="lede">You've asked us not to reach out, and we respect that. Whenever you're ready, we'll be here.</p>
        ) : (
          <ol className="steps">
            {steps.map((s, n) => (
              <li key={s.name} className={n === 0 ? "step step-featured" : "step"}>
                <span className="step-num">{n + 1}</span>
                <span className={`tag tag-${s.kind}`}>{KIND_LABEL[s.kind]}</span>
                <h3>{s.name}</h3>
                <p className="step-when">{s.when}</p>
                <p>{s.why}</p>
                {interested === s.name ? (
                  <p className="step-done" role="status">Thank you. {person.assignedTo.split(" ")[0]} will be in touch.</p>
                ) : (
                  <button className={n === 0 ? "btn btn-primary" : "btn btn-ghost"} onClick={() => setInterested(s.name)}>
                    {s.kind === "call" ? "Yes, I'd like that" : "I'm interested"}
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
