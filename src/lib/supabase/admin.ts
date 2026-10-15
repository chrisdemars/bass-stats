import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseServiceKey, supabaseUrl } from "@/lib/env";

/**
 * Service-role client for the ingest pipeline. Bypasses RLS, so it lives only
 * in scripts under src/scrapers/ and the protected ingest route.
 *
 * Deliberately NOT guarded with `import "server-only"`: this file is also
 * imported by scripts/ingest.ts, which runs under plain `tsx`/Node outside
 * Next's bundler. The real `server-only` package always throws when actually
 * executed (it exists purely for Next's bundler to alias away at build time),
 * so pairing it with a standalone CLI entry point breaks the CLI rather than
 * protecting anything. The other data-layer files under src/lib/data/ are
 * Next-exclusive and keep the guard; this one can't be.
 */
export function getAdminClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
