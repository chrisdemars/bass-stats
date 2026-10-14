/**
 * Display formatting.
 *
 * Tournament weights are written pounds-ounces ("21-6"), not decimals, on every
 * scoreboard in the sport — so that is the default here, with the decimal kept
 * around for tooltips and sorting.
 */
import type { AnglerClass, EventStatus, ScoringFormat, SeriesLevel } from "./types";

export function weightLbsOz(lbs: number | null | undefined): string {
  if (lbs == null) return "—";
  const total = Math.round(lbs * 16);
  const whole = Math.floor(total / 16);
  const oz = total % 16;
  return `${whole}-${oz}`;
}

export function weightDecimal(lbs: number | null | undefined, unit = true): string {
  if (lbs == null) return "—";
  return `${lbs.toFixed(2)}${unit ? " lbs" : ""}`;
}

export function money(n: number | null | undefined, compact = false): string {
  if (n == null) return "—";
  if (compact && Math.abs(n) >= 1000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency", currency: "USD", notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(n);
}

export function count(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US").format(n);
}

const ORDINALS = new Intl.PluralRules("en-US", { type: "ordinal" });
const SUFFIX: Record<string, string> = {
  one: "st", two: "nd", few: "rd", other: "th",
};
export function ordinal(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n}${SUFFIX[ORDINALS.select(n)] ?? "th"}`;
}

const DATE = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", timeZone: "UTC",
});
const DATE_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
});

const asDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`);

export function dateRange(start?: string | null, end?: string | null): string {
  if (!start) return "TBA";
  const s = asDate(start);
  if (!end || end === start) return DATE_YEAR.format(s);
  const e = asDate(end);
  const sameMonth = s.getUTCMonth() === e.getUTCMonth() && s.getUTCFullYear() === e.getUTCFullYear();
  return sameMonth
    ? `${DATE.format(s)}–${e.getUTCDate()}, ${e.getUTCFullYear()}`
    : `${DATE.format(s)} – ${DATE_YEAR.format(e)}`;
}

export function shortDate(iso?: string | null): string {
  return iso ? DATE_YEAR.format(asDate(iso)) : "—";
}

export function timeAgo(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  const mins = Math.round((now - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return shortDate(iso);
}

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  scheduled: "Upcoming",
  in_progress: "Live",
  official: "Final",
  unofficial: "Unofficial",
  cancelled: "Cancelled",
  postponed: "Postponed",
};

export const LEVEL_LABEL: Record<SeriesLevel, string> = {
  professional: "Professional",
  semi_pro: "Qualifier",
  amateur: "Amateur",
  championship: "Championship",
  college: "College",
  high_school: "High School",
  team: "Team",
};

export const CLASS_LABEL: Record<AnglerClass, string> = {
  pro: "Pro",
  boater: "Boater",
  co_angler: "Co-angler",
  amateur: "Amateur",
  college: "College",
  high_school: "High School",
};

export const FORMAT_LABEL: Record<ScoringFormat, string> = {
  bag_limit_5: "5-fish limit",
  bag_limit_3: "3-fish limit",
  catch_weigh_release: "Catch, weigh, release",
  total_weight: "Total weight",
  points: "Points",
};

/** Stable per-slug hue so every event/angler gets consistent placeholder art. */
export function hueFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

export function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export function placeTone(place: number | null | undefined): "gold" | "water" | "none" {
  if (place == null) return "none";
  if (place === 1) return "gold";
  if (place <= 10) return "water";
  return "none";
}
