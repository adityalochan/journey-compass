import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Participant } from "../../../src/types";
import { daysUntil, type NextStep } from "../lib/steps";
import { downloadIcs, placeFor } from "../lib/enrollment";
import { KIND_ICON } from "./Icons";

interface Props { person: Participant; step: NextStep; alreadyBooked: boolean; onConfirm: () => void; onCancel: () => void; onClose: () => void }

const COLORS = ["#7677f4", "#ff9004", "#67a20b", "#abacf8", "#ffd45c"];

export default function EnrollDialog({ person, step, alreadyBooked, onConfirm, onCancel, onClose }: Props) {
  const [done, setDone] = useState(alreadyBooked);
  const [justBooked, setJustBooked] = useState(false);
  const firstBtn = useRef<HTMLButtonElement>(null);
  const days = daysUntil(step);
  const teacher = person.assignedTo.split(" ")[0];
  const isCall = step.kind === "call";
  const Icon = KIND_ICON[step.kind];

  useEffect(() => {
    firstBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, done]);

  function confirm() {
    // Courses/events with a sign-up page: open it now (still inside the click, so popups aren't blocked).
    if (step.registrationUrl) window.open(step.registrationUrl, "_blank", "noopener");
    onConfirm();
    setJustBooked(true);
    setDone(true);
  }

  function cancel() {
    onCancel();
    setJustBooked(false);
    setDone(false);
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="enroll-title" onClick={(e) => e.stopPropagation()}>
        <button className="dialog-close" aria-label="Close" onClick={onClose}>×</button>

        {!done ? (
          <>
            <span className="dialog-icon"><Icon /></span>
            <h3 id="enroll-title">{step.name}</h3>
            <p className="muted">{step.why}</p>
            <dl className="dialog-facts">
              <div><dt>When</dt><dd>{step.when}</dd></div>
              <div><dt>Where</dt><dd>{placeFor(step, person)}</dd></div>
              <div><dt>{isCall ? "With" : "Teacher"}</dt><dd>{person.assignedTo}</dd></div>
            </dl>
            <p className="dialog-badges">
              {days !== null && <span className="badge">Starts in {days} {days === 1 ? "day" : "days"}</span>}
              {step.seatsLeft !== undefined && <span className="badge badge-warm">{step.seatsLeft} seats left</span>}
              {step.seatsLeft === undefined && !isCall && <span className="badge">Open to everyone</span>}
            </p>
            <div className="dialog-actions">
              <button ref={firstBtn} className="btn btn-primary" onClick={confirm}>
                {isCall ? `Yes, ask ${teacher} to call me` : "Confirm my spot"}
              </button>
              <button className="btn btn-ghost" onClick={onClose}>Not now</button>
            </div>
          </>
        ) : (
          <div className="dialog-done">
            {justBooked && (
              <div className="confetti" aria-hidden="true">
                {Array.from({ length: 28 }, (_, n) => (
                  <i key={n} style={{ "--x": `${((n * 37) % 100) - 50}vw`, "--r": `${(n * 53) % 360}deg`, "--d": `${(n % 7) * 60}ms`, background: COLORS[n % COLORS.length] } as CSSProperties} />
                ))}
              </div>
            )}
            <span className="dialog-icon dialog-icon-done">✓</span>
            <h3 id="enroll-title">
              {isCall ? `${teacher} will call you soon` : step.registrationUrl ? (justBooked ? "Almost there!" : `You asked to join ${step.name}`) : justBooked ? "Request sent" : `You asked to join ${step.name}`}
            </h3>
            <p className="muted">
              {isCall
                ? `${teacher} will reach out this week at a time that suits you.`
                : step.registrationUrl ? "Finish signing up on the registration page. We've noted your interest." : "Request sent — we'll be in touch."}
            </p>
            <div className="dialog-actions">
              {step.registrationUrl && <a className="btn btn-primary" href={step.registrationUrl} target="_blank" rel="noopener noreferrer">Open registration page</a>}
              {step.start && <button ref={firstBtn} className={step.registrationUrl ? "btn btn-ghost" : "btn btn-primary"} onClick={() => downloadIcs(step, person)}>Add to calendar</button>}
              <button ref={step.start ? undefined : firstBtn} className="btn btn-ghost" onClick={onClose}>Back to my journey</button>
              <button className="btn-link-danger" onClick={cancel}>
                {isCall ? "Cancel call request" : "Cancel my spot"}
              </button>
            </div>
          </div>
        )}
        <p className="dialog-note">Demo: no real booking is made.</p>
      </div>
    </div>
  );
}
