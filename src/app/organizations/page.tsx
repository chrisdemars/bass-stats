import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { getCatalog } from "@/lib/data";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { FORMAT_LABEL, LEVEL_LABEL } from "@/lib/format";

export const metadata: Metadata = {
  title: "Organizations",
  description:
    "B.A.S.S., Major League Fishing and the National Professional Fishing League — every series each one runs.",
};

export default function OrganizationsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <PageHeader
        kicker="The circuits"
        title="Organizations"
        description="Three organizations run competitive bass fishing in the United States. Here is every series under each, from high school through the top professional tour."
      />
      <Suspense fallback={<div className="card h-96 animate-pulse" />}>
        <OrgList />
      </Suspense>
    </div>
  );
}

async function OrgList() {
  const { organizations, series, divisions } = await getCatalog();

  return (
    <div className="space-y-14">
      {organizations.map((org) => {
        const own = series.filter((s) => s.orgId === org.id);
        return (
          <section key={org.id}>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
              <div className="max-w-2xl">
                <div className="flex items-center gap-3">
                  <span
                    className="h-7 w-1 rounded-full"
                    style={{ background: org.accentColor }}
                    aria-hidden
                  />
                  <h2 className="headline text-3xl">
                    <Link href={`/organizations/${org.slug}`} className="hover:text-accent">
                      {org.name}
                    </Link>
                  </h2>
                </div>
                <p className="mt-3 leading-relaxed text-muted">{org.description}</p>
              </div>
              {org.website ? (
                <a
                  href={org.website}
                  rel="noopener noreferrer nofollow"
                  target="_blank"
                  className="eyebrow flex items-center gap-1.5 rounded-md border border-line px-3 py-2 text-muted transition-colors hover:text-ink"
                >
                  Official site <ExternalLink size={12} />
                </a>
              ) : null}
            </div>

            <ul className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {own.map((s) => {
                const divs = divisions.filter((d) => d.seriesId === s.id);
                return (
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
                      {divs.length ? (
                        <p className="mt-auto pt-3 text-xs text-faint">
                          {divs.length} divisions ·{" "}
                          {divs.slice(0, 3).map((d) => d.region ?? d.name).join(", ")}
                          {divs.length > 3 ? "…" : ""}
                        </p>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
