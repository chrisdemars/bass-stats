/**
 * The read interface the UI codes against. Two implementations:
 *   - fixture.ts  : the bundled sample dataset (no Supabase configured)
 *   - supabase.ts : live queries
 */
import type {
  Angler, AnglerClass, AnglerResultRow, ArticleWithContext, CareerStats,
  Division, EventStatus, EventWithContext, LeaderboardRow, Organization,
  Season, Series, SeriesLevel, StandingRow,
} from "@/lib/types";

/** Small, fully-cacheable reference data — loaded once and reused everywhere. */
export interface Catalog {
  organizations: Organization[];
  series: Series[];
  divisions: Division[];
  seasons: Season[];
}

export interface EventFilter {
  orgSlug?: string;
  seriesSlug?: string;
  divisionSlug?: string;
  level?: SeriesLevel;
  year?: number;
  status?: EventStatus | EventStatus[];
  state?: string;
  search?: string;
  /** "upcoming" sorts ascending by date; everything else descending. */
  order?: "recent" | "upcoming";
  limit?: number;
}

export interface AnglerFilter {
  search?: string;
  anglerClass?: AnglerClass;
  state?: string;
  orgSlug?: string;
  sort?: "name" | "earnings" | "wins" | "events";
  limit?: number;
  offset?: number;
}

/** The winning line of an event — what cards and rails show under the title. */
export interface EventWinner {
  eventId: string;
  anglerSlug: string;
  anglerName: string;
  firstName: string;
  lastName: string;
  totalWeight: number | null;
  totalFish: number | null;
  payoutUsd: number | null;
}

/** An angler plus the headline numbers the directory shows. */
export interface AnglerListItem {
  angler: Angler;
  stats: CareerStats;
  orgSlugs: string[];
}

export interface Repository {
  readonly source: "sample" | "supabase";
  getCatalog(): Promise<Catalog>;
  listEvents(filter?: EventFilter): Promise<EventWithContext[]>;
  getEventBySlug(slug: string): Promise<EventWithContext | null>;
  getLeaderboard(eventId: string): Promise<LeaderboardRow[]>;
  /** Winners for a batch of events, keyed by event id. */
  getWinners(eventIds: string[]): Promise<Record<string, EventWinner>>;
  getStandings(seasonId: string, divisionId?: string | null): Promise<StandingRow[]>;
  listAnglers(filter?: AnglerFilter): Promise<{ items: AnglerListItem[]; total: number }>;
  getAnglerBySlug(slug: string): Promise<Angler | null>;
  getAnglerResults(anglerId: string): Promise<AnglerResultRow[]>;
  getCareerStats(anglerId: string): Promise<CareerStats>;
  listArticles(limit?: number): Promise<ArticleWithContext[]>;
  getArticleBySlug(slug: string): Promise<ArticleWithContext | null>;
  getFeaturedArticle(): Promise<ArticleWithContext | null>;
  getArticleForEvent(eventId: string): Promise<ArticleWithContext | null>;
}

/** Shared ordering/filtering helpers so both repositories agree. */
export function matchesSearch(haystack: Array<string | null | undefined>, needle?: string) {
  if (!needle) return true;
  const q = needle.trim().toLowerCase();
  if (!q) return true;
  return haystack.some((h) => h?.toLowerCase().includes(q));
}

export function emptyCareerStats(anglerId: string): CareerStats {
  return {
    anglerId, events: 0, wins: 0, top10s: 0, top25s: 0, avgPlace: null,
    bestPlace: null, careerEarnings: 0, careerWeight: 0, careerFish: 0,
    biggestBass: null,
  };
}

export type { Season, Series, Division, Organization };
