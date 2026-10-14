import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import {
  getCatalog, getFeaturedArticle, getLeaderboard, getStandings, listArticles,
  listEvents, getWinners,
} from "@/lib/data";
import { toEventItem } from "@/lib/event-item";
import { HeroRecap } from "@/components/home/HeroRecap";
import { EventCard } from "@/components/events/EventCard";
import { ArticleCard } from "@/components/news/ArticleCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { StatusPill } from "@/components/ui/StatusPill";
import { dateRange } from "@/lib/format";

export default function HomePage() {
  return (
    <>
      <Suspense fallback={<HeroSkeleton />}>
        <Hero />
      </Suspense>

      <div className="mx-auto max-w-7xl px-4">
        <Suspense fallback={<RailSkeleton />}>
          <OnTheWater />
        </Suspense>

        <Suspense fallback={null}>
          <LatestResults />
        </Suspense>

        <Suspense fallback={null}>
          <PointsRaces />
        </Suspense>

        <Suspense fallback={null}>
          <LatestNews />
        </Suspense>

        <Suspense fallback={null}>
          <OrgStrip />
        </Suspense>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */

async function Hero() {
  const article = await getFeaturedArticle();
  if (!article) return null;
  const podium = article.event ? await getLeaderboard(article.event.id) : [];
  const primary = podium[0]?.anglerClass;
  return (
    <HeroRecap
      article={article}
      podium={podium.filter((r) => r.anglerClass === primary).slice(0, 5)}
    />
  );
}

async function OnTheWater() {
  const [live, upcoming] = await Promise.all([
    listEvents({ status: "in_progress" }),
    listEvents({ status: "scheduled", order: "upcoming", limit: 6 }),
  ]);
  if (live.length === 0 && upcoming.length === 0) return null;

  return (
    <section className="py-12">
      <SectionHeader
        kicker="On the water"
        title={live.length ? "Live now and next up" : "Next up"}
        href="/events"
        hrefLabel="Full schedule"
      />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[...live, ...upcoming].slice(0, 6).map((e) => (
          <li key={e.id}>
            <Link
              href={`/events/${e.slug}`}
              className="card flex h-full flex-col gap-2 p-4 transition-colors hover:border-accent/40"
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className="eyebrow rounded-sm border-l-2 bg-surface-2 px-1.5 py-1 leading-none"
                  style={{ borderLeftColor: e.org.accentColor }}
                >
                  {e.org.shortName}
                </span>
                <StatusPill status={e.status} />
              </div>
              <h3 className="headline text-lg">{e.waterBody ?? e.name}</h3>
              <p className="text-xs text-muted">
                {e.series.shortName ?? e.series.name}
                {e.division ? ` · ${e.division.name}` : ""}
              </p>
              <p className="tnum mt-auto pt-2 text-xs text-faint">
                {dateRange(e.startDate, e.endDate)} ·{" "}
                {[e.city, e.state].filter(Boolean).join(", ")}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function LatestResults() {
  const events = await listEvents({ status: "official", limit: 8 });
  if (!events.length) return null;
  const winners = await getWinners(events.map((e) => e.id));

  return (
    <section className="py-12">
      <SectionHeader
        kicker="Results"
        title="Latest finishes"
        href="/events?status=official"
        hrefLabel="Browse all events"
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {events.map((e) => (
          <EventCard key={e.id} event={toEventItem(e, winners[e.id])} />
        ))}
      </div>
    </section>
  );
}

async function PointsRaces() {
  const { organizations, series, seasons } = await getCatalog();

  // One flagship points race per organization.
  const flagships = organizations
    .map((org) => {
      const flagship = series
        .filter((s) => s.orgId === org.id && s.level === "professional")
        .sort((a, b) => a.sortOrder - b.sortOrder)[0];
      if (!flagship) return null;
      const season = seasons
        .filter((s) => s.seriesId === flagship.id)
        .sort((a, b) => b.year - a.year)[0];
      return season ? { org, flagship, season } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const races = await Promise.all(
    flagships.map(async (f) => ({ ...f, rows: (await getStandings(f.season.id)).slice(0, 5) })),
  );

  return (
    <section className="py-12">
      <SectionHeader
        kicker="Points"
        title="Angler of the Year watch"
        href="/standings"
        hrefLabel="All points races"
      />
      <div className="grid gap-4 lg:grid-cols-3">
        {races.map(({ org, flagship, season, rows }) => (
          <div key={flagship.id} className="card overflow-hidden">
            <div
              className="flex items-center justify-between gap-2 border-b border-line bg-surface-2/60 px-4 py-3"
              style={{ borderLeftColor: org.accentColor, borderLeftWidth: 3 }}
            >
              <div className="min-w-0">
                <p className="eyebrow truncate text-faint">{org.shortName}</p>
                <h3 className="headline truncate text-base">{flagship.name}</h3>
              </div>
              <Badge tone={season.status === "complete" ? "outline" : "live"}>
                {season.year}
              </Badge>
            </div>
            <ol>
              {rows.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/anglers/${r.angler.slug}`}
                    className="flex items-center gap-3 border-b border-line-soft px-4 py-2.5 transition-colors last:border-0 hover:bg-surface-2"
                  >
                    <span
                      className={`tnum w-4 text-right text-sm font-semibold ${
                        r.rank === 1 ? "text-gold" : "text-muted"
                      }`}
                    >
                      {r.rank}
                    </span>
                    <Avatar
                      firstName={r.angler.firstName}
                      lastName={r.angler.lastName}
                      slug={r.angler.slug}
                      photoUrl={r.angler.photoUrl}
                      size={26}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {r.angler.displayName}
                    </span>
                    <span className="tnum shrink-0 text-sm font-semibold">
                      {r.points != null ? Math.round(r.points) : "—"}
                    </span>
                  </Link>
                </li>
              ))}
              {rows.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-muted">
                  Standings post after the first event.
                </li>
              ) : null}
            </ol>
            <Link
              href={`/series/${flagship.slug}`}
              className="eyebrow block border-t border-line px-4 py-3 text-center text-muted transition-colors hover:text-accent"
            >
              Full standings →
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

async function LatestNews() {
  const articles = await listArticles(7);
  const [lead, ...rest] = articles;
  if (!lead) return null;

  return (
    <section className="py-12">
      <SectionHeader kicker="Coverage" title="Event breakdowns" href="/news" />
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          {rest.slice(0, 4).map((a) => (
            <ArticleCard key={a.id} article={a} />
          ))}
        </div>
        <div className="card divide-y divide-[var(--border-soft)] px-4">
          {rest.slice(4).concat(lead).slice(0, 4).map((a) => (
            <ArticleCard key={a.id} article={a} compact />
          ))}
        </div>
      </div>
    </section>
  );
}

async function OrgStrip() {
  const { organizations, series } = await getCatalog();
  return (
    <section className="py-12 pb-20">
      <SectionHeader kicker="Who runs what" title="The circuits" href="/organizations" />
      <div className="grid gap-4 lg:grid-cols-3">
        {organizations.map((org) => {
          const own = series.filter((s) => s.orgId === org.id);
          return (
            <Link
              key={org.id}
              href={`/organizations/${org.slug}`}
              className="card group relative overflow-hidden p-5 transition-colors hover:border-accent/40"
            >
              <span
                className="absolute inset-x-0 top-0 h-1"
                style={{ background: org.accentColor }}
                aria-hidden
              />
              <h3 className="headline text-xl">{org.name}</h3>
              <p className="mt-2 line-clamp-3 text-sm text-muted">{org.description}</p>
              <p className="eyebrow mt-4 flex items-center gap-1.5 text-accent">
                {own.length} series <ArrowRight size={13} />
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function HeroSkeleton() {
  return <div className="h-[30rem] animate-pulse border-b border-line bg-surface" />;
}

function RailSkeleton() {
  return (
    <div className="grid gap-3 py-12 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card h-36 animate-pulse" />
      ))}
    </div>
  );
}
