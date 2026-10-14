import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { getCatalog, getStandings } from "@/lib/data";
import { PageHeader } from "@/components/layout/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { LEVEL_LABEL } from "@/lib/format";

export const metadata: Metadata = {
  title: "Standings",
  description:
    "Angler of the Year races and division points standings across every Bassmaster, MLF and NPFL series.",
};

export default function StandingsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <PageHeader
        kicker="Points races"
        title="Standings"
        description="Current-season points for every series. Championship-qualifying positions are marked on each full table."
      />
      <Suspense fallback={<Skeleton />}>
        <Races />
      </Suspense>
    </div>
  );
}

async function Races() {
  const { organizations, series, seasons } = await getCatalog();

  // Latest season per series, newest first.
  const latest = series
    .map((s) => {
      const season = seasons
        .filter((x) => x.seriesId === s.id)
        .sort((a, b) => b.year - a.year)[0];
      return season ? { series: s, season } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const withRows = await Promise.all(
    latest.map(async (entry) => ({
      ...entry,
      rows: (await getStandings(entry.season.id)).slice(0, 3),
    })),
  );

  return (
    <div className="space-y-12">
      {organizations.map((org) => {
        const races = withRows.filter((r) => r.series.orgId === org.id);
        if (!races.length) return null;
        return (
          <section key={org.id}>
            <div className="mb-4 flex items-center gap-3">
              <span
                className="h-6 w-1 rounded-full"
                style={{ background: org.accentColor }}
                aria-hidden
              />
              <h2 className="headline text-2xl">
                <Link href={`/organizations/${org.slug}`} className="hover:text-accent">
                  {org.name}
                </Link>
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {races.map(({ series: s, season, rows }) => (
                <div key={s.id} className="card flex flex-col overflow-hidden">
                  <div className="border-b border-line px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="headline text-base leading-tight">
                        <Link href={`/series/${s.slug}`} className="hover:text-accent">
                          {s.name}
                        </Link>
                      </h3>
                      <Badge tone={season.status === "complete" ? "outline" : "live"}>
                        {season.year}
                      </Badge>
                    </div>
                    <p className="eyebrow mt-1 text-faint">{LEVEL_LABEL[s.level]}</p>
                  </div>

                  <ol className="flex-1">
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
                            size={24}
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
                        No points posted yet.
                      </li>
                    ) : null}
                  </ol>

                  <Link
                    href={`/series/${s.slug}`}
                    className="eyebrow border-t border-line px-4 py-3 text-center text-muted transition-colors hover:text-accent"
                  >
                    Full standings →
                  </Link>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="card h-56 animate-pulse" />
      ))}
    </div>
  );
}
