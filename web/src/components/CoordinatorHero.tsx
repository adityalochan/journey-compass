import "./insights.css";

type Tab = "outreach" | "requests" | "all";

interface Props {
  name: string;
  covers: string | null;
  people: { stage: string | null; do_not_contact: boolean; request_status: string | null; drift_date: string | null; chosen_by: string | null }[];
  tab: Tab;
  onTab: (t: Tab) => void;
  /** Which shortcut tile is showing, if any: drifting soon or AI-picked. */
  focus?: "soon" | "ai" | null;
  onFocus?: (f: "soon" | "ai") => void;
}

const OUTREACH = new Set(["slipping", "drifting", "dormant"]);

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** Art of Living style banner for the coordinator list, with clickable summary tiles. */
export default function CoordinatorHero({ name, covers, people, tab, onTab, focus = null, onFocus }: Props) {
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const daysTo = (iso: string) => Math.round((new Date(`${iso}T12:00:00`).getTime() - today.getTime()) / 86_400_000);
  const outreach = people.filter((p) => !p.do_not_contact && OUTREACH.has(p.stage ?? "")).length;
  const requests = people.filter((p) => p.request_status === "requested").length;
  const soon = people.filter((p) => !p.do_not_contact && p.drift_date && OUTREACH.has(p.stage ?? "") && daysTo(p.drift_date) >= 0 && daysTo(p.drift_date) <= 14).length;
  const on = (t: Tab) => (!focus && tab === t ? " is-on" : "");
  const ai = people.filter((p) => p.chosen_by === "ai").length;
  const scope = covers ? (covers === name ? "your people" : `${covers}'s people`) : "everyone";
  const date = new Date().toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" });

  return (
    <>
      <section className="coh">
        <div className="container">
          <p className="ins-hero-eyebrow">Coordinator · {date}</p>
          <h1>{greeting()}, {name.split(" ")[0]}.</h1>
          <p className="ins-hero-sub">
            {outreach > 0 ? `${outreach} of ${scope} could use a gentle touch this week.` : `All of ${scope} are on track.`}
            {requests > 0 && <span className="coh-new">{requests} new request{requests === 1 ? "" : "s"}</span>}
          </p>
        </div>
      </section>
      <div className="container coh-tiles">
        <button className={`coh-tile${on("outreach")}`} onClick={() => onTab("outreach")}>
          <span>Needs outreach</span><strong>{outreach}</strong><small>slipping, drifting or dormant</small>
        </button>
        <button className={`coh-tile${on("requests")}`} onClick={() => onTab("requests")}>
          <span>Requests</span><strong>{requests}</strong><small>asked to join something</small>
        </button>
        <button className={`coh-tile${focus === "soon" ? " is-on" : ""}`} onClick={() => onFocus?.("soon")}>
          <span>Drifting soon</span><strong>{soon}</strong><small>predicted within 14 days</small>
        </button>
        <button className={`coh-tile${focus === "ai" ? " is-on" : ""}`} onClick={() => onFocus?.("ai")}>
          <span>AI-picked steps</span><strong>{ai}</strong><small>chosen from volunteer notes</small>
        </button>
        <button className={`coh-tile${on("all")}`} onClick={() => onTab("all")}>
          <span>Everyone</span><strong>{people.length}</strong><small>{scope}</small>
        </button>
      </div>
    </>
  );
}
