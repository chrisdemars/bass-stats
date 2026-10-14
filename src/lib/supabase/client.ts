"use client";
import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

/** Browser client — used for live leaderboard subscriptions. */
export function createClientSideClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
