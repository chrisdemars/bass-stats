# bass-stats

Standings, results and angler records across every series run by
Bassmaster (B.A.S.S.), Major League Fishing, and the National Professional
Fishing League — one schema, one site.

Next.js 16 (App Router, Cache Components), React 19, Tailwind 4, Supabase.

## Quick start

```bash
npm install
npm run data:generate   # builds src/data/dataset.json (safe to skip — it's committed)
npm run dev
```

With no Supabase environment variables set, the app runs entirely on the
bundled **sample dataset**: real organizations, series, divisions and
fisheries, but **fictional anglers and results** — see
[`/about-the-data`](src/app/about-the-data/page.tsx) and the banner the site
shows whenever it's serving this fixture. This is what makes `npm run dev`
work immediately on a fresh clone with no setup.

## Pointing it at Supabase

```bash
cp .env.example .env
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY
```

Apply the schema (via the Supabase CLI, or paste the SQL into the dashboard's
SQL editor):

```bash
supabase link --project-ref <your-project-ref>
supabase db push          # runs supabase/migrations/*.sql
```

The app automatically switches to live queries the moment
`NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set
(`src/lib/env.ts`). The database starts empty — see **Ingest** below to fill
it with real results.

## Architecture

```
src/
  lib/
    types.ts            domain types the whole app codes against
    data/
      repository.ts      the Repository interface (one, swappable implementation)
      fixture.ts          reads src/data/dataset.json
      supabase.ts         live Postgres queries
      index.ts            public API — "use cache" wrappers, cache tags
    supabase/              typed row shapes + mappers, client factories
  components/              UI, grouped by domain (events/, anglers/, standings/, ...)
  app/                     routes
  scrapers/
    core/                  adapter contract, HTTP client, parsing helpers, the
                           ingest orchestrator that upserts into Supabase
    bassmaster.ts          live adapter — Bassmaster's public JSON API
    mlf.ts, npfl.ts        manual-import adapters (see below)
    data/                  where manual-import files live
supabase/
  migrations/              schema + RLS policies
  seed.sql                 generated alongside the JSON fixture
scripts/
  generate-dataset.ts      the one generator that produces both
                           src/data/dataset.json and supabase/seed.sql
  ingest.ts                CLI for src/scrapers/core/ingest.ts
```

Every page reads through `src/lib/data/index.ts`, never through the fixture
or Supabase client directly — swapping data sources never touches a
component.

## Ingest

Two independent things to pull in: **event results** (an event, its
leaderboard, tied to whichever anglers fished it) and **angler profiles**
(hometown, photo, socials — independent of any event, from a source's own
directory). You generally want both.

```bash
# Event results
npm run ingest -- --source=bassmaster --year=2026
npm run ingest -- --source=bassmaster --year=2026 --series=bassmaster-elite --dry-run
npm run ingest -- --source=mlf --year=2026 --skip-existing

# Angler profiles — real hometowns, photos, socials, independent of events
npm run ingest -- --source=bassmaster --roster --scope=elite      # current Elite Series field (~100)
npm run ingest -- --source=bassmaster --roster --scope=angler --state=TX --limit=500
```

Requires `SUPABASE_SERVICE_ROLE_KEY` — this writes with the service role, so
it only ever runs from an operator's machine or a scheduled job, never in the
browser. The same logic is exposed as `POST /api/ingest` (guarded by
`INGEST_SECRET`) for a cron trigger.

### Sources

**Bassmaster** is a live scrape against B.A.S.S.'s own public JSON API
(`wp-json/wp/v2/tournament`, `wp-json/data/v1/tournament/basstrakk/leaderboard`
— verified against the live site; `robots.txt` permits it). It pulls the
BassTrakk live-scoring feed, which can differ from a corrected official sheet
by a late penalty; re-running the ingest after an event is finalized picks up
any correction, since every row upserts on its natural key.

It also has a `roster()` method, pulling Bassmaster's own angler directory
(`wp-json/bassmaster/v1/persons`) — real hometowns, a working photo URL, and
social links, independent of any tournament result. `--scope=elite` is the
current ~100-angler Elite Series field; `--scope=angler` is every angler
B.A.S.S. has ever tagged as one, 75,000+ records back to 1968 (use `--state`,
`--keyword`, or `--limit` to bound a run). Enrichment never overwrites a
field an angler row already has, so running this alongside event ingest is
safe in either order.

**MLF and NPFL are not scraped.** MLF's entire site sits behind Cloudflare
bot management (every path, including the homepage, returns 403 to a
non-browser request) — an active technical control this project does not
attempt to defeat. NPFL's `robots.txt` is a flat `Disallow: /`, which the
HTTP client in `src/scrapers/core/http.ts` refuses with no override. Both
adapters instead read manually-supplied files from
`src/scrapers/data/<org>/<year>/` — see
[`src/scrapers/data/README.md`](src/scrapers/data/README.md) for the exact
shape. Drop in data you have a legitimate way to get (a personal export, an
official data-sharing arrangement) and the ingest pipeline treats it exactly
like a live-scraped source.

Adding a fourth source means writing one file that implements
`SourceAdapter` (`src/scrapers/core/types.ts`) — discover a season's events,
fetch one event's results, done. Everything downstream (angler matching,
season standings, the points races) is derived automatically.

## Design

Dark by default — the look of a tournament broadcast graphics package:
deep water-blue surfaces, a hot accent for live/leading states, a condensed
display face over a workhorse UI sans, tabular numerals on every weight and
placement. Tokens live in `src/app/globals.css`; `data-theme="light"` on
`<html>` switches the palette (toggle in the header, no flash on load).

Weights display pounds-ounces (`21-6`), matching how every scoreboard in the
sport writes them; the underlying value is always decimal pounds
(`src/lib/format.ts`).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run data:generate` | Regenerate the sample fixture + `supabase/seed.sql` |
| `npm run ingest -- --source=<org> --year=YYYY` | Run a scrape/import into Supabase |

## Disclosure

This project is independent and has no affiliation with B.A.S.S., Major
League Fishing, or the National Professional Fishing League.
