import { useState, type FormEvent } from "react";
import type { Participant, Stage } from "../../../src/types";
import { daysUntil, isActive, type NextStep } from "../lib/steps";
import { QUOTES } from "../lib/quotes";
import { CENTRES, distanceKm, knownCity } from "../lib/geo";

// Official accounts, taken from artofliving.org/ca-en and wisdom.srisriravishankar.org.
const SOCIAL = {
  aol: [
    { net: "facebook", label: "Facebook", url: "https://www.facebook.com/artoflivingcanada/" },
    { net: "instagram", label: "Instagram", url: "https://www.instagram.com/artoflivingcanada/" },
    { net: "x", label: "X", url: "https://twitter.com/aolcanada" },
    { net: "youtube", label: "YouTube", url: "https://www.youtube.com/artoflivingcanada" },
  ],
  gurudev: [
    { net: "facebook", label: "Facebook", url: "https://www.facebook.com/srisriravishankar" },
    { net: "instagram", label: "Instagram", url: "https://www.instagram.com/srisriravishankar/" },
    { net: "x", label: "X", url: "https://twitter.com/srisri" },
    { net: "youtube", label: "YouTube", url: "https://www.youtube.com/srisri" },
  ],
};

const ICON: Record<string, JSX.Element> = {
  facebook: <path d="M14 8h3V4h-3c-2.8 0-4.5 1.8-4.5 4.6V11H7v4h2.5v8h4v-8h3l.5-4h-3.5V9c0-.6.4-1 1-1z" />,
  instagram: <><rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="17.3" cy="6.7" r="1.2" /></>,
  x: <path d="M4 4h4.5l4 5.6L17 4h3l-6.1 7.3L20.5 20H16l-4.3-6-5 6H3.6l6.6-7.8z" />,
  youtube: <path d="M21.6 7.2a2.6 2.6 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.6 2.6 0 0 0 2.4 7.2 27 27 0 0 0 2 12a27 27 0 0 0 .4 4.8 2.6 2.6 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.6 2.6 0 0 0 1.8-1.8A27 27 0 0 0 22 12a27 27 0 0 0-.4-4.8zM10 15V9l5.2 3z" />,
  whatsapp: <path d="M12 2.5a9.5 9.5 0 0 0-8.2 14.3L2.5 21.5l4.8-1.3A9.5 9.5 0 1 0 12 2.5zm5.3 13.3c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.4-.7a11.8 11.8 0 0 1-4.6-4.1c-.4-.5-1-1.6-1-2.7s.6-1.6.8-1.9c.2-.2.5-.3.6-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .5l-.3.5-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2 1.1 1 2 1.3 2.3 1.4.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.8.9c.3.1.4.2.5.3.1.2.1.7-.1 1.2z" />,
};

const Icon = ({ net }: { net: string }) => <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">{ICON[net]}</svg>;

/** Format as you type: North American numbers as +1 (905) 555-1001; others as +CC grouped digits. */
export function formatPhone(input: string): string {
  const intl = input.trim().startsWith("+");
  const raw = input.replace(/\D/g, "");
  // Other countries: keep the person's own spacing, digits only.
  if (intl && raw && !raw.startsWith("1")) return "+" + input.trim().slice(1).replace(/[^\d ]/g, "").replace(/\s+/g, " ").slice(0, 20);
  if (!raw) return intl ? "+" : "";
  if (raw === "1") return intl ? "+1" : "1"; // lets backspace walk back through "+1" instead of sticking
  const d = (raw.startsWith("1") ? raw.slice(1) : raw).slice(0, 10);
  if (d.length < 4) return `+1 (${d}`;
  if (d.length < 7) return `+1 (${d.slice(0, 3)}) ${d.slice(3)}`;
  return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}
export const phoneOk = (p: string) => p.replace(/\D/g, "").length >= 11 || (p.trim().startsWith("+") && p.replace(/\D/g, "").length >= 8);

interface Prefs { phone: string; channel: "whatsapp" | "sms"; quotes: boolean; nudges: boolean; time: "morning" | "evening" }
const key = (id: string) => `jc-messages-${id}`;
const load = (id: string): Prefs | null => { try { return JSON.parse(localStorage.getItem(key(id)) ?? "null"); } catch { return null; } };

interface Props { person: Participant; stage: Stage; steps: NextStep[] }

export default function StayConnected({ person, stage, steps }: Props) {
  const teacher = person.assignedTo.split(" ")[0];
  const home = knownCity(person.city);
  const defaultGroup = home ? [...CENTRES].sort((a, b) => distanceKm(home, a) - distanceKm(home, b))[0].id : CENTRES[0].id;
  const [waGroup, setWaGroup] = useState(defaultGroup);
  const [waAsked, setWaAsked] = useState<string | null>(null);
  const groupName = (id: string) => (id === "online" ? "Online community" : CENTRES.find((c) => c.id === id)?.city ?? id);
  const [saved, setSaved] = useState<Prefs | null>(() => load(person.id));
  const [form, setForm] = useState<Prefs>(saved ?? { phone: formatPhone(person.phone), channel: "whatsapp", quotes: true, nudges: true, time: "morning" });
  const [consent, setConsent] = useState(false);

  const quote = QUOTES[new Date().getDate() % QUOTES.length];
  const next = steps[0];
  const days = next ? daysUntil(next) : null;
  const nudge = !next ? `Hi ${person.firstName}, a few minutes of practice today goes a long way. We're here whenever you need us.`
    : isActive(stage) ? `Hi ${person.firstName}, you've been keeping up beautifully. ${next.name} could take your practice deeper${days !== null ? ` and it starts in ${days} days` : ""}. Want details?`
      : `Hi ${person.firstName}, we've missed you. ${next.name}${days !== null ? ` is in ${days} days` : " is open whenever you're ready"}. Would you like ${teacher} to save you a spot?`;

  function subscribe(e: FormEvent) {
    e.preventDefault();
    if (!consent || !phoneOk(form.phone)) return;
    try { localStorage.setItem(key(person.id), JSON.stringify(form)); } catch { /* storage blocked */ }
    setSaved(form);
  }
  function unsubscribe() {
    try { localStorage.removeItem(key(person.id)); } catch { /* storage blocked */ }
    setSaved(null);
    setConsent(false);
  }

  const time = (saved ?? form).time === "morning" ? "7:30 am" : "8:00 pm";

  return (
    <section className="section" id="connect">
      <div className="container">
        <p className="eyebrow">Stay connected</p>
        <h2>Keep the wisdom close, every day</h2>

        <div className="connect-grid">
          <div className="connect-social">
            <div className="social-card">
              <h3>Art of Living Canada</h3>
              <p className="muted">Events, courses and community news.</p>
              <div className="social-row">
                {SOCIAL.aol.map((s) => (
                  <a key={s.url} className={`social social-${s.net}`} href={s.url} target="_blank" rel="noopener noreferrer" aria-label={`Art of Living Canada on ${s.label}`}>
                    <Icon net={s.net} /><span>{s.label}</span>
                  </a>
                ))}
              </div>
            </div>
            <div className="social-card">
              <h3>Gurudev Sri Sri Ravi Shankar</h3>
              <p className="muted">Daily wisdom, talks and guided meditations.</p>
              <div className="social-row">
                {SOCIAL.gurudev.map((s) => (
                  <a key={s.url} className={`social social-${s.net}`} href={s.url} target="_blank" rel="noopener noreferrer" aria-label={`Gurudev on ${s.label}`}>
                    <Icon net={s.net} /><span>{s.label}</span>
                  </a>
                ))}
              </div>
            </div>
            <div className="social-card social-card-wa">
              <span className="social social-whatsapp social-big"><Icon net="whatsapp" /></span>
              <div>
                <h3>Join a local WhatsApp group</h3>
                <p className="muted">Session reminders, satsang updates and seva calls from the community you choose.</p>
                {waAsked ? (
                  <p className="step-done" role="status">
                    Request sent for the {groupName(waAsked)} group. You'll get an invite link on WhatsApp soon.{" "}
                    <button className="btn-link-danger" onClick={() => setWaAsked(null)}>Change</button>
                  </p>
                ) : (
                  <div className="wa-form">
                    <select value={waGroup} onChange={(e) => setWaGroup(e.target.value)} aria-label="Choose a location">
                      {CENTRES.map((c) => <option key={c.id} value={c.id}>{c.city}, {c.region}</option>)}
                      <option value="online">Online community</option>
                    </select>
                    <button className="btn btn-primary btn-sm" onClick={() => setWaAsked(waGroup)}>Request to join</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="connect-messages">
            {!saved ? (
              <form className="msg-form" onSubmit={subscribe}>
                <h3>Daily wisdom on your phone</h3>
                <p className="muted">A short Gurudev quote each day, and gentle reminders picked for where you are on your journey.</p>
                <label>Mobile number
                  <input type="tel" inputMode="tel" value={form.phone} placeholder="+1 (555) 555-0123"
                    onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })} required autoComplete="tel" />
                </label>
                {form.phone && !phoneOk(form.phone) && <p className="field-error">Enter a full number, e.g. +1 (905) 555-0123</p>}
                <div className="seg" role="radiogroup" aria-label="Send by">
                  {(["whatsapp", "sms"] as const).map((c) => (
                    <button type="button" key={c} role="radio" aria-checked={form.channel === c} className={form.channel === c ? "on" : ""}
                      onClick={() => setForm({ ...form, channel: c })}>{c === "whatsapp" ? "WhatsApp" : "Text message"}</button>
                  ))}
                </div>
                <label className="check"><input type="checkbox" checked={form.quotes} onChange={(e) => setForm({ ...form, quotes: e.target.checked })} /> Daily Gurudev quote</label>
                <label className="check"><input type="checkbox" checked={form.nudges} onChange={(e) => setForm({ ...form, nudges: e.target.checked })} /> Personal reminders for my next step</label>
                <div className="seg" role="radiogroup" aria-label="Time of day">
                  {(["morning", "evening"] as const).map((t) => (
                    <button type="button" key={t} role="radio" aria-checked={form.time === t} className={form.time === t ? "on" : ""}
                      onClick={() => setForm({ ...form, time: t })}>{t === "morning" ? "Mornings" : "Evenings"}</button>
                  ))}
                </div>
                <label className="check check-consent">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                  I agree to receive these messages. I can reply STOP at any time.
                </label>
                <button className="btn btn-primary" type="submit" disabled={!consent || !phoneOk(form.phone) || (!form.quotes && !form.nudges)}>Start my daily messages</button>
                <p className="dialog-note">Demo: no messages are actually sent.</p>
              </form>
            ) : (
              <div className="msg-done">
                <h3>You're all set</h3>
                <p className="muted">
                  {saved.channel === "whatsapp" ? "WhatsApp" : "Text"} messages to {saved.phone}, {saved.time === "morning" ? "each morning" : "each evening"}.
                </p>
                <button className="btn-link-danger" onClick={unsubscribe}>Stop messages</button>
              </div>
            )}

            <div className="phone" aria-label="Message preview">
              <div className="phone-notch" />
              <p className="phone-head">{(saved ?? form).channel === "whatsapp" ? "WhatsApp" : "Messages"} · Art of Living</p>
              <div className="phone-chat">
                {(saved ?? form).quotes && <p className="bubble">“{quote.text}”<br /><em>— Gurudev</em><span className="bubble-time">{time}</span></p>}
                {(saved ?? form).nudges && <p className="bubble">{nudge}<span className="bubble-time">{time}</span></p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
