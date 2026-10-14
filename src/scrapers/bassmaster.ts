/**
 * B.A.S.S. / Bassmaster adapter.
 *
 * Bassmaster runs on WordPress and exposes a public JSON API. Two endpoints
 * carry everything this project needs — both verified against the live site:
 *
 *   GET /wp-json/wp/v2/tournament?parent=0&per_page=100&page=N
 *       Every tournament post. `meta.bassmaster_tournament_scoring_system_id`
 *       is the id the scoring backend knows the event by ("tms"), which is NOT
 *       the WordPress post id.
 *
 *   GET /wp-json/data/v1/tournament/basstrakk/leaderboard
 *         ?tournament_id={tms}&daydate=YYYYMMDD
 *       The cumulative board as of that day: Rank, angler, that day's bag in
 *       ounces (BTLimitOunces) and the running total (SumOunces).
 *
 *   GET /wp-json/bassmaster/v1/persons
 *         ?series={taxonomy-slug}&state=XX&keyword=...&num_per_page=N&page_num=N
 *       Bassmaster's own angler directory — a WordPress "person" post per
 *       angler, filterable by its person-types taxonomy. `series=elite`
 *       returns the current Elite Series roster (~100); `series=angler`
 *       returns the full historical roster (75k+, going back to 1968).
 *       Carries hometown, a working photo URL and socials — real profile
 *       data, independent of any tournament result. See `roster()` below.
 *
 * Caveats worth knowing:
 *
 *   - This is the BassTrakk live-scoring feed, the same data the broadcast
 *     uses, not the certified results sheet. It can differ from the official
 *     record by a penalty or a late correction. Re-running the scrape after an
 *     event is made official picks up the corrected numbers, because every row
 *     upserts on its natural key.
 *   - `BTLimitOunces` (the day's scored limit) does not always sum exactly to
 *     `SumOunces` (the running total). Both are stored as published — day
 *     weights from the former, the event total from the latter — rather than
 *     reconciled with arithmetic this project would be inventing.
 *
 * robots.txt (checked 2026-10-13): `User-agent: * / Disallow:` — crawling is
 * permitted, with no crawl-delay declared. This adapter still self-limits.
 */
import type {
  RosterFilter, SourceAdapter, SourceAnglerProfile, SourceEvent, SourceResult,
  SourceResultDay, SourceSeries,
} from "./core/types";
import { fetchJson, fetchJsonWithMeta } from "./core/http";
import {
  dateSpan, ouncesToPounds, parseInt10, splitName, toCompactDate, toIsoDate,
} from "./core/parse";
import type { ScoringFormat, SeriesLevel } from "@/lib/types";

const BASE = "https://www.bassmaster.com/wp-json";
const DELAY_MS = 1200;

/** Taxonomy slug → how this project classifies the series. */
const SERIES_MAP: Record<
  string,
  { name: string; shortName: string; level: SeriesLevel; format: ScoringFormat; description: string }
> = {
  elite: {
    name: "Bassmaster Elite Series", shortName: "Elite Series",
    level: "professional", format: "bag_limit_5",
    description: "The top rung at B.A.S.S. — the sport's leading boaters chasing Angler of the Year and a Classic berth.",
  },
  opens: {
    name: "Bassmaster Open Series", shortName: "Opens",
    level: "semi_pro", format: "bag_limit_5",
    description: "The qualifying path to the Elite Series, fished across regional divisions.",
  },
  eqs: {
    name: "Bassmaster Elite Qualifiers", shortName: "Elite Qualifiers",
    level: "semi_pro", format: "bag_limit_5",
    description: "Qualifying events feeding the Elite Series field.",
  },
  classic: {
    name: "Bassmaster Classic", shortName: "Classic",
    level: "championship", format: "bag_limit_5",
    description: "The world championship of bass fishing.",
  },
  nation: {
    name: "B.A.S.S. Nation", shortName: "Nation",
    level: "amateur", format: "bag_limit_5",
    description: "The grassroots club circuit feeding regional championships.",
  },
  college: {
    name: "Bassmaster College Series", shortName: "College",
    level: "college", format: "bag_limit_5",
    description: "Two-angler university teams fishing for a national title.",
  },
  "high-school": {
    name: "Bassmaster High School Series", shortName: "High School",
    level: "high_school", format: "bag_limit_5",
    description: "Two-angler high school teams with a boat captain.",
  },
  junior: {
    name: "Bassmaster Junior Series", shortName: "Junior",
    level: "high_school", format: "bag_limit_3",
    description: "The junior circuit for anglers below high school age.",
  },
  team: {
    name: "Bassmaster Team Championship", shortName: "Team",
    level: "team", format: "bag_limit_5",
    description: "Two-angler teams from qualifying trails nationwide.",
  },
  kayak: {
    name: "Bassmaster Kayak Series", shortName: "Kayak",
    level: "amateur", format: "total_weight",
    description: "Catch-photo-release kayak competition scored on total length.",
  },
  "pro-am": {
    name: "Bassmaster Pro-Am", shortName: "Pro-Am",
    level: "semi_pro", format: "bag_limit_5",
    description: "Paired pro and amateur competition.",
  },
};

interface TournamentPost {
  id: number;
  link: string;
  title: { rendered: string };
  "tournament-series": number[];
  meta: {
    bassmaster_tournament_scoring_system_id?: number | string;
    bassmaster_tournament_body_of_water?: string;
    bassmaster_tournament_city?: string;
    bassmaster_tournament_state?: string;
    bassmaster_tournament_start_date?: string;
    bassmaster_tournament_end_date?: string;
    bassmaster_tournament_short_name?: string;
  };
}

interface SeriesTerm {
  id: number;
  slug: string;
  name: string;
}

/** One row of the BassTrakk cumulative board. */
interface BoardRow {
  Rank: number | null;
  FISHERMAN_PHONENAME: string | null;
  FISHERMENID: number | null;
  /** That day's bag, in ounces. */
  BTLimitOunces: number | null;
  BTFishCount: number | null;
  /** Running total for the event, in ounces. */
  SumOunces: number | null;
  SumFishCount: number | null;
}

let termCache: Map<number, SeriesTerm> | null = null;

async function seriesTerms(): Promise<Map<number, SeriesTerm>> {
  if (termCache) return termCache;
  const terms = await fetchJson<SeriesTerm[]>(
    `${BASE}/wp/v2/tournament-series?per_page=100`,
    { minDelayMs: DELAY_MS },
  );
  termCache = new Map(terms.map((t) => [t.id, t]));
  return termCache;
}

export const bassmasterAdapter: SourceAdapter = {
  org: "bassmaster",
  label: "Bassmaster (B.A.S.S.)",

  async series() {
    const terms = await seriesTerms();
    const out: SourceSeries[] = [];
    for (const term of terms.values()) {
      const mapped = SERIES_MAP[term.slug];
      if (!mapped) continue; // e.g. the Redfish Cup, which is not bass fishing
      out.push({ slug: `bassmaster-${term.slug}`, ...mapped });
    }
    return out;
  },

  async discover(year) {
    const terms = await seriesTerms();
    const events: SourceEvent[] = [];

    // The API has no year filter on this post type, so page through the whole
    // archive and filter locally. Paging past the end is a 400, so the page
    // count comes from the header on the first response.
    let totalPages = 1;
    for (let page = 1; page <= totalPages; page++) {
      const { data: batch, headers } = await fetchJsonWithMeta<TournamentPost[]>(
        `${BASE}/wp/v2/tournament?parent=0&per_page=100&page=${page}` +
          `&_fields=id,link,title,meta,tournament-series`,
        { minDelayMs: DELAY_MS },
      );
      if (page === 1) {
        totalPages = Math.min(Number(headers.get("x-wp-totalpages") ?? 1) || 1, 50);
      }
      if (!batch.length) break;

      for (const post of batch) {
        const meta = post.meta ?? {};
        const start = toIsoDate(meta.bassmaster_tournament_start_date);
        if (!start || Number(start.slice(0, 4)) !== year) continue;

        const termId = post["tournament-series"]?.[0];
        const term = termId ? terms.get(termId) : undefined;
        if (!term || !SERIES_MAP[term.slug]) continue;

        const tms = parseInt10(meta.bassmaster_tournament_scoring_system_id);
        const end = toIsoDate(meta.bassmaster_tournament_end_date) ?? start;
        const days = dateSpan(start, end);

        events.push({
          externalId: String(tms ?? `wp-${post.id}`),
          seriesSlug: `bassmaster-${term.slug}`,
          year,
          name: decodeEntities(post.title?.rendered ?? ""),
          subtitle: meta.bassmaster_tournament_short_name || null,
          waterBody: meta.bassmaster_tournament_body_of_water || null,
          city: meta.bassmaster_tournament_city || null,
          state: meta.bassmaster_tournament_state || null,
          country: "USA",
          startDate: start,
          endDate: end,
          status: statusFor(start, end),
          format: SERIES_MAP[term.slug].format,
          daysScheduled: days.length,
          sourceUrl: post.link,
          cursor: { tms, wpId: post.id },
        });
      }
    }
    return events;
  },

  async results(event) {
    const tms = event.cursor?.tms;
    if (!tms) return []; // No scoring-system id means no board to fetch.
    if (!event.startDate || !event.endDate) return [];

    const days = dateSpan(event.startDate, event.endDate);

    // One request per competition day; a day that was never fished 404s or
    // comes back empty, which simply means the event is still in progress.
    const boards: Array<{ day: number; rows: BoardRow[] }> = [];
    for (const [i, date] of days.entries()) {
      try {
        const rows = await fetchJson<BoardRow[]>(
          `${BASE}/data/v1/tournament/basstrakk/leaderboard` +
            `?tournament_id=${tms}&daydate=${toCompactDate(date)}`,
          { minDelayMs: DELAY_MS },
        );
        // A board can come back fully populated but all-zero — a day that was
        // scheduled and then not fished. Keeping it would overwrite every
        // angler's running total with nothing. The test is per *board*, not
        // per row: an angler who blanked a day is real data worth storing.
        const anyScored =
          Array.isArray(rows) &&
          rows.some((r) => (r.SumOunces ?? 0) > 0 || (r.BTLimitOunces ?? 0) > 0);
        if (anyScored) boards.push({ day: i + 1, rows });
      } catch {
        // A missing day is normal (weather day, cut day) — keep going.
      }
    }
    if (!boards.length) return [];

    return assembleResults(boards);
  },

  async roster(filter: RosterFilter = {}) {
    const scope = filter.scope ?? "angler"; // "angler" = every level, historical
    const perPage = 100;
    const out: SourceAnglerProfile[] = [];

    for (let page = 1; ; page++) {
      const params = new URLSearchParams({
        series: scope, num_per_page: String(perPage), page_num: String(page),
      });
      if (filter.state) params.set("state", filter.state);
      if (filter.keyword) params.set("keyword", filter.keyword);

      const rows = await fetchJson<PersonRow[]>(
        `${BASE}/bassmaster/v1/persons?${params}`,
        { minDelayMs: DELAY_MS },
      );
      if (!rows.length) break;

      for (const row of rows) {
        const profile = toAnglerProfile(row);
        if (profile) out.push(profile);
        if (filter.limit && out.length >= filter.limit) return out.slice(0, filter.limit);
      }

      filter.log?.(`  page ${page}: ${rows.length} row(s), ${out.length} usable so far`);
      if (rows.length < perPage) break; // short page means this was the last one
    }
    return out;
  },
};

/** One row of GET /bassmaster/v1/persons. */
interface PersonRow {
  post_id: number;
  post_title: string;
  post_url: string;
  image: string | null;
  series_slug: string[];
  bassmaster_person_first_name: string;
  bassmaster_person_last_name: string;
  bassmaster_person_city: string;
  bassmaster_person_state: string;
  bassmaster_person_facebook: string;
  bassmaster_person_twitter: string;
}

/**
 * The "angler" taxonomy also tags a handful of non-angler accounts (social
 * media handles, staff columnists who happen to be cross-tagged). A row with
 * no parseable name is skipped rather than stored as a blank angler.
 */
function toAnglerProfile(row: PersonRow): SourceAnglerProfile | null {
  let firstName = sanitizeNamePart(row.bassmaster_person_first_name);
  let lastName = sanitizeNamePart(row.bassmaster_person_last_name);
  if (!firstName && !lastName) {
    const split = splitName(decodeEntities(row.post_title ?? ""));
    firstName = sanitizeNamePart(split.firstName);
    lastName = sanitizeNamePart(split.lastName);
  }
  if (!firstName && !lastName) return null;

  const socials: Record<string, string> = {};
  if (row.bassmaster_person_facebook) socials.facebook = row.bassmaster_person_facebook;
  if (row.bassmaster_person_twitter) socials.twitter = row.bassmaster_person_twitter;

  return {
    externalId: String(row.post_id),
    firstName, lastName,
    hometownCity: cleanLocation(row.bassmaster_person_city),
    hometownState: cleanLocation(row.bassmaster_person_state),
    country: "USA",
    photoUrl: row.image || null,
    socials,
    // No reliable per-row signal for amateur vs. pro — the "angler" tag
    // spans 50+ years of club-level Nation members alongside current Elite
    // pros, and a social-media handle can be cross-tagged "elite" too (seen
    // in the wild). The caller picks a default via RosterFilter.scope
    // instead of this function guessing from messy tag soup.
    profileUrl: row.post_url || null,
  };
}

/** "Parts Unknown" and similar placeholders mean "no data", not a real value. */
function cleanLocation(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  if (!v || /^(parts unknown|n\/a|unknown|tbd)$/i.test(v)) return null;
  return v;
}

/**
 * Across 75,000+ historical rows, a name field occasionally has stray
 * wrapping quotes or extra text bled into it from a CMS data-entry error —
 * e.g. a `last_name` of `"teegarden, Sr."` (quotes and all) seen in the
 * wild. Strips wrapping quote characters and, when a comma survives,
 * keeps only the text before it — real surnames don't contain commas, so
 * whatever follows one here is misplaced data, not part of the name.
 * Casing is left as the source wrote it; guessing a "corrected"
 * capitalization risks being wrong for names like "McDonald" or "DeLong".
 */
function sanitizeNamePart(value: string | null | undefined): string {
  let v = (value ?? "").trim();
  v = v.replace(/^["'""]+|["'""]+$/g, "").trim();
  if (v.includes(",")) v = v.split(",")[0].trim();
  return v;
}

/**
 * Fold the per-day boards into one result per angler.
 *
 * Anglers who miss the cut stop appearing on later boards, so final order is
 * "most days fished, then heaviest total" — which is exactly how a cut works.
 */
export function assembleResults(
  boards: Array<{ day: number; rows: BoardRow[] }>,
): SourceResult[] {
  const maxDay = Math.max(...boards.map((b) => b.day));

  interface Acc {
    name: string;
    externalAnglerId: string | null;
    days: SourceResultDay[];
    lastDay: number;
    total: number | null;
    fish: number | null;
    finalRank: number | null;
  }
  const byAngler = new Map<string, Acc>();

  for (const { day, rows } of boards) {
    for (const row of rows) {
      const name = (row.FISHERMAN_PHONENAME ?? "").trim();
      if (!name) continue;
      const key = row.FISHERMENID != null ? `id:${row.FISHERMENID}` : `name:${name.toLowerCase()}`;

      const acc = byAngler.get(key) ?? {
        name,
        externalAnglerId: row.FISHERMENID != null ? String(row.FISHERMENID) : null,
        days: [],
        lastDay: 0,
        total: null,
        fish: null,
        finalRank: null,
      };

      acc.days.push({
        dayNumber: day,
        weight: ouncesToPounds(row.BTLimitOunces),
        fishCount: row.BTFishCount ?? null,
        place: row.Rank ?? null,
        cumulativeWeight: ouncesToPounds(row.SumOunces),
      });

      if (day >= acc.lastDay) {
        acc.lastDay = day;
        acc.total = ouncesToPounds(row.SumOunces);
        acc.fish = row.SumFishCount ?? null;
        acc.finalRank = row.Rank ?? null;
      }
      byAngler.set(key, acc);
    }
  }

  const ordered = [...byAngler.values()].sort(
    (a, b) => b.lastDay - a.lastDay || (b.total ?? 0) - (a.total ?? 0),
  );

  return ordered.map((acc, i) => {
    const { firstName, lastName } = splitName(acc.name);
    return {
      externalAnglerId: acc.externalAnglerId,
      firstName,
      lastName,
      place: i + 1,
      status: acc.lastDay >= maxDay ? "official" : "missed_cut",
      anglerClass: "pro",
      totalWeight: acc.total,
      totalFish: acc.fish,
      days: acc.days.sort((x, y) => x.dayNumber - y.dayNumber),
    } satisfies SourceResult;
  });
}

function statusFor(start: string, end: string): SourceEvent["status"] {
  const today = new Date().toISOString().slice(0, 10);
  if (end < today) return "official";
  if (start <= today) return "in_progress";
  return "scheduled";
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&#038;": "&", "&quot;": '"', "&#8217;": "’", "&#8216;": "‘",
  "&#8211;": "–", "&#8212;": "—", "&lt;": "<", "&gt;": ">", "&nbsp;": " ",
};
function decodeEntities(input: string): string {
  return input.replace(/&[#a-z0-9]+;/gi, (m) => ENTITIES[m] ?? m).trim();
}
