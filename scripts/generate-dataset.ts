/**
 * Deterministic sample-dataset generator.
 *
 * Emits two artifacts from one definition:
 *   - src/data/dataset.json  : the fixture the app falls back to with no Supabase
 *   - supabase/seed.sql      : the same rows, for `supabase db reset` / psql
 *
 * The *structure* here is real: these are the actual organizations, series,
 * divisions and fisheries of competitive bass fishing. The *anglers and results
 * are fabricated* — plausible fictional names and numbers so the UI has
 * something to render before the scrapers in src/scrapers/ fill the real thing
 * in. No real person's name is attached to an invented result.
 *
 * Run: npm run data:generate
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import type {
  Angler, AnglerClass, Article, BassEvent, DataSet, Division, EventResult,
  Organization, ResultDay, ScoringFormat, Season, Series, SeriesLevel,
} from "../src/lib/types";

// ---------------------------------------------------------------------------
// deterministic randomness
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(0x6261_7373); // "bass"

const rand = () => rnd();
const randInt = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
const randFloat = (lo: number, hi: number, dp = 2) =>
  Number((lo + rand() * (hi - lo)).toFixed(dp));
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];

/** Stable UUIDs so regenerating the dataset doesn't churn every id. */
let uuidCounter = 0;
function uuid(): string {
  const hex = (n: number) =>
    Array.from({ length: n }, () => "0123456789abcdef"[Math.floor(rand() * 16)]).join("");
  uuidCounter++;
  return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
}

const slugify = (s: string) =>
  s.toLowerCase().replace(/['’.]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: string, n: number) => {
  const x = new Date(d + "T12:00:00Z");
  x.setUTCDate(x.getUTCDate() + n);
  return iso(x);
};

// ---------------------------------------------------------------------------
// organizations
// ---------------------------------------------------------------------------
const ORGS: Array<Omit<Organization, "id">> = [
  {
    slug: "bassmaster",
    name: "Bass Anglers Sportsman Society",
    shortName: "Bassmaster",
    description:
      "Founded in 1968, B.A.S.S. runs the Bassmaster Elite Series, the Opens, and the sport's defining championship — the Bassmaster Classic.",
    website: "https://www.bassmaster.com",
    primaryColor: "#0B1622",
    accentColor: "#E8472B",
    sortOrder: 1,
  },
  {
    slug: "mlf",
    name: "Major League Fishing",
    shortName: "MLF",
    description:
      "Home of the catch-weigh-immediately-release format, the Bass Pro Tour, the Invitationals, the Toyota Series and the grassroots Phoenix Bass Fishing League.",
    website: "https://majorleaguefishing.com",
    primaryColor: "#0A1A2F",
    accentColor: "#1FA2E0",
    sortOrder: 2,
  },
  {
    slug: "npfl",
    name: "National Professional Fishing League",
    shortName: "NPFL",
    description:
      "An angler-first professional tour founded in 2021 on a flat entry fee, a capped field, and a published payout table.",
    website: "https://npfl.com",
    primaryColor: "#14241A",
    accentColor: "#C8A227",
    sortOrder: 3,
  },
];

// ---------------------------------------------------------------------------
// series + divisions
// ---------------------------------------------------------------------------
interface SeriesDef {
  org: string;
  name: string;
  shortName: string;
  level: SeriesLevel;
  format: ScoringFormat;
  description: string;
  divisions?: string[];
  /** anglers in a typical field */
  field: number;
  /** [firstMonth, lastMonth] the series runs, 1-indexed */
  months: [number, number];
  days: number;
  cutTo?: number;
  purse: number;
  winner: number;
  classes: AnglerClass[];
}

const SERIES: SeriesDef[] = [
  {
    org: "bassmaster", name: "Bassmaster Elite Series", shortName: "Elite Series",
    months: [2, 9],
    level: "professional", format: "bag_limit_5",
    description: "The top rung at B.A.S.S. — roughly 100 of the best boaters in the world over an eight- or nine-event season, racing for Angler of the Year and a Classic berth.",
    field: 100, days: 4, cutTo: 50, purse: 1_000_000, winner: 100_000, classes: ["pro"],
  },
  {
    org: "bassmaster", name: "Bassmaster Open Series", shortName: "Opens",
    months: [2, 10],
    level: "semi_pro", format: "bag_limit_5",
    description: "The qualifying path to the Elites. Fish one division or fish them all; the top finishers earn Elite invitations.",
    divisions: ["Eastern Division", "Central Division", "Western Division"],
    field: 200, days: 3, cutTo: 10, purse: 350_000, winner: 55_000, classes: ["boater", "co_angler"],
  },
  {
    org: "bassmaster", name: "Bassmaster Classic", shortName: "Classic",
    months: [3, 3],
    level: "championship", format: "bag_limit_5",
    description: "The world championship of bass fishing. Roughly 55 qualifiers, three days, one trophy.",
    field: 55, days: 3, purse: 1_000_000, winner: 300_000, classes: ["pro"],
  },
  {
    org: "bassmaster", name: "B.A.S.S. Nation", shortName: "Nation",
    months: [10, 11],
    level: "amateur", format: "bag_limit_5",
    description: "The grassroots club circuit — state federations feeding regional championships and a shot at the Classic.",
    divisions: ["Northern Regional", "Southern Regional", "Central Regional", "Western Regional"],
    field: 120, days: 3, purse: 60_000, winner: 10_000, classes: ["amateur", "co_angler"],
  },
  {
    org: "bassmaster", name: "Bassmaster College Series", shortName: "College",
    months: [4, 8],
    level: "college", format: "bag_limit_5",
    description: "Two-angler university teams fishing for a national title and a Classic berth for the winner.",
    field: 150, days: 3, purse: 0, winner: 0, classes: ["college"],
  },
  {
    org: "bassmaster", name: "Bassmaster High School Series", shortName: "High School",
    months: [5, 8],
    level: "high_school", format: "bag_limit_5",
    description: "Two-angler high school teams with a boat captain, fishing state and national events.",
    field: 180, days: 2, purse: 0, winner: 0, classes: ["high_school"],
  },
  {
    org: "mlf", name: "Bass Pro Tour", shortName: "BPT",
    months: [2, 8],
    level: "professional", format: "catch_weigh_release",
    description: "MLF's flagship: 80 anglers, no five-fish limit, every scorable bass counts on SCORETRACKER as it is caught.",
    field: 80, days: 6, cutTo: 20, purse: 805_000, winner: 100_000, classes: ["pro"],
  },
  {
    org: "mlf", name: "Tackle Warehouse Invitationals", shortName: "Invitationals",
    months: [1, 10],
    level: "professional", format: "bag_limit_5",
    description: "The direct qualifier to the Bass Pro Tour — traditional five-fish-limit events with a 150-angler field.",
    field: 150, days: 4, cutTo: 30, purse: 400_000, winner: 60_000, classes: ["pro"],
  },
  {
    org: "mlf", name: "Toyota Series", shortName: "Toyota Series",
    months: [3, 9],
    level: "semi_pro", format: "bag_limit_5",
    description: "Regional three-day events with a boater and co-angler division, feeding a year-end championship.",
    divisions: ["Central Division", "Northern Division", "Plains Division", "Southeastern Division", "Southwestern Division", "Western Division"],
    field: 200, days: 3, cutTo: 10, purse: 235_000, winner: 35_000, classes: ["boater", "co_angler"],
  },
  {
    org: "mlf", name: "Phoenix Bass Fishing League", shortName: "BFL",
    months: [3, 10],
    level: "amateur", format: "bag_limit_5",
    description: "The entry point to tournament bass fishing — 24 regional divisions of one-day weekend events.",
    divisions: ["Bulldog Division", "Gator Division", "Hoosier Division", "Ozark Division", "Shenandoah Division", "Cowboy Division"],
    field: 160, days: 1, purse: 45_000, winner: 6_000, classes: ["boater", "co_angler"],
  },
  {
    org: "mlf", name: "Abu Garcia College Fishing", shortName: "College",
    months: [3, 10],
    level: "college", format: "bag_limit_5",
    description: "Two-angler collegiate teams across four conferences and a national championship.",
    field: 120, days: 2, purse: 0, winner: 0, classes: ["college"],
  },
  {
    org: "npfl", name: "NPFL Tour", shortName: "NPFL Tour",
    months: [3, 9],
    level: "professional", format: "bag_limit_5",
    description: "A capped 120-boat professional field, flat entry fees, and a payout table published before the season starts.",
    field: 120, days: 3, cutTo: 30, purse: 450_000, winner: 60_000, classes: ["pro"],
  },
  {
    org: "npfl", name: "NPFL Championship", shortName: "Championship",
    months: [11, 11],
    level: "championship", format: "bag_limit_5",
    description: "The season-ending shootout for the NPFL's top points earners.",
    field: 40, days: 3, purse: 300_000, winner: 100_000, classes: ["pro"],
  },
];

// ---------------------------------------------------------------------------
// fisheries — real water, real towns
// ---------------------------------------------------------------------------
const WATERS: Array<[string, string, string]> = [
  ["Lake Fork", "Quitman", "TX"], ["Sam Rayburn Reservoir", "Brookeland", "TX"],
  ["Toledo Bend", "Many", "LA"], ["Lake Guntersville", "Guntersville", "AL"],
  ["Pickwick Lake", "Florence", "AL"], ["Lake Eufaula", "Eufaula", "AL"],
  ["Smith Lake", "Cullman", "AL"], ["Lay Lake", "Columbiana", "AL"],
  ["Santee Cooper Lakes", "Summerton", "SC"], ["Lake Hartwell", "Anderson", "SC"],
  ["Lake Murray", "Columbia", "SC"], ["Clarks Hill Lake", "Appling", "GA"],
  ["Lake Lanier", "Gainesville", "GA"], ["Lake Seminole", "Bainbridge", "GA"],
  ["Lake Okeechobee", "Clewiston", "FL"], ["Harris Chain of Lakes", "Leesburg", "FL"],
  ["St. Johns River", "Palatka", "FL"], ["Kissimmee Chain", "Kissimmee", "FL"],
  ["Lake Champlain", "Plattsburgh", "NY"], ["St. Lawrence River", "Clayton", "NY"],
  ["Oneida Lake", "Syracuse", "NY"], ["Cayuga Lake", "Union Springs", "NY"],
  ["Lake Erie", "Sandusky", "OH"], ["Lake St. Clair", "Detroit", "MI"],
  ["Mississippi River", "La Crosse", "WI"], ["Lake Mille Lacs", "Isle", "MN"],
  ["Table Rock Lake", "Branson", "MO"], ["Lake of the Ozarks", "Osage Beach", "MO"],
  ["Grand Lake O' the Cherokees", "Grove", "OK"], ["Lake Tenkiller", "Vian", "OK"],
  ["Kentucky Lake", "Paris", "TN"], ["Chickamauga Lake", "Dayton", "TN"],
  ["Douglas Lake", "Dandridge", "TN"], ["Cherokee Lake", "Jefferson City", "TN"],
  ["Lake Chatuge", "Hiawassee", "GA"], ["Potomac River", "Marbury", "MD"],
  ["James River", "Richmond", "VA"], ["Lake Norman", "Mooresville", "NC"],
  ["High Rock Lake", "Lexington", "NC"], ["Clear Lake", "Lakeport", "CA"],
  ["California Delta", "Oakley", "CA"], ["Lake Havasu", "Lake Havasu City", "AZ"],
  ["Lake Mead", "Boulder City", "NV"], ["Columbia River", "The Dalles", "OR"],
  ["Lake Travis", "Austin", "TX"], ["Falcon Lake", "Zapata", "TX"],
  ["Caddo Lake", "Karnack", "TX"], ["Red River", "Shreveport", "LA"],
  ["Lake Dardanelle", "Russellville", "AR"], ["Bull Shoals Lake", "Flippin", "AR"],
];
let waterCursor = 0;
const nextWater = () => WATERS[waterCursor++ % WATERS.length];

// ---------------------------------------------------------------------------
// fictional anglers
// ---------------------------------------------------------------------------
const FIRST = [
  "Cole","Brant","Wes","Dalton","Rhett","Travis","Kyle","Garrett","Brody","Chase",
  "Marcus","Devin","Jaxon","Trey","Logan","Hunter","Easton","Beau","Cash","Ridge",
  "Tanner","Kellan","Drew","Grady","Nolan","Austin","Blaine","Carson","Dax","Emmett",
  "Finn","Gage","Heath","Isaac","Jonah","Keaton","Lane","Mason","Nash","Owen",
  "Porter","Quinn","Reed","Sawyer","Tate","Vance","Weston","Zane","Avery","Blake",
  "Dana","Harper","Jordan","Kendall","Morgan","Payton","Riley","Shea","Taylor","Hollis",
];
const LAST = [
  "Marchetti","Vandergriff","Holloway","Prewitt","Calhoun","Rasmussen","Delacroix","Whitlock",
  "Brennan","Castillo","Dupree","Eastwood","Falkner","Granger","Hardwick","Ingalls",
  "Jessup","Kirkland","Lindqvist","Mercer","Novak","Oakley","Pemberton","Quillen",
  "Radford","Sandoval","Thibodeaux","Underwood","Valdez","Westbrook","Yeager","Zamora",
  "Ashcroft","Boudreaux","Coffey","Driscoll","Ellison","Fontaine","Gentry","Hollister",
  "Iverson","Jennings","Kowalski","Langston","Mathis","Norwood","Ortega","Paxton",
  "Rutherford","Shelby","Tolliver","Vargas","Winslow","Yarbrough","Alcott","Birdsong",
  "Crowder","Dennison","Everhart","Fairchild",
];
const STATES: Array<[string, string[]]> = [
  ["AL", ["Guntersville", "Dothan", "Huntsville"]], ["TX", ["Tyler", "Conroe", "Del Rio"]],
  ["FL", ["Palatka", "Okeechobee", "Tavares"]], ["SC", ["Anderson", "Chapin", "Sumter"]],
  ["TN", ["Dayton", "Knoxville", "Paris"]], ["MO", ["Branson", "Warsaw", "Nixa"]],
  ["CA", ["Clearlake", "Oakley", "Redding"]], ["NY", ["Clayton", "Waddington", "Auburn"]],
  ["MI", ["Monroe", "Clinton Township"]], ["OK", ["Grove", "Broken Bow"]],
  ["AR", ["Flippin", "Mountain Home"]], ["GA", ["Gainesville", "Bainbridge"]],
  ["LA", ["Shreveport", "Many"]], ["VA", ["Richmond", "Chesapeake"]],
  ["WI", ["La Crosse", "Onalaska"]], ["AZ", ["Lake Havasu City", "Mesa"]],
  ["NC", ["Mooresville", "Lexington"]], ["MN", ["Isle", "Brainerd"]],
];
const SPONSORS = [
  "Phoenix Boats","Skeeter","Nitro","Ranger","Bass Cat","Legend Boats","Triton",
  "Mercury Marine","Yamaha","Garmin","Humminbird","Lowrance","Power-Pole","Minn Kota",
  "Strike King","Z-Man","Berkley","Googan Baits","Megabass","Duckett Fishing",
  "Abu Garcia","Daiwa","Shimano","Lew's","13 Fishing","Costa","Yeti","Toyota",
];
const BOATS = ["Phoenix Boats","Skeeter","Nitro","Ranger","Bass Cat","Triton","Legend Boats"];

const usedAnglerSlugs = new Set<string>();
function makeAngler(cls: AnglerClass): Angler {
  let first = pick(FIRST), last = pick(LAST), slug = slugify(`${first} ${last}`);
  let guard = 0;
  while (usedAnglerSlugs.has(slug) && guard++ < 50) {
    first = pick(FIRST); last = pick(LAST); slug = slugify(`${first} ${last}`);
  }
  if (usedAnglerSlugs.has(slug)) slug = `${slug}-${usedAnglerSlugs.size}`;
  usedAnglerSlugs.add(slug);

  const [state, cities] = pick(STATES);
  const isYouth = cls === "college" || cls === "high_school";
  const birthYear = isYouth
    ? (cls === "high_school" ? randInt(2008, 2010) : randInt(2004, 2007))
    : randInt(1975, 2001);
  const sponsorCount = cls === "pro" ? randInt(3, 6) : cls === "boater" ? randInt(1, 3) : 0;
  const sponsors: string[] = [];
  while (sponsors.length < sponsorCount) {
    const s = pick(SPONSORS);
    if (!sponsors.includes(s)) sponsors.push(s);
  }

  return {
    id: uuid(), slug, firstName: first, lastName: last,
    displayName: `${first} ${last}`,
    nickname: cls === "pro" && rand() < 0.15 ? pick(["Hammer", "The Closer", "Smallie", "Flip"]) : null,
    hometownCity: pick(cities), hometownState: state, country: "USA",
    birthYear,
    turnedPro: cls === "pro" ? Math.min(birthYear + randInt(19, 28), 2024) : null,
    primaryClass: cls,
    bio: null,
    photoUrl: null,
    boatSponsor: cls === "pro" || cls === "boater" ? pick(BOATS) : null,
    sponsors, socials: {},
  };
}

// ---------------------------------------------------------------------------
// build the world
// ---------------------------------------------------------------------------
const SEASON_YEARS = [2025, 2026] as const;
/** "today" for the generated world — the 2026 season is mid-flight. */
const TODAY = "2026-10-13";

const organizations: Organization[] = ORGS.map((o) => ({ ...o, id: uuid() }));
const orgBySlug = new Map(organizations.map((o) => [o.slug, o]));

const series: Series[] = [];
const divisions: Division[] = [];
const seriesDefById = new Map<string, SeriesDef>();

for (const [i, def] of SERIES.entries()) {
  const org = orgBySlug.get(def.org)!;
  const s: Series = {
    id: uuid(), orgId: org.id,
    // Series names are unique across organizations, so no org prefix is needed.
    slug: slugify(def.name),
    name: def.name, shortName: def.shortName, level: def.level, format: def.format,
    description: def.description, sortOrder: i,
  };
  series.push(s);
  seriesDefById.set(s.id, def);
  for (const [j, d] of (def.divisions ?? []).entries()) {
    divisions.push({
      id: uuid(), seriesId: s.id,
      slug: slugify(`${def.shortName} ${d}`),
      name: d, region: d.replace(/ (Division|Regional)$/, ""), sortOrder: j,
    });
  }
}

/** How many events each series runs per division, per season. */
const EVENTS_PER_SEASON: Record<string, number> = {
  "Bassmaster Elite Series": 8,
  "Bassmaster Open Series": 2,
  "Bassmaster Classic": 1,
  "B.A.S.S. Nation": 1,
  "Bassmaster College Series": 2,
  "Bassmaster High School Series": 2,
  "Bass Pro Tour": 7,
  "Tackle Warehouse Invitationals": 4,
  "Toyota Series": 2,
  "Phoenix Bass Fishing League": 2,
  "Abu Garcia College Fishing": 2,
  "NPFL Tour": 6,
  "NPFL Championship": 1,
};
/** Leaderboard depth stored in the sample fixture (see header note). */
const STORED_DEPTH: Record<string, number> = {
  "Bassmaster Elite Series": 100,
  "Bass Pro Tour": 80,
  "NPFL Tour": 120,
  "NPFL Championship": 40,
  "Bassmaster Classic": 55,
};
const DEFAULT_DEPTH = 50;

/** Month windows so a season reads like a real calendar. */
function eventWindow(months: [number, number], idx: number, count: number, year: number) {
  const [first, last] = months;
  const span = last - first;
  const month = first + Math.round((span * idx) / Math.max(count - 1, 1));
  const day = randInt(3, 22);
  const start = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return start;
}

const seasons: Season[] = [];
const events: BassEvent[] = [];
const usedEventSlugs = new Set<string>();

for (const s of series) {
  const def = seriesDefById.get(s.id)!;
  const divs = divisions.filter((d) => d.seriesId === s.id);
  const perSeason = EVENTS_PER_SEASON[def.name] ?? 2;

  for (const year of SEASON_YEARS) {
    const season: Season = {
      id: uuid(), seriesId: s.id, year,
      name: `${year} ${def.shortName}`,
      status: year < 2026 ? "complete" : "in_progress",
      startDate: null, endDate: null,
    };
    seasons.push(season);

    const buckets = divs.length ? divs : [null];
    for (const div of buckets) {
      for (let i = 0; i < perSeason; i++) {
        const [water, city, state] = nextWater();
        const start = eventWindow(def.months, i, perSeason, year);
        const end = addDays(start, def.days - 1);
        const status: BassEvent["status"] =
          end < TODAY ? "official" : start <= TODAY ? "in_progress" : "scheduled";
        const label = div ? `${def.shortName} ${div.region}` : def.shortName;
        let slug = slugify(`${year} ${label} ${water}`);
        if (usedEventSlugs.has(slug)) slug = `${slug}-${usedEventSlugs.size}`;
        usedEventSlugs.add(slug);
        events.push({
          id: uuid(), seasonId: season.id, divisionId: div?.id ?? null,
          slug,
          name: `${def.name} at ${water}`,
          subtitle: div ? div.name : null,
          waterBody: water, city, state, country: "USA",
          startDate: start, endDate: end, status,
          format: def.format, daysScheduled: def.days,
          fieldSize: def.field, cutTo: def.cutTo ?? null,
          purseUsd: def.purse || null, winnerPayoutUsd: def.winner || null,
          pointsMultiplier: def.level === "championship" ? 1.5 : 1,
          coverImageUrl: null,
          blurb: `${def.days === 1 ? "A one-day" : `A ${def.days}-day`} ${def.format === "catch_weigh_release" ? "catch-weigh-release" : "five-fish-limit"} event on ${water} out of ${city}, ${state}.`,
          sourceUrl: null,
        });
      }
    }
    const mine = events.filter((e) => e.seasonId === season.id).map((e) => e.startDate!).sort();
    season.startDate = mine[0] ?? null;
    season.endDate = mine.length ? addDays(mine[mine.length - 1], 3) : null;
  }
}

// One 2026 event is mid-tournament as of TODAY, so the UI has a live board.
{
  const inv = series.find(
    (x) => seriesDefById.get(x.id)!.name === "Tackle Warehouse Invitationals",
  )!;
  const season26 = seasons.find((x) => x.seriesId === inv.id && x.year === 2026)!;
  const live = events
    .filter((e) => e.seasonId === season26.id)
    .sort((a, b) => a.startDate!.localeCompare(b.startDate!))
    .at(-1)!;
  live.startDate = addDays(TODAY, -1);
  live.endDate = addDays(TODAY, 2);
  live.status = "in_progress";
}

// ---------------------------------------------------------------------------
// angler pools
// ---------------------------------------------------------------------------
const POOL_SIZES: Record<AnglerClass, number> = {
  pro: 220, boater: 220, co_angler: 200, amateur: 140, college: 120, high_school: 120,
};
const anglers: Angler[] = [];
const pools: Record<AnglerClass, Angler[]> = {
  pro: [], boater: [], co_angler: [], amateur: [], college: [], high_school: [],
};
for (const cls of Object.keys(POOL_SIZES) as AnglerClass[]) {
  for (let i = 0; i < POOL_SIZES[cls]; i++) {
    const a = makeAngler(cls);
    anglers.push(a);
    pools[cls].push(a);
  }
}
/** Latent ability, 0..1 — makes the same names recur near the top all season. */
const skill = new Map(anglers.map((a) => [a.id, randFloat(0.25, 1, 4)]));

// ---------------------------------------------------------------------------
// results
// ---------------------------------------------------------------------------
const results: EventResult[] = [];

/** Weighted sample without replacement, favoring higher-skill anglers. */
function drawField(pool: Angler[], n: number): Angler[] {
  const scored = pool.map((a) => ({ a, k: skill.get(a.id)! * 0.6 + rand() * 0.4 }));
  scored.sort((x, y) => y.k - x.k);
  const top = scored.slice(0, Math.min(pool.length, Math.ceil(n * 1.6)));
  for (let i = top.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [top[i], top[j]] = [top[j], top[i]];
  }
  return top.slice(0, n).map((x) => x.a);
}

function dayWeight(format: ScoringFormat, k: number): { w: number; fish: number } {
  if (format === "catch_weigh_release") {
    const fish = Math.max(2, Math.round(randInt(6, 34) * (0.55 + k * 0.65)));
    return { w: Number((fish * randFloat(2.1, 3.4)).toFixed(2)), fish };
  }
  const fish = rand() < 0.08 ? randInt(1, 4) : 5;
  const per = randFloat(1.9, 4.3) * (0.7 + k * 0.6);
  return { w: Number(Math.min(fish * per, 34).toFixed(2)), fish };
}

/** Payout curve: steep at the top, flat through the money. */
function payout(place: number, purse: number, winner: number, paid: number): number | null {
  if (!purse || place > paid) return null;
  if (place === 1) return winner;
  const t = (place - 1) / Math.max(paid - 1, 1);
  const amt = winner * Math.pow(1 - t, 2.1) * 0.62 + purse * 0.0035;
  return Math.round(amt / 100) * 100;
}

for (const ev of events) {
  if (ev.status === "scheduled") continue;
  const season = seasons.find((s) => s.id === ev.seasonId)!;
  const ser = series.find((s) => s.id === season.seriesId)!;
  const def = seriesDefById.get(ser.id)!;
  const depth = Math.min(STORED_DEPTH[def.name] ?? DEFAULT_DEPTH, def.field);
  const daysRun = ev.status === "in_progress" ? Math.max(1, Math.ceil(def.days / 2)) : def.days;

  for (const cls of def.classes) {
    // Co-anglers fish a shallower stored board; boaters/pros carry the event.
    const clsDepth = cls === "co_angler" ? Math.round(depth * 0.6) : depth;
    const field = drawField(pools[cls], clsDepth);

    const rows = field.map((a) => {
      const k = skill.get(a.id)!;
      const days: ResultDay[] = [];
      let cum = 0, fish = 0, big = 0;
      for (let d = 1; d <= Math.min(daysRun, 2); d++) {
        const { w, fish: f } = dayWeight(def.format, k);
        cum = Number((cum + w).toFixed(2));
        fish += f;
        big = Math.max(big, Number((w / Math.max(f, 1) * randFloat(1.3, 2.2)).toFixed(2)));
        days.push({ dayNumber: d, weight: w, fishCount: f, place: null, cumulativeWeight: cum });
      }
      return { angler: a, k, days, cum, fish, big };
    });

    // The cut, then the back half of the event for whoever survived it.
    rows.sort((x, y) => y.cum - x.cum);
    const cutLine = def.cutTo && daysRun > 2 ? Math.min(def.cutTo, rows.length) : rows.length;

    rows.forEach((r, i) => {
      const madeCut = i < cutLine;
      if (madeCut) {
        for (let d = 3; d <= daysRun; d++) {
          const { w, fish: f } = dayWeight(def.format, r.k);
          r.cum = Number((r.cum + w).toFixed(2));
          r.fish += f;
          r.big = Math.max(r.big, Number((w / Math.max(f, 1) * randFloat(1.3, 2.2)).toFixed(2)));
          r.days.push({ dayNumber: d, weight: w, fishCount: f, place: null, cumulativeWeight: r.cum });
        }
      }
      (r as { madeCut?: boolean }).madeCut = madeCut;
    });

    // Final order: everyone who made the cut outranks everyone who didn't.
    rows.sort((x, y) => {
      const mx = (x as { madeCut?: boolean }).madeCut ? 1 : 0;
      const my = (y as { madeCut?: boolean }).madeCut ? 1 : 0;
      return my - mx || y.cum - x.cum;
    });

    const paidThrough = Math.round(clsDepth * 0.5);
    rows.forEach((r, i) => {
      const place = i + 1;
      const madeCut = (r as { madeCut?: boolean }).madeCut;
      const basePoints =
        def.level === "professional" || def.level === "championship"
          ? Math.max(100 - (place - 1), 1)
          : Math.max(200 - (place - 1) * 2, 10);
      const purse = cls === "co_angler" ? (ev.purseUsd ?? 0) * 0.25 : ev.purseUsd ?? 0;
      const win = cls === "co_angler" ? (ev.winnerPayoutUsd ?? 0) * 0.25 : ev.winnerPayoutUsd ?? 0;

      results.push({
        id: uuid(), eventId: ev.id, anglerId: r.angler.id, place,
        status: ev.status === "in_progress" ? "official" : madeCut ? "official" : "missed_cut",
        anglerClass: cls,
        totalWeight: r.cum, totalFish: r.fish,
        bigBass: Number(Math.min(r.big, 12.4).toFixed(2)),
        points: Number((basePoints * ev.pointsMultiplier).toFixed(1)),
        payoutUsd: payout(place, purse, win, paidThrough),
        dayCount: r.days.length,
        days: r.days.map((d, di) => ({ ...d, place: di === r.days.length - 1 ? place : null })),
      });
    });
  }
}

// ---------------------------------------------------------------------------
// season standings (points races / AOY)
// ---------------------------------------------------------------------------
const resultsByEvent = new Map<string, EventResult[]>();
for (const r of results) {
  const list = resultsByEvent.get(r.eventId) ?? [];
  list.push(r);
  resultsByEvent.set(r.eventId, list);
}

const standings: DataSet["standings"] = [];

for (const season of seasons) {
  const ser = series.find((s) => s.id === season.seriesId)!;
  const def = seriesDefById.get(ser.id)!;
  const seasonEvents = events.filter((e) => e.seasonId === season.id);
  const divs = divisions.filter((d) => d.seriesId === ser.id);
  const buckets: Array<Division | null> = divs.length ? divs : [null];
  const primaryClass = def.classes[0];

  for (const div of buckets) {
    const scoped = seasonEvents.filter((e) => (div ? e.divisionId === div.id : true));
    const agg = new Map<string, {
      points: number; events: number; wins: number; top10s: number;
      weight: number; earnings: number;
    }>();

    for (const ev of scoped) {
      for (const r of resultsByEvent.get(ev.id) ?? []) {
        if (r.anglerClass !== primaryClass) continue;
        const cur = agg.get(r.anglerId) ?? {
          points: 0, events: 0, wins: 0, top10s: 0, weight: 0, earnings: 0,
        };
        cur.points += r.points ?? 0;
        cur.events += 1;
        if (r.place === 1) cur.wins += 1;
        if ((r.place ?? 999) <= 10) cur.top10s += 1;
        cur.weight += r.totalWeight ?? 0;
        cur.earnings += r.payoutUsd ?? 0;
        agg.set(r.anglerId, cur);
      }
    }

    const ranked = [...agg.entries()]
      .sort((a, b) => b[1].points - a[1].points || b[1].weight - a[1].weight)
      .filter(([, v]) => v.events > 0);

    ranked.forEach(([anglerId, v], i) => {
      standings.push({
        id: uuid(), seasonId: season.id, divisionId: div?.id ?? null, anglerId,
        rank: i + 1,
        points: Number(v.points.toFixed(1)),
        eventsFished: v.events, wins: v.wins, top10s: v.top10s,
        totalWeight: Number(v.weight.toFixed(2)),
        earningsUsd: Math.round(v.earnings),
        isAoy: i === 0 && season.status === "complete",
        qualified: i < Math.max(3, Math.round(ranked.length * 0.35)),
      });
    });
  }
}

// ---------------------------------------------------------------------------
// editorial — recaps generated from the numbers above, so the story matches
// ---------------------------------------------------------------------------
const anglerById = new Map(anglers.map((a) => [a.id, a]));
const lbs = (n: number | null) => (n == null ? "—" : `${n.toFixed(2)} pounds`);
const money = (n: number | null) =>
  n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`;

const articles: Article[] = [];
const recapEvents = events
  .filter((e) => e.status === "official" && (resultsByEvent.get(e.id)?.length ?? 0) > 0)
  .sort((a, b) => (b.endDate ?? "").localeCompare(a.endDate ?? ""))
  .slice(0, 18);

/** The hero slot belongs to the most recent top-tier event. */
const featuredEventId = (
  recapEvents.find((e) => {
    const ser = series.find(
      (x) => x.id === seasons.find((s2) => s2.id === e.seasonId)!.seriesId,
    )!;
    return ser.level === "professional" || ser.level === "championship";
  }) ?? recapEvents[0]
)?.id;

for (const ev of recapEvents) {
  const season = seasons.find((s) => s.id === ev.seasonId)!;
  const ser = series.find((s) => s.id === season.seriesId)!;
  const org = organizations.find((o) => o.id === ser.orgId)!;
  const def = seriesDefById.get(ser.id)!;
  const board = (resultsByEvent.get(ev.id) ?? [])
    .filter((r) => r.anglerClass === def.classes[0])
    .sort((a, b) => (a.place ?? 999) - (b.place ?? 999));
  const [win, second, third] = board;
  if (!win) continue;
  const w = anglerById.get(win.anglerId)!;
  const s2 = second ? anglerById.get(second.anglerId)! : null;
  const s3 = third ? anglerById.get(third.anglerId)! : null;
  const margin = second ? Number(((win.totalWeight ?? 0) - (second.totalWeight ?? 0)).toFixed(2)) : 0;
  const bigFish = board.reduce((m, r) => ((r.bigBass ?? 0) > (m.bigBass ?? 0) ? r : m), board[0]);
  const bf = anglerById.get(bigFish.anglerId)!;
  const dayOne = win.days[0];
  const home = [w.hometownCity, w.hometownState].filter(Boolean).join(", ");

  const body = [
    `**${ev.city}, ${ev.state}** — ${w.displayName} of ${home} closed out the ${season.year} ${def.name} stop on ${ev.waterBody} with ${lbs(win.totalWeight)}, ${margin > 0 ? `winning by ${margin.toFixed(2)} pounds` : "taking the title"} and collecting ${money(win.payoutUsd)}.`,
    ``,
    `## How it was won`,
    ``,
    `${w.lastName} opened with ${lbs(dayOne?.weight ?? null)} on day one and never gave the lead back, finishing the ${def.days}-day event with ${win.totalFish} scorable fish. ${def.format === "catch_weigh_release" ? "Under MLF's catch-weigh-release format every fish counted the moment it hit the scale, and the pace never let up." : "A five-fish limit each day meant culling was the whole game, and the right afternoon bites made the difference."}`,
    ``,
    s2
      ? `${s2.displayName} finished second with ${lbs(second!.totalWeight)}${s3 ? `, ahead of ${s3.displayName} at ${lbs(third!.totalWeight)}` : ""}.`
      : ``,
    ``,
    `## Big bass`,
    ``,
    `The heaviest fish of the week went to ${bf.displayName} at ${(bigFish.bigBass ?? 0).toFixed(2)} pounds.`,
    ``,
    `## What it means`,
    ``,
    `The win moves ${w.lastName} up the ${season.year} ${def.shortName} points race with ${(win.points ?? 0).toFixed(0)} points banked from ${ev.waterBody}.`,
  ].join("\n");

  articles.push({
    id: uuid(),
    slug: slugify(`${ev.slug} recap`),
    type: "recap",
    title: `${w.displayName} wins ${def.shortName} on ${ev.waterBody}`,
    dek: margin > 0
      ? `${margin.toFixed(2)} pounds separated first from second after ${def.days} days on ${ev.waterBody}.`
      : `${w.displayName} takes the ${def.shortName} title on ${ev.waterBody}.`,
    bodyMd: body,
    heroImageUrl: null,
    heroCredit: null,
    author: "bass-stats staff",
    orgId: org.id, eventId: ev.id, anglerId: w.id,
    tags: [org.shortName, def.shortName, ev.waterBody ?? ""].filter(Boolean),
    featured: ev.id === featuredEventId,
    publishedAt: `${addDays(ev.endDate!, 0)}T23:10:00.000Z`,
  });
}

// ---------------------------------------------------------------------------
// emit
// ---------------------------------------------------------------------------
const dataset: DataSet = {
  organizations, series, divisions, seasons, events, anglers, results, standings, articles,
};

const root = resolve(import.meta.dirname, "..");
const jsonPath = resolve(root, "src/data/dataset.json");
mkdirSync(dirname(jsonPath), { recursive: true });
writeFileSync(jsonPath, JSON.stringify(dataset));

// ---- SQL ------------------------------------------------------------------
const lit = (v: unknown): string => {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) return `array[${v.map((x) => lit(x)).join(",")}]::text[]`;
  if (typeof v === "object") return `${lit(JSON.stringify(v))}::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
};

function insert(table: string, cols: string[], rows: unknown[][]): string {
  if (!rows.length) return "";
  const chunks: string[] = [];
  for (let i = 0; i < rows.length; i += 500) {
    const slice = rows.slice(i, i + 500);
    chunks.push(
      `insert into ${table} (${cols.join(", ")}) values\n` +
        slice.map((r) => `  (${r.map(lit).join(", ")})`).join(",\n") +
        `\non conflict (id) do nothing;`,
    );
  }
  return chunks.join("\n\n") + "\n";
}

const sql: string[] = [
  "-- Generated by scripts/generate-dataset.ts — do not edit by hand.",
  "-- Sample data: real series/venues, fictional anglers and results.",
  "-- Regenerate with `npm run data:generate`.",
  "",
  "begin;",
  "",
  "truncate articles, season_standings, event_result_days, event_results,",
  "         angler_org_profiles, anglers, events, seasons, divisions, series,",
  "         organizations restart identity cascade;",
  "",
  insert("organizations",
    ["id","slug","name","short_name","description","website","primary_color","accent_color","sort_order"],
    organizations.map((o) => [o.id,o.slug,o.name,o.shortName,o.description,o.website,o.primaryColor,o.accentColor,o.sortOrder])),
  insert("series",
    ["id","org_id","slug","name","short_name","level","format","description","sort_order"],
    series.map((s) => [s.id,s.orgId,s.slug,s.name,s.shortName,s.level,s.format,s.description,s.sortOrder])),
  insert("divisions",
    ["id","series_id","slug","name","region","sort_order"],
    divisions.map((d) => [d.id,d.seriesId,d.slug,d.name,d.region,d.sortOrder])),
  insert("seasons",
    ["id","series_id","year","name","status","start_date","end_date"],
    seasons.map((s) => [s.id,s.seriesId,s.year,s.name,s.status,s.startDate,s.endDate])),
  insert("events",
    ["id","season_id","division_id","slug","name","subtitle","water_body","city","state","country","start_date","end_date","status","format","days_scheduled","field_size","cut_to","purse_usd","winner_payout_usd","points_multiplier","blurb","source"],
    events.map((e) => [e.id,e.seasonId,e.divisionId,e.slug,e.name,e.subtitle,e.waterBody,e.city,e.state,e.country,e.startDate,e.endDate,e.status,e.format,e.daysScheduled,e.fieldSize,e.cutTo,e.purseUsd,e.winnerPayoutUsd,e.pointsMultiplier,e.blurb,"sample"])),
  insert("anglers",
    ["id","slug","first_name","last_name","nickname","hometown_city","hometown_state","country","birth_year","turned_pro","primary_class","bio","boat_sponsor","sponsors","socials"],
    anglers.map((a) => [a.id,a.slug,a.firstName,a.lastName,a.nickname,a.hometownCity,a.hometownState,a.country,a.birthYear,a.turnedPro,a.primaryClass,a.bio,a.boatSponsor,a.sponsors,a.socials])),
  insert("event_results",
    ["id","event_id","angler_id","place","status","angler_class","total_weight","total_fish","big_bass","points","payout_usd","day_count"],
    results.map((r) => [r.id,r.eventId,r.anglerId,r.place,r.status,r.anglerClass,r.totalWeight,r.totalFish,r.bigBass,r.points,r.payoutUsd,r.dayCount])),
  insert("event_result_days",
    ["id","result_id","day_number","weight","fish_count","place","cumulative_weight"],
    results.flatMap((r) => r.days.map((d) => [uuid(),r.id,d.dayNumber,d.weight,d.fishCount,d.place,d.cumulativeWeight]))),
  insert("season_standings",
    ["id","season_id","division_id","angler_id","rank","points","events_fished","wins","top_10s","total_weight","earnings_usd","is_aoy","qualified"],
    standings.map((s) => [s.id,s.seasonId,s.divisionId,s.anglerId,s.rank,s.points,s.eventsFished,s.wins,s.top10s,s.totalWeight,s.earningsUsd,s.isAoy,s.qualified])),
  insert("articles",
    ["id","slug","type","title","dek","body_md","author","org_id","event_id","angler_id","tags","featured","published_at"],
    articles.map((a) => [a.id,a.slug,a.type,a.title,a.dek,a.bodyMd,a.author,a.orgId,a.eventId,a.anglerId,a.tags,a.featured,a.publishedAt])),
  "commit;",
  "",
];

writeFileSync(resolve(root, "supabase/seed.sql"), sql.join("\n"));

const bytes = JSON.stringify(dataset).length;
console.log(
  [
    `organizations ${organizations.length}`,
    `series ${series.length}`,
    `divisions ${divisions.length}`,
    `seasons ${seasons.length}`,
    `events ${events.length}`,
    `anglers ${anglers.length}`,
    `results ${results.length}`,
    `standings ${standings.length}`,
    `articles ${articles.length}`,
    `uuids ${uuidCounter}`,
    `fixture ${(bytes / 1024 / 1024).toFixed(2)} MB`,
  ].join("\n"),
);
