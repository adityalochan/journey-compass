import { useEffect, useState } from "react";

export type Mood = { kind: "happy" | "sad"; name: string; key: number };

interface Props {
  /** The step the walker is chasing; null when nothing is left to catch. */
  target: { name: string; days: number | null } | null;
  facing: "left" | "right";
  /** Latest enroll/unenroll reaction; shown briefly, then back to chasing. */
  mood: Mood | null;
  onClick?: () => void;
}

const REACTION_MS = 3600;
const LINE_MS = 2800;

export default function Walker({ target, facing, mood, onClick }: Props) {
  const [reaction, setReaction] = useState<Mood | null>(null);
  const [line, setLine] = useState(0);

  useEffect(() => {
    if (!mood) return;
    setReaction(mood);
    const t = window.setTimeout(() => setReaction(null), REACTION_MS);
    return () => window.clearTimeout(t);
  }, [mood?.key]);

  const chaseLines = target
    ? [
        `Let's catch the ${target.name}!`,
        target.days !== null ? `Starts in ${target.days} ${target.days === 1 ? "day" : "days"}. Wait for me!` : "It's just around the corner!",
        "Almost there…",
        "Tap the glowing circle with me!",
        ...(mood?.kind === "sad" ? ["Okay, let's try again!"] : []),
      ]
    : ["All caught up! Enjoy the journey.", "See you at your next session!"];

  useEffect(() => {
    const t = window.setInterval(() => setLine((n) => n + 1), LINE_MS);
    return () => window.clearInterval(t);
  }, []);

  const state = reaction?.kind ?? (target ? "chase" : "rest");
  const text =
    reaction?.kind === "happy" ? `Yay! See you at ${reaction.name}!`
    : reaction?.kind === "sad" ? "Aww… maybe next time."
    : chaseLines[line % chaseLines.length];

  return (
    <button className={`walker walker-${state} walker-${facing}`} onClick={onClick} disabled={!onClick}
      aria-label={target ? `You are here. Next: ${target.name}` : "You are here"}>
      <span className="walker-bubble" key={text} role="status">{text}</span>
      <svg className="walker-body" viewBox="0 0 60 80" width="66" height="88" aria-hidden="true">
        <ellipse className="walker-shadow" cx="30" cy="77" rx="14" ry="3" />
        <g className="walker-fig">
          <line className="leg leg-a" x1="30" y1="50" x2="24" y2="71" />
          <line className="leg leg-b" x1="30" y1="50" x2="36" y2="71" />
          <line className="arm arm-a" x1="30" y1="31" x2="21" y2="43" />
          <line className="arm arm-b" x1="30" y1="31" x2="39" y2="43" />
          <line className="torso" x1="30" y1="29" x2="30" y2="50" />
          <g className="head">
            <circle cx="30" cy="16" r="11" className="face" />
            <path d="M19 15 Q20 4 30 4 Q41 4 41 15 Q36 9 30 9 Q24 9 19 15z" className="hair" />
            <circle cx="26" cy="16" r="1.6" className="eye" />
            <circle cx="34" cy="16" r="1.6" className="eye" />
            {state === "sad"
              ? <path d="M25.5 23.5 Q30 19.5 34.5 23.5" className="mouth" />
              : state === "happy"
                ? <path d="M24.5 20.5 Q30 27 35.5 20.5 Z" className="mouth mouth-open" />
                : <path d="M26 21 Q30 24 34 21" className="mouth" />}
            {state === "sad" && <path d="M23 12.5 L28 13.5 M37 12.5 L32 13.5" className="brow" />}
          </g>
        </g>
      </svg>
    </button>
  );
}
