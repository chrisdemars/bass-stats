import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Award, MapPin, Ship } from "lucide-react";
import {
  getAnglerBySlug, getAnglerResults, getCareerStats, listAnglers,
} from "@/lib/data";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { StatTile } from "@/components/ui/StatTile";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { cn } from "@/lib/cn";
import {
  CLASS_LABEL, dateRange, money, ordinal, weightDecimal, weightLbsOz,
} from "@/lib/format";
import type { AnglerResultRow } from "@/lib/types";

export async function generateStaticParams() {
  const { items } = await listAnglers({ limit: 24, sort: "earnings" });
  return items.map((i) => ({ slug: i.angler.slug }));
}

export async function generateMetadata(
  { params }: PageProps<"/anglers/[slug]">,
): Promise<Metadata> {
  const { slug } = await params;
  const angler = await getAnglerBySlug(slug);
  if (!angler) return { title: "Angler not found" };
  const home = [angler.hometownCity, angler.hometownState].filter(Boolean).join(", ");
  return {
    title: angler.displayName,
    description: `Career results, earnings and event history for ${angler.displayName}${home ? ` of ${home}` : ""}.`,
  };
}

export default async function AnglerPage({ params }: PageProps<"/anglers/[slug]">) {
  const { slug } = await params;
  const angler = await getAnglerBySlug(slug);
  if (!angler) notFound();

  const [stats, results] = await Promise.all([
    getCareerStats(angler.id),
    getAnglerResults(angler.id),
  ]);

  const home = [angler.hometownCity, angler.hometownState].filter(Boolean).join(", ");

  // Group the career table by season year, newest first.
  const byYear = new Map<number, AnglerResultRow[]>();
  for (const r of results) {
    const list = byYear.get(r.event.season.year);
    if (list) list.push(r);
    else byYear.set(r.event.season.year, [r]);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);

  // Which circuits has this angler actually fished, and how often?
  const byOrg = new Map<string, { name: string; accent: string; slug: string; n: number }>();
  for (const r of results) {
    const key = r.event.org.slug;
    const cur = byOrg.get(key);
    if (cur) cur.n += 1;
    else
      byOrg.set(key, {
        name: r.event.org.shortName, accent: r.event.org.accentColor,
        slug: key, n: 1,
      });
  }

  return (
    <article>
      <header className="border-b border-line bg-elevated">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <Breadcrumbs
            items={[{ href: "/anglers", label: "Anglers" }, { label: angler.displayName }]}
          />

          <div className="mt-5 flex flex-wrap items-start gap-6">
            <Avatar
              firstName={angler.firstName}
              lastName={angler.lastName}
              slug={angler.slug}
              photoUrl={angler.photoUrl}
              size={104}
              className="shadow-card"
            />
            <div className="min-w-0 flex-1">
              <h1 className="headline text-4xl sm:text-5xl">
                {angler.displayName}
                {angler.nickname ? (
                  <span className="ml-3 align-middle text-xl text-muted">
                    “{angler.nickname}”
                  </span>
                ) : null}
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
                {home ? (
                  <span className="flex items-center gap-1.5">
                    <MapPin size={13} /> {home}
                  </span>
                ) : null}
                {angler.boatSponsor ? (
                  <span className="flex items-center gap-1.5">
                    <Ship size={13} /> {angler.boatSponsor}
                  </span>
                ) : null}
                {angler.turnedPro ? (
                  <span className="flex items-center gap-1.5">
                    <Award size={13} /> Pro since {angler.turnedPro}
                  </span>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Badge tone={angler.primaryClass === "pro" ? "accent" : "outline"}>
                  {CLASS_LABEL[angler.primaryClass]}
                </Badge>
                {[...byOrg.values()].map((o) => (
                  <Link key={o.slug} href={`/organizations/${o.slug}`}>
                    <span
                      className="eyebrow inline-flex items-center gap-1.5 rounded-sm border-l-2 bg-surface-2 px-2 py-1 leading-none transition-colors hover:text-accent"
                      style={{ borderLeftColor: o.accent }}
                    >
                      {o.name} <span className="tnum text-faint">{o.n}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <dl className="mt-8 grid gap-3 grid-cols-2 lg:grid-cols-6">
            <StatTile label="Events" value={stats.events} />
            <StatTile label="Wins" value={stats.wins} tone={stats.wins ? "gold" : "default"} />
            <StatTile label="Top 10s" value={stats.top10s} tone="water" />
            <StatTile
              label="Best finish"
              value={stats.bestPlace ? ordinal(stats.bestPlace) : "—"}
            />
            <StatTile
              label="Career earnings"
              value={money(stats.careerEarnings, true)}
              sub={money(stats.careerEarnings)}
            />
            <StatTile
              label="Biggest bass"
              value={weightLbsOz(stats.biggestBass)}
              sub={stats.avgPlace ? `Avg finish ${stats.avgPlace}` : undefined}
            />
          </dl>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-10">
        {angler.sponsors.length ? (
          <section className="mb-10">
            <h2 className="eyebrow mb-2.5 text-faint">Sponsors</h2>
            <ul className="flex flex-wrap gap-2">
              {angler.sponsors.map((s) => (
                <li key={s} className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs">
                  {s}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {angler.bio ? (
          <p className="mb-10 max-w-2xl leading-relaxed text-muted">{angler.bio}</p>
        ) : null}

        <section>
          <h2 className="headline mb-4 text-2xl">Career results</h2>

          {years.length === 0 ? (
            <div className="card px-6 py-12 text-center text-sm text-muted">
              No results on record yet.
            </div>
          ) : (
            <div className="space-y-8">
              {years.map((year) => {
                const rows = byYear.get(year)!;
                const earned = rows.reduce((a, r) => a + (r.payoutUsd ?? 0), 0);
                return (
                  <div key={year}>
                    <div className="mb-2.5 flex items-baseline justify-between gap-4">
                      <h3 className="headline text-xl">{year}</h3>
                      <p className="tnum text-xs text-muted">
                        {rows.length} {rows.length === 1 ? "event" : "events"} ·{" "}
                        {money(earned)}
                      </p>
                    </div>

                    <div className="card overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[40rem] text-sm">
                          <thead>
                            <tr className="border-b border-line bg-surface-2/60 text-left">
                              <th scope="col" className="eyebrow w-16 px-3 py-2.5 text-center text-faint">Place</th>
                              <th scope="col" className="eyebrow px-3 py-2.5 text-faint">Event</th>
                              <th scope="col" className="eyebrow hidden px-3 py-2.5 text-faint md:table-cell">Series</th>
                              <th scope="col" className="eyebrow w-24 px-3 py-2.5 text-right text-faint">Weight</th>
                              <th scope="col" className="eyebrow hidden w-16 px-3 py-2.5 text-right text-faint lg:table-cell">Pts</th>
                              <th scope="col" className="eyebrow w-24 px-3 py-2.5 text-right text-faint">Payout</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r) => (
                              <tr
                                key={r.id}
                                className={cn(
                                  "border-b border-line-soft last:border-0 hover:bg-surface-2/60",
                                  r.place === 1 && "bg-gold/[0.06]",
                                )}
                              >
                                <td className="px-3 py-2.5 text-center">
                                  <span
                                    className={cn(
                                      "tnum font-semibold",
                                      r.place === 1 && "text-gold",
                                      r.place != null && r.place <= 10 && r.place !== 1 && "text-water",
                                    )}
                                  >
                                    {r.place ?? "—"}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5">
                                  <Link href={`/events/${r.event.slug}`} className="font-medium hover:text-accent">
                                    {r.event.waterBody ?? r.event.name}
                                  </Link>
                                  <span className="block text-xs text-muted">
                                    {dateRange(r.event.startDate, r.event.endDate)}
                                  </span>
                                </td>
                                <td className="hidden px-3 py-2.5 md:table-cell">
                                  <Link
                                    href={`/series/${r.event.series.slug}`}
                                    className="eyebrow inline-block rounded-sm border-l-2 bg-surface-2 px-1.5 py-1 leading-none hover:text-accent"
                                    style={{ borderLeftColor: r.event.org.accentColor }}
                                  >
                                    {r.event.series.shortName ?? r.event.series.name}
                                  </Link>
                                </td>
                                <td
                                  className="tnum px-3 py-2.5 text-right font-medium"
                                  title={weightDecimal(r.totalWeight)}
                                >
                                  {weightLbsOz(r.totalWeight)}
                                </td>
                                <td className="tnum hidden px-3 py-2.5 text-right text-muted lg:table-cell">
                                  {r.points != null ? Math.round(r.points) : "—"}
                                </td>
                                <td className="tnum px-3 py-2.5 text-right">
                                  {r.payoutUsd ? money(r.payoutUsd) : <span className="text-faint">—</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </article>
  );
}
