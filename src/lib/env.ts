/**
 * Environment plumbing.
 *
 * The app runs with or without Supabase. With no credentials it serves the
 * bundled sample dataset so `npm run dev` works on a fresh clone; set the
 * Supabase vars and every read switches to the database.
 */
export const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";

export const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "";

/** Server-only. Bypasses RLS — never import this into a client component. */
export const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const canWriteToSupabase = Boolean(supabaseUrl && supabaseServiceKey);

/** Shown in the UI so nobody mistakes the sample data for real results. */
export const dataSourceLabel = isSupabaseConfigured ? "supabase" : "sample";
