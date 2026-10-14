import Link from "next/link";
import type { Metadata } from "next";
import { dataSource } from "@/lib/data";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = {
  title: "About the data",
  description: "Where bass-stats results come from, how often they update, and what the sample dataset is.",
};

export default function AboutTheDataPage() {
  const sample = dataSource === "sample";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader kicker="Methodology" title="About the data">
        <Badge tone={sample ? "gold" : "pos"}>
          {sample ? "Sample dataset" : "Live database"}
        </Badge>
      </PageHeader>

      <div className="space-y-8 leading-relaxed text-ink/85">
        {sample ? (
          <section className="card border-gold/30 bg-gold/[0.06] p-5">
            <h2 className="headline text-xl text-gold">You are looking at sample data</h2>
            <p className="mt-2 text-sm">
              No Supabase credentials are configured, so the site is serving a
              generated dataset. The organizations, series, divisions and
              fisheries are real. <strong>The anglers and every result attached
              to them are invented</strong> — fictional names over plausible
              numbers, so the interface has something to render. Nothing on the
              site right now describes a real tournament outcome, and no real
              angler&rsquo;s name appears in it.
            </p>
            <p className="mt-2 text-sm">
              Point the app at a Supabase project and run the ingest pipeline to
              replace it with real results.
            </p>
          </section>
        ) : (
          <section className="card p-5">
            <h2 className="headline text-xl">Live database</h2>
            <p className="mt-2 text-sm">
              Results are served from Supabase and refreshed by the ingest
              pipeline described below.
            </p>
          </section>
        )}

        <section>
          <h2 className="headline text-2xl">Where results come from</h2>
          <p className="mt-3">
            Each organization publishes its own results, in its own shape.
            bass-stats keeps one adapter per source under{" "}
            <code className="rounded bg-surface-2 px-1.5 py-0.5 text-sm">src/scrapers/</code>.
            An adapter is responsible for three things: discovering which events
            exist, fetching one event&rsquo;s leaderboard, and normalizing both
            into the shared schema. Everything downstream — standings, career
            records, the points races — is derived from those normalized rows,
            so a new source only ever means a new adapter.
          </p>
        </section>

        <section>
          <h2 className="headline text-2xl">How a number becomes a row</h2>
          <ol className="mt-3 space-y-3">
            {[
              ["Discover", "The adapter lists the season's events and resolves each to a stable external id."],
              ["Fetch", "One event at a time, rate-limited, with the raw payload retained for debugging."],
              ["Normalize", "Weights are parsed to decimal pounds, places and points to numbers, anglers matched to existing records by name and hometown."],
              ["Upsert", "Rows are written by natural key, so re-running a scrape corrects a result rather than duplicating it."],
              ["Derive", "Season standings are recomputed from the event results that feed them."],
              ["Revalidate", "Only the cache tags the run actually touched are invalidated."],
            ].map(([step, detail], i) => (
              <li key={step} className="flex gap-4">
                <span className="tnum eyebrow mt-0.5 shrink-0 text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>
                  <strong className="font-semibold">{step}.</strong> {detail}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="headline text-2xl">Weights</h2>
          <p className="mt-3">
            Weights are stored as decimal pounds and displayed the way a
            scoreboard shows them — pounds and ounces, so{" "}
            <span className="tnum">21-6</span> means 21 pounds 6 ounces. Hovering
            a total shows the decimal value the ranking actually used.
          </p>
        </section>

        <section>
          <h2 className="headline text-2xl">Corrections</h2>
          <p className="mt-3">
            Official results are occasionally amended after a weigh-in — a
            penalty applied, a disqualification, a correction to a payout. Every
            re-scrape overwrites by natural key, so a corrected result replaces
            the earlier one instead of creating a second copy. Where an
            organization publishes a source page for an event, it is linked at
            the bottom of that event.
          </p>
        </section>

        <section>
          <h2 className="headline text-2xl">Independence</h2>
          <p className="mt-3">
            bass-stats is an independent project with no affiliation to B.A.S.S.,
            Major League Fishing or the National Professional Fishing League.
            Series names, event names and organization names are used to
            identify the competitions they belong to.
          </p>
        </section>

        <p className="border-t border-line pt-6 text-sm text-muted">
          Browse the <Link href="/events" className="text-accent underline underline-offset-2">events</Link>{" "}
          or the{" "}
          <Link href="/anglers" className="text-accent underline underline-offset-2">angler directory</Link>.
        </p>
      </div>
    </div>
  );
}
