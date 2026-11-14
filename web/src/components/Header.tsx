import type { Participant } from "../../../src/types";

interface Props {
  people: Participant[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export default function Header({ people, selectedId, onSelect }: Props) {
  // Hand-authored demo people first, then everyone else alphabetically.
  const sorted = [...people].sort((a, b) =>
    Number(!a.hero) - Number(!b.hero) || a.firstName.localeCompare(b.firstName));

  return (
    <header className="site-header">
      <div className="container header-row">
        <a className="wordmark" href="#top">
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <circle cx="12" cy="12" r="5" fill="var(--marigold)" />
            {Array.from({ length: 8 }, (_, i) => (
              <line key={i} x1="12" y1="2" x2="12" y2="5" stroke="var(--marigold)" strokeWidth="2"
                strokeLinecap="round" transform={`rotate(${i * 45} 12 12)`} />
            ))}
          </svg>
          Journey Compass
        </a>
        <nav className="main-nav" aria-label="Sections">
          <a href="#wisdom">Wisdom</a>
          <a href="#journey">Your Journey</a>
          <a href="#next">Next Steps</a>
        </nav>
        <label className="viewing-as">
          <span>Viewing as</span>
          <select value={selectedId} onChange={(e) => onSelect(e.target.value)}>
            {sorted.map((p) => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName} · {p.city}
              </option>
            ))}
          </select>
        </label>
      </div>
    </header>
  );
}
