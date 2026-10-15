import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { getArticleBySlug, getLeaderboard, listArticles } from "@/lib/data";
import { Markdown } from "@/components/news/Markdown";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { EventArt } from "@/components/ui/EventArt";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { ArticleCard } from "@/components/news/ArticleCard";
import { Avatar } from "@/components/ui/Avatar";
import { dateRange, money, weightLbsOz } from "@/lib/format";

// No generateStaticParams: `articles` can be empty on a fresh database
// (nothing currently writes editorial articles for a live Supabase project —
// the sample fixture's recaps are generated locally, not scraped), and
// Next's Cache Components treat an empty array from this export as a build
// error rather than "nothing to prerender yet." Going fully dynamic here
// means the build always succeeds regardless of database state; the page is
// still cached per-request via the "use cache" layer in src/lib/data.

export async function generateMetadata(
  { params }: PageProps<"/news/[slug]">,
): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return { title: "Article not found" };
  return {
    title: article.title,
    description: article.dek ?? undefined,
    openGraph: {
      title: article.title,
      description: article.dek ?? undefined,
      type: "article",
      publishedTime: article.publishedAt,
    },
  };
}

export default function ArticlePage({ params }: PageProps<"/news/[slug]">) {
  return (
    <Suspense fallback={<ArticlePageSkeleton />}>
      <ArticlePageContent params={params} />
    </Suspense>
  );
}

function ArticlePageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="card h-56 animate-pulse" />
      <div className="card mt-6 h-96 animate-pulse" />
    </div>
  );
}

async function ArticlePageContent({
  params,
}: Pick<PageProps<"/news/[slug]">, "params">) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) notFound();

  const event = article.event;
  const board = event ? await getLeaderboard(event.id) : [];
  const primaryClass = board[0]?.anglerClass;
  const top = board.filter((r) => r.anglerClass === primaryClass).slice(0, 10);

  const more = (await listArticles(8)).filter((a) => a.id !== article.id).slice(0, 4);

  return (
    <article>
      <header className="relative isolate overflow-hidden border-b border-line">
        <EventArt
          slug={event?.slug ?? article.slug}
          imageUrl={article.heroImageUrl}
          label={event?.waterBody}
          className="absolute inset-0 -z-10 size-full"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-bg via-bg/90 to-bg/60" />

        <div className="mx-auto max-w-7xl px-4 py-12">
          <Breadcrumbs
            items={[
              { href: "/news", label: "News" },
              ...(article.org
                ? [{ href: `/organizations/${article.org.slug}`, label: article.org.shortName }]
                : []),
              { label: article.title },
            ]}
          />
          <p className="eyebrow mt-5 text-accent">
            {article.type === "recap" ? "Event breakdown" : article.type}
          </p>
          <h1 className="headline mt-2 max-w-4xl text-4xl sm:text-5xl lg:text-6xl">
            {article.title}
          </h1>
          {article.dek ? (
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">{article.dek}</p>
          ) : null}
          <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">
            {article.author ? <span>By {article.author}</span> : null}
            <TimeAgo iso={article.publishedAt} />
            {event ? (
              <span>
                {event.waterBody} · {dateRange(event.startDate, event.endDate)}
              </span>
            ) : null}
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 lg:grid-cols-[1fr_22rem]">
        <div className="max-w-2xl">
          {article.bodyMd ? <Markdown source={article.bodyMd} /> : null}

          {event ? (
            <Link
              href={`/events/${event.slug}`}
              className="card mt-10 flex items-center gap-4 p-5 transition-colors hover:border-accent/40"
            >
              <span className="min-w-0 flex-1">
                <span className="eyebrow block text-accent">Full results</span>
                <span className="headline mt-1 block text-lg">
                  {event.name}
                </span>
                <span className="mt-0.5 block text-sm text-muted">
                  {event.fieldSize ? `${event.fieldSize} anglers · ` : ""}
                  {dateRange(event.startDate, event.endDate)}
                </span>
              </span>
              <ArrowRight size={18} className="shrink-0 text-muted" />
            </Link>
          ) : null}

          {article.tags.length ? (
            <ul className="mt-8 flex flex-wrap gap-2">
              {article.tags.map((t) => (
                <li key={t} className="rounded-md border border-line bg-surface px-2.5 py-1 text-xs text-muted">
                  {t}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {top.length ? (
          <aside className="self-start lg:sticky lg:top-28">
            <div className="card overflow-hidden">
              <h2 className="eyebrow border-b border-line bg-surface-2/60 px-4 py-3 text-faint">
                Final standings
              </h2>
              <ol>
                {top.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/anglers/${r.angler.slug}`}
                      className="flex items-center gap-3 border-b border-line-soft px-4 py-2.5 transition-colors last:border-0 hover:bg-surface-2"
                    >
                      <span
                        className={`tnum w-5 text-right text-sm font-semibold ${
                          r.place === 1 ? "text-gold" : "text-muted"
                        }`}
                      >
                        {r.place}
                      </span>
                      <Avatar
                        firstName={r.angler.firstName}
                        lastName={r.angler.lastName}
                        slug={r.angler.slug}
                        photoUrl={r.angler.photoUrl}
                        size={26}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{r.angler.displayName}</span>
                        {r.payoutUsd ? (
                          <span className="tnum block text-xs text-faint">
                            {money(r.payoutUsd, true)}
                          </span>
                        ) : null}
                      </span>
                      <span className="tnum shrink-0 text-sm font-semibold">
                        {weightLbsOz(r.totalWeight)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
              {event ? (
                <Link
                  href={`/events/${event.slug}`}
                  className="eyebrow block border-t border-line px-4 py-3 text-center text-muted transition-colors hover:text-accent"
                >
                  Full leaderboard →
                </Link>
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>

      {more.length ? (
        <section className="mx-auto max-w-7xl px-4 pb-16">
          <h2 className="headline mb-4 border-t border-line pt-10 text-2xl">More coverage</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {more.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
