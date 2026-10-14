import Link from "next/link";
import { getCatalog, dataSource } from "@/lib/data";
import { NAV_ITEMS } from "./nav-items";

export async function SiteFooter() {
  const { organizations, series } = await getCatalog();

  return (
    <footer className="mt-20 border-t border-line bg-elevated">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="headline text-xl">BASS</span>
              <span className="headline rounded bg-accent px-1.5 text-xl text-accent-ink">
                STATS
              </span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-muted">
              Standings, results and angler records across every series in
              professional and amateur tournament bass fishing.
            </p>
          </div>

          <nav aria-label="Browse">
            <h2 className="eyebrow text-faint">Browse</h2>
            <ul className="mt-3 space-y-2">
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm text-muted hover:text-ink">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Organizations">
            <h2 className="eyebrow text-faint">Organizations</h2>
            <ul className="mt-3 space-y-2">
              {organizations.map((org) => (
                <li key={org.id}>
                  <Link
                    href={`/organizations/${org.slug}`}
                    className="text-sm text-muted hover:text-ink"
                  >
                    {org.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Top series">
            <h2 className="eyebrow text-faint">Top series</h2>
            <ul className="mt-3 space-y-2">
              {series
                .filter((s) => s.level === "professional")
                .slice(0, 6)
                .map((s) => (
                  <li key={s.id}>
                    <Link href={`/series/${s.slug}`} className="text-sm text-muted hover:text-ink">
                      {s.name}
                    </Link>
                  </li>
                ))}
            </ul>
          </nav>
        </div>

        <div className="hairline my-8" />

        <div className="flex flex-col gap-3 text-xs text-faint sm:flex-row sm:items-center sm:justify-between">
          <p>
            bass-stats is an independent project and is not affiliated with
            B.A.S.S., Major League Fishing or the NPFL.
          </p>
          <p>
            Data source:{" "}
            <Link href="/about-the-data" className="text-muted underline underline-offset-2">
              {dataSource === "sample" ? "sample dataset" : "live database"}
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
