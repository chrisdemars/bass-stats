/**
 * The ingest orchestrator.
 *
 * Takes any SourceAdapter and upserts what it returns into Supabase, in the
 * order the schema requires: organization → series → divisions → season →
 * events → anglers → results → days. Season standings are recomputed last,
 * from whatever event_results now exist for that season — never trusted from
 * the source directly, so a source's own "standings" page (if it has one) is
 * never the thing this project stores.
 *
 * Every upsert keys on a natural key (org slug, series slug, event
 * external_id + source, angler name + hometown) so re-running an adapter
 * corrects existing rows instead of duplicating them.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminClient } from "@/lib/supabase/admin";
import { slugify } from "./parse";
import type {
  IngestOptions, IngestReport, RosterFilter, RosterReport,
  SourceAdapter, SourceAnglerProfile, SourceEvent, SourceResult,
} from "./types";
import type { AnglerClass } from "@/lib/types";

interface AnglerKey {
  id: string;
}

/** The identity fields shared by a result row and a roster profile — enough to find-or-create an angler. */
interface AnglerIdentity {
  externalId?: string | null;
  firstName: string;
  lastName: string;
  hometownCity?: string | null;
  hometownState?: string | null;
  country?: string;
  anglerClass?: AnglerClass;
}

/**
 * Finds or creates the angler an identity (a result row, a roster profile)
 * refers to.
 *
 * Matching is by source-specific external id first (strongest signal, once
 * an org_profile row exists for it), then by name + hometown state, which is
 * weak but the best available for a brand-new name. A name collision across
 * two different real people in the same state is the known failure mode;
 * nothing here claims to solve angler disambiguation definitively.
 */
async function resolveAngler(
  db: SupabaseClient,
  orgId: string,
  identity: AnglerIdentity,
): Promise<{ key: AnglerKey; created: boolean }> {
  if (identity.externalId) {
    const { data: existing } = await db
      .from("angler_org_profiles")
      .select("angler_id")
      .eq("org_id", orgId)
      .eq("external_id", identity.externalId)
      .maybeSingle();
    if (existing) return { key: { id: existing.angler_id as string }, created: false };
  }

  const firstName = identity.firstName.trim();
  const lastName = identity.lastName.trim();
  if (!firstName && !lastName) {
    throw new Error("No angler name given — cannot resolve or create an angler row.");
  }

  const { data: byName } = await db
    .from("anglers")
    .select("id, hometown_state")
    .eq("first_name", firstName)
    .eq("last_name", lastName);

  const match = (byName ?? []).find(
    (a) => !identity.hometownState || !a.hometown_state || a.hometown_state === identity.hometownState,
  );

  let anglerId: string;
  let created = false;

  if (match) {
    anglerId = match.id as string;
  } else {
    const baseSlug = slugify(`${firstName} ${lastName}`) || slugify(identity.externalId ?? "angler");
    let slug = baseSlug;
    for (let attempt = 1; ; attempt++) {
      const { data: taken } = await db.from("anglers").select("id").eq("slug", slug).maybeSingle();
      if (!taken) break;
      slug = `${baseSlug}-${attempt + 1}`;
    }

    const { data: inserted, error } = await db
      .from("anglers")
      .insert({
        slug, first_name: firstName, last_name: lastName,
        hometown_city: identity.hometownCity ?? null,
        hometown_state: identity.hometownState ?? null,
        country: identity.country ?? "USA",
        primary_class: identity.anglerClass ?? "pro",
      })
      .select("id")
      .single();
    if (error) throw new Error(`Failed to create angler ${firstName} ${lastName}: ${error.message}`);
    anglerId = inserted.id as string;
    created = true;
  }

  if (identity.externalId) {
    await db
      .from("angler_org_profiles")
      .upsert(
        { angler_id: anglerId, org_id: orgId, external_id: identity.externalId },
        { onConflict: "org_id,external_id" },
      );
  }

  return { key: { id: anglerId }, created };
}

async function ensureOrganization(db: SupabaseClient, slug: string): Promise<string> {
  const { data, error } = await db
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`organizations lookup failed: ${error.message}`);
  if (!data) {
    throw new Error(
      `Organization "${slug}" does not exist. Seed organizations before running ingest ` +
        `(see supabase/migrations/0001_init.sql or supabase/seed.sql).`,
    );
  }
  return data.id as string;
}

async function ensureSeries(
  db: SupabaseClient,
  orgId: string,
  adapter: SourceAdapter,
): Promise<Map<string, string>> {
  const bySlug = new Map<string, string>();
  for (const s of await adapter.series()) {
    const { data, error } = await db
      .from("series")
      .upsert(
        {
          org_id: orgId, slug: s.slug, name: s.name,
          short_name: s.shortName ?? s.name, level: s.level, format: s.format,
          description: s.description ?? null,
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single();
    if (error) throw new Error(`series upsert failed for ${s.slug}: ${error.message}`);
    bySlug.set(s.slug, data.id as string);
  }
  return bySlug;
}

async function ensureDivision(
  db: SupabaseClient,
  seriesId: string,
  name: string,
): Promise<string> {
  const slug = slugify(`${seriesId.slice(0, 8)}-${name}`);
  const { data: existing } = await db
    .from("divisions")
    .select("id")
    .eq("series_id", seriesId)
    .eq("name", name)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data, error } = await db
    .from("divisions")
    .insert({ series_id: seriesId, slug, name, region: name.replace(/ (Division|Regional)$/, "") })
    .select("id")
    .single();
  if (error) throw new Error(`division insert failed for ${name}: ${error.message}`);
  return data.id as string;
}

async function ensureSeason(db: SupabaseClient, seriesId: string, year: number): Promise<string> {
  const status = year < new Date().getUTCFullYear() ? "complete" : "in_progress";
  const { data, error } = await db
    .from("seasons")
    .upsert(
      { series_id: seriesId, year, name: String(year), status },
      { onConflict: "series_id,year", ignoreDuplicates: false },
    )
    .select("id")
    .single();
  if (error) throw new Error(`season upsert failed for ${year}: ${error.message}`);
  return data.id as string;
}

async function upsertEvent(
  db: SupabaseClient,
  source: string,
  seasonId: string,
  divisionId: string | null,
  event: SourceEvent,
): Promise<string> {
  const slug = slugify(`${event.year} ${event.name} ${event.waterBody ?? ""}`);
  const row = {
    season_id: seasonId, division_id: divisionId, slug,
    name: event.name, subtitle: event.subtitle ?? null,
    water_body: event.waterBody ?? null, city: event.city ?? null,
    state: event.state ?? null, country: event.country ?? "USA",
    start_date: event.startDate ?? null, end_date: event.endDate ?? null,
    status: event.status, format: event.format ?? null,
    days_scheduled: event.daysScheduled ?? null, field_size: event.fieldSize ?? null,
    cut_to: event.cutTo ?? null, purse_usd: event.purseUsd ?? null,
    winner_payout_usd: event.winnerPayoutUsd ?? null,
    blurb: event.blurb ?? null, source, source_url: event.sourceUrl ?? null,
    external_id: event.externalId, scraped_at: new Date().toISOString(),
  };
  const { data, error } = await db
    .from("events")
    .upsert(row, { onConflict: "source,external_id" })
    .select("id")
    .single();
  if (error) throw new Error(`event upsert failed for ${event.name}: ${error.message}`);
  return data.id as string;
}

async function writeResult(
  db: SupabaseClient,
  eventId: string,
  anglerId: string,
  result: SourceResult,
): Promise<void> {
  const row = {
    event_id: eventId, angler_id: anglerId,
    place: result.place ?? null, status: result.status ?? "official",
    angler_class: result.anglerClass ?? "pro",
    total_weight: result.totalWeight ?? null, total_fish: result.totalFish ?? null,
    big_bass: result.bigBass ?? null, points: result.points ?? null,
    payout_usd: result.payoutUsd ?? null, day_count: result.days?.length ?? null,
  };
  const { data, error } = await db
    .from("event_results")
    .upsert(row, { onConflict: "event_id,angler_id,angler_class" })
    .select("id")
    .single();
  if (error) throw new Error(`result upsert failed: ${error.message}`);

  if (result.days?.length) {
    const dayRows = result.days.map((d) => ({
      result_id: data.id, day_number: d.dayNumber, weight: d.weight ?? null,
      fish_count: d.fishCount ?? null, place: d.place ?? null,
      cumulative_weight: d.cumulativeWeight ?? null,
    }));
    const { error: dayError } = await db
      .from("event_result_days")
      .upsert(dayRows, { onConflict: "result_id,day_number" });
    if (dayError) throw new Error(`result day upsert failed: ${dayError.message}`);
  }
}

/**
 * Recomputes season_standings for one season from the event_results on file.
 *
 * Deletes and re-inserts rather than upserting: standings are fully derived
 * from event_results every time, never incrementally patched, and
 * `unique (season_id, division_id, angler_id)` doesn't dedupe reliably for
 * a non-divisional series anyway — Postgres treats NULL as never equal to
 * NULL in a unique constraint, so a series with no divisions (division_id
 * IS NULL for every row) would let `upsert` insert a fresh duplicate row
 * every single run instead of updating the existing one.
 */
async function recomputeStandings(db: SupabaseClient, seasonId: string): Promise<void> {
  const { data: seasonEvents, error: evErr } = await db
    .from("events")
    .select("id, division_id")
    .eq("season_id", seasonId);
  if (evErr) throw new Error(`standings recompute: event lookup failed: ${evErr.message}`);
  if (!seasonEvents?.length) return;

  const { error: clearError } = await db
    .from("season_standings")
    .delete()
    .eq("season_id", seasonId);
  if (clearError) throw new Error(`standings clear failed: ${clearError.message}`);

  const eventIds = seasonEvents.map((e) => e.id as string);
  const divisionByEvent = new Map(seasonEvents.map((e) => [e.id as string, e.division_id as string | null]));

  const { data: results, error: resErr } = await db
    .from("event_results")
    .select("event_id, angler_id, angler_class, place, points, total_weight, payout_usd")
    .in("event_id", eventIds);
  if (resErr) throw new Error(`standings recompute: results lookup failed: ${resErr.message}`);

  // One points race per (division, primary angler class) — co-anglers and
  // boaters race separately when a series has both.
  //
  // `points` is deliberately `number | null`, not defaulted to 0: a source
  // can supply real weight/payout data without ever supplying a real points
  // value (Bassmaster's live-scoring feed is exactly this case — BassTrakk
  // reports weights, not B.A.S.S.'s own Angler of the Year point formula,
  // which is computed and published separately). Treating "no points data"
  // as "zero points" would assert something false about every angler in
  // that race, so a bucket with no real points ranks by weight instead and
  // is never labeled "AOY" — that title specifically means won-on-points.
  const buckets = new Map<string, Map<string, {
    points: number | null; events: number; wins: number; top10s: number;
    weight: number; earnings: number;
  }>>();

  for (const r of results ?? []) {
    const divisionId = divisionByEvent.get(r.event_id as string) ?? null;
    const bucketKey = `${divisionId ?? "none"}:${r.angler_class}`;
    const bucket = buckets.get(bucketKey) ?? new Map();
    const cur = bucket.get(r.angler_id as string) ?? {
      points: null, events: 0, wins: 0, top10s: 0, weight: 0, earnings: 0,
    };
    if (r.points != null) cur.points = (cur.points ?? 0) + Number(r.points);
    cur.events += 1;
    if (r.place === 1) cur.wins += 1;
    if ((r.place ?? 999) <= 10) cur.top10s += 1;
    cur.weight += Number(r.total_weight ?? 0);
    cur.earnings += Number(r.payout_usd ?? 0);
    bucket.set(r.angler_id as string, cur);
    buckets.set(bucketKey, bucket);
  }

  for (const [bucketKey, bucket] of buckets) {
    const [divisionRaw] = bucketKey.split(":");
    const divisionId = divisionRaw === "none" ? null : divisionRaw;
    const ranked = [...bucket.entries()].sort(
      (a, b) => (b[1].points ?? -Infinity) - (a[1].points ?? -Infinity) || b[1].weight - a[1].weight,
    );
    const rows = ranked.map(([anglerId, v], i) => ({
      season_id: seasonId, division_id: divisionId, angler_id: anglerId,
      rank: i + 1, points: v.points, events_fished: v.events, wins: v.wins,
      top_10s: v.top10s, total_weight: v.weight, earnings_usd: Math.round(v.earnings),
      is_aoy: i === 0 && v.points != null,
      qualified: i < Math.max(3, Math.round(ranked.length * 0.35)),
    }));
    if (!rows.length) continue;
    const { error } = await db.from("season_standings").insert(rows);
    if (error) throw new Error(`standings insert failed: ${error.message}`);
  }
}

export async function runIngest(
  adapter: SourceAdapter,
  options: IngestOptions,
): Promise<IngestReport> {
  const log = options.log ?? (() => {});
  const db = getAdminClient();

  const report: IngestReport = {
    source: adapter.org, year: options.year, eventsSeen: 0, eventsWritten: 0,
    resultsWritten: 0, anglersCreated: 0, skipped: 0, errors: [],
  };

  log(`[${adapter.label}] resolving organization "${adapter.org}"…`);
  const orgId = await ensureOrganization(db, adapter.org);

  log(`[${adapter.label}] syncing series…`);
  const seriesBySlug = await ensureSeries(db, orgId, adapter);

  log(`[${adapter.label}] discovering ${options.year} events…`);
  let events = await adapter.discover(options.year);
  if (options.seriesSlug) events = events.filter((e) => e.seriesSlug === options.seriesSlug);
  if (options.limit) events = events.slice(0, options.limit);
  report.eventsSeen = events.length;
  log(`[${adapter.label}] ${events.length} event(s) to process.`);

  const touchedSeasons = new Set<string>();

  for (const event of events) {
    try {
      const seriesId = seriesBySlug.get(event.seriesSlug);
      if (!seriesId) {
        report.errors.push({ event: event.name, message: `Unknown series slug "${event.seriesSlug}"` });
        continue;
      }

      const seasonId = await ensureSeason(db, seriesId, event.year);
      touchedSeasons.add(seasonId);

      const divisionId = event.divisionName
        ? await ensureDivision(db, seriesId, event.divisionName)
        : null;

      if (options.skipExisting) {
        const { data: existing } = await db
          .from("events")
          .select("id")
          .eq("source", adapter.org)
          .eq("external_id", event.externalId)
          .maybeSingle();
        if (existing) {
          const { count } = await db
            .from("event_results")
            .select("id", { count: "exact", head: true })
            .eq("event_id", existing.id);
          if ((count ?? 0) > 0) {
            report.skipped += 1;
            continue;
          }
        }
      }

      if (options.dryRun) {
        log(`  [dry-run] would upsert event "${event.name}" (${event.externalId})`);
        report.eventsWritten += 1;
        continue;
      }

      const eventId = await upsertEvent(db, adapter.org, seasonId, divisionId, event);
      report.eventsWritten += 1;

      const results = await adapter.results(event);
      log(`  "${event.name}": ${results.length} result row(s)`);

      for (const result of results) {
        const { key, created } = await resolveAngler(db, orgId, {
          externalId: result.externalAnglerId,
          firstName: result.firstName, lastName: result.lastName,
          hometownCity: result.hometownCity, hometownState: result.hometownState,
          country: result.country, anglerClass: result.anglerClass,
        });
        if (created) report.anglersCreated += 1;
        await writeResult(db, eventId, key.id, result);
        report.resultsWritten += 1;
      }
    } catch (error) {
      report.errors.push({ event: event.name, message: (error as Error).message });
      log(`  ERROR on "${event.name}": ${(error as Error).message}`);
    }
  }

  if (!options.dryRun) {
    log(`[${adapter.label}] recomputing standings for ${touchedSeasons.size} season(s)…`);
    for (const seasonId of touchedSeasons) {
      try {
        await recomputeStandings(db, seasonId);
      } catch (error) {
        report.errors.push({ event: `season ${seasonId}`, message: (error as Error).message });
      }
    }
    await refreshCareerStats(db, log);
  }

  return report;
}

/**
 * angler_career_stats is a materialized view (see migration 0004) — fast to
 * read, but it only reflects reality as of its last refresh. A failed
 * refresh doesn't invalidate anything already written (events, results and
 * standings are all correct regardless), so it's logged rather than thrown:
 * worth knowing about, not worth discarding an otherwise-successful run over.
 */
async function refreshCareerStats(
  db: SupabaseClient,
  log: (message: string) => void,
): Promise<void> {
  log("Refreshing angler career stats…");
  const { error } = await db.rpc("refresh_angler_career_stats");
  if (error) log(`  WARNING: career stats refresh failed: ${error.message}`);
}

/**
 * Syncs angler *profiles* from a source's own directory — independent of any
 * event result, and the way to get "every angler," not just the ones who
 * happen to appear in events already ingested. Only an adapter that
 * implements the optional `roster()` method supports this.
 *
 * Existing anglers are enriched, never overwritten: a field already on file
 * (a photo, a bio) is left alone, since a later, thinner source should never
 * blank out something a richer one already supplied.
 */
export async function runRosterSync(
  adapter: SourceAdapter,
  filter: RosterFilter = {},
): Promise<RosterReport> {
  if (!adapter.roster) {
    throw new Error(`${adapter.label} has no angler directory to sync (adapter.roster is not implemented).`);
  }
  const log = filter.log ?? (() => {});
  const db = getAdminClient();

  const report: RosterReport = {
    source: adapter.org, scope: filter.scope ?? "(default)",
    profilesSeen: 0, anglersCreated: 0, anglersUpdated: 0, errors: [],
  };

  log(`[${adapter.label}] resolving organization "${adapter.org}"…`);
  const orgId = await ensureOrganization(db, adapter.org);

  log(`[${adapter.label}] fetching roster (scope: ${report.scope})…`);
  const profiles = await adapter.roster(filter);
  report.profilesSeen = profiles.length;
  log(`[${adapter.label}] ${profiles.length} profile(s) to process.`);

  for (const profile of profiles) {
    try {
      const { key, created } = await resolveAngler(db, orgId, {
        externalId: profile.externalId,
        firstName: profile.firstName, lastName: profile.lastName,
        hometownCity: profile.hometownCity, hometownState: profile.hometownState,
        country: profile.country, anglerClass: filter.defaultClass ?? profile.primaryClass,
      });
      if (created) report.anglersCreated += 1;
      else report.anglersUpdated += 1;

      await enrichAnglerProfile(db, key.id, profile);

      if (profile.externalId && profile.profileUrl) {
        await db
          .from("angler_org_profiles")
          .update({ profile_url: profile.profileUrl })
          .eq("org_id", orgId)
          .eq("external_id", profile.externalId);
      }
    } catch (error) {
      report.errors.push({
        profile: `${profile.firstName} ${profile.lastName}`.trim() || profile.externalId || "(unknown)",
        message: (error as Error).message,
      });
    }
  }

  // A roster sync can create brand-new angler rows the materialized view
  // has never seen, so a freshly-created angler's career stats page would
  // find no row at all until this refresh runs.
  if (report.anglersCreated > 0) await refreshCareerStats(db, log);

  return report;
}

/**
 * Fills in whatever profile fields the angler row doesn't already have.
 * Never clobbers an existing value — enrichment only adds, it doesn't
 * demote data a richer prior sync (or a human editor) already supplied.
 */
async function enrichAnglerProfile(
  db: SupabaseClient,
  anglerId: string,
  profile: SourceAnglerProfile,
): Promise<void> {
  const { data: current, error } = await db
    .from("anglers")
    .select("hometown_city, hometown_state, photo_url, bio, boat_sponsor, sponsors, socials, turned_pro")
    .eq("id", anglerId)
    .single();
  if (error) throw new Error(`Failed to read angler ${anglerId} before enrichment: ${error.message}`);

  const patch: Record<string, unknown> = {};
  if (!current.hometown_city && profile.hometownCity) patch.hometown_city = profile.hometownCity;
  if (!current.hometown_state && profile.hometownState) patch.hometown_state = profile.hometownState;
  if (!current.photo_url && profile.photoUrl) patch.photo_url = profile.photoUrl;
  if (!current.bio && profile.bio) patch.bio = profile.bio;
  if (!current.boat_sponsor && profile.boatSponsor) patch.boat_sponsor = profile.boatSponsor;
  if (!current.turned_pro && profile.turnedPro) patch.turned_pro = profile.turnedPro;
  if (!(current.sponsors as string[] | null)?.length && profile.sponsors?.length) {
    patch.sponsors = profile.sponsors;
  }
  if (profile.socials && Object.keys(profile.socials).length) {
    // Socials merge per-key rather than all-or-nothing, so a Facebook link
    // from one pass survives an Instagram link added by a later one.
    const merged = { ...(current.socials as Record<string, string> | null), ...profile.socials };
    if (JSON.stringify(merged) !== JSON.stringify(current.socials ?? {})) patch.socials = merged;
  }

  if (Object.keys(patch).length === 0) return;
  const { error: updateError } = await db.from("anglers").update(patch).eq("id", anglerId);
  if (updateError) throw new Error(`Failed to enrich angler ${anglerId}: ${updateError.message}`);
}
