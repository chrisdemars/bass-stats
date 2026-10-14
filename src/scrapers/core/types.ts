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

/**
 * A profile pulled from a source's own angler directory, independent of any
 * event result. Richer than what a leaderboard row carries — hometown,
 * photo, bio, socials — and the way to populate "every angler" rather than
 * only the ones who show up in whatever events have been ingested so far.
 */
export interface SourceAnglerProfile {
  /** Source's own id for this person, when the source has a stable one. */
  externalId?: string | null;
  firstName: string;
  lastName: string;
  hometownCity?: string | null;
  hometownState?: string | null;
  country?: string;
  photoUrl?: string | null;
  bio?: string | null;
  boatSponsor?: string | null;
  sponsors?: string[];
  socials?: Record<string, string>;
  primaryClass?: AnglerClass;
  turnedPro?: number | null;
  profileUrl?: string | null;
}

export interface RosterFilter {
  /** Source-specific scope — e.g. Bassmaster's "elite" | "angler" | "opens" taxonomy slug. */
  scope?: string;
  state?: string;
  keyword?: string;
  /** Caps how many profiles a single call returns; omit for "all in scope". */
  limit?: number;
  /**
   * `AnglerClass` to assign a profile that has no class of its own — most
   * directory listings don't carry one. Applied only when *creating* a new
   * angler row; never used to overwrite an existing one's class.
   */
  defaultClass?: AnglerClass;
  log?: (message: string) => void;
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
  /**
   * The source's own angler directory, if it has one independent of event
   * results. Optional — manual-import adapters generally don't.
   */
  roster?(filter?: RosterFilter): Promise<SourceAnglerProfile[]>;
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

export interface RosterReport {
  source: string;
  scope: string;
  profilesSeen: number;
  anglersCreated: number;
  anglersUpdated: number;
  errors: Array<{ profile: string; message: string }>;
}
