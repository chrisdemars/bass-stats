import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { isSupabaseConfigured } from "@/lib/env";
import { fixtureRepository } from "./fixture";
import { supabaseRepository } from "./supabase";
import type {
  AnglerFilter, Catalog, EventFilter, Repository,
} from "./repository";

/**
 * Public read API.
 *
 * Every function is a `"use cache"` entry point tagged so the ingest pipeline
 * can invalidate exactly what a scrape touched (see src/app/api/ingest/route.ts).
 * The repository underneath is Supabase when configured, the sample fixture
 * otherwise — callers never need to know which.
 */
const repo: Repository = isSupabaseConfigured ? supabaseRepository : fixtureRepository;

export const dataSource = repo.source;

export const tags = {
  catalog: "catalog",
  events: "events",
  event: (slug: string) => `event:${slug}`,
  leaderboard: (eventId: string) => `leaderboard:${eventId}`,
  standings: (seasonId: string) => `standings:${seasonId}`,
  anglers: "anglers",
  angler: (slug: string) => `angler:${slug}`,
  articles: "articles",
} as const;

export async function getCatalog(): Promise<Catalog> {
  "use cache";
  cacheTag(tags.catalog);
  cacheLife("hours");
  return repo.getCatalog();
}

export async function listEvents(filter: EventFilter = {}) {
  "use cache";
  cacheTag(tags.events);
  cacheLife("minutes");
  return repo.listEvents(filter);
}

export async function getEventBySlug(slug: string) {
  "use cache";
  cacheTag(tags.events, tags.event(slug));
  cacheLife("minutes");
  return repo.getEventBySlug(slug);
}

export async function getLeaderboard(eventId: string) {
  "use cache";
  cacheTag(tags.leaderboard(eventId));
  cacheLife("minutes");
  return repo.getLeaderboard(eventId);
}

export async function getWinners(eventIds: string[]) {
  "use cache";
  cacheTag(tags.events);
  cacheLife("minutes");
  return repo.getWinners(eventIds);
}

export async function getStandings(seasonId: string, divisionId?: string | null) {
  "use cache";
  cacheTag(tags.standings(seasonId));
  cacheLife("minutes");
  return repo.getStandings(seasonId, divisionId ?? null);
}

export async function listAnglers(filter: AnglerFilter = {}) {
  "use cache";
  cacheTag(tags.anglers);
  cacheLife("hours");
  return repo.listAnglers(filter);
}

export async function listAnglerStates() {
  "use cache";
  cacheTag(tags.anglers);
  cacheLife("hours");
  return repo.listAnglerStates();
}

export async function getAnglerBySlug(slug: string) {
  "use cache";
  cacheTag(tags.anglers, tags.angler(slug));
  cacheLife("hours");
  return repo.getAnglerBySlug(slug);
}

export async function getAnglerResults(anglerId: string) {
  "use cache";
  cacheTag(tags.anglers);
  cacheLife("hours");
  return repo.getAnglerResults(anglerId);
}

export async function getCareerStats(anglerId: string) {
  "use cache";
  cacheTag(tags.anglers);
  cacheLife("hours");
  return repo.getCareerStats(anglerId);
}

export async function listArticles(limit = 20) {
  "use cache";
  cacheTag(tags.articles);
  cacheLife("minutes");
  return repo.listArticles(limit);
}

export async function getArticleBySlug(slug: string) {
  "use cache";
  cacheTag(tags.articles);
  cacheLife("minutes");
  return repo.getArticleBySlug(slug);
}

export async function getFeaturedArticle() {
  "use cache";
  cacheTag(tags.articles);
  cacheLife("minutes");
  return repo.getFeaturedArticle();
}

export async function getArticleForEvent(eventId: string) {
  "use cache";
  cacheTag(tags.articles);
  cacheLife("minutes");
  return repo.getArticleForEvent(eventId);
}

export type { Catalog, EventFilter, AnglerFilter };
export type { AnglerListItem, EventWinner } from "./repository";
