import { useSyncExternalStore } from "react";

export interface Track {
  title: string;
  composer: string;
  src: string;
  /** Where the recording came from, and its licence. */
  credit: string;
}

// Public-domain / CC0 recordings from Wikimedia Commons. No lyrics, calm and slow.
export const TRACKS: Track[] = [
  { title: "Gymnopédie No. 1", composer: "Erik Satie", src: "/music/gymnopedie-1.mp3", credit: "Teknopazzo, CC0" },
  { title: "Clair de lune", composer: "Claude Debussy", src: "/music/clair-de-lune.mp3", credit: "Public domain" },
  { title: "Nocturne Op. 9 No. 2", composer: "Frédéric Chopin", src: "/music/nocturne-op9-2.mp3", credit: "CC0" },
  { title: "Air on the G String", composer: "J. S. Bach", src: "/music/air-on-g.mp3", credit: "Public domain" },
  { title: "Rêverie", composer: "Claude Debussy", src: "/music/reverie.mp3", credit: "Public domain" },
  { title: "Träumerei", composer: "Robert Schumann", src: "/music/traumerei.mp3", credit: "Public domain" },
  { title: "Gymnopédie No. 3", composer: "Erik Satie", src: "/music/gymnopedie-3.mp3", credit: "CC0" },
  { title: "Morning Mood", composer: "Edvard Grieg", src: "/music/morning-mood.mp3", credit: "Public domain" },
  { title: "Gnossienne No. 1", composer: "Erik Satie", src: "/music/gnossienne-1.mp3", credit: "La Piani, public domain" },
];

// ---- One shared player for the whole app, so music keeps playing across login → profile ----
const VOLUME = 0.35; // soft background level (tracks are loudness-normalized)
const FADE_MS = 2500;
const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } };

let state = { playing: false, track: Number(get("jc-track") ?? 0) % TRACKS.length };
const subs = new Set<() => void>();
const emit = (patch: Partial<typeof state>) => { state = { ...state, ...patch }; subs.forEach((f) => f()); };
let audio: HTMLAudioElement | null = null;
let fade: number | undefined;

function rampTo(target: number, then?: () => void) {
  if (!audio) return;
  const a = audio;
  window.clearInterval(fade);
  const step = (target - a.volume) / (FADE_MS / 50);
  fade = window.setInterval(() => {
    const v = a.volume + step;
    if ((step >= 0 && v >= target) || (step < 0 && v <= target)) {
      a.volume = target;
      window.clearInterval(fade);
      then?.();
    } else a.volume = Math.min(1, Math.max(0, v));
  }, 50);
}

function play(index: number) {
  if (!audio) { audio = new Audio(); audio.onended = next; }
  if (!audio.src.endsWith(TRACKS[index].src)) audio.src = TRACKS[index].src;
  audio.volume = START_VOLUME;
  audio.play().then(() => { emit({ playing: true }); rampTo(VOLUME); }).catch(() => emit({ playing: false }));
}

export function toggleMusic() {
  if (state.playing) {
    rampTo(0, () => audio?.pause());
    emit({ playing: false });
    set("jc-music", "off");
  } else {
    play(state.track);
    set("jc-music", "on");
  }
}

export function next() {
  const n = (state.track + 1) % TRACKS.length;
  emit({ track: n });
  set("jc-track", String(n));
  play(n);
}

// Auto-start 4s after landing, unless the visitor turned music off before.
// Browsers block sound until the first click/tap/key press, so if the attempt is blocked we start on that interaction.
const AUTOSTART_MS = 4000;
const START_VOLUME = 0.05; // fade starts here, not 0, so browsers treat it as real (audible) playback
if (get("jc-music") !== "off") {
  const events = ["pointerdown", "keydown", "touchstart"] as const;
  const onInteract = (e: Event) => {
    events.forEach((ev) => window.removeEventListener(ev, onInteract));
    // A click on the music button itself is handled by the button, so the two don't cancel each other out.
    if ((e.target as Element | null)?.closest?.(".music-pill")) return;
    if (get("jc-music") !== "off" && (!state.playing || !audio || audio.paused || audio.muted)) play(state.track);
  };
  window.setTimeout(() => {
    if (state.playing || get("jc-music") === "off") return;
    if (!audio) { audio = new Audio(); audio.onended = next; }
    audio.src = TRACKS[state.track].src;
    audio.volume = START_VOLUME;
    events.forEach((e) => window.addEventListener(e, onInteract, { once: true }));
    audio.play()
      .then(() => { emit({ playing: true }); rampTo(VOLUME); })
      .catch(() => emit({ playing: false }));
  }, AUTOSTART_MS);
}

export const useMusic = () =>
  useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state);
