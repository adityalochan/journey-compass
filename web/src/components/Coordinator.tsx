import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import Login from "./Login";
import TopControls from "./TopControls";
import CoordinatorFilters, { applyFilters, EMPTY_FILTERS, type Filters } from "./CoordinatorFilters";
import PersonInsights from "./PersonInsights";
import CoordinatorHero from "./CoordinatorHero";
import "./coordinator.css";

type Result = "attended" | "accepted" | "declined" | "no_response";

interface Person {
  participant_id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  city: string | null;
  language: string;
  assigned_to: string | null;
  do_not_contact: boolean;
  stage: string | null;
  stage_confidence: number | null;
  stage_drivers: string | null;
  engagement_score: number | null;
  drift_date: string | null;
  chosen_offer_id: string | null;
  chosen_offer_name: string | null;
  chosen_by: string | null;
  coordinator_reason: string | null;
  suggested_channel: string | null;
  draft_message: string | null;
  request_offer_id: string | null;
  request_offer_name: string | null;
  request_status: string | null;
  requested_at: string | null;
  latest_outcome: Result | null;
  notes: string | null;
  phone: string | null;
  email_opt_in: boolean;
  whatsapp_opt_in: boolean;
  next_steps: { rank: number; offer_id: string; name: string; kind: string; when: string }[];
  trend_points?: number | null;
  journey_stage?: string | null;
  chosen_offer_type?: string | null;
}

/** An email draft starts with "Subject: …" (or "Objet : …"); split it for the mailto link. */
function splitEmail(draft: string): { subject: string; body: string } {
  const [first, ...rest] = draft.split("\n");
  const m = first.match(/^(subject|objet)\s*:\s*(.*)$/i);
  return m ? { subject: m[2], body: rest.join("\n").trim() } : { subject: "Art of Living", body: draft };
}

const digits = (phone: string) => phone.replace(/[^\d+]/g, "");

function contactLinks(p: Person) {
  const msg = p.draft_message ?? "";
  const links: { channel: string; label: string; href: string }[] = [];
  if (p.email && p.email_opt_in) {
    const { subject, body } = splitEmail(msg);
    links.push({ channel: "email", label: "Email",
      href: `mailto:${p.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` });
  }
  if (p.phone && p.whatsapp_opt_in) {
    links.push({ channel: "whatsapp", label: "WhatsApp",
      href: `https://wa.me/${digits(p.phone).replace("+", "")}?text=${encodeURIComponent(msg)}` });
  }
  if (p.phone) {
    links.push({ channel: "sms", label: "Text", href: `sms:${digits(p.phone)}?body=${encodeURIComponent(msg)}` });
    links.push({ channel: "phone", label: `Call ${p.phone}`, href: `tel:${digits(p.phone)}` });
  }
  return links;
}

/** The engine's channel names ("Email", "WhatsApp", "Phone call (volunteer)", "SMS") as link keys. */
function channelKey(channel: string | null): string {
  const c = (channel ?? "").toLowerCase();
  return c.startsWith("phone") ? "phone" : c;
}

type Filter = "outreach" | "requests" | "all";

const OUTREACH_STAGES = new Set(["slipping", "drifting", "dormant"]);
const OUTCOMES: { result: Result; label: string }[] = [
  { result: "attended", label: "Attended" },
  { result: "accepted", label: "Accepted" },
  { result: "declined", label: "Declined" },
  { result: "no_response", label: "No reply" },
];
const OUTCOME_LABEL: Record<Result, string> = {
  attended: "Attended", accepted: "Accepted", declined: "Declined", no_response: "No reply",
};
// Outcome row: Accepted / Declined is a toggle (at most one is on). Attended and No reply are separate
// on/off marks that can sit alongside it. Clicking a highlighted chip clears it.
const DECISION: Result[] = ["accepted", "declined"];
export interface OutcomeRow { participant_id: string; offer_id: string; result: Result }
export interface OutcomeState { decision: Result | null; attended: boolean; noReply: boolean }

/** True when Attended can be marked: the event's date has passed, or it has no date (seva, a call). */
export function canMarkAttended(eventDate?: string | null, today = new Date()): boolean {
  if (!eventDate) return true;
  const t = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return eventDate < t;
}

/** What is currently marked for this person's current offer (their request, else the suggested step).
 *  rows = outcome history (oldest → newest); undefined when it hasn't loaded, then latest_outcome is used.
 *  eventDate = the offer's start date: Attended only counts once that date has passed. */
export function outcomeState(
  p: Pick<Person, "participant_id" | "request_status" | "request_offer_id" | "chosen_offer_id" | "latest_outcome">,
  rows?: OutcomeRow[],
  eventDate?: string | null,
): OutcomeState {
  const offer = p.request_offer_id ?? p.chosen_offer_id;
  const mine = rows
    ? rows.filter((r) => r.participant_id === p.participant_id && r.offer_id === offer)
    : p.latest_outcome && offer ? [{ participant_id: p.participant_id, offer_id: offer, result: p.latest_outcome }] : [];
  const lastDecision = [...mine].reverse().find((r) => DECISION.includes(r.result))?.result ?? null;
  // A request waiting for you has no decision yet; a confirmed booking is Accepted.
  const decision = p.request_status === "requested" ? null : p.request_status === "booked" ? "accepted" : lastDecision;
  return {
    decision,
    // Attended only counts for an accepted booking whose event has happened (or that has no date).
    attended: decision === "accepted" && canMarkAttended(eventDate) && mine.some((r) => r.result === "attended"),
    noReply: mine.some((r) => r.result === "no_response"),
  };
}

const day = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-CA", { month: "short", day: "numeric" });

/** Drift relative to today, so the label stays right whichever day the page is opened. */
function driftLabel(iso: string): string {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const days = Math.round((new Date(`${iso}T12:00:00`).getTime() - today.getTime()) / 86_400_000);
  if (days > 1) return `drifts in ${days} days`;
  if (days === 1) return "drifts tomorrow";
  if (days === 0) return "drifts today";
  return days === -1 ? "drifted yesterday" : `drifted ${-days} days ago`;
}

export default function Coordinator() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!ready) return <div className="co-center">Loading…</div>;
  if (!session) return <Login />;
  return <Queue session={session} />;
}

function Queue({ session }: { session: Session }) {
  const [staff, setStaff] = useState<{ name: string; covers: string | null } | null | undefined>(undefined);
  const [people, setPeople] = useState<Person[]>([]);
  const [outcomeRows, setOutcomeRows] = useState<OutcomeRow[]>([]);
  const [offerDates, setOfferDates] = useState<Record<string, string | null>>({});
  const [filter, setFilter] = useState<Filter>("outreach");
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [refresh, setRefresh] = useState<"idle" | "busy" | "done">("idle");
  // In-page routing: /coordinator/person/<id> opens the model-insights page for that person.
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const on = () => setPath(window.location.pathname);
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);
  const go = (to: string) => { window.history.pushState(null, "", to); setPath(to); };
  const personId = path.match(/^\/coordinator\/person\/([^/]+)/)?.[1];

  async function load() {
    const me = await supabase.from("staff").select("name,covers").eq("user_id", session.user.id).maybeSingle();
    setStaff(me.data ?? null);
    if (!me.data) return;
    const { data, error } = await supabase.from("coordinator_people").select("*")
      .order("drift_date", { ascending: true, nullsFirst: false });
    if (error) setError(error.message);
    setPeople((data as Person[]) ?? []);
    // Outcome history (staff-only, read-only) so the card can show the decision and the follow-up together.
    const oc = await supabase.from("outcomes").select("participant_id,offer_id,result").order("recorded_at").order("id");
    if (!oc.error) setOutcomeRows((oc.data as OutcomeRow[]) ?? []);
    // Offer start dates: Attended can only be marked once the event has happened.
    const of = await supabase.from("offers").select("id,start_date");
    if (!of.error) setOfferDates(Object.fromEntries(((of.data ?? []) as { id: string; start_date: string | null }[]).map((o) => [o.id, o.start_date])));
  }

  useEffect(() => {
    load();
    const quiet = () => { if (document.visibilityState === "visible") load(); };
    window.addEventListener("focus", quiet);
    document.addEventListener("visibilitychange", quiet);
    const poll = window.setInterval(quiet, 10_000); // new participant requests appear without pressing Refresh
    return () => { window.clearInterval(poll); window.removeEventListener("focus", quiet); document.removeEventListener("visibilitychange", quiet); };
  }, [session.user.id]);

  const shown = useMemo(() => people.filter((p) =>
    filter === "all" ? true
      : filter === "requests" ? p.request_status === "requested"
      : !p.do_not_contact && OUTREACH_STAGES.has(p.stage ?? "")), [people, filter]);
  const visible = useMemo(() => applyFilters(shown, filters), [shown, filters]);
  // Shortcut tiles: "Drifting soon" = outreach list, drifting within 14 days; "AI-picked" = everyone the AI chose for.
  const focus = filter === "outreach" && filters.drift === "14" ? "soon" : filter === "all" && filters.pickedBy === "ai" ? "ai" : null;
  const pick = (f: "soon" | "ai") => {
    setFilter(f === "soon" ? "outreach" : "all");
    setFilters({ ...EMPTY_FILTERS, stages: new Set(), ...(f === "soon" ? { drift: "14" as const } : { pickedBy: "ai" as const }) });
  };
  const tab = (t: Filter) => { setFilter(t); if (focus) setFilters({ ...EMPTY_FILTERS, stages: new Set() }); };
  async function refreshNow() {
    setRefresh("busy");
    await load();
    setRefresh("done");
    window.setTimeout(() => setRefresh("idle"), 1800);
  }
  const requests = people.filter((p) => p.request_status === "requested").length;
  const outreach = people.filter((p) => !p.do_not_contact && OUTREACH_STAGES.has(p.stage ?? "")).length;

  if (staff === undefined) return <div className="co-center">Loading…</div>;
  if (staff === null) {
    return (
      <div className="co-center">
        <p>This page is for coordinators.</p>
        <button className="btn btn-primary" onClick={() => window.location.assign("/")}>Go to participant view</button>
        <button className="btn btn-ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    );
  }

  async function record(p: Person, result: Result) {
    const offer = p.request_offer_id ?? p.chosen_offer_id;
    if (!offer) return;
    const { error } = await supabase.from("outcomes").insert({
      participant_id: p.participant_id, offer_id: offer, result, recorded_by: session.user.id,
    });
    if (error) return setError(error.message);
    // Keep the participant's request in sync: Accepted confirms it, Declined releases it.
    // Attended / No reply are marks alongside the decision and leave the booking as it is.
    const next = p.request_offer_id === offer && result === "accepted" ? "booked"
      : p.request_offer_id === offer && result === "declined" ? "cancelled" : null;
    if (next) {
      const upd = await supabase.from("interests").update({ status: next })
        .eq("participant_id", p.participant_id).eq("offer_id", offer);
      if (upd.error) setError(upd.error.message);
    }
    setPeople((all) => all.map((x) => (x.participant_id === p.participant_id
      ? { ...x, latest_outcome: result, request_status: next ?? x.request_status } : x)));
    setOutcomeRows((rows) => [...rows, { participant_id: p.participant_id, offer_id: offer, result }]);
  }

  // Unselect a chip: remove that mark for this offer. Clearing Accepted / Declined on a request puts it back
  // to "waiting" (the participant sees "Requested" again).
  async function clearOutcome(p: Person, result: Result) {
    const offer = p.request_offer_id ?? p.chosen_offer_id;
    if (!offer) return;
    const { error } = await supabase.from("outcomes").delete()
      .eq("participant_id", p.participant_id).eq("offer_id", offer).eq("result", result);
    if (error) return setError(error.message);
    const reopen = p.request_offer_id === offer
      && ((result === "accepted" && p.request_status === "booked") || (result === "declined" && p.request_status === "cancelled"));
    if (reopen) {
      const upd = await supabase.from("interests").update({ status: "requested" })
        .eq("participant_id", p.participant_id).eq("offer_id", offer);
      if (upd.error) setError(upd.error.message);
    }
    const left = outcomeRows.filter((r) => !(r.participant_id === p.participant_id && r.offer_id === offer && r.result === result));
    setOutcomeRows(left);
    setPeople((all) => all.map((x) => (x.participant_id === p.participant_id ? {
      ...x,
      request_status: reopen ? "requested" : x.request_status,
      latest_outcome: [...left].reverse().find((r) => r.participant_id === p.participant_id)?.result ?? null,
    } : x)));
  }

  return (
    <div className="co">
      <header className="co-header">
        <div className="container co-header-row">
          <span className="wordmark">Journey Compass · Coordinator</span>
          <span className="co-who">
            {staff.covers ? (staff.name === staff.covers ? `${staff.name}'s people` : `${staff.name} · ${staff.covers}'s people`)
              : `${staff.name} · everyone`}
          </span>
          <button className="btn btn-sm btn-ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
          <TopControls />
        </div>
      </header>

      {personId ? (
        <PersonInsights personId={decodeURIComponent(personId)} people={people}
          onBack={() => go("/coordinator")} onOpen={(id) => go(`/coordinator/person/${encodeURIComponent(id)}`)} />
      ) : (
      <>
      <CoordinatorHero name={staff.name} covers={staff.covers} people={people} tab={filter} onTab={tab} focus={focus} onFocus={pick} />
      <main className="container co-main co-wide">
        <div className="co-tabs" role="tablist">
          <Tab on={filter === "outreach"} onClick={() => tab("outreach")}>Needs outreach ({outreach})</Tab>
          <Tab on={filter === "requests"} onClick={() => tab("requests")}>Requests ({requests})</Tab>
          <Tab on={filter === "all"} onClick={() => tab("all")}>Everyone ({people.length})</Tab>
        </div>
        <CoordinatorFilters people={shown} value={filters} onChange={setFilters} shown={visible.length}>
          <button className="co-refresh" onClick={refreshNow} disabled={refresh === "busy"} aria-live="polite">
            {refresh === "busy" ? "Refreshing…" : refresh === "done" ? "Updated ✓" : "Refresh"}</button>
        </CoordinatorFilters>
        {error && <p className="form-error" role="alert">{error}</p>}
        {visible.length === 0 && <p className="muted">Nobody here right now.</p>}
        <ul className="co-list">
          {visible.map((p) => <Card key={p.participant_id} p={p} onRecord={record} onClear={clearOutcome}
            eventDate={offerDates[p.request_offer_id ?? p.chosen_offer_id ?? ""] ?? null}
            outcome={outcomeState(p, outcomeRows, offerDates[p.request_offer_id ?? p.chosen_offer_id ?? ""] ?? null)}
            onVisualize={() => go(`/coordinator/person/${encodeURIComponent(p.participant_id)}`)} />)}
        </ul>
      </main>
      </>
      )}
    </div>
  );
}

function Tab({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button role="tab" aria-selected={on} className={`co-tab${on ? " is-on" : ""}`} onClick={onClick}>{children}</button>;
}

export function Card({ p, onRecord, onClear, onVisualize, outcome, eventDate }: {
  p: Person; onRecord: (p: Person, r: Result) => void | Promise<void>; onClear?: (p: Person, r: Result) => void | Promise<void>;
  onVisualize: () => void; outcome?: OutcomeState; eventDate?: string | null;
}) {
  const { decision, attended, noReply } = outcome ?? outcomeState(p, undefined, eventDate);
  const attendable = canMarkAttended(eventDate);
  const isOn = (r: Result) => (r === "attended" ? attended : r === "no_response" ? noReply : decision === r);
  const toggle = (r: Result) => (isOn(r) ? onClear?.(p, r) : onRecord(p, r));
  const [copied, setCopied] = useState(false);
  const [deciding, setDeciding] = useState<null | "accepted" | "declined">(null);
  // Accept / decline a participant's request: same save as the outcome chips (confirms or releases the booking).
  async function decide(r: "accepted" | "declined") {
    setDeciding(r);
    try { await onRecord(p, r); } finally { setDeciding(null); }
  }
  const [showNotes, setShowNotes] = useState(false);
  const step = p.request_status === "requested" ? p.request_offer_name : p.chosen_offer_name;

  async function copy() {
    if (!p.draft_message) return;
    try { await navigator.clipboard.writeText(p.draft_message); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { /* clipboard blocked */ }
  }

  return (
    <li className={`co-card ins-st-${p.stage ?? "unknown"}`}>
      <div className="co-card-top">
        <div>
          <h3>{p.first_name} {p.last_name}</h3>
          <p className="muted">{p.city ?? "—"} · {p.email}</p>
        </div>
        <div className="co-badges">
          {p.stage && <span className={`co-stage co-stage-${p.stage}`}>{p.stage}</span>}
          {p.drift_date && OUTREACH_STAGES.has(p.stage ?? "") &&
            <span className="co-drift" title={day(p.drift_date)}>{driftLabel(p.drift_date)}</span>}
          {p.request_status === "requested" && <span className="co-request">asked for this</span>}
          {p.request_status === "booked" && <span className="co-confirmed">✓ confirmed</span>}
          {p.do_not_contact && <span className="co-dnc">do not contact</span>}
          <button className="btn btn-sm btn-primary co-visual" onClick={onVisualize}>Visualize</button>
        </div>
      </div>

      {!p.do_not_contact && (
        <>
          {p.request_status === "requested" && (
            <div className="co-ask" role="group" aria-label={`Request from ${p.first_name}`}>
              <div className="co-ask-text">
                <span className="co-ask-eyebrow">New request</span>
                <p><strong>{p.first_name} asked for</strong> {step ?? "—"}</p>
              </div>
              <div className="co-ask-actions">
                <button type="button" className="co-ask-accept" disabled={!!deciding} onClick={() => decide("accepted")}>
                  {deciding === "accepted" ? "Accepting…" : "✓ Accept request"}</button>
                <button type="button" className="co-ask-decline" disabled={!!deciding} onClick={() => decide("declined")}>
                  {deciding === "declined" ? "Declining…" : "Decline"}</button>
              </div>
            </div>
          )}
          {p.request_status === "booked" && p.request_offer_name && (
            <p className="co-ask-done" role="status"><span className="co-ask-tick" aria-hidden="true">✓</span><span>Confirmed: <strong>{p.request_offer_name}</strong>. {p.first_name} can see it on their journey.</span></p>
          )}
          {p.request_status === "cancelled" && p.request_offer_name && (
            <p className="co-ask-released" role="status">Request declined: {p.request_offer_name}. It's been released.</p>
          )}
          {p.next_steps.length > 0 && (
            <ol className="co-steps">
              {p.next_steps.map((s) => (
                <li key={s.rank} className={s.offer_id === p.chosen_offer_id ? "is-pick" : ""}>
                  <span className="co-kind">{s.kind}</span> {s.name} <span className="muted">· {s.when}</span>
                  {s.offer_id === p.chosen_offer_id && <span className="co-pick">suggested</span>}
                </li>
              ))}
            </ol>
          )}
          {p.coordinator_reason && <p className="co-reason">Why: {p.coordinator_reason}{p.chosen_by === "ai" ? " (AI, from notes)" : ""}</p>}
          <div className="co-draft">
            <div className="co-draft-head">
              <span>Reach out by <strong>{p.suggested_channel || "—"}</strong></span>
              {p.draft_message && <button className="co-link" onClick={copy}>{copied ? "Copied" : "Copy message"}</button>}
            </div>
            <pre>{p.draft_message || "No drafted message yet."}</pre>
            <div className="co-contact">
              {contactLinks(p).map((l) => (
                <a key={l.channel} href={l.href} target={l.channel === "whatsapp" ? "_blank" : undefined} rel="noopener"
                  className={`co-contact-btn${channelKey(p.suggested_channel) === l.channel ? " is-suggested" : ""}`}>
                  {l.label}
                </a>
              ))}
            </div>
          </div>
          <div className="co-outcome" role="group" aria-label={`Outcome for ${p.first_name}`}>
            <span className="muted">Outcome:</span>
            {/* Accepted / Declined: a toggle, one at most. Click a highlighted chip again to clear it. */}
            {OUTCOMES.filter((o) => DECISION.includes(o.result)).map((o) => (
              <button key={o.result} className={`co-chip co-chip-${o.result}${isOn(o.result) ? " is-on" : ""}`} aria-pressed={isOn(o.result)}
                title={isOn(o.result) ? "Click to clear" : undefined} onClick={() => toggle(o.result)}>{o.label}</button>
            ))}
            <span className="co-outcome-sep" aria-hidden="true" />
            {/* Attended and No reply: each on or off on its own, alongside the decision. */}
            {OUTCOMES.filter((o) => !DECISION.includes(o.result)).map((o) => {
              // Can't have attended something that isn't accepted yet, or before the event.
              const locked = o.result === "attended" && (decision !== "accepted" || !attendable);
              return (
                <button key={o.result} className={`co-chip co-chip-${o.result}${isOn(o.result) ? " is-on" : ""}`} aria-pressed={isOn(o.result)}
                  disabled={locked} onClick={() => toggle(o.result)}
                  title={locked ? (decision !== "accepted" ? "Accept first" : `Available after ${day(eventDate!)}`)
                    : isOn(o.result) ? "Click to clear" : undefined}>{o.label}</button>
              );
            })}
            {(decision || attended || noReply) && (
              <span className={`co-saved${decision === "declined" && !attended && !noReply ? " co-saved-declined" : ""}`}>
                Saved: {[decision && OUTCOME_LABEL[decision], attended && "Attended", noReply && "No reply"].filter(Boolean).join(" · ")}</span>
            )}
          </div>
        </>
      )}

      {p.notes && (
        <div className="co-notes">
          <button className="co-link" onClick={() => setShowNotes((v) => !v)}>
            {showNotes ? "Hide volunteer notes" : "Volunteer notes"}
          </button>
          {showNotes && <p>{p.notes}</p>}
        </div>
      )}
    </li>
  );
}
