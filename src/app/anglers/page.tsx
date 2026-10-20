import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getCatalog, listAnglerStates, listAnglers } from "@/lib/data";
import { AnglerCard } from "@/components/anglers/AnglerCard";
import { AnglerFilters } from "@/components/anglers/AnglerFilters";
import { PageHeader } from "@/components/layout/PageHeader";
import type { AnglerClass } from "@/lib/types";

export const metadata: Metadata = {
  title: "Anglers",
  description:
    "Profiles and career records for every angler, from high school teams through the professional tours.",
};

const PER_PAGE = 48;

export default function AnglersPage({ searchParams }: PageProps<"/anglers">) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <PageHeader
        kicker="Directory"
        title="Anglers"
        description="Every competitor on record — amateur through professional — with career earnings, wins and a full event history."
      />
      <Suspense fallback={<div className="card h-36 animate-pulse" />}>
        <Filters />
      </Suspense>
      <Suspense fallback={<GridSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Filters() {
  const [{ organizations }, states] = await Promise.all([getCatalog(), listAnglerStates()]);

  return (
    <AnglerFilters
      orgs={organizations.map((o) => ({ slug: o.slug, name: o.name }))}
      states={states}
    />
  );
}

async function Results({ searchParams }: Pick<PageProps<"/anglers">, "searchParams">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const page = Math.max(1, Number(one(sp.page) ?? 1) || 1);
  const sortParam = one(sp.sort);
  const sort =
    sortParam === "name" || sortParam === "wins" || sortParam === "events"
      ? sortParam
      : "earnings";

  const { items, total } = await listAnglers({
    search: one(sp.search),
    anglerClass: one(sp.class) as AnglerClass | undefined,
    state: one(sp.state),
    orgSlug: one(sp.org),
    sort,
    limit: PER_PAGE,
    offset: (page - 1) * PER_PAGE,
  });

  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const query = (n: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      const val = Array.isArray(v) ? v[0] : v;
      if (val && k !== "page") next.set(k, val);
    }
    if (n > 1) next.set("page", String(n));
    const qs = next.toString();
    return qs ? `/anglers?${qs}` : "/anglers";
  };

  return (
    <>
      <p className="mt-5 mb-4 text-sm text-muted" aria-live="polite">
        <span className="tnum font-medium text-ink">{total.toLocaleString("en-US")}</span>{" "}
        {total === 1 ? "angler" : "anglers"}
        {pages > 1 ? ` · page ${page} of ${pages}` : ""}
      </p>

      {items.length === 0 ? (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <p className="headline text-xl">No anglers match</p>
          <p className="mt-1.5 max-w-sm text-sm text-muted">
            Try a different spelling, or clear the class and state filters.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <AnglerCard key={item.angler.id} item={item} />
          ))}
        </div>
      )}

      {pages > 1 ? (
        <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Pagination">
          <PageLink href={query(page - 1)} disabled={page === 1}>← Previous</PageLink>
          <span className="tnum px-3 text-sm text-muted">
            {page} / {pages}
          </span>
          <PageLink href={query(page + 1)} disabled={page === pages}>Next →</PageLink>
        </nav>
      ) : null}
    </>
  );
}

function PageLink({
  href, disabled, children,
}: {
  href: string; disabled: boolean; children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="rounded-md border border-line px-3 py-2 text-sm text-faint">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-md border border-line px-3 py-2 text-sm transition-colors hover:border-accent/50 hover:text-accent"
    >
      {children}
    </Link>
  );
}

function GridSkeleton() {
  return (
    <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} className="card h-44 animate-pulse" />
      ))}
    </div>
  );
}
