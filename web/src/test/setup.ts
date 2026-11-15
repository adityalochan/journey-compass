import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());

// Node 25+ ships its own localStorage/sessionStorage globals, which hide jsdom's (and are empty without
// --localstorage-file). Give tests a working in-memory Storage on any Node version.
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => { m.delete(k); },
    setItem: (k: string, v: string) => { m.set(k, String(v)); },
  };
}
for (const name of ["localStorage", "sessionStorage"] as const) {
  let ok = false;
  try { ok = typeof globalThis[name]?.clear === "function"; } catch { ok = false; }
  if (!ok) Object.defineProperty(globalThis, name, { value: memoryStorage(), configurable: true, writable: true });
}

// jsdom has no matchMedia; components that check the screen size or reduced motion need it.
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  }) as MediaQueryList;
}
