/**
 * Parsing helpers shared by every adapter.
 *
 * Sources publish weights four different ways — decimal pounds, total ounces,
 * "27-4", and "27 lbs 4 oz" — and the whole site depends on them all landing
 * in the same decimal-pound column.
 */

/** "27-4" → 27.25 (27 lb 4 oz). */
export function parseLbsOz(input: string): number | null {
  const m = /^\s*(-?\d+)\s*-\s*(\d{1,2})\s*$/.exec(input);
  if (!m) return null;
  const lbs = Number(m[1]);
  const oz = Number(m[2]);
  if (!Number.isFinite(lbs) || !Number.isFinite(oz) || oz > 15) return null;
  const sign = lbs < 0 ? -1 : 1;
  return Number((Math.abs(lbs) + oz / 16).toFixed(4)) * sign;
}

export function ouncesToPounds(oz: number | null | undefined): number | null {
  if (oz == null || !Number.isFinite(oz)) return null;
  return Number((oz / 16).toFixed(4));
}

/**
 * Best-effort weight parse across every format seen in the wild.
 * Returns decimal pounds, or null when the cell holds no weight at all.
 */
export function parseWeight(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;

  const text = String(raw).trim();
  if (!text || /^(—|-|n\/?a|dq|dnf)$/i.test(text)) return null;

  const dash = parseLbsOz(text);
  if (dash != null) return dash;

  // "27 lbs 4 oz" / "27 lb" / "4 oz"
  const lbsOz = /(?:(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?))?[\s,]*(?:(\d+(?:\.\d+)?)\s*(?:oz|ounces?))?/i.exec(text);
  if (lbsOz && (lbsOz[1] || lbsOz[2])) {
    const lbs = Number(lbsOz[1] ?? 0);
    const oz = Number(lbsOz[2] ?? 0);
    if (Number.isFinite(lbs) && Number.isFinite(oz) && (lbs || oz)) {
      return Number((lbs + oz / 16).toFixed(4));
    }
  }

  const plain = Number(text.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(plain) ? plain : null;
}

/** "$100,000" → 100000. */
export function parseMoney(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  // Stripping non-numeric characters from text that has no number at all
  // (e.g. "DQ", "—", "TBD") leaves an empty string, and `Number("")` is 0 in
  // JavaScript — not NaN. Left unguarded, that turns "not a dollar amount"
  // into a fabricated "$0", the same silent-zero failure mode fixed
  // elsewhere in this project's standings math. Require at least one digit
  // before attempting the conversion.
  const stripped = String(raw).replace(/[^0-9.-]/g, "");
  if (!/\d/.test(stripped)) return null;
  const n = Number(stripped);
  return Number.isFinite(n) ? n : null;
}

export function parseInt10(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? Math.trunc(raw) : null;
  const n = parseInt(String(raw).replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

const SUFFIXES = new Set(["jr", "jr.", "sr", "sr.", "ii", "iii", "iv", "v"]);

/**
 * "Hank Cherry Jr" → { firstName: "Hank", lastName: "Cherry Jr" }
 * "Cherry, Hank"   → { firstName: "Hank", lastName: "Cherry" }
 */
export function splitName(full: string): { firstName: string; lastName: string } {
  const clean = full.replace(/\s+/g, " ").trim();
  if (!clean) return { firstName: "", lastName: "" };

  if (clean.includes(",")) {
    const [last, first = ""] = clean.split(",").map((s) => s.trim());
    return { firstName: first, lastName: last };
  }

  const parts = clean.split(" ");
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };

  // Keep a generational suffix attached to the surname.
  let lastIndex = parts.length - 1;
  if (SUFFIXES.has(parts[lastIndex].toLowerCase()) && parts.length > 2) lastIndex -= 1;

  return {
    firstName: parts.slice(0, lastIndex).join(" "),
    lastName: parts.slice(lastIndex).join(" "),
  };
}

/** "Scottsboro, AL" → { city, state } */
export function splitHometown(raw: string | null | undefined): {
  city: string | null;
  state: string | null;
} {
  if (!raw) return { city: null, state: null };
  const [city, state] = raw.split(",").map((s) => s.trim());
  return { city: city || null, state: (state || null)?.toUpperCase().slice(0, 2) ?? null };
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * "20260208" or "2026-02-08T23:59:59-06:00" → "2026-02-08".
 *
 * Takes the calendar date as written rather than converting to UTC: feeds
 * publish local end-of-day timestamps, and `toISOString()` on
 * "2026-08-30T23:59:59-04:00" rolls forward to the 31st, inventing a
 * competition day that never happened.
 */
export function toIsoDate(raw: unknown): string | null {
  if (!raw) return null;
  const text = String(raw).trim();

  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(text);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;

  const literal = /^(\d{4}-\d{2}-\d{2})(?:[T ]|$)/.exec(text);
  if (literal) return literal[1];

  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** "2026-02-08" → "20260208", the compact form several feeds expect. */
export function toCompactDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, "");
}

/** Every date from start to end, inclusive. */
export function dateSpan(start: string, end: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${start.slice(0, 10)}T12:00:00Z`);
  const stop = new Date(`${end.slice(0, 10)}T12:00:00Z`);
  while (cur <= stop && out.length < 14) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}
