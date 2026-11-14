import type { Participant, Stage } from "../../../src/types";

// Warm, never guilt-based (PRD principle 3). Participants never see their stage name or score.
const GREETING: Record<Stage, { title: string; line: string }> = {
  new: { title: "What a beginning", line: "You've just started something wonderful. Here's where it can lead." },
  practicing: { title: "Your practice is flourishing", line: "Here's your path so far, and a few ways to go deeper." },
  slipping: { title: "Life gets busy", line: "Your practice is still here for you. Here are some easy ways to reconnect." },
  drifting: { title: "We've missed you", line: "Whenever you're ready, there's a gentle way back in." },
  dormant: { title: "It's good to see you", line: "It's been a while. Your community would love to welcome you back." },
};

export default function Hero({ person, stage }: { person: Participant; stage: Stage }) {
  const g = GREETING[stage];
  const since = new Date(`${person.joinedAt}T00:00`).toLocaleDateString("en-CA", { month: "long", year: "numeric" });
  return (
    <section className="hero" id="top">
      <div className="container">
        <p className="eyebrow">Your journey with Art of Living · since {since}</p>
        <h1>{g.title}, {person.firstName}.</h1>
        <p className="lede">{g.line}</p>
        <div className="hero-actions">
          <a className="btn btn-primary" href="#next">See your next steps</a>
          <a className="btn btn-ghost" href="#journey">Your journey</a>
        </div>
      </div>
    </section>
  );
}
