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
  const [filter, setFilter] = useState<Filter>("outreach");
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
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
    // Keep the participant's request in sync: accepted/attended confirms it, declined releases it.
    const next = p.request_offer_id === offer && (result === "accepted" || result === "attended") ? "booked"
      : p.request_offer_id === offer && result === "declined" ? "cancelled" : null;
    if (next) {
      const upd = await supabase.from("interests").update({ status: next })
        .eq("participant_id", p.participant_id).eq("offer_id", offer);
      if (upd.error) setError(upd.error.message);
    }
    setPeople((all) => all.map((x) => (x.participant_id === p.participant_id
      ? { ...x, latest_outcome: result, request_status: next ?? x.request_status } : x)));
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
      <CoordinatorHero name={staff.name} covers={staff.covers} people={people} tab={filter} onTab={setFilter} />
      <main className="container co-main co-wide">
        <div className="co-tabs" role="tablist">
          <Tab on={filter === "outreach"} onClick={() => setFilter("outreach")}>Needs outreach ({outreach})</Tab>
          <Tab on={filter === "requests"} onClick={() => setFilter("requests")}>Requests ({requests})</Tab>
          <Tab on={filter === "all"} onClick={() => setFilter("all")}>Everyone ({people.length})</Tab>
          <button className="co-refresh" onClick={load}>Refresh</button>
        </div>
        <CoordinatorFilters people={shown} value={filters} onChange={setFilters} shown={visible.length} />
        {error && <p className="form-error" role="alert">{error}</p>}
        {visible.length === 0 && <p className="muted">Nobody here right now.</p>}
        <ul className="co-list">
          {visible.map((p) => <Card key={p.participant_id} p={p} onRecord={record}
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

function Card({ p, onRecord, onVisualize }: { p: Person; onRecord: (p: Person, r: Result) => void; onVisualize: () => void }) {
  const [copied, setCopied] = useState(false);
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
            <p className="co-step"><strong>Requested:</strong> {step ?? "—"}</p>
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
          <div className="co-outcome">
            <span className="muted">Outcome:</span>
            {OUTCOMES.map((o) => (
              <button key={o.result} className={`co-chip${p.latest_outcome === o.result ? " is-on" : ""}`}
                onClick={() => onRecord(p, o.result)}>{o.label}</button>
            ))}
            {p.latest_outcome && <span className="co-saved">Saved: {OUTCOME_LABEL[p.latest_outcome]}</span>}
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
