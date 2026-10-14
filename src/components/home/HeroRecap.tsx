import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import { EventArt } from "@/components/ui/EventArt";
import { StatusPill } from "@/components/ui/StatusPill";
import { Avatar } from "@/components/ui/Avatar";
import { dateRange, money, weightLbsOz } from "@/lib/format";
import { TimeAgo } from "@/components/ui/TimeAgo";
import type { ArticleWithContext, LeaderboardRow } from "@/lib/types";

/**
 * The masthead story: the most recent event, broken down.
 *
 * Mirrors how bassmaster.com and MLF lead their homepages — one dominant
 * image, the result in the headline, and the top of the board right there so
 * the number is visible without a click.
 */
export function HeroRecap({
  article,
  podium,
}: {
  article: ArticleWithContext;
  podium: LeaderboardRow[];
}) {
  const event = article.event;
  const winner = podium[0];
  const runnerUp = podium[1];
  const margin =
    winner?.totalWeight != null && runnerUp?.totalWeight != null
      ? winner.totalWeight - runnerUp.totalWeight
      : null;

  return (
    <section className="relative isolate overflow-hidden border-b border-line">
      <EventArt
        slug={event?.slug ?? article.slug}
        imageUrl={article.heroImageUrl}
        label={event?.waterBody}
        className="absolute inset-0 -z-10 size-full"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-bg via-bg/85 to-bg/35" />

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 lg:grid-cols-[1.35fr_1fr] lg:py-20">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            {event ? <StatusPill status={event.status} /> : null}
            {event ? (
              <Link
                href={`/series/${event.series.slug}`}
                className="eyebrow rounded-sm border-l-2 bg-surface-2/80 px-2 py-1 leading-none backdrop-blur-sm transition-colors hover:text-accent"
                style={{ borderLeftColor: event.org.accentColor }}
              >
                {event.org.shortName} · {event.series.shortName ?? event.series.name}
              </Link>
            ) : null}
            <span className="eyebrow text-faint"><TimeAgo iso={article.publishedAt} /></span>
          </div>

          <h1 className="headline mt-5 text-4xl sm:text-5xl lg:text-6xl">
            <Link href={`/news/${article.slug}`} className="hover:text-accent">
              {article.title}
            </Link>
          </h1>

          {article.dek ? (
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">{article.dek}</p>
          ) : null}

          {event ? (
            <p className="mt-4 text-sm text-faint">
              {event.waterBody} · {[event.city, event.state].filter(Boolean).join(", ")} ·{" "}
              {dateRange(event.startDate, event.endDate)}
            </p>
          ) : null}

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href={`/news/${article.slug}`}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90"
            >
              Read the breakdown <ArrowRight size={15} />
            </Link>
            {event ? (
              <Link
                href={`/events/${event.slug}`}
                className="inline-flex items-center gap-2 rounded-md border border-line bg-surface/70 px-4 py-2.5 text-sm font-semibold backdrop-blur-sm transition-colors hover:border-accent/50"
              >
                Full leaderboard
              </Link>
            ) : null}
          </div>

          {winner && margin != null ? (
            <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-4 border-t border-line pt-6">
              <Stat label="Winning weight" value={weightLbsOz(winner.totalWeight)} tone="gold" />
              <Stat label="Margin" value={weightLbsOz(margin)} />
              <Stat label="Fish weighed" value={String(winner.totalFish ?? "—")} />
              <Stat label="First-place purse" value={money(winner.payoutUsd, true)} />
            </dl>
          ) : null}
        </div>

        {/* Top of the board */}
        {podium.length > 0 ? (
          <aside className="card self-start bg-surface/80 p-1.5 backdrop-blur-sm">
            <h2 className="eyebrow flex items-center gap-2 px-3 py-2.5 text-faint">
              <Trophy size={13} className="text-gold" />
              Top of the board
            </h2>
            <ol>
              {podium.slice(0, 5).map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/anglers/${row.angler.slug}`}
                    className="flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-surface-2"
                  >
                    <span
                      className={`tnum w-5 shrink-0 text-right text-sm font-semibold ${
                        row.place === 1 ? "text-gold" : "text-muted"
                      }`}
                    >
                      {row.place}
                    </span>
                    <Avatar
                      firstName={row.angler.firstName}
                      lastName={row.angler.lastName}
                      slug={row.angler.slug}
                      photoUrl={row.angler.photoUrl}
                      size={32}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {row.angler.displayName}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {[row.angler.hometownCity, row.angler.hometownState]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </span>
                    <span className="tnum shrink-0 text-sm font-semibold">
                      {weightLbsOz(row.totalWeight)}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
            {event ? (
              <Link
                href={`/events/${event.slug}`}
                className="eyebrow block border-t border-line-soft px-3 py-3 text-center text-muted transition-colors hover:text-accent"
              >
                All {event.fieldSize ? `${event.fieldSize} ` : ""}anglers →
              </Link>
            ) : null}
          </aside>
        ) : null}
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "gold";
}) {
  return (
    <div>
      <dt className="eyebrow text-faint">{label}</dt>
      <dd
        className={`tnum mt-1 text-2xl leading-none font-semibold ${
          tone === "gold" ? "text-gold" : "text-ink"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
