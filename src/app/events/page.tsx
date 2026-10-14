import { Suspense } from "react";
import type { Metadata } from "next";
import { getCatalog, getWinners, listEvents } from "@/lib/data";
import { toBrowseCatalog, toEventItem } from "@/lib/event-item";
import { EventBrowser } from "@/components/events/EventBrowser";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata: Metadata = {
  title: "Events",
  description:
    "Every Bassmaster, Major League Fishing and NPFL event — filter by organization, series, division and season.",
};

export default function EventsPage({ searchParams }: PageProps<"/events">) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <PageHeader
        kicker="Schedule and results"
        title="Events"
        description="Drill down organization by organization, series by series. Every event links through to its full leaderboard."
      />
      <Suspense fallback={<BrowserSkeleton />}>
        <Browser searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Browser({ searchParams }: Pick<PageProps<"/events">, "searchParams">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const [catalog, events] = await Promise.all([getCatalog(), listEvents()]);
  const winners = await getWinners(events.map((e) => e.id));

  return (
    <EventBrowser
      catalog={toBrowseCatalog(catalog)}
      events={events.map((e) => toEventItem(e, winners[e.id]))}
      initial={{
        org: one(sp.org),
        series: one(sp.series),
        division: one(sp.division),
        year: one(sp.year),
        status: one(sp.status),
      }}
    />
  );
}

function BrowserSkeleton() {
  return (
    <div>
      <div className="card h-36 animate-pulse" />
      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="card h-60 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
