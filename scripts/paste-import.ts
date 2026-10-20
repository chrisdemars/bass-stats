#!/usr/bin/env -S npx tsx
/**
 * Interactive importer for sources this project does not scrape (MLF, NPFL
 * — see src/scrapers/mlf.ts and src/scrapers/npfl.ts for why).
 *
 * Walks an operator through one event: a few questions for the event's own
 * metadata, then a single paste of the leaderboard table copied straight out
 * of their own browser. Writes both into
 * src/scrapers/data/<source>/<year>/{events.json,results/<id>.json} in the
 * exact shape the manual-import adapters already read — the same `npm run
 * ingest` pipeline picks it up from there, no different from a live-scraped
 * source.
 *
 * Usage:
 *   npm run paste-import -- --source=mlf
 *   npm run paste-import -- --source=npfl
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { mlfAdapter } from "../src/scrapers/mlf";
import { npflAdapter } from "../src/scrapers/npfl";
import { parseLeaderboardPaste, type ParsedRow } from "../src/scrapers/core/paste-parse";
import { slugify } from "../src/scrapers/core/parse";
import type { SourceAdapter, SourceEvent } from "../src/scrapers/core/types";
import type { AnglerClass, EventStatus } from "../src/lib/types";

const ADAPTERS: Record<string, SourceAdapter> = { mlf: mlfAdapter, npfl: npflAdapter };

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const arg of argv) {
    const m = /^--([a-z-]+)(?:=(.*))?$/.exec(arg);
    if (m) out[m[1]] = m[2] ?? "true";
  }
  return out;
}

const rl = createInterface({ input: process.stdin, output: process.stdout });

/**
 * A single shared iterator over stdin, rather than one `rl.question()` call
 * per prompt. `question()` attaches a fresh one-time 'line' listener on each
 * call, and firing several in quick succession against piped (non-TTY)
 * input — a line already buffered, no human typing latency between them —
 * can race: a line arrives before the next call's listener is attached and
 * silently vanishes. A single continuous consumer has nothing to race
 * against. This also means a saved transcript can be replayed with
 * `npm run paste-import < transcript.txt`, which is worth supporting
 * properly, not just tolerating.
 */
const stdinLines = rl[Symbol.asyncIterator]();
async function nextLine(): Promise<string> {
  const { value, done } = await stdinLines.next();
  if (done) throw new Error("Input ended before the import finished.");
  return value;
}
function ask(prompt: string): Promise<string> {
  if (prompt) process.stdout.write(prompt);
  return nextLine();
}

async function askChoice<T extends string>(label: string, options: T[]): Promise<T> {
  console.log(`\n${label}`);
  options.forEach((o, i) => console.log(`  ${i + 1}. ${o}`));
  for (;;) {
    const answer = (await ask(`#> `)).trim();
    const idx = Number(answer) - 1;
    if (idx >= 0 && idx < options.length) return options[idx];
    console.log(`Enter a number from 1 to ${options.length}.`);
  }
}

async function askPaste(label: string): Promise<string> {
  console.log(`\n${label}`);
  console.log(`(Paste the table, then type END on its own line and press enter.)`);
  const lines: string[] = [];
  for (;;) {
    const line = await ask("");
    if (line.trim() === "END") break;
    lines.push(line);
  }
  return lines.join("\n");
}

function dataDir(org: string, year: number): string {
  return join(process.cwd(), "src", "scrapers", "data", org, String(year));
}

function loadJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const adapter = ADAPTERS[args.source];
  if (!adapter) {
    console.error(`Usage: npm run paste-import -- --source=<${Object.keys(ADAPTERS).join("|")}>`);
    process.exit(1);
  }

  console.log(`\n▶ Paste import — ${adapter.label}\n`);
  console.log(
    "This only ever reads what you paste in — it never contacts the source's\n" +
    "own site. See src/scrapers/data/README.md for the full workflow.",
  );

  const series = await adapter.series();
  const seriesChoice = await askChoice(
    "Which series is this event part of?",
    series.map((s) => s.slug),
  );
  const seriesDef = series.find((s) => s.slug === seriesChoice)!;

  const year = Number((await ask(`\nSeason year [e.g. 2026]: `)).trim());
  if (!Number.isFinite(year)) {
    console.error("That doesn't look like a year.");
    process.exit(1);
  }

  const name = (await ask(`\nEvent name [e.g. "2026 Bass Pro Tour at Lake Guntersville"]: `)).trim();
  const waterBody = (await ask(`Water body [e.g. "Lake Guntersville"]: `)).trim();
  const city = (await ask(`City: `)).trim();
  const state = (await ask(`State (2-letter): `)).trim().toUpperCase().slice(0, 2);
  const startDate = (await ask(`Start date [YYYY-MM-DD]: `)).trim();
  const endDate = (await ask(`End date [YYYY-MM-DD, blank = same as start]: `)).trim() || startDate;
  const sourceUrl = (await ask(`Source URL (the page you copied this from, optional): `)).trim();

  const status = await askChoice<EventStatus>(
    "Event status:",
    ["official", "in_progress", "scheduled"],
  );

  const defaultClass = await askChoice<AnglerClass>(
    "Angler class for this field:",
    ["pro", "boater", "co_angler", "amateur", "college", "high_school"],
  );

  const raw = await askPaste(
    `Paste the leaderboard now (place, name, weight, fish, big bass, payout — in\n` +
    `whatever columns the source has; a header row like "Place  Angler  Weight" is read\n` +
    `automatically if present, otherwise columns are assumed in that order).`,
  );

  const { rows, warnings, columns } = parseLeaderboardPaste(raw, { defaultClass });

  console.log(`\nParsed ${rows.length} row(s) as columns: ${columns.join(", ")}`);
  if (warnings.length) {
    console.log(`\n${warnings.length} line(s) couldn't be read:`);
    for (const w of warnings) console.log(`  - ${w}`);
  }
  console.log("\nPreview (first 10):");
  for (const r of rows.slice(0, 10)) {
    console.log(
      `  ${String(r.place ?? "—").padStart(3)}  ${(r.firstName + " " + r.lastName).padEnd(24)}` +
        ` wt=${r.totalWeight ?? "—"}  fish=${r.totalFish ?? "—"}  status=${r.status}`,
    );
  }

  if (!rows.length) {
    console.log("\nNothing parsed — nothing written. Check the paste format and try again.");
    rl.close();
    return;
  }

  const confirm = (await ask(`\nWrite ${rows.length} row(s) to disk? [y/N] `)).trim().toLowerCase();
  if (confirm !== "y" && confirm !== "yes") {
    console.log("Discarded — nothing written.");
    rl.close();
    return;
  }

  const externalId = slugify(`${year}-${name}-${waterBody}`);
  const event: SourceEvent = {
    externalId,
    seriesSlug: seriesChoice,
    year,
    name,
    waterBody: waterBody || null,
    city: city || null,
    state: state || null,
    country: "USA",
    startDate: startDate || null,
    endDate: endDate || null,
    status,
    format: seriesDef.format,
    sourceUrl: sourceUrl || null,
  };

  const eventsPath = join(dataDir(args.source, year), "events.json");
  const events = loadJson<SourceEvent[]>(eventsPath, []);
  const existingIdx = events.findIndex((e) => e.externalId === externalId);
  if (existingIdx >= 0) events[existingIdx] = event;
  else events.push(event);
  writeJson(eventsPath, events);

  const resultsPath = join(dataDir(args.source, year), "results", `${externalId}.json`);
  const clean = rows.map((r: ParsedRow) => {
    const { raw, ...rest } = r;
    void raw; // kept on ParsedRow only for the preview above, not for disk
    return rest;
  });
  writeJson(resultsPath, clean);

  console.log(`\nWrote:`);
  console.log(`  ${eventsPath}`);
  console.log(`  ${resultsPath}`);
  console.log(`\nRun it in with: npm run ingest -- --source=${args.source} --year=${year}`);

  rl.close();
}

main().catch((error) => {
  console.error("Paste import failed:", error);
  process.exit(1);
});
