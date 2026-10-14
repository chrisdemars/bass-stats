/**
 * Postgres row shapes and the mappers that turn them into domain objects.
 * Keeps snake_case and numeric-as-string quirks out of the rest of the app.
 */
import type {
  Angler, AnglerClass, Article, ArticleType, BassEvent, Division, EventResult,
  EventStatus, Organization, ResultDay, ScoringFormat, Season, SeasonStatus,
  Series, SeriesLevel, StandingRow, ResultStatus,
} from "@/lib/types";

const num = (v: unknown): number | null =>
  v === null || v === undefined || v === "" ? null : Number(v);
const req = (v: unknown, fallback = 0): number => num(v) ?? fallback;

export interface OrgRow {
  id: string; slug: string; name: string; short_name: string;
  description: string | null; website: string | null;
  primary_color: string; accent_color: string; sort_order: number;
}
export const toOrg = (r: OrgRow): Organization => ({
  id: r.id, slug: r.slug, name: r.name, shortName: r.short_name,
  description: r.description, website: r.website,
  primaryColor: r.primary_color, accentColor: r.accent_color,
  sortOrder: r.sort_order,
});

export interface SeriesRow {
  id: string; org_id: string; slug: string; name: string;
  short_name: string | null; level: SeriesLevel; format: ScoringFormat;
  description: string | null; sort_order: number;
}
export const toSeries = (r: SeriesRow): Series => ({
  id: r.id, orgId: r.org_id, slug: r.slug, name: r.name,
  shortName: r.short_name, level: r.level, format: r.format,
  description: r.description, sortOrder: r.sort_order,
});

export interface DivisionRow {
  id: string; series_id: string; slug: string; name: string;
  region: string | null; sort_order: number;
}
export const toDivision = (r: DivisionRow): Division => ({
  id: r.id, seriesId: r.series_id, slug: r.slug, name: r.name,
  region: r.region, sortOrder: r.sort_order,
});

export interface SeasonRow {
  id: string; series_id: string; year: number; name: string | null;
  status: SeasonStatus; start_date: string | null; end_date: string | null;
}
export const toSeason = (r: SeasonRow): Season => ({
  id: r.id, seriesId: r.series_id, year: r.year, name: r.name,
  status: r.status, startDate: r.start_date, endDate: r.end_date,
});

export interface EventRow {
  id: string; season_id: string; division_id: string | null; slug: string;
  name: string; subtitle: string | null; water_body: string | null;
  city: string | null; state: string | null; country: string;
  start_date: string | null; end_date: string | null; status: EventStatus;
  format: ScoringFormat | null; days_scheduled: number | null;
  field_size: number | null; cut_to: number | null;
  purse_usd: string | number | null; winner_payout_usd: string | number | null;
  points_multiplier: string | number; cover_image_url: string | null;
  blurb: string | null; source_url: string | null;
}
export const toEvent = (r: EventRow): BassEvent => ({
  id: r.id, seasonId: r.season_id, divisionId: r.division_id, slug: r.slug,
  name: r.name, subtitle: r.subtitle, waterBody: r.water_body,
  city: r.city, state: r.state, country: r.country,
  startDate: r.start_date, endDate: r.end_date, status: r.status,
  format: r.format, daysScheduled: r.days_scheduled, fieldSize: r.field_size,
  cutTo: r.cut_to, purseUsd: num(r.purse_usd),
  winnerPayoutUsd: num(r.winner_payout_usd),
  pointsMultiplier: req(r.points_multiplier, 1),
  coverImageUrl: r.cover_image_url, blurb: r.blurb, sourceUrl: r.source_url,
});

export interface AnglerRow {
  id: string; slug: string; first_name: string; last_name: string;
  display_name: string; nickname: string | null;
  hometown_city: string | null; hometown_state: string | null; country: string;
  birth_year: number | null; turned_pro: number | null;
  primary_class: AnglerClass; bio: string | null; photo_url: string | null;
  boat_sponsor: string | null; sponsors: string[] | null;
  socials: Record<string, string> | null;
}
export const toAngler = (r: AnglerRow): Angler => ({
  id: r.id, slug: r.slug, firstName: r.first_name, lastName: r.last_name,
  displayName: r.display_name ?? `${r.first_name} ${r.last_name}`,
  nickname: r.nickname, hometownCity: r.hometown_city,
  hometownState: r.hometown_state, country: r.country,
  birthYear: r.birth_year, turnedPro: r.turned_pro,
  primaryClass: r.primary_class, bio: r.bio, photoUrl: r.photo_url,
  boatSponsor: r.boat_sponsor, sponsors: r.sponsors ?? [],
  socials: r.socials ?? {},
});

export interface ResultDayRow {
  day_number: number; weight: string | number | null; fish_count: number | null;
  place: number | null; cumulative_weight: string | number | null;
}
export const toResultDay = (r: ResultDayRow): ResultDay => ({
  dayNumber: r.day_number, weight: num(r.weight), fishCount: r.fish_count,
  place: r.place, cumulativeWeight: num(r.cumulative_weight),
});

export interface ResultRow {
  id: string; event_id: string; angler_id: string; place: number | null;
  status: ResultStatus; angler_class: AnglerClass;
  total_weight: string | number | null; total_fish: number | null;
  big_bass: string | number | null; points: string | number | null;
  payout_usd: string | number | null; day_count: number | null;
  event_result_days?: ResultDayRow[] | null;
}
export const toResult = (r: ResultRow): EventResult => ({
  id: r.id, eventId: r.event_id, anglerId: r.angler_id, place: r.place,
  status: r.status, anglerClass: r.angler_class,
  totalWeight: num(r.total_weight), totalFish: r.total_fish,
  bigBass: num(r.big_bass), points: num(r.points),
  payoutUsd: num(r.payout_usd), dayCount: r.day_count,
  days: (r.event_result_days ?? [])
    .map(toResultDay)
    .sort((a, b) => a.dayNumber - b.dayNumber),
});

export interface StandingRowRaw {
  id: string; season_id: string; division_id: string | null; angler_id: string;
  rank: number | null; points: string | number | null; events_fished: number;
  wins: number; top_10s: number; total_weight: string | number | null;
  earnings_usd: string | number | null; is_aoy: boolean;
  qualified: boolean | null; anglers?: AnglerRow | null;
}
export const toStanding = (r: StandingRowRaw, angler: Angler): StandingRow => ({
  id: r.id, seasonId: r.season_id, divisionId: r.division_id,
  anglerId: r.angler_id, rank: r.rank, points: num(r.points),
  eventsFished: r.events_fished, wins: r.wins, top10s: r.top_10s,
  totalWeight: num(r.total_weight), earningsUsd: num(r.earnings_usd),
  isAoy: r.is_aoy, qualified: r.qualified, angler,
});

export interface ArticleRow {
  id: string; slug: string; type: ArticleType; title: string;
  dek: string | null; body_md: string | null; hero_image_url: string | null;
  hero_credit: string | null; author: string | null; org_id: string | null;
  event_id: string | null; angler_id: string | null; tags: string[] | null;
  featured: boolean; published_at: string;
}
export const toArticle = (r: ArticleRow): Article => ({
  id: r.id, slug: r.slug, type: r.type, title: r.title, dek: r.dek,
  bodyMd: r.body_md, heroImageUrl: r.hero_image_url, heroCredit: r.hero_credit,
  author: r.author, orgId: r.org_id, eventId: r.event_id,
  anglerId: r.angler_id, tags: r.tags ?? [], featured: r.featured,
  publishedAt: r.published_at,
});

export interface CareerStatsRow {
  angler_id: string; events: number | string; wins: number | string;
  top_10s: number | string; top_25s: number | string;
  avg_place: string | number | null; best_place: number | null;
  career_earnings: string | number | null;
  career_weight: string | number | null;
  career_fish: string | number | null;
  biggest_bass: string | number | null;
}
