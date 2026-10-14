import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { getCatalog, getWinners, listArticles, listEvents } from "@/lib/data";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { EventCard } from "@/components/events/EventCard";
import { ArticleCard } from "@/components/news/ArticleCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { StatTile } from "@/components/ui/StatTile";
import { toEventItem } from "@/lib/event-item";
import { FORMAT_LABEL, LEVEL_LABEL } from "@/lib/format";

export async function generateStaticParams() {
  const { organizations } = await getCatalog();
  return organizations.map((o) => ({ slug: o.slug }));
}

export async function generateMetadata(
  { params }: PageProps<"/organizations/[slug]">,
): Promise<Metadata> {
  const { slug } = await params;
  const { organizations } = await getCatalog();
  const org = organizations.find((o) => o.slug === slug);
  if (!org) return { title: "Organization not found" };
  return { title: org.name, description: org.description ?? undefined };
}

export default async function OrganizationPage({
  params,
}: PageProps<"/organizations/[slug]">) {
  const { slug } = await params;
  const catalog = await getCatalog();
  const org = catalog.organizations.find((o) => o.slug === slug);
  if (!org) notFound();

  const own = catalog.series.filter((s) => s.orgId === org.id);
  const seasonCount = catalog.seasons.filter((s) =>
    own.some((x) => x.id === s.seriesId),
  ).length;
  const divisionCount = catalog.divisions.filter((d) =>
    own.some((x) => x.id === d.seriesId),
  ).length;

  return (
    <article>
      <header className="relative border-b border-line bg-elevated">
        <span
          className="absolute inset-x-0 top-0 h-1"
          style={{ background: org.accentColor }}
          aria-hidden
        />
        <div className="mx-auto max-w-7xl px-4 py-10">
          <Breadcrumbs
            items={[{ href: "/organizations", label: "Organizations" }, { label: org.shortName }]}
          />
          <h1 className="headline mt-4 text-4xl sm:text-5xl">{org.name}</h1>
          {org.description ? (
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted">
              {org.description}
            </p>
          ) : null}

          {org.website ? (
            <a
              href={org.website}
              rel="noopener noreferrer nofollow"
              target="_blank"
              className="eyebrow mt-4 inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-2 text-muted transition-colors hover:text-ink"
            >
              {org.website.replace(/^https?:\/\//, "")} <ExternalLink size={12} />
            </a>
          ) : null}

          <dl className="mt-8 grid grid-cols-3 gap-3 sm:max-w-lg">
            <StatTile label="Series" value={own.length} />
            <StatTile label="Divisions" value={divisionCount} />
            <StatTile label="Seasons" value={seasonCount} />
          </dl>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-10">
        <section>
          <SectionHeader kicker="What they run" title="Series" />
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {own.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/series/${s.slug}`}
                  className="card flex h-full flex-col p-4 transition-colors hover:border-accent/40"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="outline">{LEVEL_LABEL[s.level]}</Badge>
                    <Badge tone="water">{FORMAT_LABEL[s.format]}</Badge>
                  </div>
                  <h3 className="headline mt-2.5 text-lg">{s.name}</h3>
                  {s.description ? (
                    <p className="mt-2 line-clamp-3 text-sm text-muted">{s.description}</p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <Suspense fallback={null}>
          <RecentEvents orgSlug={org.slug} />
        </Suspense>

        <Suspense fallback={null}>
          <OrgNews orgId={org.id} />
        </Suspense>
      </div>
    </article>
  );
}

async function RecentEvents({ orgSlug }: { orgSlug: string }) {
  const events = await listEvents({ orgSlug, limit: 8 });
  if (!events.length) return null;
  const winners = await getWinners(events.map((e) => e.id));

  return (
    <section className="mt-14">
      <SectionHeader
        kicker="Results"
        title="Recent events"
        href={`/events?org=${orgSlug}`}
        hrefLabel="All events"
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {events.map((e) => (
          <EventCard key={e.id} event={toEventItem(e, winners[e.id])} />
        ))}
      </div>
    </section>
  );
}

async function OrgNews({ orgId }: { orgId: string }) {
  const articles = (await listArticles(30)).filter((a) => a.orgId === orgId).slice(0, 4);
  if (!articles.length) return null;

  return (
    <section className="mt-14">
      <SectionHeader kicker="Coverage" title="Latest breakdowns" href="/news" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {articles.map((a) => (
          <ArticleCard key={a.id} article={a} />
        ))}
      </div>
    </section>
  );
}
