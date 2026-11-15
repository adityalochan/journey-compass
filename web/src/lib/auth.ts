import { hasSupabaseKey, supabase } from "./supabase";

export async function sendMagicLink(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      shouldCreateUser: false,
      emailRedirectTo: window.location.pathname.startsWith("/coordinator")
        ? `${window.location.origin}/coordinator`
        : `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw error;
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  if (!hasSupabaseKey) throw new Error("Login isn't set up on this copy of the site: VITE_SUPABASE_ANON_KEY is missing.");
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (!error) return;
  // Wrong email/password gets a friendly message; anything else (bad key, network) shows the real reason.
  if (/invalid login credentials/i.test(error.message)) throw new Error("That email and password don't match our records.");
  throw new Error(`Couldn't sign in: ${error.message}`);
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
