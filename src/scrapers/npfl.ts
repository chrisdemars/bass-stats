/**
 * NPFL (National Professional Fishing League) adapter.
 *
 * npfl.com's robots.txt is `User-agent: * / Disallow: /` — a direct,
 * unambiguous request not to be crawled, and this project honours it with no
 * override. This adapter makes no network requests at all; it reads
 * manually-supplied data from src/scrapers/data/npfl/<year>/, in the shape
 * documented in src/scrapers/data/README.md.
 */
import type { SourceAdapter, SourceSeries } from "./core/types";
import { loadManualEvents, loadManualResults, manualYearsAvailable } from "./core/manual-import";

const SERIES: SourceSeries[] = [
  {
    slug: "npfl-tour", name: "NPFL Tour", shortName: "NPFL Tour",
    level: "professional", format: "bag_limit_5",
    description: "A capped professional field, flat entry fees, and a payout table published before the season starts.",
  },
  {
    slug: "npfl-championship", name: "NPFL Championship", shortName: "Championship",
    level: "championship", format: "bag_limit_5",
    description: "The season-ending shootout for the NPFL's top points earners.",
  },
];

export const npflAdapter: SourceAdapter = {
  org: "npfl",
  label: "National Professional Fishing League",

  async series() {
    return SERIES;
  },

  async discover(year) {
    const available = await manualYearsAvailable("npfl");
    if (!available.includes(year)) return [];
    return loadManualEvents("npfl", year);
  },

  async results(event) {
    return loadManualResults("npfl", event);
  },
};
