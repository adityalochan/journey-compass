import { useSyncExternalStore } from "react";

export interface Track {
  title: string;
  composer: string;
  src: string;
  /** Where the recording came from, and its licence. */
  credit: string;
}

// Sitar by Rishab Rikhiram Sharma, used with the artist's permission. Audio from his official YouTube channel
// (only his own compositions and ragas, no covers of other artists' songs), loudness-matched, 2 s fade in / 3 s out.
export const TRACKS: Track[] = [
  { title: "Sitar for Mental Health", composer: "Rishab Rikhiram Sharma", src: "/music/sitar-for-mental-health.mp3", credit: "Used with permission of the artist" },
  { title: "Shiv Kailash (Live in Mumbai)", composer: "Rishab Rikhiram Sharma", src: "/music/shiv-kailash.mp3", credit: "Used with permission of the artist" },
  { title: "Chanakya", composer: "Rishab Rikhiram Sharma", src: "/music/chanakya.mp3", credit: "Used with permission of the artist" },
  { title: "Rama Rama", composer: "Rishab Rikhiram Sharma", src: "/music/rama-rama.mp3", credit: "Used with permission of the artist" },
  { title: "The Burning Ghat", composer: "Rishab Rikhiram Sharma", src: "/music/burning-ghat.mp3", credit: "Used with permission of the artist" },
  { title: "Shankara", composer: "Rishab Rikhiram Sharma", src: "/music/shankara.mp3", credit: "Used with permission of the artist" },
  { title: "Raga Nat Bhairav", composer: "Rishab Rikhiram Sharma", src: "/music/raga-nat-bhairav.mp3", credit: "Used with permission of the artist" },
  { title: "Mera Satguru Pyaara (Live in Chandigarh)", composer: "Rishab Rikhiram Sharma", src: "/music/mera-satguru-pyaara.mp3", credit: "Used with permission of the artist" },
];

// ---- One shared player for the whole app, so music keeps playing across login → profile ----
const VOLUME = 0.35; // soft background level (tracks are loudness-normalized)
const FADE_MS = 2500;
const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } };
// "Music off" lasts for this visit only (until the tab/window closes), so every new visit auto-starts again.
const isOff = () => { try { return sessionStorage.getItem("jc-music") === "off"; } catch { return false; } };
const setOff = (off: boolean) => { try { if (off) sessionStorage.setItem("jc-music", "off"); else sessionStorage.removeItem("jc-music"); } catch { /* storage blocked */ } };
try { localStorage.removeItem("jc-music"); } catch { /* older versions kept "off" forever; clear it */ }

let state = { playing: false, track: Number(get("jc-track") ?? 0) % TRACKS.length };
const subs = new Set<() => void>();
const emit = (patch: Partial<typeof state>) => { state = { ...state, ...patch }; subs.forEach((f) => f()); };
let audio: HTMLAudioElement | null = null;
let fade: number | undefined;

function rampTo(target: number, then?: () => void) {
  if (!audio) return;
  const a = audio;
  window.clearInterval(fade);
  // iPhone/iPad ignore element volume (always 1). Skip the fade there, or pause would never happen.
  const before = a.volume;
  a.volume = before === 0.5 ? 0.6 : 0.5;
  const settable = a.volume !== before;
  a.volume = before;
  if (!settable) { then?.(); return; }
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

// The next track is loaded in the background, so pressing "next" switches instantly.
let warm: HTMLAudioElement | null = null;
function warmNext(index: number) {
  const src = TRACKS[(index + 1) % TRACKS.length].src;
  if (warm?.src.endsWith(src)) return;
  warm = new Audio();
  warm.preload = "auto";
  warm.src = src;
  warm.load();
}

/** Start a track. fadeIn: soft fade for the first start; switching tracks starts straight away at normal volume. */
function play(index: number, fadeIn = true): Promise<boolean> {
  const src = TRACKS[index].src;
  if (warm?.src.endsWith(src)) { audio?.pause(); audio = warm; warm = null; }
  if (!audio) audio = new Audio();
  audio.onended = next;
  if (!audio.src.endsWith(src)) audio.src = src;
  window.clearInterval(fade); // a pause fade in progress must not stop the new track
  audio.volume = fadeIn ? START_VOLUME : VOLUME;
  return audio.play()
    .then(() => { emit({ playing: true }); if (fadeIn) rampTo(VOLUME); warmNext(index); return true; })
    .catch(() => { emit({ playing: false }); return false; });
}

export function toggleMusic() {
  if (state.playing) {
    rampTo(0, () => audio?.pause());
    emit({ playing: false });
    setOff(true);
  } else {
    void play(state.track);
    setOff(false);
  }
}

export function next() {
  const n = (state.track + 1) % TRACKS.length;
  emit({ track: n });
  set("jc-track", String(n));
  setOff(false); // pressing next means "play music"
  void play(n, false);
}

// Auto-start 4s after landing on either site (participant or coordinator), unless the visitor turned music off before.
// Browsers block sound until a real click, tap or key press, so if the attempt is blocked we keep trying on each
// of those until it plays. (touchstart and scrolling don't count as permission, so they aren't used.)
const AUTOSTART_MS = 4000;
const START_VOLUME = 0.05; // fade starts here, not 0, so browsers treat it as real (audible) playback
const UNLOCK = ["pointerup", "touchend", "click", "keydown"] as const;
const disarm = () => UNLOCK.forEach((ev) => window.removeEventListener(ev, onInteract));
function onInteract(e: Event) {
  // A click on the music controls is handled by those buttons, so the two don't cancel each other out.
  if ((e.target as Element | null)?.closest?.(".music-pill")) { disarm(); return; }
  if (isOff() || (state.playing && audio && !audio.paused)) { disarm(); return; }
  void play(state.track).then((ok) => { if (ok) disarm(); });
}
if (!isOff()) {
  window.setTimeout(() => {
    if (state.playing || isOff()) return;
    UNLOCK.forEach((ev) => window.addEventListener(ev, onInteract));
    void play(state.track).then((ok) => { if (ok) disarm(); });
  }, AUTOSTART_MS);
}

export const useMusic = () =>
  useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state);
