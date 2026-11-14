import type { Participant } from "../../../src/types";

export default function Header({ person, onLogout }: { person: Participant; onLogout: () => void }) {
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
        <div className="account">
          <span className="avatar" aria-hidden="true">{person.firstName[0]}{person.lastName[0]}</span>
          <span className="account-name">{person.firstName} {person.lastName}</span>
          <button className="btn btn-ghost btn-sm" onClick={onLogout}>Sign out</button>
        </div>
      </div>
    </header>
  );
}
