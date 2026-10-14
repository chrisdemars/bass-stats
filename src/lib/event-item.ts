import type { EventWithContext } from "./types";
import type { EventWinner } from "./data/repository";
import type { EventStatus, ScoringFormat, SeriesLevel } from "./types";

/**
 * The flattened event shape sent to client components.
 *
 * `EventWithContext` repeats the whole org/series/season object on every row;
 * this keeps the browse payload to slugs and scalars.
 */
export interface EventItem {
  id: string;
  slug: string;
  name: string;
  waterBody: string | null;
  city: string | null;
  state: string | null;
  startDate: string | null;
  endDate: string | null;
  status: EventStatus;
  format: ScoringFormat | null;
  fieldSize: number | null;
  purseUsd: number | null;
  year: number;
  orgSlug: string;
  orgShortName: string;
  orgAccent: string;
  seriesSlug: string;
  seriesName: string;
  seriesShortName: string;
  level: SeriesLevel;
  divisionSlug: string | null;
  divisionName: string | null;
  winnerName: string | null;
  winnerSlug: string | null;
  winnerWeight: number | null;
}

export function toEventItem(
  e: EventWithContext,
  winner?: EventWinner,
): EventItem {
  return {
    id: e.id,
    slug: e.slug,
    name: e.name,
    waterBody: e.waterBody,
    city: e.city,
    state: e.state,
    startDate: e.startDate,
    endDate: e.endDate,
    status: e.status,
    format: e.format,
    fieldSize: e.fieldSize,
    purseUsd: e.purseUsd,
    year: e.season.year,
    orgSlug: e.org.slug,
    orgShortName: e.org.shortName,
    orgAccent: e.org.accentColor,
    seriesSlug: e.series.slug,
    seriesName: e.series.name,
    seriesShortName: e.series.shortName ?? e.series.name,
    level: e.series.level,
    divisionSlug: e.division?.slug ?? null,
    divisionName: e.division?.name ?? null,
    winnerName: winner?.anglerName ?? null,
    winnerSlug: winner?.anglerSlug ?? null,
    winnerWeight: winner?.totalWeight ?? null,
  };
}

/** Compact catalog for the client-side filter controls. */
export interface BrowseCatalog {
  orgs: Array<{ slug: string; name: string; shortName: string; accent: string }>;
  series: Array<{
    slug: string; name: string; shortName: string; orgSlug: string; level: SeriesLevel;
  }>;
  divisions: Array<{ slug: string; name: string; seriesSlug: string }>;
  years: number[];
}

export function toBrowseCatalog(catalog: {
  organizations: Array<{ id: string; slug: string; name: string; shortName: string; accentColor: string }>;
  series: Array<{ id: string; slug: string; name: string; shortName: string | null; orgId: string; level: SeriesLevel }>;
  divisions: Array<{ slug: string; name: string; seriesId: string }>;
  seasons: Array<{ year: number }>;
}): BrowseCatalog {
  const orgSlugById = new Map(catalog.organizations.map((o) => [o.id, o.slug]));
  const seriesSlugById = new Map(catalog.series.map((s) => [s.id, s.slug]));

  return {
    orgs: catalog.organizations.map((o) => ({
      slug: o.slug, name: o.name, shortName: o.shortName, accent: o.accentColor,
    })),
    series: catalog.series.map((s) => ({
      slug: s.slug,
      name: s.name,
      shortName: s.shortName ?? s.name,
      orgSlug: orgSlugById.get(s.orgId) ?? "",
      level: s.level,
    })),
    divisions: catalog.divisions.map((d) => ({
      slug: d.slug, name: d.name, seriesSlug: seriesSlugById.get(d.seriesId) ?? "",
    })),
    years: [...new Set(catalog.seasons.map((s) => s.year))].sort((a, b) => b - a),
  };
}
