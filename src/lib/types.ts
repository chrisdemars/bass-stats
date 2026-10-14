/**
 * Domain types for bass-stats.
 *
 * These mirror `supabase/migrations/0001_init.sql` but are the shapes the UI
 * actually consumes: joins pre-flattened, numbers as numbers, no nulls where a
 * sensible default exists.
 */

export type SeriesLevel =
  | "professional"
  | "semi_pro"
  | "amateur"
  | "championship"
  | "college"
  | "high_school"
  | "team";

export type ScoringFormat =
  | "bag_limit_5"
  | "bag_limit_3"
  | "catch_weigh_release"
  | "total_weight"
  | "points";

export type SeasonStatus = "upcoming" | "in_progress" | "complete";

export type EventStatus =
  | "scheduled"
  | "in_progress"
  | "official"
  | "unofficial"
  | "cancelled"
  | "postponed";

export type AnglerClass =
  | "pro"
  | "boater"
  | "co_angler"
  | "amateur"
  | "college"
  | "high_school";

export type ResultStatus =
  | "official"
  | "made_cut"
  | "missed_cut"
  | "dq"
  | "withdrew"
  | "did_not_fish";

export type ArticleType = "recap" | "preview" | "analysis" | "news" | "feature";

export interface Organization {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  description: string | null;
  website: string | null;
  primaryColor: string;
  accentColor: string;
  sortOrder: number;
}

export interface Series {
  id: string;
  orgId: string;
  slug: string;
  name: string;
  shortName: string | null;
  level: SeriesLevel;
  format: ScoringFormat;
  description: string | null;
  sortOrder: number;
}

export interface Division {
  id: string;
  seriesId: string;
  slug: string;
  name: string;
  region: string | null;
  sortOrder: number;
}

export interface Season {
  id: string;
  seriesId: string;
  year: number;
  name: string | null;
  status: SeasonStatus;
  startDate: string | null;
  endDate: string | null;
}

export interface BassEvent {
  id: string;
  seasonId: string;
  divisionId: string | null;
  slug: string;
  name: string;
  subtitle: string | null;
  waterBody: string | null;
  city: string | null;
  state: string | null;
  country: string;
  startDate: string | null;
  endDate: string | null;
  status: EventStatus;
  format: ScoringFormat | null;
  daysScheduled: number | null;
  fieldSize: number | null;
  cutTo: number | null;
  purseUsd: number | null;
  winnerPayoutUsd: number | null;
  pointsMultiplier: number;
  coverImageUrl: string | null;
  blurb: string | null;
  sourceUrl: string | null;
}

/** An event with its series/org/season context resolved — what cards and lists need. */
export interface EventWithContext extends BassEvent {
  org: Organization;
  series: Series;
  season: Season;
  division: Division | null;
}

export interface Angler {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  displayName: string;
  nickname: string | null;
  hometownCity: string | null;
  hometownState: string | null;
  country: string;
  birthYear: number | null;
  turnedPro: number | null;
  primaryClass: AnglerClass;
  bio: string | null;
  photoUrl: string | null;
  boatSponsor: string | null;
  sponsors: string[];
  socials: Record<string, string>;
}

export interface ResultDay {
  dayNumber: number;
  weight: number | null;
  fishCount: number | null;
  place: number | null;
  cumulativeWeight: number | null;
}

export interface EventResult {
  id: string;
  eventId: string;
  anglerId: string;
  place: number | null;
  status: ResultStatus;
  anglerClass: AnglerClass;
  totalWeight: number | null;
  totalFish: number | null;
  bigBass: number | null;
  points: number | null;
  payoutUsd: number | null;
  dayCount: number | null;
  days: ResultDay[];
}

/** A leaderboard row: result + the angler who posted it. */
export interface LeaderboardRow extends EventResult {
  angler: Angler;
}

export interface StandingRow {
  id: string;
  seasonId: string;
  divisionId: string | null;
  anglerId: string;
  rank: number | null;
  points: number | null;
  eventsFished: number;
  wins: number;
  top10s: number;
  totalWeight: number | null;
  earningsUsd: number | null;
  isAoy: boolean;
  qualified: boolean | null;
  angler: Angler;
}

export interface CareerStats {
  anglerId: string;
  events: number;
  wins: number;
  top10s: number;
  top25s: number;
  avgPlace: number | null;
  bestPlace: number | null;
  careerEarnings: number;
  careerWeight: number;
  careerFish: number;
  biggestBass: number | null;
}

/** One line of an angler's career table. */
export interface AnglerResultRow extends EventResult {
  event: EventWithContext;
}

export interface Article {
  id: string;
  slug: string;
  type: ArticleType;
  title: string;
  dek: string | null;
  bodyMd: string | null;
  heroImageUrl: string | null;
  heroCredit: string | null;
  author: string | null;
  orgId: string | null;
  eventId: string | null;
  anglerId: string | null;
  tags: string[];
  featured: boolean;
  publishedAt: string;
}

export interface ArticleWithContext extends Article {
  org: Organization | null;
  event: EventWithContext | null;
}

/** The full bundle the dev-mode fixture file holds. */
export interface DataSet {
  organizations: Organization[];
  series: Series[];
  divisions: Division[];
  seasons: Season[];
  events: BassEvent[];
  anglers: Angler[];
  results: EventResult[];
  standings: Omit<StandingRow, "angler">[];
  articles: Article[];
}
