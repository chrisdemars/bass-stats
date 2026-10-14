import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

let cached: SupabaseClient | null = null;

/**
 * Anonymous read client for server components.
 *
 * Deliberately cookie-free: every table is public-read behind RLS, so these
 * queries carry no user state and stay safe to call inside `"use cache"`.
 */
export function getReadClient(): SupabaseClient {
  if (!cached) {
    cached = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "x-application-name": "bass-stats" } },
    });
  }
  return cached;
}
