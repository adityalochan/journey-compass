import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Participant } from "../../../src/types";
import { daysUntil, type NextStep } from "../lib/steps";
import { addToCalendar, calendarLinks, downloadIcs, placeFor } from "../lib/enrollment";
import { KIND_ICON } from "./Icons";

interface Props { person: Participant; step: NextStep; alreadyBooked: boolean; onConfirm: () => void; onCancel: () => void; onClose: () => void }

const COLORS = ["#7677f4", "#ff9004", "#67a20b", "#abacf8", "#ffd45c"];

/** A registration link worth showing. The organisers' mock data has placeholder links that lead nowhere:
 *  Eventbrite IDs like /e/eb-0700000592 (real ones end in a long number) and members.artofliving.org/reg/…
 *  (no such site). Those are ignored, so the step books like any other: Request sent, then Confirmed. */
export function usableRegistrationUrl(url?: string | null): string | null {
  if (!url) return null;
  if (/eventbrite\.[a-z.]+\/e\/eb-\d+\/?$/i.test(url)) return null;
  if (/^https?:\/\/members\.artofliving\.org\/reg\//i.test(url)) return null;
  return url;
}

export default function EnrollDialog({ person, step, alreadyBooked, onConfirm, onCancel, onClose }: Props) {
  // offer → justBooked (no cancel offered right away) · booked (opened later: can cancel) → justCancelled (no re-book offered)
  const regUrl = usableRegistrationUrl(step.registrationUrl);
  const [phase, setPhase] = useState<"offer" | "booked" | "justBooked" | "justCancelled">(alreadyBooked ? "booked" : "offer");
  const done = phase === "booked" || phase === "justBooked";
  const justBooked = phase === "justBooked";
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
  }, [onClose, phase]);

  function confirm() {
    // No new tab opens by itself; a real sign-up page is offered as a button on the next screen.
    onConfirm();
    setPhase("justBooked");
  }

  function cancel() {
    onCancel();
    setPhase("justCancelled");
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="enroll-title" onClick={(e) => e.stopPropagation()}>
        <button className="dialog-close" aria-label="Close" onClick={onClose}>×</button>

        {phase === "justCancelled" ? (
          <div className="dialog-done">
            <span className="dialog-icon dialog-icon-cancel">×</span>
            <h3 id="enroll-title">{isCall ? "Call request cancelled" : "Booking cancelled"}</h3>
            <p className="muted">
              {isCall ? `No problem. ${teacher} won't call for now.` : `Your spot at ${step.name} has been released.`}
              {" "}You can come back to it any time from your journey.
            </p>
            <div className="dialog-actions">
              <button ref={firstBtn} className="btn btn-primary" onClick={onClose}>Back to my journey</button>
            </div>
          </div>
        ) : !done ? (
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
              {isCall ? `${teacher} will call you soon` : regUrl ? (justBooked ? "Almost there!" : `You asked to join ${step.name}`) : justBooked ? "Request sent" : `You asked to join ${step.name}`}
            </h3>
            <p className="muted">
              {isCall
                ? `${teacher} will reach out this week at a time that suits you.`
                : regUrl ? "Finish signing up on the registration page. We've noted your interest." : "Request sent — we'll be in touch."}
            </p>
            <div className="dialog-actions">
              {regUrl && <a className="btn btn-primary" href={regUrl} target="_blank" rel="noopener noreferrer">Open registration page</a>}
              {step.start && <button ref={firstBtn} className={regUrl ? "btn btn-ghost" : "btn btn-primary"} onClick={() => addToCalendar(step, person)}>Add to calendar</button>}
              {step.start && (() => {
                const links = calendarLinks(step, person)!;
                return (
                  <p className="cal-alt">Or add to{" "}
                    <a href={links.google} target="_blank" rel="noopener noreferrer">Google Calendar</a> ·{" "}
                    <a href={links.outlook} target="_blank" rel="noopener noreferrer">Outlook.com</a> ·{" "}
                    <button type="button" className="cal-alt-btn" onClick={() => downloadIcs(step, person)}>Apple / Outlook (.ics)</button>
                  </p>
                );
              })()}
              <button ref={step.start ? undefined : firstBtn} className="btn btn-ghost" onClick={onClose}>Back to my journey</button>
              {/* Cancelling is offered when you come back to a booking later, not in the moment you make it. */}
              {phase === "booked" && (
                <button className="btn-link-danger" onClick={cancel}>
                  {isCall ? "Cancel call request" : "Cancel my spot"}
                </button>
              )}
            </div>
          </div>
        )}
        <p className="dialog-note">Demo: no real booking is made.</p>
      </div>
    </div>
  );
}
