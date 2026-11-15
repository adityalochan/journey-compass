import { lazy, Suspense, useMemo, useState, type FormEvent } from "react";
import type { Participant } from "../../../src/types";
import { CENTRES, distanceKm, geocode, knownCity, type Place } from "../lib/geo";
// The 3D globe (three.js) loads separately so the rest of the page stays fast.
const Globe = lazy(() => import("./Globe"));
import ErrorBoundary from "./ErrorBoundary";

const fmt = (iso: string) => new Date(`${iso}T00:00`).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });

export default function CommunitySection({ person }: { person: Participant }) {
  const [query, setQuery] = useState("");
  const [me, setMe] = useState<Place | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const ranked = useMemo(
    () => (me ? CENTRES.map((c) => ({ ...c, km: distanceKm(me, c) })).sort((a, b) => a.km - b.km) : CENTRES.map((c) => ({ ...c, km: null as number | null }))),
    [me],
  );
  const nearestIds = me ? ranked.slice(0, 3).map((c) => c.id) : [];

  function choose(place: Place) {
    setMe(place);
    setError("");
    const nearest = CENTRES.map((c) => ({ id: c.id, km: distanceKm(place, c) })).sort((a, b) => a.km - b.km)[0];
    setOpen(nearest?.id ?? null);
  }

  async function search(e?: FormEvent) {
    e?.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    try {
      const place = await geocode(query);
      if (place) choose(place);
      else setError("We couldn't find that place. Try a city name, like Toronto.");
    } catch {
      setError("Location search is unavailable right now. Try a city name, like Toronto.");
    } finally {
      setBusy(false);
    }
  }

  function useDevice() {
    if (!navigator.geolocation) return setError("Your browser doesn't share location. Type your city instead.");
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { choose({ label: "Your current location", lat: pos.coords.latitude, lng: pos.coords.longitude }); setBusy(false); },
      () => { setError("Location permission was declined. Type your city instead."); setBusy(false); },
      { timeout: 8000 },
    );
  }

  const homeCity = knownCity(person.city);

  return (
    <section className="community" id="community">
      <div className="container">
        <p className="eyebrow eyebrow-light">Find your community</p>
        <h2>Your people are closer than you think</h2>
        <p className="community-lede">Enter your city or address to see Art of Living centres, upcoming sessions, and who to talk to near you.</p>

        <form className="community-search" onSubmit={search}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="City or address, e.g. Toronto, ON"
            aria-label="Your city or address" autoComplete="address-level2" />
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Finding…" : "Find near me"}</button>
          <button className="btn btn-ghost-light" type="button" onClick={useDevice} disabled={busy}>Use my location</button>
          {homeCity && !me && (
            <button className="chip-light" type="button" onClick={() => { setQuery(person.city); choose(homeCity); }}>
              Try {person.city}
            </button>
          )}
        </form>
        {error && <p className="community-error" role="alert">{error}</p>}

        <div className="community-grid">
          <div className="globe-wrap">
            <ErrorBoundary fallback={<div className="globe-loading">The 3D globe isn't available on this device. The list of centres works as usual.</div>}>
            <Suspense fallback={<div className="globe-loading">Loading the globe…</div>}>
              <Globe centres={CENTRES} me={me} nearestIds={nearestIds} selectedId={open} onSelect={(id) => setOpen(id)} />
            </Suspense>
            </ErrorBoundary>
            <p className="globe-hint">Drag to rotate · scroll or pinch to zoom · tap a glowing city</p>
          </div>

          <aside className="community-panel" aria-live="polite">
            {me ? <p className="panel-you">Showing centres near <strong>{me.label}</strong></p>
              : <p className="panel-you">Enter your location to see the closest centres first.</p>}
            <ul className="centre-list">
              {ranked.map((c, n) => {
                const isOpen = open === c.id;
                return (
                  <li key={c.id} className={`centre ${isOpen ? "is-open" : ""} ${me && n === 0 ? "is-nearest" : ""}`}>
                    <button className="centre-head" onClick={() => setOpen(isOpen ? null : c.id)} aria-expanded={isOpen}>
                      <span>
                        <strong>{c.name}</strong>
                        <small>{c.city}, {c.region}{c.km !== null && ` · ${c.km < 1 ? "<1" : Math.round(c.km).toLocaleString()} km`}</small>
                      </span>
                      {me && n === 0 && <span className="badge badge-warm">Nearest</span>}
                    </button>
                    {isOpen && (
                      <div className="centre-body">
                        <p className="centre-address">{c.address}</p>
                        <div className="centre-contacts">
                          {c.contacts.map((p) => (
                            <div key={p.email} className="contact">
                              <span className="contact-role">{p.role}</span>
                              <strong>{p.name}</strong>
                              <a href={`mailto:${p.email}`}>{p.email}</a>
                              <a href={`tel:${p.phone.replace(/[^\d+]/g, "")}`}>{p.phone}</a>
                            </div>
                          ))}
                        </div>
                        <div className="seva-box">
                          <p className="centre-sub">Seva here</p>
                          {c.seva.map((s) => (
                            <p key={s.name + s.date} className="seva-line">
                              {s.name} · {s.past ? `last held ${fmt(s.date)}` : fmt(s.date)}
                              {s.url && <> · <a href={s.url} target="_blank" rel="noopener noreferrer">Register</a></>}
                            </p>
                          ))}
                          <p className="seva-line">Kitchen, setup and welcome-desk help at weekly events. Ask the coordinator above.</p>
                        </div>
                        {c.upcoming.length > 0 && (
                          <>
                            <p className="centre-sub">Coming up</p>
                            <ul className="upcoming">
                              {c.upcoming.map((u) => (
                                <li key={u.name + u.date}>
                                  <span className="upcoming-date">{fmt(u.date)}</span>
                                  <span className="upcoming-name">{u.name}</span>
                                  {u.url && <a href={u.url} target="_blank" rel="noopener noreferrer">{u.kind === "course" ? "Register" : "Details"}</a>}
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="panel-note">Addresses and contacts are sample data from the hackathon dataset.</p>
          </aside>
        </div>
      </div>
    </section>
  );
}
