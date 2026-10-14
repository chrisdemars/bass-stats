# Manual import data

MLF and NPFL are not scraped by this project:

- **MLF** (`majorleaguefishing.com`) sits entirely behind Cloudflare bot
  management — every path, including the homepage, returns HTTP 403 to a
  non-browser request. That's an active technical control. This project does
  not attempt to defeat bot detection to get around it.
- **NPFL** (`npfl.com`) publishes `robots.txt: Disallow: /` — a direct
  request not to be crawled, which `src/scrapers/core/http.ts` honours with
  no override available.

Instead, both adapters (`src/scrapers/mlf.ts`, `src/scrapers/npfl.ts`) read
files from this directory. If you have a legitimate way to get the data — a
personal export from your own browser session, an official data-sharing
arrangement with the organization, a licensed feed — drop it in here in the
shape below, and `npm run ingest -- --source=mlf --year=2026` picks it up
exactly like a live-scraped source: same upsert keys, same derived standings.

## Shape

```
src/scrapers/data/<org>/<year>/
  events.json            — SourceEvent[]
  results/<externalId>.json   — SourceResult[] for the event with that externalId
```

`events.json` is an array of `SourceEvent` (see `src/scrapers/core/types.ts`).
Each event needs at least:

```jsonc
{
  "externalId": "2026-bpt-guntersville",   // stable, unique within the org
  "seriesSlug": "bass-pro-tour",           // must match one of the adapter's series() slugs
  "year": 2026,
  "name": "2026 Bass Pro Tour at Lake Guntersville",
  "waterBody": "Lake Guntersville",
  "city": "Guntersville", "state": "AL", "country": "USA",
  "startDate": "2026-04-02", "endDate": "2026-04-07",
  "status": "official",                    // scheduled | in_progress | official
  "sourceUrl": "https://majorleaguefishing.com/..."
}
```

`results/<externalId>.json` is an array of `SourceResult`:

```jsonc
[
  {
    "firstName": "Jacob", "lastName": "Wheeler",
    "hometownCity": "Harrison", "hometownState": "TN",
    "place": 1,
    "anglerClass": "pro",
    "totalWeight": 212.5,     // decimal pounds — total across every scored fish
    "totalFish": 61,
    "points": 100,
    "payoutUsd": 100000,
    "days": [
      { "dayNumber": 1, "weight": 38.2, "fishCount": 11, "cumulativeWeight": 38.2 }
    ]
  }
]
```

Weights are decimal pounds throughout, matching every other source in this
project — see `src/scrapers/core/parse.ts` for conversion helpers if your
source material uses ounces or "lbs-oz" notation.

An `events.json` with zero events is a normal, supported state — the ingest
pipeline just reports nothing new for that org/year. `npm run data:years` (or
`manualYearsAvailable()` directly) lists which years currently have data.

The two example files in `mlf/2026/` and `npfl/2026/` are empty arrays `[]` —
placeholders showing where real exports go, not sample data. Nothing in this
project claims they contain a real result.
