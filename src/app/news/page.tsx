import { Suspense } from "react";
import type { Metadata } from "next";
import { listArticles } from "@/lib/data";
import { ArticleCard } from "@/components/news/ArticleCard";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata: Metadata = {
  title: "News",
  description: "Event breakdowns, winning patterns and points-race analysis.",
};

export default function NewsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <PageHeader
        kicker="Coverage"
        title="Breakdowns"
        description="What won, how it was won, and what it did to the points race — one write-up per event."
      />
      <Suspense fallback={<Skeleton />}>
        <Feed />
      </Suspense>
    </div>
  );
}

async function Feed() {
  const articles = await listArticles(40);
  const [lead, ...rest] = articles;
  if (!lead) {
    return (
      <p className="card px-6 py-16 text-center text-sm text-muted">
        No articles published yet.
      </p>
    );
  }

  return (
    <>
      <ArticleCard article={lead} className="mb-8 sm:[&_h3]:text-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {rest.map((a) => (
          <ArticleCard key={a.id} article={a} />
        ))}
      </div>
    </>
  );
}

function Skeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="card h-64 animate-pulse" />
      ))}
    </div>
  );
}
