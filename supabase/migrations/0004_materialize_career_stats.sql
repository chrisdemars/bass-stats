-- =============================================================================
-- Angler career stats: view -> materialized view.
--
-- angler_career_stats was a plain VIEW, so every read recomputed the full
-- aggregation — a LEFT JOIN + GROUP BY across every angler and every
-- event_result — from scratch. Fine at a few hundred rows; at the real
-- Bassmaster season's scale (2,373 anglers, 5,692 results) it timed out
-- outright on the angler directory's own listing page, not just an
-- incidental query. Materializing it turns every read into an index-only
-- lookup; the cost of computing the aggregate moves to one explicit refresh
-- after each ingest run instead of being paid again on every page view.
-- =============================================================================

-- Covers both a fresh database (where this is still the plain view from
-- migration 0001) and re-running this migration after it's already been
-- applied once (where it's already a materialized view). `IF EXISTS` only
-- suppresses "doesn't exist" — it still errors on "exists, but is the
-- wrong kind of relation" (DROP VIEW on a matview, or vice versa), so each
-- attempt catches and swallows that specific error rather than the two
-- statements being able to rely on IF EXISTS alone.
do $$ begin
  execute 'drop view if exists angler_career_stats';
exception when wrong_object_type then null;
end $$;

do $$ begin
  execute 'drop materialized view if exists angler_career_stats';
exception when wrong_object_type then null;
end $$;

create materialized view angler_career_stats as
select
  a.id as angler_id,
  count(distinct r.event_id)                                          as events,
  count(*) filter (where r.place = 1)                                 as wins,
  count(*) filter (where r.place <= 10)                               as top_10s,
  count(*) filter (where r.place <= 25)                               as top_25s,
  round(avg(r.place)::numeric, 1)                                     as avg_place,
  min(r.place)                                                        as best_place,
  -- Deliberately not coalesced: sum() of an all-NULL column is SQL NULL,
  -- which is exactly right here. Bassmaster's live-scoring feed never
  -- reports payouts at all, so every Bassmaster-only angler's payout_usd is
  -- null on every row — coalescing that to 0 would assert "earned nothing
  -- across their whole career" when the true fact is "no payout data for
  -- this angler from any source." total_weight and total_fish don't have
  -- this problem (Bassmaster does report both), so those stay coalesced to
  -- a true zero for an angler with results but no scored weight/fish.
  sum(r.payout_usd)                                                   as career_earnings,
  coalesce(sum(r.total_weight), 0)                                    as career_weight,
  coalesce(sum(r.total_fish), 0)                                      as career_fish,
  max(r.big_bass)                                                     as biggest_bass
from anglers a
left join event_results r on r.angler_id = a.id and r.status <> 'did_not_fish'
group by a.id;

-- REFRESH ... CONCURRENTLY (used below) requires a unique index to exist.
-- It costs more than a plain refresh but doesn't lock the view against
-- concurrent reads while it runs — worth it so an ingest in progress never
-- makes the live site's angler pages unavailable.
create unique index angler_career_stats_angler_id_idx on angler_career_stats (angler_id);

-- Materialized views don't inherit RLS from their base tables the way a
-- plain view does (a plain view re-runs its query, under the querying
-- role's RLS, every time; a materialized view is a static snapshot with its
-- own independent grants). There is nothing row-sensitive in this fully
-- public, fully derived aggregate, so a direct grant is the equivalent of
-- the "public read" policy every base table already carries.
grant select on angler_career_stats to anon, authenticated;

-- The one thing allowed to write here: the ingest pipeline, after it
-- finishes a run, via the service role. Not exposed to anon/authenticated —
-- letting any visitor with the public anon key trigger a refresh on demand
-- would be a cheap way to hammer the database.
create or replace function refresh_angler_career_stats() returns void
language plpgsql security definer as $$
begin
  refresh materialized view concurrently angler_career_stats;
end;
$$;

grant execute on function refresh_angler_career_stats to service_role;
