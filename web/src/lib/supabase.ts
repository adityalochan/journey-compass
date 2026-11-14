// A1: the one Supabase client for the website.
// Reads the two public VITE_ variables (set in Vercel and in web/.env.local).
// Only the anon/publishable key belongs here — never the service_role/secret key.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * A6 fallback: null when the env vars are missing (fresh checkout, no keys yet),
 * so the site keeps running on the bundled demo data instead of breaking.
 */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
    : null;

export const hasSupabase = supabase !== null;
