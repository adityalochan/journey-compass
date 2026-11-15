import { createClient } from "@supabase/supabase-js";

// Set VITE_SUPABASE_URL to use another Supabase project; without it, the hackathon project is used.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://oqnbyyjadykiravsbyml.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

if (!SUPABASE_ANON_KEY) {
  console.warn("VITE_SUPABASE_ANON_KEY is not set in .env");
}

// A6: never crash the page when the key is missing (fresh checkout, preview without env vars).
// createClient throws on an empty key, so use a placeholder; requests then fail softly until the key is set.
export const hasSupabaseKey = Boolean(SUPABASE_ANON_KEY);
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY || "missing-anon-key");
