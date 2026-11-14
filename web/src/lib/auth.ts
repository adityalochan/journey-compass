import { supabase } from "./supabase";

const KEY = "jc-session";

export async function sendMagicLink(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      shouldCreateUser: true, // allow new users for testing; change to false after seeding
    },
  });
  if (error) throw error;
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
