import { supabase } from "./supabase";

export const DEMO_PASSWORD = "journey-demo-2026";

export async function sendMagicLink(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw error;
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error("That email and password don't match our records.");
}

export async function currentSession(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      return data.session.user.email || null;
    }
  } catch (err) {
    console.error("Session check failed:", err);
  }
  return null;
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}
