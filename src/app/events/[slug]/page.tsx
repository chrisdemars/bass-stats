import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowRight, Fish, Trophy, Users, Wallet } from "lucide-react";
import {
  getArticleForEvent, getEventBySlug, getLeaderboard, listEvents,
} from "@/lib/data";
import { Leaderboard, type BoardRow } from "@/components/events/Leaderboard";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { EventArt } from "@/components/ui/EventArt";
import { StatusPill } from "@/components/ui/StatusPill";
import { StatTile } from "@/components/ui/StatTile";
import { Avatar } from "@/components/ui/Avatar";
import {
  FORMAT_LABEL, count, dateRange, money, weightDecimal, weightLbsOz,
} from "@/lib/format";

/** Prerender the most recent events; the rest render on first request. */
export async function generateStaticParams() {
  const events = await listEvents({ limit: 24 });
  return events.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata(
  { params }: PageProps<"/events/[slug]">,
): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return { title: "Event not found" };
  return {
    title: `${event.name} — ${event.season.year}`,
    description:
      event.blurb ??
      `Full results and standings for the ${event.season.year} ${event.series.name} on ${event.waterBody}.`,
  };
}

export default async function EventPage({ params }: PageProps<"/events/[slug]">) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const [board, recap] = await Promise.all([
    getLeaderboard(event.id),
    getArticleForEvent(event.id),
  ]);

  const primaryClass = board[0]?.anglerClass;
  const primary = board.filter((r) => r.anglerClass === primaryClass);
  const winner = primary.find((r) => r.place === 1);
  const runnerUp = primary.find((r) => r.place === 2);
  const margin =
    winner?.totalWeight != null && runnerUp?.totalWeight != null
      ? winner.totalWeight - runnerUp.totalWeight
      : null;
  const bigBass = primary.reduce<typeof winner>(
    (best, r) => ((r.bigBass ?? 0) > (best?.bigBass ?? 0) ? r : best),
    undefined,
  );

  const rows: BoardRow[] = board.map((r) => ({
    id: r.id,
    place: r.place,
    status: r.status,
    anglerClass: r.anglerClass,
    slug: r.angler.slug,
    name: r.angler.displayName,
    firstName: r.angler.firstName,
    lastName: r.angler.lastName,
    hometown: [r.angler.hometownCity, r.angler.hometownState].filter(Boolean).join(", "),
    photoUrl: r.angler.photoUrl,
    totalWeight: r.totalWeight,
    totalFish: r.totalFish,
    bigBass: r.bigBass,
    points: r.points,
    payoutUsd: r.payoutUsd,
    days: r.days.map((d) => ({
      dayNumber: d.dayNumber, weight: d.weight, fishCount: d.fishCount,
    })),
  }));

  const siblings = (await listEvents({ seriesSlug: event.series.slug, year: event.season.year }))
    .filter((e) => e.id !== event.id)
    .slice(0, 6);

  return (
    <article>
      {/* Masthead */}
      <header className="relative isolate overflow-hidden border-b border-line">
        <EventArt
          slug={event.slug}
          imageUrl={event.coverImageUrl}
          label={event.waterBody}
          className="absolute inset-0 -z-10 size-full"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-bg via-bg/90 to-bg/50" />

        <div className="mx-auto max-w-7xl px-4 py-10">
          <Breadcrumbs
            items={[
              { href: "/events", label: "Events" },
              { href: `/organizations/${event.org.slug}`, label: event.org.shortName },
              { href: `/series/${event.series.slug}`, label: event.series.shortName ?? event.series.name },
              { label: event.waterBody ?? event.name },
            ]}
          />

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <StatusPill status={event.status} />
            <span
              className="eyebrow rounded-sm border-l-2 bg-surface-2/80 px-2 py-1 leading-none"
              style={{ borderLeftColor: event.org.accentColor }}
            >
              {event.season.year} {event.series.shortName ?? event.series.name}
            </span>
            {event.division ? (
              <span className="eyebrow text-faint">{event.division.name}</span>
            ) : null}
          </div>

          <h1 className="headline mt-4 max-w-3xl text-4xl sm:text-5xl lg:text-6xl">
            {event.waterBody ?? event.name}
          </h1>
          <p className="mt-3 text-muted">
            {[event.city, event.state].filter(Boolean).join(", ")} ·{" "}
            <span className="tnum">{dateRange(event.startDate, event.endDate)}</span>
          </p>

          <dl className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Field"
              value={count(event.fieldSize)}
              sub={event.cutTo ? `Cut to ${event.cutTo}` : "No cut"}
            />
            <StatTile
              label="Format"
              value={event.format ? FORMAT_LABEL[event.format] : "—"}
              sub={event.daysScheduled ? `${event.daysScheduled}-day event` : undefined}
            />
            <StatTile label="Purse" value={money(event.purseUsd, true)} tone="water"
              sub={event.winnerPayoutUsd ? `${money(event.winnerPayoutUsd, true)} to win` : undefined} />
            <StatTile
              label="Winning weight"
              value={weightLbsOz(winner?.totalWeight)}
              tone="gold"
              sub={margin != null ? `Won by ${weightLbsOz(margin)}` : undefined}
            />
          </dl>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-10">
        {/* Winner callout */}
        {winner ? (
          <section className="card mb-8 flex flex-wrap items-center gap-5 p-5">
            <Avatar
              firstName={winner.angler.firstName}
              lastName={winner.angler.lastName}
              slug={winner.angler.slug}
              photoUrl={winner.angler.photoUrl}
              size={64}
            />
            <div className="min-w-0 flex-1">
              <p className="eyebrow flex items-center gap-1.5 text-gold">
                <Trophy size={13} /> Winner
              </p>
              <h2 className="headline mt-1 text-2xl">
                <Link href={`/anglers/${winner.angler.slug}`} className="hover:text-accent">
                  {winner.angler.displayName}
                </Link>
              </h2>
              <p className="mt-0.5 text-sm text-muted">
                {[winner.angler.hometownCity, winner.angler.hometownState]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </div>
            <dl className="flex flex-wrap gap-x-8 gap-y-3">
              <Mini icon={<Fish size={13} />} label="Total" value={weightLbsOz(winner.totalWeight)}
                sub={weightDecimal(winner.totalWeight)} />
              <Mini icon={<Users size={13} />} label="Fish" value={String(winner.totalFish ?? "—")} />
              <Mini icon={<Wallet size={13} />} label="Payout" value={money(winner.payoutUsd)} />
            </dl>
          </section>
        ) : null}

        {recap ? (
          <Link
            href={`/news/${recap.slug}`}
            className="card mb-8 flex items-center gap-4 p-5 transition-colors hover:border-accent/40"
          >
            <div className="min-w-0 flex-1">
              <p className="eyebrow text-accent">Breakdown</p>
              <h2 className="headline mt-1 text-xl">{recap.title}</h2>
              {recap.dek ? <p className="mt-1 text-sm text-muted">{recap.dek}</p> : null}
            </div>
            <ArrowRight size={18} className="shrink-0 text-muted" />
          </Link>
        ) : null}

        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 className="headline text-2xl">Leaderboard</h2>
          {bigBass?.bigBass ? (
            <p className="text-xs text-muted">
              Big bass:{" "}
              <Link href={`/anglers/${bigBass.angler.slug}`} className="text-ink hover:text-accent">
                {bigBass.angler.displayName}
              </Link>{" "}
              <span className="tnum">{weightLbsOz(bigBass.bigBass)}</span>
            </p>
          ) : null}
        </div>

        <Leaderboard
          rows={rows}
          daysScheduled={event.daysScheduled}
          cutTo={event.cutTo}
          live={event.status === "in_progress"}
        />

        {event.blurb ? (
          <p className="mt-6 max-w-2xl text-sm text-muted">{event.blurb}</p>
        ) : null}

        {siblings.length ? (
          <section className="mt-12">
            <h2 className="headline mb-4 text-xl">
              More from the {event.season.year} {event.series.shortName ?? event.series.name}
            </h2>
            <ul className="card divide-y divide-[var(--border-soft)] overflow-hidden">
              {siblings.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/events/${e.slug}`}
                    className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-surface-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{e.waterBody ?? e.name}</span>
                      <span className="block truncate text-xs text-muted">
                        {[e.city, e.state].filter(Boolean).join(", ")}
                        {e.division ? ` · ${e.division.name}` : ""}
                      </span>
                    </span>
                    <span className="tnum shrink-0 text-xs text-muted">
                      {dateRange(e.startDate, e.endDate)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {event.sourceUrl ? (
          <p className="mt-8 text-xs text-faint">
            Source:{" "}
            <a href={event.sourceUrl} rel="noopener noreferrer nofollow" target="_blank"
              className="underline underline-offset-2">
              official results
            </a>
          </p>
        ) : null}
      </div>
    </article>
  );
}

function Mini({
  icon, label, value, sub,
}: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
}) {
  return (
    <div>
      <dt className="eyebrow flex items-center gap-1.5 text-faint">
        {icon} {label}
      </dt>
      <dd className="tnum mt-1 text-xl font-semibold" title={sub}>{value}</dd>
    </div>
  );
}
