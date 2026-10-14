#!/usr/bin/env -S npx tsx
/**
 * CLI entry point for the ingest pipeline.
 *
 * Usage:
 *   npm run ingest -- --source=bassmaster --year=2026
 *   npm run ingest -- --source=mlf --year=2026 --dry-run
 *   npm run ingest -- --source=bassmaster --year=2026 --series=bassmaster-elite --limit=3
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the
 * environment (see .env.example) — this writes with the service role, so it
 * only ever runs server-side / from an operator's machine, never in the
 * browser.
 */
import { bassmasterAdapter } from "../src/scrapers/bassmaster";
import { mlfAdapter } from "../src/scrapers/mlf";
import { npflAdapter } from "../src/scrapers/npfl";
import { runIngest } from "../src/scrapers/core/ingest";
import type { SourceAdapter } from "../src/scrapers/core/types";

const ADAPTERS: Record<string, SourceAdapter> = {
  bassmaster: bassmasterAdapter,
  mlf: mlfAdapter,
  npfl: npflAdapter,
};

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const arg of argv) {
    const m = /^--([a-z-]+)(?:=(.*))?$/.exec(arg);
    if (m) out[m[1]] = m[2] ?? true;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceKey = String(args.source ?? "");
  const adapter = ADAPTERS[sourceKey];

  if (!adapter) {
    console.error(
      `Usage: npm run ingest -- --source=<${Object.keys(ADAPTERS).join("|")}> --year=YYYY [--series=slug] [--limit=N] [--dry-run] [--skip-existing]`,
    );
    process.exit(1);
  }

  const year = Number(args.year ?? new Date().getUTCFullYear());
  const dryRun = Boolean(args["dry-run"]);
  const skipExisting = Boolean(args["skip-existing"]);

  console.log(`\n▶ ${adapter.label} — ${year}${dryRun ? " (dry run)" : ""}\n`);

  const report = await runIngest(adapter, {
    year,
    seriesSlug: typeof args.series === "string" ? args.series : undefined,
    limit: args.limit ? Number(args.limit) : undefined,
    dryRun,
    skipExisting,
    log: (msg) => console.log(msg),
  });

  console.log("\n— summary —");
  console.log(`  events seen:      ${report.eventsSeen}`);
  console.log(`  events written:   ${report.eventsWritten}`);
  console.log(`  results written:  ${report.resultsWritten}`);
  console.log(`  anglers created:  ${report.anglersCreated}`);
  console.log(`  skipped:          ${report.skipped}`);
  if (report.errors.length) {
    console.log(`  errors:           ${report.errors.length}`);
    for (const e of report.errors) console.log(`    - ${e.event}: ${e.message}`);
  }
  console.log();

  if (report.errors.length && report.eventsWritten === 0) process.exit(1);
}

main().catch((error) => {
  console.error("Ingest failed:", error);
  process.exit(1);
});
