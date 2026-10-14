import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { bassmasterAdapter } from "@/scrapers/bassmaster";
import { mlfAdapter } from "@/scrapers/mlf";
import { npflAdapter } from "@/scrapers/npfl";
import { runIngest } from "@/scrapers/core/ingest";
import { tags } from "@/lib/data";
import { canWriteToSupabase } from "@/lib/env";
import type { SourceAdapter } from "@/scrapers/core/types";

export const maxDuration = 300;

const ADAPTERS: Record<string, SourceAdapter> = {
  bassmaster: bassmasterAdapter,
  mlf: mlfAdapter,
  npfl: npflAdapter,
};

/**
 * Triggers a scrape and writes straight to Supabase with the service role.
 *
 * Guarded by a bearer token (`INGEST_SECRET`) rather than a session, so a
 * scheduler (Vercel Cron, GitHub Actions, a manual curl from an operator) can
 * call it without a browser. Returns 503 rather than running half-configured
 * when Supabase credentials are missing — there is nothing to write to.
 */
export async function POST(request: Request) {
  const secret = process.env.INGEST_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "INGEST_SECRET is not configured; refusing to run an unguarded ingest endpoint." },
      { status: 503 },
    );
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canWriteToSupabase) {
    return NextResponse.json(
      { error: "Supabase write credentials are not configured. Set SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const sourceKey = String(body.source ?? "");
  const adapter = ADAPTERS[sourceKey];
  if (!adapter) {
    return NextResponse.json(
      { error: `Unknown source "${sourceKey}". Expected one of: ${Object.keys(ADAPTERS).join(", ")}.` },
      { status: 400 },
    );
  }

  const year = Number(body.year ?? new Date().getUTCFullYear());
  const messages: string[] = [];

  const report = await runIngest(adapter, {
    year,
    seriesSlug: typeof body.series === "string" ? body.series : undefined,
    limit: typeof body.limit === "number" ? body.limit : undefined,
    skipExisting: Boolean(body.skipExisting),
    log: (msg) => messages.push(msg),
  });

  // Only invalidate what this run actually touched, not the whole cache.
  // `{ expire: 0 }` means the next request blocks for fresh data instead of
  // serving stale content — a freshly-ingested result should show up
  // immediately, not after next.config's "minutes" stale window lapses.
  const now = { expire: 0 };
  revalidateTag(tags.events, now);
  revalidateTag(tags.anglers, now);
  revalidateTag(tags.articles, now);
  if (report.eventsWritten > 0) revalidateTag(tags.catalog, now);

  return NextResponse.json({ report, log: messages });
}
