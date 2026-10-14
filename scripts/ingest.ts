#!/usr/bin/env -S npx tsx
/**
 * CLI entry point for the ingest pipeline.
 *
 * Event results:
 *   npm run ingest -- --source=bassmaster --year=2026
 *   npm run ingest -- --source=mlf --year=2026 --dry-run
 *   npm run ingest -- --source=bassmaster --year=2026 --series=bassmaster-elite --limit=3
 *
 * Angler directory (profiles independent of any event — hometown, photo,
 * socials — only sources whose adapter implements `roster()`, currently
 * just Bassmaster):
 *   npm run ingest -- --source=bassmaster --roster --scope=elite
 *   npm run ingest -- --source=bassmaster --roster --scope=angler --state=TX
 *   npm run ingest -- --source=bassmaster --roster --scope=angler --limit=500
 *
 * `--scope` is the source's own directory scope — for Bassmaster, a
 * person-types taxonomy slug: "elite" (~100, the current Elite Series
 * field), "elite-qualifiers", or "angler" (everyone tagged as an angler,
 * 75,000+ rows going back to 1968 — pass --limit to bound a first run).
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the
 * environment (see .env.example) — this writes with the service role, so it
 * only ever runs server-side / from an operator's machine, never in the
 * browser.
 */
import { bassmasterAdapter } from "../src/scrapers/bassmaster";
import { mlfAdapter } from "../src/scrapers/mlf";
import { npflAdapter } from "../src/scrapers/npfl";
import { runIngest, runRosterSync } from "../src/scrapers/core/ingest";
import type { SourceAdapter } from "../src/scrapers/core/types";
import type { AnglerClass } from "../src/lib/types";

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

function usage(): never {
  console.error(
    [
      `Usage:`,
      `  npm run ingest -- --source=<${Object.keys(ADAPTERS).join("|")}> --year=YYYY [--series=slug] [--limit=N] [--dry-run] [--skip-existing]`,
      `  npm run ingest -- --source=<org> --roster [--scope=slug] [--state=XX] [--keyword=...] [--limit=N] [--class=pro|amateur|...]`,
    ].join("\n"),
  );
  process.exit(1);
}

async function runEvents(adapter: SourceAdapter, args: Record<string, string | boolean>) {
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

async function runRoster(adapter: SourceAdapter, args: Record<string, string | boolean>) {
  if (!adapter.roster) {
    console.error(`${adapter.label} has no angler directory to sync (see src/scrapers/data/README.md instead).`);
    process.exit(1);
  }

  const scope = typeof args.scope === "string" ? args.scope : undefined;
  console.log(`\n▶ ${adapter.label} roster — scope: ${scope ?? "(adapter default)"}\n`);

  const report = await runRosterSync(adapter, {
    scope,
    state: typeof args.state === "string" ? args.state : undefined,
    keyword: typeof args.keyword === "string" ? args.keyword : undefined,
    limit: args.limit ? Number(args.limit) : undefined,
    defaultClass: typeof args.class === "string" ? (args.class as AnglerClass) : undefined,
    log: (msg) => console.log(msg),
  });

  console.log("\n— summary —");
  console.log(`  profiles seen:    ${report.profilesSeen}`);
  console.log(`  anglers created:  ${report.anglersCreated}`);
  console.log(`  anglers updated:  ${report.anglersUpdated}`);
  if (report.errors.length) {
    console.log(`  errors:           ${report.errors.length}`);
    for (const e of report.errors.slice(0, 20)) console.log(`    - ${e.profile}: ${e.message}`);
    if (report.errors.length > 20) console.log(`    … and ${report.errors.length - 20} more`);
  }
  console.log();

  if (report.errors.length && report.anglersCreated + report.anglersUpdated === 0) process.exit(1);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const adapter = ADAPTERS[String(args.source ?? "")];
  if (!adapter) usage();

  if (args.roster) await runRoster(adapter, args);
  else await runEvents(adapter, args);
}

main().catch((error) => {
  console.error("Ingest failed:", error);
  process.exit(1);
});
