-- =============================================================================
-- Angler directory: distinct hometown states.
--
-- The filter dropdown on /anglers only ever needs the short list of states
-- anglers actually have on file. Pulling that out of a full listAnglers()
-- call (which joins angler_career_stats across event_results for every row)
-- just to read one column off each got slow fast as the roster grew — it
-- timed out outright once the real dataset reached a couple thousand
-- anglers. A dedicated function with its own index-only scan stays cheap no
-- matter how large anglers gets.
-- =============================================================================

create or replace function list_angler_states()
returns table (state text)
language sql
stable
as $$
  select distinct hometown_state as state
  from anglers
  where hometown_state is not null and hometown_state <> ''
  order by 1;
$$;

grant execute on function list_angler_states to anon, authenticated;
