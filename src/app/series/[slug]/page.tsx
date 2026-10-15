import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import { getCatalog, getStandings, getWinners, listEvents } from "@/lib/data";
import { StandingsTable } from "@/components/standings/StandingsTable";
import { EventRow } from "@/components/events/EventRow";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Badge } from "@/components/ui/Badge";
import { toEventItem } from "@/lib/event-item";
import { FORMAT_LABEL, LEVEL_LABEL } from "@/lib/format";

// No generateStaticParams: `series` can be empty on a fresh database (before
// the first ingest run populates it), and Next's Cache Components treat an
// empty array from this export as a build error rather than "nothing to
// prerender yet." Going fully dynamic here means the build always succeeds
// regardless of database state; the page is still cached per-request via the
// "use cache" layer in src/lib/data.

export async function generateMetadata(
  { params }: PageProps<"/series/[slug]">,
): Promise<Metadata> {
  const { slug } = await params;
  const { series } = await getCatalog();
  const s = series.find((x) => x.slug === slug);
  if (!s) return { title: "Series not found" };
  return {
    title: s.name,
    description: s.description ?? `Schedule, results and points standings for the ${s.name}.`,
  };
}

export default function SeriesPage({
  params, searchParams,
}: PageProps<"/series/[slug]">) {
  return (
    <Suspense fallback={<SeriesPageSkeleton />}>
      <SeriesPageContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

function SeriesPageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="card h-40 animate-pulse" />
      <div className="card mt-6 h-96 animate-pulse" />
    </div>
  );
}

async function SeriesPageContent({
  params, searchParams,
}: Pick<PageProps<"/series/[slug]">, "params" | "searchParams">) {
  const { slug } = await params;
  const catalog = await getCatalog();
  const series = catalog.series.find((s) => s.slug === slug);
  if (!series) notFound();

  const org = catalog.organizations.find((o) => o.id === series.orgId);
  if (!org) notFound();

  const seasons = catalog.seasons
    .filter((s) => s.seriesId === series.id)
    .sort((a, b) => b.year - a.year);
  const divisions = catalog.divisions
    .filter((d) => d.seriesId === series.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <article>
      <header className="border-b border-line bg-elevated">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <Breadcrumbs
            items={[
              { href: "/organizations", label: "Organizations" },
              { href: `/organizations/${org.slug}`, label: org.shortName },
              { label: series.shortName ?? series.name },
            ]}
          />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span
              className="eyebrow rounded-sm border-l-2 bg-surface-2 px-2 py-1 leading-none"
              style={{ borderLeftColor: org.accentColor }}
            >
              {org.shortName}
            </span>
            <Badge tone="outline">{LEVEL_LABEL[series.level]}</Badge>
            <Badge tone="water">{FORMAT_LABEL[series.format]}</Badge>
          </div>
          <h1 className="headline mt-4 text-4xl sm:text-5xl">{series.name}</h1>
          {series.description ? (
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted">
              {series.description}
            </p>
          ) : null}
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-10">
        <Suspense fallback={<div className="card h-96 animate-pulse" />}>
          <SeasonView
            seriesSlug={series.slug}
            seasons={seasons}
            divisions={divisions}
            searchParams={searchParams}
          />
        </Suspense>
      </div>
    </article>
  );
}

async function SeasonView({
  seriesSlug,
  seasons,
  divisions,
  searchParams,
}: {
  seriesSlug: string;
  seasons: Array<{ id: string; year: number; status: string }>;
  divisions: Array<{ id: string; slug: string; name: string }>;
  searchParams: PageProps<"/series/[slug]">["searchParams"];
}) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const yearParam = Number(one(sp.year));
  const season = seasons.find((s) => s.year === yearParam) ?? seasons[0];
  const divisionSlug = one(sp.division);
  const division = divisions.find((d) => d.slug === divisionSlug) ?? null;

  if (!season) {
    return (
      <p className="card px-6 py-12 text-center text-sm text-muted">
        No seasons on record for this series yet.
      </p>
    );
  }

  const [standings, events] = await Promise.all([
    getStandings(season.id, division?.id ?? null),
    listEvents({ seriesSlug, year: season.year, divisionSlug: division?.slug }),
  ]);
  const winners = await getWinners(events.map((e) => e.id));

  const href = (next: { year?: number; division?: string | null }) => {
    const q = new URLSearchParams();
    const year = next.year ?? season.year;
    if (year !== seasons[0].year) q.set("year", String(year));
    const div = next.division === undefined ? division?.slug : next.division;
    if (div) q.set("division", div);
    const qs = q.toString();
    return qs ? `/series/${seriesSlug}?${qs}` : `/series/${seriesSlug}`;
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Tabs label="Season">
          {seasons.map((s) => (
            <Tab key={s.id} href={href({ year: s.year })} active={s.id === season.id}>
              {s.year}
            </Tab>
          ))}
        </Tabs>

        {divisions.length ? (
          <Tabs label="Division">
            <Tab href={href({ division: null })} active={!division}>All</Tab>
            {divisions.map((d) => (
              <Tab key={d.id} href={href({ division: d.slug })} active={division?.id === d.id}>
                {d.name.replace(/ (Division|Regional)$/, "")}
              </Tab>
            ))}
          </Tabs>
        ) : null}
      </div>

      <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
        <section>
          <h2 className="headline mb-4 text-2xl">
            {season.year} points standings
            {division ? ` — ${division.name}` : ""}
          </h2>
          <StandingsTable rows={standings} qualifyLabel="championship" />
        </section>

        <section>
          <h2 className="headline mb-4 text-2xl">Schedule</h2>
          {events.length ? (
            <ul className="card overflow-hidden">
              {events
                .slice()
                .sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""))
                .map((e) => (
                  <EventRow key={e.id} event={toEventItem(e, winners[e.id])} />
                ))}
            </ul>
          ) : (
            <p className="card px-6 py-12 text-center text-sm text-muted">
              No events scheduled.
            </p>
          )}
        </section>
      </div>
    </>
  );
}

function Tabs({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="eyebrow text-faint">{label}</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Tab({
  href, active, children,
}: {
  href: string; active: boolean; children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-md px-2.5 py-1.5 text-xs transition-colors ${
        active ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
