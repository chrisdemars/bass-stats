/**
 * Shared machinery for sources this project does not scrape.
 *
 * MLF sits entirely behind Cloudflare bot management — every path, including
 * the homepage, returns 403 to a non-browser client. That is an active
 * technical control, not just a crawling courtesy, and defeating it (solving
 * its JS challenge headlessly, spoofing a browser fingerprint, routing around
 * it with proxies) is bot-detection evasion. This project does not do that.
 *
 * NPFL's robots.txt is a flat `Disallow: /`. That is a direct request not to
 * be crawled, and `politeFetch` already refuses it without an explicit
 * override — which this adapter does not pass.
 *
 * Both adapters below read from a local directory instead of the network.
 * An operator who has a legitimate way to get the data — a personal browser
 * session, an official export, a data-sharing agreement with the
 * organization — drops files in that shape here and the same `npm run
 * ingest` pipeline picks them up. No network request to the source's own
 * infrastructure happens from this code at all.
 *
 * Directory shape, under `src/scrapers/data/<org>/<year>/`:
 *   events.json         — SourceEvent[], with `cursor.resultsFile` pointing
 *                          at the results file for that event (optional; the
 *                          id is used as the filename when omitted)
 *   results/<id>.json    — SourceResult[] for the event with that externalId
 *
 * See src/scrapers/data/README.md for the exact shapes and a worked example.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SourceEvent, SourceResult } from "./types";

export function manualImportDir(org: string, year: number): string {
  return join(process.cwd(), "src", "scrapers", "data", org, String(year));
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    const text = await readFile(path, "utf8");
    return JSON.parse(text) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return null;
    throw new Error(`Malformed JSON at ${path}: ${(error as Error).message}`);
  }
}

export async function loadManualEvents(org: string, year: number): Promise<SourceEvent[]> {
  const events = await readJson<SourceEvent[]>(join(manualImportDir(org, year), "events.json"));
  if (!events) {
    console.warn(
      `[manual-import] No ${org} data for ${year} at ${manualImportDir(org, year)}/events.json — ` +
        `see src/scrapers/data/README.md to add it.`,
    );
    return [];
  }
  return events;
}

export async function loadManualResults(
  org: string,
  event: SourceEvent,
): Promise<SourceResult[]> {
  const year = Number(event.year);
  const filename = (event.cursor?.resultsFile as string | undefined) ?? `${event.externalId}.json`;
  const path = join(manualImportDir(org, year), "results", filename);
  const results = await readJson<SourceResult[]>(path);
  if (!results) {
    console.warn(`[manual-import] No results file for ${event.name} at ${path}`);
    return [];
  }
  return results;
}

/** Lists the years an operator has actually dropped data in for, for `discover()`. */
export async function manualYearsAvailable(org: string): Promise<number[]> {
  try {
    const base = join(process.cwd(), "src", "scrapers", "data", org);
    const entries = await readdir(base, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && /^\d{4}$/.test(e.name))
      .map((e) => Number(e.name))
      .sort((a, b) => b - a);
  } catch {
    return [];
  }
}
