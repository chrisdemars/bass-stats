/**
 * The adapter contract every source implements.
 *
 * An adapter knows three things and nothing else: which events a season has,
 * what one event's results look like, and how to express both in the shared
 * vocabulary below. Standings, career records and the points races are all
 * derived downstream, so adding a source never means touching the schema.
 */
import type {
  AnglerClass, EventStatus, ResultStatus, ScoringFormat, SeriesLevel,
} from "@/lib/types";

/** A series as the source describes it — matched to `series` by slug. */
export interface SourceSeries {
  slug: string;
  name: string;
  shortName?: string;
  level: SeriesLevel;
  format: ScoringFormat;
  description?: string;
}

export interface SourceEvent {
  /** Stable id in the source's own namespace; half of the upsert key. */
  externalId: string;
  seriesSlug: string;
  divisionName?: string | null;
  year: number;
  name: string;
  subtitle?: string | null;
  waterBody?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string;
  startDate?: string | null;
  endDate?: string | null;
  status: EventStatus;
  format?: ScoringFormat | null;
  daysScheduled?: number | null;
  fieldSize?: number | null;
  cutTo?: number | null;
  purseUsd?: number | null;
  winnerPayoutUsd?: number | null;
  sourceUrl?: string | null;
  blurb?: string | null;
  /** Anything the adapter needs later to fetch results for this event. */
  cursor?: Record<string, string | number | null>;
}

export interface SourceResultDay {
  dayNumber: number;
  weight?: number | null;
  fishCount?: number | null;
  place?: number | null;
  cumulativeWeight?: number | null;
}

export interface SourceResult {
  /** Source's angler id, when it has one — the strongest matching signal. */
  externalAnglerId?: string | null;
  firstName: string;
  lastName: string;
  hometownCity?: string | null;
  hometownState?: string | null;
  country?: string;
  place?: number | null;
  status?: ResultStatus;
  anglerClass?: AnglerClass;
  totalWeight?: number | null;
  totalFish?: number | null;
  bigBass?: number | null;
  points?: number | null;
  payoutUsd?: number | null;
  days?: SourceResultDay[];
}

export interface SourceAdapter {
  /** Matches `organizations.slug`. */
  readonly org: string;
  readonly label: string;
  /** Series this adapter can produce, upserted before any event. */
  series(): Promise<SourceSeries[]>;
  /** Every event the source lists for a season. */
  discover(year: number): Promise<SourceEvent[]>;
  /** One event's full field. Returning [] means "nothing posted yet". */
  results(event: SourceEvent): Promise<SourceResult[]>;
}

export interface IngestOptions {
  year: number;
  /** Limit to one series slug. */
  seriesSlug?: string;
  /** Process at most this many events. */
  limit?: number;
  /** Parse and report without writing. */
  dryRun?: boolean;
  /** Skip events already stored with results. */
  skipExisting?: boolean;
  log?: (message: string) => void;
}

export interface IngestReport {
  source: string;
  year: number;
  eventsSeen: number;
  eventsWritten: number;
  resultsWritten: number;
  anglersCreated: number;
  skipped: number;
  errors: Array<{ event: string; message: string }>;
}
