// Demo-only auth: any participant email + the shared demo password. No real accounts or server.
import { participants } from "./data";

export const DEMO_PASSWORD = "aol2026";
const KEY = "jc-session";

export function login(email: string, password: string): string {
  const p = participants.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
  if (!p || password !== DEMO_PASSWORD) throw new Error("That email and password don't match our records.");
  try { localStorage.setItem(KEY, p.id); } catch { /* storage blocked: session lasts until reload */ }
  return p.id;
}

export function currentSession(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function logout() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
