import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  Angler, AnglerResultRow, ArticleWithContext, BassEvent, CareerStats, DataSet,
  EventResult, EventStatus, EventWithContext, LeaderboardRow, StandingRow,
} from "@/lib/types";
import {
  emptyCareerStats, matchesSearch,
  type AnglerFilter, type AnglerListItem, type Catalog, type EventFilter,
  type EventWinner, type Repository,
} from "./repository";

/**
 * In-memory repository over src/data/dataset.json.
 *
 * Read from disk rather than `import`ed so the 6 MB fixture never lands in a
 * bundle; it is parsed once per server process and indexed below.
 */
function loadDataSet(): DataSet {
  const path = join(process.cwd(), "src", "data", "dataset.json");
  return JSON.parse(readFileSync(path, "utf8")) as DataSet;
}

interface Index {
  data: DataSet;
  orgById: Map<string, DataSet["organizations"][number]>;
  seriesById: Map<string, DataSet["series"][number]>;
  divisionById: Map<string, DataSet["divisions"][number]>;
  seasonById: Map<string, DataSet["seasons"][number]>;
  eventById: Map<string, BassEvent>;
  eventBySlug: Map<string, BassEvent>;
  anglerById: Map<string, Angler>;
  anglerBySlug: Map<string, Angler>;
  resultsByEvent: Map<string, EventResult[]>;
  resultsByAngler: Map<string, EventResult[]>;
  standingsBySeason: Map<string, DataSet["standings"]>;
  careerByAngler: Map<string, CareerStats>;
  orgsByAngler: Map<string, Set<string>>;
}

let index: Index | null = null;

function buildIndex(): Index {
  const data = loadDataSet();
  const ix: Index = {
    data,
    orgById: new Map(data.organizations.map((o) => [o.id, o])),
    seriesById: new Map(data.series.map((s) => [s.id, s])),
    divisionById: new Map(data.divisions.map((d) => [d.id, d])),
    seasonById: new Map(data.seasons.map((s) => [s.id, s])),
    eventById: new Map(data.events.map((e) => [e.id, e])),
    eventBySlug: new Map(data.events.map((e) => [e.slug, e])),
    anglerById: new Map(data.anglers.map((a) => [a.id, a])),
    anglerBySlug: new Map(data.anglers.map((a) => [a.slug, a])),
    resultsByEvent: new Map(),
    resultsByAngler: new Map(),
    standingsBySeason: new Map(),
    careerByAngler: new Map(),
    orgsByAngler: new Map(),
  };

  const push = <T,>(m: Map<string, T[]>, k: string, v: T) => {
    const list = m.get(k);
    if (list) list.push(v);
    else m.set(k, [v]);
  };
  for (const r of data.results) {
    push(ix.resultsByEvent, r.eventId, r);
    push(ix.resultsByAngler, r.anglerId, r);
  }
  for (const s of data.standings) push(ix.standingsBySeason, s.seasonId, s);

  // Career aggregates + which organizations each angler has competed in.
  for (const [anglerId, rows] of ix.resultsByAngler) {
    const live = rows.filter((r) => r.status !== "did_not_fish");
    const places = live.map((r) => r.place).filter((p): p is number => p != null);
    ix.careerByAngler.set(anglerId, {
      anglerId,
      events: new Set(live.map((r) => r.eventId)).size,
      wins: places.filter((p) => p === 1).length,
      top10s: places.filter((p) => p <= 10).length,
      top25s: places.filter((p) => p <= 25).length,
      avgPlace: places.length
        ? Number((places.reduce((a, b) => a + b, 0) / places.length).toFixed(1))
        : null,
      bestPlace: places.length ? Math.min(...places) : null,
      careerEarnings: live.reduce((a, r) => a + (r.payoutUsd ?? 0), 0),
      careerWeight: Number(live.reduce((a, r) => a + (r.totalWeight ?? 0), 0).toFixed(2)),
      careerFish: live.reduce((a, r) => a + (r.totalFish ?? 0), 0),
      biggestBass: live.reduce<number | null>(
        (m, r) => (r.bigBass != null && (m == null || r.bigBass > m) ? r.bigBass : m), null),
    });

    const orgs = new Set<string>();
    for (const r of rows) {
      const ev = ix.eventById.get(r.eventId);
      if (!ev) continue;
      const season = ix.seasonById.get(ev.seasonId);
      const series = season && ix.seriesById.get(season.seriesId);
      const org = series && ix.orgById.get(series.orgId);
      if (org) orgs.add(org.slug);
    }
    ix.orgsByAngler.set(anglerId, orgs);
  }

  for (const rows of ix.resultsByEvent.values()) {
    rows.sort((a, b) => (a.place ?? 1e9) - (b.place ?? 1e9));
  }
  for (const rows of ix.standingsBySeason.values()) {
    rows.sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9));
  }
  return ix;
}

function getIndex(): Index {
  index ??= buildIndex();
  return index;
}

function withContext(ix: Index, e: BassEvent): EventWithContext | null {
  const season = ix.seasonById.get(e.seasonId);
  const series = season && ix.seriesById.get(season.seriesId);
  const org = series && ix.orgById.get(series.orgId);
  if (!season || !series || !org) return null;
  return {
    ...e, season, series, org,
    division: e.divisionId ? ix.divisionById.get(e.divisionId) ?? null : null,
  };
}

export const fixtureRepository: Repository = {
  source: "sample",

  async getCatalog(): Promise<Catalog> {
    const { data } = getIndex();
    return {
      organizations: [...data.organizations].sort((a, b) => a.sortOrder - b.sortOrder),
      series: [...data.series].sort((a, b) => a.sortOrder - b.sortOrder),
      divisions: [...data.divisions].sort((a, b) => a.sortOrder - b.sortOrder),
      seasons: [...data.seasons].sort((a, b) => b.year - a.year),
    };
  },

  async listEvents(filter: EventFilter = {}) {
    const ix = getIndex();
    const statuses: EventStatus[] | null = filter.status
      ? Array.isArray(filter.status) ? filter.status : [filter.status]
      : null;

    let rows = ix.data.events
      .map((e) => withContext(ix, e))
      .filter((e): e is EventWithContext => e !== null)
      .filter((e) => (filter.orgSlug ? e.org.slug === filter.orgSlug : true))
      .filter((e) => (filter.seriesSlug ? e.series.slug === filter.seriesSlug : true))
      .filter((e) => (filter.divisionSlug ? e.division?.slug === filter.divisionSlug : true))
      .filter((e) => (filter.level ? e.series.level === filter.level : true))
      .filter((e) => (filter.year ? e.season.year === filter.year : true))
      .filter((e) => (filter.state ? e.state === filter.state : true))
      .filter((e) => (statuses ? statuses.includes(e.status) : true))
      .filter((e) =>
        matchesSearch([e.name, e.waterBody, e.city, e.state, e.series.name, e.org.shortName],
          filter.search));

    const dir = filter.order === "upcoming" ? 1 : -1;
    rows.sort((a, b) => dir * (a.startDate ?? "").localeCompare(b.startDate ?? ""));
    if (filter.limit) rows = rows.slice(0, filter.limit);
    return rows;
  },

  async getEventBySlug(slug) {
    const ix = getIndex();
    const e = ix.eventBySlug.get(slug);
    return e ? withContext(ix, e) : null;
  },

  async getLeaderboard(eventId) {
    const ix = getIndex();
    return (ix.resultsByEvent.get(eventId) ?? [])
      .map((r) => {
        const angler = ix.anglerById.get(r.anglerId);
        return angler ? ({ ...r, angler } satisfies LeaderboardRow) : null;
      })
      .filter((r): r is LeaderboardRow => r !== null);
  },

  async getWinners(eventIds) {
    const ix = getIndex();
    const out: Record<string, EventWinner> = {};
    for (const id of eventIds) {
      // The first class listed for a series is the headline one (pro/boater).
      const board = ix.resultsByEvent.get(id) ?? [];
      const primary = board[0]?.anglerClass;
      const win = board.find((r) => r.place === 1 && r.anglerClass === primary);
      const angler = win && ix.anglerById.get(win.anglerId);
      if (!win || !angler) continue;
      out[id] = {
        eventId: id, anglerSlug: angler.slug, anglerName: angler.displayName,
        firstName: angler.firstName, lastName: angler.lastName,
        totalWeight: win.totalWeight, totalFish: win.totalFish,
        payoutUsd: win.payoutUsd,
      };
    }
    return out;
  },

  async getStandings(seasonId, divisionId = null) {
    const ix = getIndex();
    return (ix.standingsBySeason.get(seasonId) ?? [])
      .filter((s) => (divisionId ? s.divisionId === divisionId : true))
      .map((s) => {
        const angler = ix.anglerById.get(s.anglerId);
        return angler ? ({ ...s, angler } satisfies StandingRow) : null;
      })
      .filter((s): s is StandingRow => s !== null);
  },

  async listAnglers(filter: AnglerFilter = {}) {
    const ix = getIndex();
    const all = ix.data.anglers
      .filter((a) => (filter.anglerClass ? a.primaryClass === filter.anglerClass : true))
      .filter((a) => (filter.state ? a.hometownState === filter.state : true))
      .filter((a) =>
        filter.orgSlug ? ix.orgsByAngler.get(a.id)?.has(filter.orgSlug) ?? false : true)
      .filter((a) =>
        matchesSearch([a.displayName, a.hometownCity, a.hometownState, a.nickname],
          filter.search))
      .map<AnglerListItem>((angler) => ({
        angler,
        stats: ix.careerByAngler.get(angler.id) ?? emptyCareerStats(angler.id),
        orgSlugs: [...(ix.orgsByAngler.get(angler.id) ?? [])],
      }));

    const sort = filter.sort ?? "earnings";
    all.sort((a, b) => {
      switch (sort) {
        case "name": return a.angler.lastName.localeCompare(b.angler.lastName);
        case "wins": return b.stats.wins - a.stats.wins || b.stats.careerEarnings - a.stats.careerEarnings;
        case "events": return b.stats.events - a.stats.events;
        default: return b.stats.careerEarnings - a.stats.careerEarnings;
      }
    });

    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? all.length;
    return { items: all.slice(offset, offset + limit), total: all.length };
  },

  async getAnglerBySlug(slug) {
    return getIndex().anglerBySlug.get(slug) ?? null;
  },

  async getAnglerResults(anglerId) {
    const ix = getIndex();
    return (ix.resultsByAngler.get(anglerId) ?? [])
      .map((r) => {
        const base = ix.eventById.get(r.eventId);
        const event = base && withContext(ix, base);
        return event ? ({ ...r, event } satisfies AnglerResultRow) : null;
      })
      .filter((r): r is AnglerResultRow => r !== null)
      .sort((a, b) => (b.event.startDate ?? "").localeCompare(a.event.startDate ?? ""));
  },

  async getCareerStats(anglerId) {
    return getIndex().careerByAngler.get(anglerId) ?? emptyCareerStats(anglerId);
  },

  async listArticles(limit = 20) {
    const ix = getIndex();
    return ix.data.articles
      .slice()
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, limit)
      .map((a) => hydrateArticle(ix, a));
  },

  async getArticleBySlug(slug) {
    const ix = getIndex();
    const a = ix.data.articles.find((x) => x.slug === slug);
    return a ? hydrateArticle(ix, a) : null;
  },

  async getFeaturedArticle() {
    const ix = getIndex();
    const sorted = [...ix.data.articles].sort((a, b) =>
      b.publishedAt.localeCompare(a.publishedAt));
    const a = sorted.find((x) => x.featured) ?? sorted[0];
    return a ? hydrateArticle(ix, a) : null;
  },

  async getArticleForEvent(eventId) {
    const ix = getIndex();
    const a = ix.data.articles.find((x) => x.eventId === eventId);
    return a ? hydrateArticle(ix, a) : null;
  },
};

function hydrateArticle(ix: Index, a: DataSet["articles"][number]): ArticleWithContext {
  const base = a.eventId ? ix.eventById.get(a.eventId) : undefined;
  return {
    ...a,
    org: a.orgId ? ix.orgById.get(a.orgId) ?? null : null,
    event: base ? withContext(ix, base) : null,
  };
}
