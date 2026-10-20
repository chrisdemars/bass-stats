/**
 * Turns a leaderboard table an operator copy-pasted out of their own browser
 * into SourceResult rows.
 *
 * Why this exists: MLF's site sits behind Cloudflare bot management, and
 * this project does not try to defeat that (see src/scrapers/mlf.ts). A
 * human looking at the real page in a real browser has already gotten past
 * it the ordinary way — by being a human — so the cheapest legitimate path
 * to real MLF data is letting that human copy the table they're already
 * looking at and paste it somewhere this project can read. That "somewhere"
 * is scripts/paste-import.ts, and this file is the parser underneath it.
 *
 * Browsers hand a copied HTML <table> to the clipboard as tab-separated
 * values — selecting a table and pasting into a text file reliably produces
 * one line per row, cells separated by tabs. That is the primary format this
 * parser targets; comma- and multi-space-separated input are accepted as a
 * fallback for leaderboards copied some other way (a PDF, a screenshot run
 * through OCR, a hand-typed list).
 */
import { parseInt10, parseMoney, parseWeight, splitHometown, splitName } from "./parse";
import type { AnglerClass, ResultStatus } from "@/lib/types";
import type { SourceResult } from "./types";

export interface ParsedRow extends SourceResult {
  /** The raw line this row came from, kept for the confirmation preview. */
  raw: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  /** Lines that looked like they belonged but couldn't be read as a result. */
  warnings: string[];
  /** Which column meant what, so a preview can show the operator its guess. */
  columns: ColumnRole[];
}

export type ColumnRole =
  | "place" | "name" | "hometown" | "weight" | "fish" | "bigBass"
  | "points" | "payout" | "status" | "ignore";

const HEADER_HINTS: Record<ColumnRole, RegExp> = {
  place: /^(place|rank|pos\.?|#)$/i,
  name: /^(angler|name|competitor|pro|boater)$/i,
  hometown: /^(hometown|from|location|city)$/i,
  weight: /^(weight|wt\.?|total|lbs?\.?)$/i,
  fish: /^(fish|catches?|#\s*fish)$/i,
  bigBass: /^(big\s*bass|big\s*fish|bb)$/i,
  points: /^(points|pts\.?)$/i,
  payout: /^(payout|winnings|earnings|prize|\$)$/i,
  status: /^(status)$/i,
  ignore: /^$/,
};

/** Splits one line into cells, preferring tabs (how a browser copies a table). */
function splitCells(line: string): string[] {
  if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
  if (line.includes(",") && !/\d,\d{3}/.test(line)) {
    // A comma that isn't thousands-grouping inside a number — treat as CSV.
    return line.split(",").map((c) => c.trim());
  }
  // Multi-space-separated: collapse runs of 2+ spaces into one delimiter,
  // but leave single spaces alone so "Hank Cherry Jr" stays one cell.
  return line.split(/ {2,}|\t/).map((c) => c.trim()).filter(Boolean);
}

/** Guesses what each column holds, from a header row if there is one. */
function detectColumns(headerCells: string[]): ColumnRole[] | null {
  const roles = headerCells.map((cell): ColumnRole | null => {
    for (const [role, pattern] of Object.entries(HEADER_HINTS) as [ColumnRole, RegExp][]) {
      if (role !== "ignore" && pattern.test(cell)) return role;
    }
    return null;
  });
  // A real header names at least place/rank and a name column; anything
  // less and this is probably already a data row, not a header.
  if (roles.includes("place") && roles.includes("name")) {
    return roles.map((r) => r ?? "ignore");
  }
  return null;
}

/**
 * Positional fallback when no header row was found: the near-universal
 * leaderboard shape is place, name, weight, [fish, [big bass, [payout]]].
 */
function positionalColumns(cellCount: number): ColumnRole[] {
  const order: ColumnRole[] = ["place", "name", "weight", "fish", "bigBass", "payout"];
  return Array.from({ length: cellCount }, (_, i) => order[i] ?? "ignore");
}

const STATUS_WORDS: Record<string, ResultStatus> = {
  dq: "dq", disqualified: "dq",
  dnf: "did_not_fish", "did not fish": "did_not_fish",
  wd: "withdrew", withdrew: "withdrew", withdrawn: "withdrew",
};

function parseStatusWord(cell: string): ResultStatus | null {
  return STATUS_WORDS[cell.trim().toLowerCase()] ?? null;
}

export function parseLeaderboardPaste(
  raw: string,
  options: { defaultClass?: AnglerClass } = {},
): ParseResult {
  const lines = raw
    .split("\n")
    .map((l) => l.replace(/\r$/, ""))
    .filter((l) => l.trim().length > 0);

  const warnings: string[] = [];
  if (!lines.length) return { rows: [], warnings: ["No non-empty lines to parse."], columns: [] };

  const firstCells = splitCells(lines[0]);
  const headerColumns = detectColumns(firstCells);
  const columns = headerColumns ?? positionalColumns(firstCells.length);
  const dataLines = headerColumns ? lines.slice(1) : lines;

  const rows: ParsedRow[] = [];

  for (const line of dataLines) {
    const cells = splitCells(line);
    if (cells.length < 2) {
      warnings.push(`Skipped (too few columns): "${line}"`);
      continue;
    }

    const byRole = new Map<ColumnRole, string>();
    cells.forEach((cell, i) => {
      const role = columns[i] ?? "ignore";
      if (role !== "ignore" && cell) byRole.set(role, cell);
    });

    const nameCell = byRole.get("name");
    if (!nameCell) {
      warnings.push(`Skipped (no name column matched): "${line}"`);
      continue;
    }
    const { firstName, lastName } = splitName(nameCell);
    if (!firstName && !lastName) {
      warnings.push(`Skipped (couldn't read a name): "${line}"`);
      continue;
    }

    const place = parseInt10(byRole.get("place"));
    // A status word ("DQ", "DNF", "Withdrew") can land in any column — the
    // weight cell, the payout cell, a dedicated status cell — depending on
    // how the source table is laid out. Scanning every cell, not just one
    // assumed column, is what catches it; checking only the "weight" column
    // missed a real DQ sitting in the "payout" column in testing.
    const statusWord = [...byRole.values()]
      .map(parseStatusWord)
      .find((s): s is ResultStatus => s !== null) ?? null;
    const { city, state } = splitHometown(byRole.get("hometown"));

    rows.push({
      raw: line,
      firstName,
      lastName,
      hometownCity: city,
      hometownState: state,
      place,
      status: statusWord ?? "official",
      anglerClass: options.defaultClass ?? "pro",
      totalWeight: statusWord ? null : parseWeight(byRole.get("weight")),
      totalFish: parseInt10(byRole.get("fish")),
      bigBass: parseWeight(byRole.get("bigBass")),
      points: parseInt10(byRole.get("points")),
      payoutUsd: parseMoney(byRole.get("payout")),
    });
  }

  // A pasted table is usually already in finish order; fill in place when the
  // operator's source didn't have its own place/rank column.
  if (rows.length && rows.every((r) => r.place == null)) {
    rows.forEach((r, i) => { r.place = i + 1; });
  }

  return { rows, warnings, columns };
}
