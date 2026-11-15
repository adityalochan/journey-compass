import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  buildRows, ENGINE_STAGE, loadGroup, median, METRICS, STAGES,
  type CoordPerson, type GroupData, type MetricKey, type Row,
} from "../lib/insights";
import "./insights.css";

interface Props { personId: string; people: CoordPerson[]; onBack: () => void; onOpen: (id: string) => void }

const fmt = (v: number | null, unit = "") => (v == null ? "—" : `${Number.isInteger(v) ? v : v.toFixed(1)}${unit}`);
const labelOf = (k: MetricKey) => METRICS.find((m) => m.key === k)!;

export default function PersonInsights({ personId, people, onBack, onOpen }: Props) {
  const [group, setGroup] = useState<GroupData | null>(null);
  const [error, setError] = useState("");
  const ids = useMemo(() => people.map((p) => p.participant_id), [people]);

  useEffect(() => {
    let live = true;
    loadGroup(ids).then((g) => live && setGroup(g)).catch((e: Error) => live && setError(e.message));
    return () => { live = false; };
  }, [ids.join(",")]);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [personId]);

  const p = people.find((x) => x.participant_id === personId);
  const rows = useMemo(() => (group ? buildRows(people, group) : []), [group, people]);
  const me = rows.find((r) => r.id === personId);

  if (!p) return <div className="co-center"><p>Person not found.</p><button className="btn btn-ghost" onClick={onBack}>Back</button></div>;

  return (
    <div className="ins-page">
    <section className="ins-hero">
      <div className="container">
        <button className="ins-back" onClick={onBack}>← Back to people</button>
        <p className="ins-hero-eyebrow">Model insights · AI-predicted journey</p>
        <h1>{p.first_name} {p.last_name}</h1>
        <p className="ins-hero-sub">
          {p.city ?? "—"} · compared with the {people.length} people you cover
          {p.stage && <span className={`ins-stage ins-st-${p.stage}`}><i />{p.stage}</span>}
        </p>
      </div>
    </section>
    <main className="container co-main ins">

      {error && <p className="form-error" role="alert">{error}</p>}
      {!group && !error && <p className="muted">Loading the model's data…</p>}

      {group && me && (
        <>
          <Tiles me={me} rows={rows} p={p} />
          {p.stage_drivers && (
            <section className="ins-card"><h2>Why the model predicts “{p.stage}”</h2><p className="ins-drivers">{p.stage_drivers}</p></section>
          )}
          <div className="ins-grid">
            <section className="ins-card"><p className="ins-eyebrow">Signals</p><h2>Engagement signals vs. your group</h2>
              <p className="muted ins-sub">Bar = {p.first_name}. Tick = group median.</p>
              <SignalBars me={me} rows={rows} /></section>
            <section className="ins-card"><p className="ins-eyebrow">Next steps</p><h2>What the model suggests next</h2>
              <NextSteps p={p} group={group} /></section>
          </div>
          <section className="ins-card"><p className="ins-eyebrow">History</p><h2>Journey timeline</h2>
            <p className="muted ins-sub">Every course, gathering, seva and contact on record.</p>
            <Timeline id={personId} group={group} /></section>
          <section className="ins-card"><p className="ins-eyebrow">Explore</p><h2>Explore: compare {p.first_name} with everyone you cover</h2>
            <Explorer rows={rows} meId={personId} onOpen={onOpen} /></section>
        </>
      )}
    </main>
    </div>
  );
}

/* ---------- Headline tiles ---------- */
function Tiles({ me, rows, p }: { me: Row; rows: Row[]; p: CoordPerson }) {
  const med = median(rows.map((r) => r.engagement).filter((v): v is number => v != null));
  const drift = me.daysToDrift;
  const driftText = drift == null ? "Stable" : drift > 0 ? `in ${drift} days` : drift === 0 ? "today" : `${-drift} days ago`;
  return (
    <div className="ins-tiles">
      <Tile label="Engagement score" value={fmt(me.engagement)} note={`group median ${fmt(med)}`} />
      <Tile label="Stage confidence" value={fmt(me.confidence, "%")} note={`predicted: ${p.stage ?? "—"}`} />
      <Tile label="Predicted drift" value={driftText} note={p.drift_date ? `next stage change ${p.drift_date}` : "no change projected"} />
      <Tile label="Engagement trend" value={me.trend == null ? "—" : `${me.trend > 0 ? "+" : ""}${fmt(me.trend)}`}
        note={me.trend == null ? "" : me.trend >= 0 ? "rising" : "falling"} />
      <Tile label="Next step picked by" value={p.chosen_by === "ai" ? "AI" : "Rules engine"} note={p.chosen_offer_name ?? "—"} />
    </div>
  );
}
function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="ins-tile"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

/* ---------- Signals vs group median (single series + median tick) ---------- */
function SignalBars({ me, rows }: { me: Row; rows: Row[] }) {
  const keys: MetricKey[] = ["app", "email", "whatsapp", "video"];
  return (
    <div className="ins-bars">
      {keys.map((k) => {
        const vals = rows.map((r) => r[k]).filter((v): v is number => v != null);
        const max = Math.max(1, ...vals);
        const med = median(vals);
        const v = me[k] ?? 0;
        return (
          <div key={k} className="ins-bar-row" title={`${labelOf(k).label}: ${v} (group median ${fmt(med)})`}>
            <span className="ins-bar-label">{labelOf(k).label.replace(", last 30 days", "")}</span>
            <div className="ins-bar-track">
              <div className="ins-bar-fill" style={{ width: `${(v / max) * 100}%` }} />
              <div className="ins-bar-median" style={{ left: `${(med / max) * 100}%` }} />
            </div>
            <span className="ins-bar-val">{v}<small> / med {fmt(med)}</small></span>
          </div>
        );
      })}
      <p className="muted ins-foot">Last 30 days. Scale = highest in your group.</p>
    </div>
  );
}

/* ---------- Next steps + the model's learning (acceptance rates) ---------- */
function NextSteps({ p, group }: { p: CoordPerson; group: GroupData }) {
  const stage = ENGINE_STAGE[p.stage ?? ""] ?? p.journey_stage ?? "";
  const rates = group.rates.filter((r) => r.stage === stage).sort((a, b) => b.rate - a.rate);
  const max = Math.max(0.01, ...rates.map((r) => r.rate));
  return (
    <>
      <ol className="ins-steps">
        {p.next_steps.map((s) => (
          <li key={s.rank} className={s.offer_id === p.chosen_offer_id ? "is-pick" : ""}>
            <span className="co-kind">{s.kind}</span> {s.name} <span className="muted">· {s.when}</span>
            {s.offer_id === p.chosen_offer_id && <span className="co-pick">{p.chosen_by === "ai" ? "AI pick" : "engine pick"}</span>}
          </li>
        ))}
      </ol>
      {p.coordinator_reason && <p className="ins-reason">{p.coordinator_reason}</p>}
      {rates.length > 0 && (
        <>
          <h3 className="ins-h3">How often “{stage}” people accept each kind of offer</h3>
          <div className="ins-bars">
            {rates.map((r) => (
              <div key={r.offer_type} className="ins-bar-row" title={`${r.offer_type}: ${Math.round(r.rate * 100)}% · ${r.successes}/${r.trials} recorded outcomes`}>
                <span className="ins-bar-label">{r.offer_type}</span>
                <div className="ins-bar-track"><div className="ins-bar-fill ins-bar-alt" style={{ width: `${(r.rate / max) * 100}%` }} /></div>
                <span className="ins-bar-val">{Math.round(r.rate * 100)}%</span>
              </div>
            ))}
          </div>
          <p className="muted ins-foot">The engine's learned acceptance rates; they update as coordinators record outcomes.</p>
        </>
      )}
    </>
  );
}

/* ---------- Timeline (dot strip, one row per kind) ---------- */
function Timeline({ id, group }: { id: string; group: GroupData }) {
  const box = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const events = [
    ...group.activities.filter((a) => a.participant_id === id).map((a) => ({
      row: a.activity_type === "seva" ? "Seva" : a.activity_type === "event" ? "Gatherings" : "Courses",
      t: new Date(`${a.date}T12:00:00`).getTime(), text: `${a.name} · ${a.date}` })),
    ...group.contacts.filter((c) => c.participant_id === id).map((c) => ({
      row: c.direction === "in" ? "They reached out" : "We reached out",
      t: new Date(c.at).getTime(), text: `${c.direction === "in" ? "From them" : "To them"} by ${c.channel} · ${c.at.slice(0, 10)}` })),
  ];
  if (!events.length) return <p className="muted">No history on record.</p>;
  const ROWS = ["Courses", "Gatherings", "Seva", "We reached out", "They reached out"].filter((r) => events.some((e) => e.row === r));
  const now = Date.now();
  const t0 = Math.min(...events.map((e) => e.t)), t1 = Math.max(now, ...events.map((e) => e.t));
  const W = 1000, L = 130, R = 16, RH = 34, H = ROWS.length * RH + 30;
  const x = (t: number) => L + ((t - t0) / Math.max(1, t1 - t0)) * (W - L - R);
  const ticks = Array.from({ length: 5 }, (_, i) => t0 + ((t1 - t0) * i) / 4);
  return (
    <div className="ins-chart" ref={box} onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Timeline of activities and contacts">
        {ROWS.map((r, i) => (
          <g key={r}>
            <line x1={L} x2={W - R} y1={i * RH + 17} y2={i * RH + 17} className="ins-grid-line" />
            <text x={L - 10} y={i * RH + 21} textAnchor="end" className="ins-axis-text">{r}</text>
          </g>
        ))}
        {ticks.map((t) => (
          <text key={t} x={x(t)} y={H - 6} textAnchor="middle" className="ins-axis-text">
            {new Date(t).toLocaleDateString("en-CA", { month: "short", year: "2-digit" })}
          </text>
        ))}
        <line x1={x(now)} x2={x(now)} y1={4} y2={H - 22} className="ins-today" />
        {events.map((e, i) => {
          const cy = ROWS.indexOf(e.row) * RH + 17;
          return (
            <g key={i} onMouseEnter={(ev) => {
              const b = box.current!.getBoundingClientRect();
              setTip({ x: ev.clientX - b.left, y: ev.clientY - b.top, text: `${e.row}: ${e.text}` });
            }}>
              <circle cx={x(e.t)} cy={cy} r={12} fill="transparent" />
              <circle cx={x(e.t)} cy={cy} r={5.5} className={`ins-dot ins-dot-${ROWS.indexOf(e.row) > 2 ? "contact" : "act"}`} />
            </g>
          );
        })}
      </svg>
      {tip && <div className="ins-tip" style={{ left: tip.x, top: tip.y }}>{tip.text}</div>}
    </div>
  );
}

/* ---------- Explorer: bubble chart with stage territories, animated axes, hover focus ---------- */
function Explorer({ rows, meId, onOpen }: { rows: Row[]; meId: string; onOpen: (id: string) => void }) {
  const [xk, setX] = useState<MetricKey>("daysSinceContact");
  const [yk, setY] = useState<MetricKey>("engagement");
  const [zk, setZ] = useState<MetricKey | "none">("confidence");
  const [spread, setSpread] = useState(true);
  const [table, setTable] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<Row | null>(null);
  // "Spread out" uses a square-root scale: most people sit at low values, which crams them into a corner.
  const [sqrt, setSqrt] = useState(true);

  const pts = rows.filter((r) => r[xk] != null && r[yk] != null && !hidden.has(r.stage));
  const xs = pts.map((r) => r[xk] as number), ys = pts.map((r) => r[yk] as number);
  const f = (v: number) => (sqrt ? Math.sign(v) * Math.sqrt(Math.abs(v)) : v);
  const inv = (v: number) => (sqrt ? Math.sign(v) * v * v : v);
  // Domain in transformed space; never below 0 when every value is >= 0 (counts, scores, days).
  const dom = (vals: number[]) => {
    const t = vals.map(f), lo = Math.min(...t, 0), hi = Math.max(...t, f(1)), d = hi - lo || 1;
    return [lo >= 0 ? 0 : lo - d * 0.05, hi + d * 0.05];
  };
  const [x0, x1] = dom(xs);
  const [y0, y1] = dom(ys);
  const W = 1200, H = 640, L = 92, R = 30, T = 26, B = 84, PAD = 18;
  const sx = (v: number) => L + PAD + ((f(v) - x0) / (x1 - x0)) * (W - L - R - 2 * PAD);
  const sy = (v: number) => T + PAD + (1 - (f(v) - y0) / (y1 - y0)) * (H - T - B - 2 * PAD);
  const zs = zk === "none" ? [] : rows.map((r) => r[zk]).filter((v): v is number => v != null);
  const zmin = Math.min(...zs, 0), zmax = Math.max(...zs, 1);
  const rad = (r: Row) => (zk === "none" || r[zk] == null ? 5 : 3.5 + 6 * Math.sqrt(((r[zk] as number) - zmin) / (zmax - zmin || 1)));
  const jit = (id: string, k: number) => {
    if (!spread) return 0;
    let h = 0; for (const c of id + k) h = (h * 31 + c.charCodeAt(0)) | 0;
    return ((h % 1000) / 1000 - 0.5) * 12;
  };
  const pos = (r: Row) => ({ cx: sx(r[xk] as number) + (r.id === meId ? 0 : jit(r.id, 1)), cy: sy(r[yk] as number) + (r.id === meId ? 0 : jit(r.id, 2)) });
  // Ticks: evenly spaced on screen, labelled with the real (untransformed) value, rounded nicely.
  const nice = (v: number) => { const a = Math.abs(v); const st = a >= 100 ? 10 : a >= 20 ? 5 : a >= 5 ? 1 : 0.5; return Math.round(v / st) * st; };
  const ticks = (a: number, b: number) => [...new Set(Array.from({ length: 6 }, (_, i) => nice(inv(a + ((b - a) * i) / 5))))];
  const mx = median(xs), my = median(ys);
  const X = labelOf(xk), Y = labelOf(yk);

  // Soft "territory" per stage: an ellipse around that stage's cluster.
  const territories = STAGES.filter((st) => !hidden.has(st)).map((st) => {
    const ps = pts.filter((r) => r.stage === st).map(pos);
    if (ps.length < 2) return null;
    const ax = ps.reduce((a, p) => a + p.cx, 0) / ps.length, ay = ps.reduce((a, p) => a + p.cy, 0) / ps.length;
    const sdx = Math.sqrt(ps.reduce((a, p) => a + (p.cx - ax) ** 2, 0) / ps.length);
    const sdy = Math.sqrt(ps.reduce((a, p) => a + (p.cy - ay) ** 2, 0) / ps.length);
    return { st, ax, ay, rx: Math.max(40, sdx * 2.2), ry: Math.max(34, sdy * 2.2) };
  }).filter(Boolean) as { st: string; ax: number; ay: number; rx: number; ry: number }[];

  const opts = METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>);
  const me = pts.find((r) => r.id === meId);
  const ordered = [...pts.filter((r) => r.id !== meId), ...(me ? [me] : [])]; // the person is drawn last, on top

  return (
    <>
      <div className="ins-controls">
        <label>Y axis <select value={yk} onChange={(e) => setY(e.target.value as MetricKey)}>{opts}</select></label>
        <label>X axis <select value={xk} onChange={(e) => setX(e.target.value as MetricKey)}>{opts}</select></label>
        <label>Size by <select value={zk} onChange={(e) => setZ(e.target.value as MetricKey | "none")}>
          <option value="none">Same size</option>{opts}</select></label>
        <button className="co-link" onClick={() => { setX(yk); setY(xk); }} title="Swap axes">⇄ Swap</button>
        <div className="ins-seg" role="radiogroup" aria-label="Scale">
          <button type="button" role="radio" aria-checked={sqrt} className={sqrt ? "on" : ""} onClick={() => setSqrt(true)}>Spread out (√)</button>
          <button type="button" role="radio" aria-checked={!sqrt} className={!sqrt ? "on" : ""} onClick={() => setSqrt(false)}>Linear</button>
        </div>
        <label className="ins-check"><input type="checkbox" checked={spread} onChange={(e) => setSpread(e.target.checked)} /> Separate overlaps</label>
        <button className="co-link" onClick={() => setTable((t) => !t)}>{table ? "Show chart" : "Show as table"}</button>
      </div>
      <div className="ins-legend" role="group" aria-label="Stages (click to hide/show)">
        {STAGES.map((s) => (
          <button key={s} className={`ins-legend-item ins-st-${s}${hidden.has(s) ? " is-off" : ""}`} aria-pressed={!hidden.has(s)}
            onClick={() => setHidden((h) => { const n = new Set(h); if (n.has(s)) n.delete(s); else n.add(s); return n; })}>
            <i className="ins-sw" />{s} <small>({rows.filter((r) => r.stage === s).length})</small>
          </button>
        ))}
        <span className="ins-legend-me"><i className="ins-sw ins-sw-me" />this person</span>
        {zk !== "none" && <span className="ins-legend-me">bigger dot = higher {labelOf(zk).label.toLowerCase()}</span>}
      </div>

      {table ? (
        <div className="ins-table-wrap">
          <table className="ins-table">
            <thead><tr><th>Name</th><th>Stage</th><th>{X.label}</th><th>{Y.label}</th>{zk !== "none" && <th>{labelOf(zk).label}</th>}</tr></thead>
            <tbody>
              {[...pts].sort((a, b) => (b[yk] as number) - (a[yk] as number)).map((r) => (
                <tr key={r.id} className={r.id === meId ? "is-me" : ""} onClick={() => onOpen(r.id)}>
                  <td>{r.name}</td><td>{r.stage}</td><td>{fmt(r[xk], X.unit)}</td><td>{fmt(r[yk], Y.unit)}</td>
                  {zk !== "none" && <td>{fmt(r[zk], labelOf(zk).unit)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={`ins-chart ins-plot${hover ? " has-hover" : ""}`} onMouseLeave={() => setHover(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${Y.label} against ${X.label}`}>
            <defs>
              <linearGradient id="ins-bg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" style={{ stopColor: "var(--ins-bg-a)" }} />
                <stop offset="1" style={{ stopColor: "var(--ins-bg-b)" }} />
              </linearGradient>
              {STAGES.map((st) => (
                <radialGradient key={st} id={`ins-terr-${st}`}>
                  <stop offset="0" style={{ stopColor: `var(--st-${st})`, stopOpacity: 0.32 }} />
                  <stop offset="0.65" style={{ stopColor: `var(--st-${st})`, stopOpacity: 0.12 }} />
                  <stop offset="1" style={{ stopColor: `var(--st-${st})`, stopOpacity: 0 }} />
                </radialGradient>
              ))}
              {STAGES.map((st) => (
                <radialGradient key={`d${st}`} id={`ins-dot-${st}`} cx="35%" cy="30%" r="75%">
                  <stop offset="0" style={{ stopColor: "#ffffff", stopOpacity: 0.85 }} />
                  <stop offset="0.35" style={{ stopColor: `var(--st-${st})` }} />
                  <stop offset="1" style={{ stopColor: `var(--st-${st})` }} />
                </radialGradient>
              ))}
              <linearGradient id="ins-pill" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#ff9004" /><stop offset="1" stopColor="#7677f4" />
              </linearGradient>
              <filter id="ins-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.5" /></filter>
            </defs>

            <rect x={L} y={T} width={W - L - R} height={H - T - B} rx={18} fill="url(#ins-bg)" />
            {ticks(y0, y1).map((v) => (
              <g key={`y${v}`}>
                <line x1={L} x2={W - R} y1={sy(v)} y2={sy(v)} className="ins-grid-line" />
                <line x1={L - 6} x2={L} y1={sy(v)} y2={sy(v)} className="ins-tick" />
                <rect x={L - 56} y={sy(v) - 11} width={44} height={22} rx={11} className="ins-tick-chip" />
                <text x={L - 34} y={sy(v) + 4} textAnchor="middle" className="ins-tick-text">{v}</text>
              </g>
            ))}
            {ticks(x0, x1).map((v) => (
              <g key={`x${v}`}>
                <line x1={sx(v)} x2={sx(v)} y1={T} y2={H - B} className="ins-grid-line ins-grid-v" />
                <line x1={sx(v)} x2={sx(v)} y1={H - B} y2={H - B + 6} className="ins-tick" />
                <rect x={sx(v) - 24} y={H - B + 10} width={48} height={22} rx={11} className="ins-tick-chip" />
                <text x={sx(v)} y={H - B + 25} textAnchor="middle" className="ins-tick-text">{v}</text>
              </g>
            ))}
            <line x1={L} x2={L} y1={T} y2={H - B} className="ins-axis-y" />
            <line x1={L} x2={W - R} y1={H - B} y2={H - B} className="ins-axis-x" />

            {/* stage territories */}
            {territories.map((t) => (
              <ellipse key={t.st} className="ins-terr" cx={t.ax} cy={t.ay} rx={t.rx} ry={t.ry} fill={`url(#ins-terr-${t.st})`} />
            ))}

            {/* quadrant guides at the group medians */}
            {pts.length > 3 && (
              <g className="ins-quad">
                <line x1={sx(mx)} x2={sx(mx)} y1={T} y2={H - B} />
                <line x1={L} x2={W - R} y1={sy(my)} y2={sy(my)} />
                <text x={L + 12} y={T + 20}>{Y.short[1]} · {X.short[0]}</text>
                <text x={W - R - 12} y={T + 20} textAnchor="end">{Y.short[1]} · {X.short[1]}</text>
                <text x={L + 12} y={H - B - 10}>{Y.short[0]} · {X.short[0]}</text>
                <text x={W - R - 12} y={H - B - 10} textAnchor="end">{Y.short[0]} · {X.short[1]}</text>
              </g>
            )}

            {/* crosshair for the hovered person */}
            {hover && (() => {
              const { cx, cy } = pos(hover);
              return (
                <g className="ins-cross">
                  <line x1={cx} x2={cx} y1={cy} y2={H - B} /><line x1={L} x2={cx} y1={cy} y2={cy} />
                  <rect x={cx - 26} y={H - B + 10} width={52} height={22} rx={11} />
                  <text x={cx} y={H - B + 25} textAnchor="middle">{fmt(hover[xk])}</text>
                  <rect x={L - 56} y={cy - 11} width={44} height={22} rx={11} />
                  <text x={L - 34} y={cy + 4} textAnchor="middle">{fmt(hover[yk])}</text>
                </g>
              );
            })()}

            {ordered.map((r) => {
              const { cx, cy } = pos(r);
              const isMe = r.id === meId, rr = rad(r) + (isMe ? 3 : 0);
              return (
                <g key={r.id} className={`ins-pt ins-move${hover?.id === r.id ? " is-hover" : ""}${isMe ? " is-me" : ""}`}
                  style={{ transform: `translate(${cx}px, ${cy}px)` }}
                  onMouseEnter={() => setHover(r)} onClick={() => !isMe && onOpen(r.id)}>
                  <circle r={Math.max(16, rr + 6)} fill="transparent" />
                  <circle r={rr + 3} className={`ins-halo ins-st-${r.stage}`} filter="url(#ins-glow)" />
                  {isMe && <circle r={rr + 9} className="ins-pulse" />}
                  <circle r={rr} style={{ fill: `url(#ins-dot-${r.stage})` }} className="ins-dotc" />
                  {isMe && <text x={rr + 8} y={-rr - 4} className="ins-me-label">{r.name.split(" ")[0]}</text>}
                </g>
              );
            })}
            <g transform={`translate(${(L + W - R) / 2} ${H - 22})`}>
              <rect x={-(X.label.length * 4.4 + 34)} y={-15} width={X.label.length * 8.8 + 68} height={30} rx={15} fill="url(#ins-pill)" />
              <text textAnchor="middle" y={5} className="ins-axis-pill">{X.label}{sqrt ? " (spread)" : ""} →</text>
            </g>
            <g transform={`translate(22 ${(T + H - B) / 2}) rotate(-90)`}>
              <rect x={-(Y.label.length * 4.4 + 34)} y={-15} width={Y.label.length * 8.8 + 68} height={30} rx={15} fill="url(#ins-pill)" />
              <text textAnchor="middle" y={5} className="ins-axis-pill">{Y.label}{sqrt ? " (spread)" : ""} →</text>
            </g>
          </svg>
          {hover && (() => {
            const { cx, cy } = pos(hover);
            return (
              <div className="ins-tip" style={{ left: `${(cx / W) * 100}%`, top: `${(cy / H) * 100}%` }}>
                <strong>{hover.name}</strong> <span className={`ins-tip-stage ins-st-${hover.stage}`}><i />{hover.stage}</span><br />
                {X.label}: <b>{fmt(hover[xk], X.unit)}</b><br />{Y.label}: <b>{fmt(hover[yk], Y.unit)}</b>
                {zk !== "none" && <><br />{labelOf(zk).label}: <b>{fmt(hover[zk], labelOf(zk).unit)}</b></>}
                {hover.id !== meId && <><br /><em>Click to open</em></>}
              </div>
            );
          })()}
        </div>
      )}
      <p className="muted ins-foot">{pts.length} people plotted{sqrt ? " on a square-root scale, which spreads out the many low values" : ""}. Lines mark the group medians. Click a stage to hide it, or a dot to open that person.</p>
    </>
  );
}

export function Empty({ children }: { children: ReactNode }) { return <p className="muted">{children}</p>; }
