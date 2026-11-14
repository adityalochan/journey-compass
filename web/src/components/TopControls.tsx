import { useState } from "react";
import { next, toggleMusic, TRACKS, useMusic } from "../lib/music";

type Theme = "light" | "dark";
const currentTheme = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

/** Music toggle (with track name) and light/dark switch. Shown in the header and on the login page. */
export default function TopControls() {
  const { playing, track } = useMusic();
  const [theme, setTheme] = useState<Theme>(currentTheme);
  const t = TRACKS[track];

  function flipTheme() {
    const nt: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nt;
    try { localStorage.setItem("jc-theme", nt); } catch { /* storage blocked */ }
    setTheme(nt);
  }

  return (
    <div className="top-controls">
      <div className={`music-pill ${playing ? "is-playing" : ""}`}>
        <button className="music-toggle" onClick={toggleMusic} aria-pressed={playing}
          aria-label={playing ? `Pause music: ${t.title}` : "Play calming music"} title={playing ? "Pause music" : "Play calming music"}>
          <span className="eq" aria-hidden="true"><i /><i /><i /><i /></span>
          <span className="music-label">
            {playing ? <><strong>{t.title}</strong><small>{t.composer}</small></> : <strong>Calm music</strong>}
          </span>
        </button>
        {playing && (
          <button className="music-next" onClick={next} aria-label="Next track" title="Next track">
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 5l8 7-8 7zM16 5h2v14h-2z" fill="currentColor" /></svg>
          </button>
        )}
      </div>
      <button className="theme-toggle" onClick={flipTheme}
        aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} title={theme === "dark" ? "Light theme" : "Dark theme"}>
        {theme === "dark"
          ? <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="currentColor" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          : <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="currentColor" /></svg>}
      </button>
    </div>
  );
}
