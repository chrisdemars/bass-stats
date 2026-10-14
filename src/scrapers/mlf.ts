/**
 * Major League Fishing adapter.
 *
 * MLF's entire site sits behind Cloudflare bot management — every path,
 * including the homepage, returns HTTP 403 to a non-browser request. That is
 * an active technical control, independent of robots.txt (which itself
 * actually permits crawling outside /wp-admin/). This project does not
 * attempt to defeat bot detection, so this adapter makes no network requests
 * of its own; it reads manually-supplied data instead.
 *
 * To populate it, drop files under src/scrapers/data/mlf/<year>/ in the shape
 * documented in src/scrapers/data/README.md — from a personal browser export,
 * an official MLF data-sharing arrangement, or any other legitimate source
 * you have permission to use. The ingest pipeline then treats it exactly like
 * a live-scraped source: same upsert keys, same derived standings.
 */
import type { SourceAdapter, SourceSeries } from "./core/types";
import { loadManualEvents, loadManualResults, manualYearsAvailable } from "./core/manual-import";

const SERIES: SourceSeries[] = [
  {
    slug: "bass-pro-tour", name: "Bass Pro Tour", shortName: "BPT",
    level: "professional", format: "catch_weigh_release",
    description: "MLF's flagship: 80 anglers, no five-fish limit, every scorable bass counted on SCORETRACKER as it is caught.",
  },
  {
    slug: "tackle-warehouse-invitationals", name: "Tackle Warehouse Invitationals", shortName: "Invitationals",
    level: "professional", format: "bag_limit_5",
    description: "The direct qualifier to the Bass Pro Tour — traditional five-fish-limit events with a 150-angler field.",
  },
  {
    slug: "toyota-series", name: "Toyota Series", shortName: "Toyota Series",
    level: "semi_pro", format: "bag_limit_5",
    description: "Regional three-day events with a boater and co-angler division, feeding a year-end championship.",
  },
  {
    slug: "phoenix-bass-fishing-league", name: "Phoenix Bass Fishing League", shortName: "BFL",
    level: "amateur", format: "bag_limit_5",
    description: "The entry point to tournament bass fishing — regional divisions of one-day weekend events.",
  },
  {
    slug: "abu-garcia-college-fishing", name: "Abu Garcia College Fishing", shortName: "College",
    level: "college", format: "bag_limit_5",
    description: "Two-angler collegiate teams across four conferences and a national championship.",
  },
];

export const mlfAdapter: SourceAdapter = {
  org: "mlf",
  label: "Major League Fishing",

  async series() {
    return SERIES;
  },

  async discover(year) {
    const available = await manualYearsAvailable("mlf");
    if (!available.includes(year)) return [];
    return loadManualEvents("mlf", year);
  },

  async results(event) {
    return loadManualResults("mlf", event);
  },
};
