import { STAGES } from "../lib/insights";
import "./insights.css";

export interface Filters {
  q: string;
  stages: Set<string>;
  drift: "any" | "7" | "30" | "past";
  kind: string;
  pickedBy: "any" | "ai" | "engine";
  channel: string;
}
export const EMPTY_FILTERS: Filters = { q: "", stages: new Set(), drift: "any", kind: "any", pickedBy: "any", channel: "any" };

interface Filterable {
  first_name: string; last_name: string | null; email: string; city: string | null; stage: string | null;
  drift_date: string | null; chosen_by: string | null; suggested_channel: string | null;
  chosen_offer_type?: string | null; next_steps: { kind: string }[];
}

const daysTo = (iso: string) => {
  const t = new Date(); t.setHours(12, 0, 0, 0);
  return Math.round((new Date(`${iso}T12:00:00`).getTime() - t.getTime()) / 86_400_000);
};
const kindOf = (p: Filterable) => p.next_steps[0]?.kind ?? p.chosen_offer_type ?? "";

export function applyFilters<T extends Filterable>(people: T[], f: Filters): T[] {
  const q = f.q.trim().toLowerCase();
  return people.filter((p) => {
    if (q && ![p.first_name, p.last_name ?? "", p.email, p.city ?? ""].join(" ").toLowerCase().includes(q)) return false;
    if (f.stages.size && !f.stages.has(p.stage ?? "")) return false;
    if (f.drift !== "any") {
      if (!p.drift_date) return false;
      const d = daysTo(p.drift_date);
      if (f.drift === "past" ? d >= 0 : d < 0 || d > Number(f.drift)) return false;
    }
    if (f.kind !== "any" && kindOf(p) !== f.kind) return false;
    if (f.pickedBy !== "any" && p.chosen_by !== f.pickedBy) return false;
    if (f.channel !== "any" && (p.suggested_channel ?? "") !== f.channel) return false;
    return true;
  });
}

interface Props<T extends Filterable> { people: T[]; value: Filters; onChange: (f: Filters) => void; shown: number }

export default function CoordinatorFilters<T extends Filterable>({ people, value: f, onChange, shown }: Props<T>) {
  const set = (patch: Partial<Filters>) => onChange({ ...f, ...patch });
  const kinds = [...new Set(people.map(kindOf).filter(Boolean))].sort();
  const channels = [...new Set(people.map((p) => p.suggested_channel ?? "").filter(Boolean))].sort();
  const active = f.q || f.stages.size || f.drift !== "any" || f.kind !== "any" || f.pickedBy !== "any" || f.channel !== "any";
  return (
    <div className="cof" role="search">
      <input type="search" placeholder="Search name, email or city" value={f.q} onChange={(e) => set({ q: e.target.value })} aria-label="Search people" />
      <div className="cof-stages" role="group" aria-label="Stage">
        {STAGES.map((s) => (
          <button key={s} type="button" aria-pressed={f.stages.has(s)} className={`cof-stage ins-st-${s}${f.stages.has(s) ? " is-on" : ""}`}
            onClick={() => { const n = new Set(f.stages); if (n.has(s)) n.delete(s); else n.add(s); set({ stages: n }); }}>
            <i className="ins-sw" />{s}
          </button>
        ))}
      </div>
      <select value={f.drift} onChange={(e) => set({ drift: e.target.value as Filters["drift"] })} aria-label="Predicted drift">
        <option value="any">Any drift date</option><option value="7">Drifts within 7 days</option>
        <option value="30">Drifts within 30 days</option><option value="past">Already drifted</option>
      </select>
      <select value={f.kind} onChange={(e) => set({ kind: e.target.value })} aria-label="Top next step">
        <option value="any">Any next step</option>{kinds.map((k) => <option key={k} value={k}>Next step: {k}</option>)}
      </select>
      <select value={f.pickedBy} onChange={(e) => set({ pickedBy: e.target.value as Filters["pickedBy"] })} aria-label="Picked by">
        <option value="any">AI or engine</option><option value="ai">Picked by AI</option><option value="engine">Picked by engine</option>
      </select>
      <select value={f.channel} onChange={(e) => set({ channel: e.target.value })} aria-label="Suggested channel">
        <option value="any">Any channel</option>{channels.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <span className="cof-count">{shown} of {people.length}</span>
      {active && <button type="button" className="co-link" onClick={() => onChange({ ...EMPTY_FILTERS, stages: new Set() })}>Clear</button>}
    </div>
  );
}
