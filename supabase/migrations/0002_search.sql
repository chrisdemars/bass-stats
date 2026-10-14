-- =============================================================================
-- Angler directory search.
--
-- The directory filters on identity (name, class, state, organization) but
-- sorts on career aggregates. Doing that round-trip in the app would mean
-- shipping every angler id back and forth, so it lives here instead.
-- =============================================================================

-- Which organizations has each angler actually competed in?
create view angler_orgs as
select distinct
  r.angler_id,
  o.slug as org_slug
from event_results r
join events  e on e.id = r.event_id
join seasons s on s.id = e.season_id
join series  sr on sr.id = s.series_id
join organizations o on o.id = sr.org_id;

create or replace function search_anglers(
  p_search text         default null,
  p_class  angler_class default null,
  p_state  text         default null,
  p_org    text         default null,
  p_sort   text         default 'earnings',
  p_limit  int          default 48,
  p_offset int          default 0
)
returns table (
  id              uuid,
  slug            text,
  first_name      text,
  last_name       text,
  display_name    text,
  nickname        text,
  hometown_city   text,
  hometown_state  text,
  country         text,
  birth_year      int,
  turned_pro      int,
  primary_class   angler_class,
  bio             text,
  photo_url       text,
  boat_sponsor    text,
  sponsors        text[],
  socials         jsonb,
  events          bigint,
  wins            bigint,
  top_10s         bigint,
  top_25s         bigint,
  avg_place       numeric,
  best_place      int,
  career_earnings numeric,
  career_weight   numeric,
  career_fish     bigint,
  biggest_bass    numeric,
  org_slugs       text[],
  total_count     bigint
)
language sql
stable
as $$
  with filtered as (
    select a.*, cs.*
    from anglers a
    join angler_career_stats cs on cs.angler_id = a.id
    where (p_search is null or p_search = ''
           or a.display_name ilike '%' || p_search || '%'
           or coalesce(a.hometown_city, '')  ilike '%' || p_search || '%'
           or coalesce(a.hometown_state, '') ilike '%' || p_search || '%')
      and (p_class is null or a.primary_class = p_class)
      and (p_state is null or a.hometown_state = p_state)
      and (p_org   is null or exists (
             select 1 from angler_orgs ao
             where ao.angler_id = a.id and ao.org_slug = p_org))
  ),
  counted as (select count(*) as n from filtered)
  select
    f.id, f.slug, f.first_name, f.last_name, f.display_name, f.nickname,
    f.hometown_city, f.hometown_state, f.country, f.birth_year, f.turned_pro,
    f.primary_class, f.bio, f.photo_url, f.boat_sponsor, f.sponsors, f.socials,
    f.events, f.wins, f.top_10s, f.top_25s, f.avg_place, f.best_place,
    f.career_earnings, f.career_weight, f.career_fish, f.biggest_bass,
    coalesce(
      (select array_agg(ao.org_slug order by ao.org_slug)
       from angler_orgs ao where ao.angler_id = f.id),
      '{}'::text[]
    ) as org_slugs,
    counted.n as total_count
  from filtered f, counted
  order by
    case when p_sort = 'name'     then 0 else 1 end,
    case when p_sort = 'name'     then f.last_name end asc,
    case when p_sort = 'wins'     then f.wins end desc,
    case when p_sort = 'events'   then f.events end desc,
    case when p_sort = 'earnings' then f.career_earnings end desc,
    f.display_name asc
  limit  greatest(p_limit, 0)
  offset greatest(p_offset, 0);
$$;

grant execute on function search_anglers to anon, authenticated;
