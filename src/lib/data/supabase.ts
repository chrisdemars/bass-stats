import "server-only";
import type {
  Angler, AnglerResultRow, ArticleWithContext, BassEvent, CareerStats,
  EventStatus, EventWithContext, LeaderboardRow, StandingRow,
} from "@/lib/types";
import { getReadClient } from "@/lib/supabase/server";
import {
  toAngler, toArticle, toDivision, toEvent, toOrg, toResult, toSeason,
  toSeries, toStanding,
  type AnglerRow, type ArticleRow, type CareerStatsRow, type DivisionRow,
  type EventRow, type OrgRow, type ResultRow, type SeasonRow, type SeriesRow,
  type StandingRowRaw,
} from "@/lib/supabase/rows";
import {
  emptyCareerStats,
  type AnglerFilter, type AnglerListItem, type Catalog, type EventFilter,
  type EventWinner, type Repository,
} from "./repository";

const EVENT_COLUMNS =
  "id,season_id,division_id,slug,name,subtitle,water_body,city,state,country," +
  "start_date,end_date,status,format,days_scheduled,field_size,cut_to," +
  "purse_usd,winner_payout_usd,points_multiplier,cover_image_url,blurb,source_url";

function fail(context: string, error: { message: string } | null): never | void {
  if (error) throw new Error(`[supabase] ${context}: ${error.message}`);
}

/**
 * The client is intentionally untyped (no generated `Database` types to keep in
 * sync), so PostgREST hands back loose shapes. Narrow them once, here.
 */
const rows = <T,>(data: unknown): T[] => (data ?? []) as T[];
const row = <T,>(data: unknown): T | null => (data ?? null) as T | null;

/** Catalog is small and changes rarely; one fetch serves a whole render. */
async function fetchCatalog(): Promise<Catalog> {
  const db = getReadClient();
  const [orgs, series, divisions, seasons] = await Promise.all([
    db.from("organizations").select("*").order("sort_order"),
    db.from("series").select("*").order("sort_order"),
    db.from("divisions").select("*").order("sort_order"),
    db.from("seasons").select("*").order("year", { ascending: false }),
  ]);
  fail("organizations", orgs.error);
  fail("series", series.error);
  fail("divisions", divisions.error);
  fail("seasons", seasons.error);

  return {
    organizations: rows<OrgRow>(orgs.data).map(toOrg),
    series: rows<SeriesRow>(series.data).map(toSeries),
    divisions: rows<DivisionRow>(divisions.data).map(toDivision),
    seasons: rows<SeasonRow>(seasons.data).map(toSeason),
  };
}

function contextualizer(catalog: Catalog) {
  const orgById = new Map(catalog.organizations.map((o) => [o.id, o]));
  const seriesById = new Map(catalog.series.map((s) => [s.id, s]));
  const divisionById = new Map(catalog.divisions.map((d) => [d.id, d]));
  const seasonById = new Map(catalog.seasons.map((s) => [s.id, s]));

  return (e: BassEvent): EventWithContext | null => {
    const season = seasonById.get(e.seasonId);
    const series = season && seriesById.get(season.seriesId);
    const org = series && orgById.get(series.orgId);
    if (!season || !series || !org) return null;
    return {
      ...e, season, series, org,
      division: e.divisionId ? divisionById.get(e.divisionId) ?? null : null,
    };
  };
}

/** Narrow the event query to the season ids a series/org/level filter implies. */
function seasonIdsFor(catalog: Catalog, filter: EventFilter): string[] | null {
  const { orgSlug, seriesSlug, level, year } = filter;
  if (!orgSlug && !seriesSlug && !level && !year) return null;

  const org = orgSlug ? catalog.organizations.find((o) => o.slug === orgSlug) : null;
  const seriesIds = new Set(
    catalog.series
      .filter((s) => (seriesSlug ? s.slug === seriesSlug : true))
      .filter((s) => (org ? s.orgId === org.id : true))
      .filter((s) => (level ? s.level === level : true))
      .map((s) => s.id),
  );
  return catalog.seasons
    .filter((s) => seriesIds.has(s.seriesId))
    .filter((s) => (year ? s.year === year : true))
    .map((s) => s.id);
}

function toCareer(r: CareerStatsRow): CareerStats {
  const n = (v: unknown) => (v == null ? 0 : Number(v));
  return {
    anglerId: r.angler_id,
    events: n(r.events), wins: n(r.wins), top10s: n(r.top_10s), top25s: n(r.top_25s),
    avgPlace: r.avg_place == null ? null : Number(r.avg_place),
    bestPlace: r.best_place,
    // Not run through n(): the materialized view's career_earnings is a
    // plain sum(), which is SQL NULL (not 0) when every contributing
    // event_result.payout_usd is null — see the CareerStats.careerEarnings
    // doc comment for why that distinction matters.
    careerEarnings: r.career_earnings == null ? null : Number(r.career_earnings),
    careerWeight: n(r.career_weight),
    careerFish: n(r.career_fish),
    biggestBass: r.biggest_bass == null ? null : Number(r.biggest_bass),
  };
}

export const supabaseRepository: Repository = {
  source: "supabase",

  getCatalog: fetchCatalog,

  async listEvents(filter: EventFilter = {}) {
    const db = getReadClient();
    const catalog = await fetchCatalog();
    const withCtx = contextualizer(catalog);

    let q = db.from("events").select(EVENT_COLUMNS);

    const seasonIds = seasonIdsFor(catalog, filter);
    if (seasonIds) {
      if (!seasonIds.length) return [];
      q = q.in("season_id", seasonIds);
    }
    if (filter.divisionSlug) {
      const div = catalog.divisions.find((d) => d.slug === filter.divisionSlug);
      if (!div) return [];
      q = q.eq("division_id", div.id);
    }
    if (filter.state) q = q.eq("state", filter.state);
    if (filter.status) {
      const statuses = (Array.isArray(filter.status) ? filter.status : [filter.status]) as EventStatus[];
      q = q.in("status", statuses);
    }
    if (filter.search) {
      const term = `%${filter.search}%`;
      q = q.or(`name.ilike.${term},water_body.ilike.${term},city.ilike.${term}`);
    }

    q = q.order("start_date", { ascending: filter.order === "upcoming" });
    if (filter.limit) q = q.limit(filter.limit);

    const { data, error } = await q;
    fail("listEvents", error);
    return rows<EventRow>(data)
      .map((r) => withCtx(toEvent(r)))
      .filter((e): e is EventWithContext => e !== null);
  },

  async getEventBySlug(slug) {
    const db = getReadClient();
    const [{ data, error }, catalog] = await Promise.all([
      db.from("events").select(EVENT_COLUMNS).eq("slug", slug).maybeSingle(),
      fetchCatalog(),
    ]);
    fail("getEventBySlug", error);
    if (!data) return null;
    return contextualizer(catalog)(toEvent(row<EventRow>(data)!));
  },

  async getLeaderboard(eventId) {
    const db = getReadClient();
    const { data, error } = await db
      .from("event_results")
      .select("*, event_result_days(*), anglers(*)")
      .eq("event_id", eventId)
      .order("place", { ascending: true });
    fail("getLeaderboard", error);

    return rows<ResultRow & { anglers: AnglerRow | null }>(data)
      .filter((r) => r.anglers)
      .map((r) => ({ ...toResult(r), angler: toAngler(r.anglers!) }) satisfies LeaderboardRow);
  },

  async getWinners(eventIds) {
    if (!eventIds.length) return {};
    const db = getReadClient();
    const { data, error } = await db
      .from("event_results")
      .select("event_id,total_weight,total_fish,payout_usd,angler_class,anglers(slug,first_name,last_name,display_name)")
      .in("event_id", eventIds)
      .eq("place", 1);
    fail("getWinners", error);

    type WinRow = {
      event_id: string; total_weight: string | number | null;
      total_fish: number | null; payout_usd: string | number | null;
      angler_class: string;
      anglers: { slug: string; first_name: string; last_name: string; display_name: string } | null;
    };
    // An event can have a winner per class (boater and co-angler); the pro or
    // boater line is the headline, so it wins ties on insertion order.
    const rank: Record<string, number> = { pro: 0, boater: 1, co_angler: 2 };
    const out: Record<string, EventWinner> = {};
    const best: Record<string, number> = {};
    for (const r of rows<WinRow>(data)) {
      if (!r.anglers) continue;
      const score = rank[r.angler_class] ?? 3;
      if (best[r.event_id] !== undefined && best[r.event_id] <= score) continue;
      best[r.event_id] = score;
      out[r.event_id] = {
        eventId: r.event_id,
        anglerSlug: r.anglers.slug,
        anglerName: r.anglers.display_name ?? `${r.anglers.first_name} ${r.anglers.last_name}`,
        firstName: r.anglers.first_name,
        lastName: r.anglers.last_name,
        totalWeight: r.total_weight == null ? null : Number(r.total_weight),
        totalFish: r.total_fish,
        payoutUsd: r.payout_usd == null ? null : Number(r.payout_usd),
      };
    }
    return out;
  },

  async getStandings(seasonId, divisionId = null) {
    const db = getReadClient();
    let q = db
      .from("season_standings")
      .select("*, anglers(*)")
      .eq("season_id", seasonId)
      .order("rank", { ascending: true });
    if (divisionId) q = q.eq("division_id", divisionId);

    const { data, error } = await q;
    fail("getStandings", error);
    return rows<StandingRowRaw>(data)
      .filter((r) => r.anglers)
      .map((r) => toStanding(r, toAngler(r.anglers!)) satisfies StandingRow);
  },

  async listAnglers(filter: AnglerFilter = {}) {
    const db = getReadClient();
    const { data, error } = await db.rpc("search_anglers", {
      p_search: filter.search ?? null,
      p_class: filter.anglerClass ?? null,
      p_state: filter.state ?? null,
      p_org: filter.orgSlug ?? null,
      p_sort: filter.sort ?? "earnings",
      p_limit: filter.limit ?? 48,
      p_offset: filter.offset ?? 0,
    });
    fail("listAnglers", error);

    type SearchRow = AnglerRow & CareerStatsRow & {
      org_slugs: string[] | null;
      total_count: number | string;
    };
    const rows = (data ?? []) as SearchRow[];
    return {
      items: rows.map<AnglerListItem>((r) => ({
        angler: toAngler(r),
        stats: toCareer({ ...r, angler_id: r.id }),
        orgSlugs: r.org_slugs ?? [],
      })),
      total: rows.length ? Number(rows[0].total_count) : 0,
    };
  },

  async getAnglerBySlug(slug) {
    const db = getReadClient();
    const { data, error } = await db
      .from("anglers").select("*").eq("slug", slug).maybeSingle();
    fail("getAnglerBySlug", error);
    return data ? toAngler(row<AnglerRow>(data)!) : null;
  },

  async listAnglerStates() {
    const db = getReadClient();
    const { data, error } = await db.rpc("list_angler_states");
    fail("listAnglerStates", error);
    return rows<{ state: string }>(data).map((r) => r.state);
  },

  async getAnglerResults(anglerId) {
    const db = getReadClient();
    const [{ data, error }, catalog] = await Promise.all([
      db
        .from("event_results")
        .select(`*, event_result_days(*), events(${EVENT_COLUMNS})`)
        .eq("angler_id", anglerId),
      fetchCatalog(),
    ]);
    fail("getAnglerResults", error);
    const withCtx = contextualizer(catalog);

    return rows<ResultRow & { events: EventRow | null }>(data)
      .map((r) => {
        const event = r.events ? withCtx(toEvent(r.events)) : null;
        return event ? ({ ...toResult(r), event } satisfies AnglerResultRow) : null;
      })
      .filter((r): r is AnglerResultRow => r !== null)
      .sort((a, b) => (b.event.startDate ?? "").localeCompare(a.event.startDate ?? ""));
  },

  async getCareerStats(anglerId) {
    const db = getReadClient();
    const { data, error } = await db
      .from("angler_career_stats").select("*").eq("angler_id", anglerId).maybeSingle();
    fail("getCareerStats", error);
    return data ? toCareer(row<CareerStatsRow>(data)!) : emptyCareerStats(anglerId);
  },

  async listArticles(limit = 20) {
    const db = getReadClient();
    const [{ data, error }, catalog] = await Promise.all([
      db
        .from("articles")
        .select(`*, events(${EVENT_COLUMNS})`)
        .order("published_at", { ascending: false })
        .limit(limit),
      fetchCatalog(),
    ]);
    fail("listArticles", error);
    return hydrate(rows<ArticleJoin>(data), catalog);
  },

  async getArticleBySlug(slug) {
    const db = getReadClient();
    const [{ data, error }, catalog] = await Promise.all([
      db.from("articles").select(`*, events(${EVENT_COLUMNS})`).eq("slug", slug).maybeSingle(),
      fetchCatalog(),
    ]);
    fail("getArticleBySlug", error);
    return data ? hydrate([row<ArticleJoin>(data)!], catalog)[0] ?? null : null;
  },

  async getFeaturedArticle() {
    const db = getReadClient();
    const [{ data, error }, catalog] = await Promise.all([
      db
        .from("articles")
        .select(`*, events(${EVENT_COLUMNS})`)
        .order("featured", { ascending: false })
        .order("published_at", { ascending: false })
        .limit(1),
      fetchCatalog(),
    ]);
    fail("getFeaturedArticle", error);
    return hydrate(rows<ArticleJoin>(data), catalog)[0] ?? null;
  },

  async getArticleForEvent(eventId) {
    const db = getReadClient();
    const [{ data, error }, catalog] = await Promise.all([
      db
        .from("articles")
        .select(`*, events(${EVENT_COLUMNS})`)
        .eq("event_id", eventId)
        .order("published_at", { ascending: false })
        .limit(1),
      fetchCatalog(),
    ]);
    fail("getArticleForEvent", error);
    return hydrate(rows<ArticleJoin>(data), catalog)[0] ?? null;
  },
};

type ArticleJoin = ArticleRow & { events: EventRow | null };

function hydrate(list: ArticleJoin[], catalog: Catalog): ArticleWithContext[] {
  const withCtx = contextualizer(catalog);
  const orgById = new Map(catalog.organizations.map((o) => [o.id, o]));
  return (list ?? []).map((r) => ({
    ...toArticle(r),
    org: r.org_id ? orgById.get(r.org_id) ?? null : null,
    event: r.events ? withCtx(toEvent(r.events)) : null,
  }));
}

export type { Angler };
