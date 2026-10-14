-- =============================================================================
-- bass-stats :: core schema
-- Tournament bass fishing standings across B.A.S.S., MLF, and the NPFL.
--
-- Shape of the world:
--   organization -> series -> (division) -> season -> event -> result -> day
--   angler       -> org profile (per-org identity) -> results -> standings
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------------
-- enums
-- ---------------------------------------------------------------------------
create type series_level as enum (
  'professional', 'semi_pro', 'amateur', 'championship', 'college', 'high_school', 'team'
);

create type scoring_format as enum (
  'bag_limit_5',          -- classic 5-fish limit, heaviest bag
  'bag_limit_3',
  'catch_weigh_release',  -- MLF: every scorable fish counts
  'total_weight',
  'points'
);

create type season_status as enum ('upcoming', 'in_progress', 'complete');

create type event_status as enum (
  'scheduled', 'in_progress', 'official', 'unofficial', 'cancelled', 'postponed'
);

create type angler_class as enum (
  'pro', 'boater', 'co_angler', 'amateur', 'college', 'high_school'
);

create type result_status as enum (
  'official', 'made_cut', 'missed_cut', 'dq', 'withdrew', 'did_not_fish'
);

create type article_type as enum ('recap', 'preview', 'analysis', 'news', 'feature');

create type ingest_status as enum ('running', 'success', 'partial', 'failed');

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
create table organizations (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  short_name    text not null,
  description   text,
  website       text,
  logo_url      text,
  primary_color text not null default '#0B1622',
  accent_color  text not null default '#E8472B',
  sort_order    int  not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- series  (Elite Series, Bass Pro Tour, NPFL Tour, Toyota Series, BFL, ...)
-- ---------------------------------------------------------------------------
create table series (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  slug        text not null unique,
  name        text not null,
  short_name  text,
  level       series_level not null default 'professional',
  format      scoring_format not null default 'bag_limit_5',
  description text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, name)
);
create index series_org_idx on series (org_id, sort_order);

-- ---------------------------------------------------------------------------
-- divisions (Opens East/Central/West, BFL Bulldog, Toyota Series Plains, ...)
-- ---------------------------------------------------------------------------
create table divisions (
  id         uuid primary key default gen_random_uuid(),
  series_id  uuid not null references series(id) on delete cascade,
  slug       text not null unique,
  name       text not null,
  region     text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (series_id, name)
);
create index divisions_series_idx on divisions (series_id, sort_order);

-- ---------------------------------------------------------------------------
-- seasons
-- ---------------------------------------------------------------------------
create table seasons (
  id         uuid primary key default gen_random_uuid(),
  series_id  uuid not null references series(id) on delete cascade,
  year       int  not null,
  name       text,
  status     season_status not null default 'upcoming',
  start_date date,
  end_date   date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (series_id, year)
);
create index seasons_year_idx on seasons (year desc);

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
create table events (
  id                uuid primary key default gen_random_uuid(),
  season_id         uuid not null references seasons(id) on delete cascade,
  division_id       uuid references divisions(id) on delete set null,
  slug              text not null unique,
  name              text not null,
  subtitle          text,
  water_body        text,                       -- "Lake Fork", "St. Lawrence River"
  city              text,
  state             text,                       -- two-letter where applicable
  country           text not null default 'USA',
  start_date        date,
  end_date          date,
  status            event_status not null default 'scheduled',
  format            scoring_format,
  days_scheduled    int,
  field_size        int,
  cut_to            int,                        -- field size after the cut
  purse_usd         numeric(12,2),
  winner_payout_usd numeric(12,2),
  points_multiplier numeric(5,2) not null default 1,
  cover_image_url   text,
  blurb             text,
  -- provenance
  source            text,                       -- 'bassmaster', 'mlf', 'npfl', 'manual'
  source_url        text,
  external_id       text,
  scraped_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (source, external_id)
);
create index events_season_idx  on events (season_id, start_date);
create index events_date_idx    on events (start_date desc);
create index events_status_idx  on events (status);

-- ---------------------------------------------------------------------------
-- anglers  (amateur through professional, one row per human)
-- ---------------------------------------------------------------------------
create table anglers (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  first_name     text not null,
  last_name      text not null,
  display_name   text generated always as (first_name || ' ' || last_name) stored,
  nickname       text,
  hometown_city  text,
  hometown_state text,
  country        text not null default 'USA',
  birth_year     int,
  turned_pro     int,
  primary_class  angler_class not null default 'pro',
  bio            text,
  photo_url      text,
  boat_sponsor   text,
  sponsors       text[] not null default '{}',
  socials        jsonb  not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index anglers_last_name_idx on anglers (last_name, first_name);
create index anglers_name_trgm_idx on anglers using gin (display_name gin_trgm_ops);
create index anglers_state_idx     on anglers (hometown_state);

-- Per-organization identity, so the same human can be matched across sources.
create table angler_org_profiles (
  id          uuid primary key default gen_random_uuid(),
  angler_id   uuid not null references anglers(id) on delete cascade,
  org_id      uuid not null references organizations(id) on delete cascade,
  external_id text,
  profile_url text,
  member_since int,
  created_at  timestamptz not null default now(),
  unique (org_id, external_id),
  unique (angler_id, org_id)
);

-- ---------------------------------------------------------------------------
-- results
-- ---------------------------------------------------------------------------
create table event_results (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references events(id) on delete cascade,
  angler_id      uuid not null references anglers(id) on delete cascade,
  place          int,
  status         result_status not null default 'official',
  angler_class   angler_class not null default 'pro',
  total_weight   numeric(7,2),       -- pounds
  total_fish     int,
  big_bass       numeric(5,2),
  points         numeric(7,2),
  payout_usd     numeric(12,2),
  day_count      int,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (event_id, angler_id, angler_class)
);
create index event_results_event_idx  on event_results (event_id, place);
create index event_results_angler_idx on event_results (angler_id);

create table event_result_days (
  id            uuid primary key default gen_random_uuid(),
  result_id     uuid not null references event_results(id) on delete cascade,
  day_number    int  not null,
  weight        numeric(6,2),
  fish_count    int,
  place         int,
  cumulative_weight numeric(7,2),
  unique (result_id, day_number)
);
create index event_result_days_result_idx on event_result_days (result_id, day_number);

-- ---------------------------------------------------------------------------
-- season standings (Angler of the Year races, division points races)
-- ---------------------------------------------------------------------------
create table season_standings (
  id            uuid primary key default gen_random_uuid(),
  season_id     uuid not null references seasons(id) on delete cascade,
  division_id   uuid references divisions(id) on delete cascade,
  angler_id     uuid not null references anglers(id) on delete cascade,
  rank          int,
  points        numeric(8,2),
  events_fished int not null default 0,
  wins          int not null default 0,
  top_10s       int not null default 0,
  total_weight  numeric(9,2),
  earnings_usd  numeric(12,2),
  is_aoy        boolean not null default false,
  qualified     boolean,              -- qualified for the championship
  updated_at    timestamptz not null default now(),
  unique (season_id, division_id, angler_id)
);
create index season_standings_rank_idx on season_standings (season_id, rank);

-- ---------------------------------------------------------------------------
-- editorial
-- ---------------------------------------------------------------------------
create table articles (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  type           article_type not null default 'recap',
  title          text not null,
  dek            text,
  body_md        text,
  hero_image_url text,
  hero_credit    text,
  author         text,
  org_id         uuid references organizations(id) on delete set null,
  event_id       uuid references events(id) on delete set null,
  angler_id      uuid references anglers(id) on delete set null,
  tags           text[] not null default '{}',
  featured       boolean not null default false,
  published_at   timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index articles_published_idx on articles (published_at desc);
create index articles_featured_idx  on articles (featured, published_at desc);

-- ---------------------------------------------------------------------------
-- ingest bookkeeping (one row per scraper run)
-- ---------------------------------------------------------------------------
create table ingest_runs (
  id            uuid primary key default gen_random_uuid(),
  source        text not null,
  target        text,
  status        ingest_status not null default 'running',
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  events_seen   int not null default 0,
  rows_upserted int not null default 0,
  message       text,
  error         text
);
create index ingest_runs_source_idx on ingest_runs (source, started_at desc);

-- ---------------------------------------------------------------------------
-- derived: career stats per angler
-- ---------------------------------------------------------------------------
create view angler_career_stats as
select
  a.id as angler_id,
  count(distinct r.event_id)                                          as events,
  count(*) filter (where r.place = 1)                                 as wins,
  count(*) filter (where r.place <= 10)                               as top_10s,
  count(*) filter (where r.place <= 25)                               as top_25s,
  round(avg(r.place)::numeric, 1)                                     as avg_place,
  min(r.place)                                                        as best_place,
  coalesce(sum(r.payout_usd), 0)                                      as career_earnings,
  coalesce(sum(r.total_weight), 0)                                    as career_weight,
  coalesce(sum(r.total_fish), 0)                                      as career_fish,
  max(r.big_bass)                                                     as biggest_bass
from anglers a
left join event_results r on r.angler_id = a.id and r.status <> 'did_not_fish'
group by a.id;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'organizations','series','seasons','events','anglers',
    'event_results','articles'
  ] loop
    execute format(
      'create trigger %I_set_updated_at before update on %I
         for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- row level security: the public reads, only the service role writes
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'organizations','series','divisions','seasons','events','anglers',
    'angler_org_profiles','event_results','event_result_days',
    'season_standings','articles'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I on %I for select to anon, authenticated using (true)',
      t || '_public_read', t);
  end loop;
end $$;

-- ingest_runs stays private: RLS on, no select policy => service role only.
alter table ingest_runs enable row level security;
