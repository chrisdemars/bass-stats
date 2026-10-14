import Link from "next/link";
import { getCatalog, dataSource } from "@/lib/data";
import { NAV_ITEMS } from "./nav-items";
import { MobileNav } from "./MobileNav";
import { ThemeToggle } from "./ThemeToggle";
import { SiteSearch } from "./SiteSearch";

export async function SiteHeader() {
  const { organizations } = await getCatalog();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
      {/* Utility strip: jump straight to an organization. */}
      <div className="hidden border-b border-line-soft lg:block">
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-between gap-6 px-4">
          <nav aria-label="Organizations">
            <ul className="flex items-center gap-1">
              {organizations.map((org) => (
                <li key={org.id}>
                  <Link
                    href={`/organizations/${org.slug}`}
                    className="eyebrow flex items-center gap-1.5 rounded px-2 py-1 text-faint transition-colors hover:bg-surface-2 hover:text-ink"
                  >
                    <span
                      className="size-1.5 rounded-full"
                      style={{ background: org.accentColor }}
                      aria-hidden
                    />
                    {org.shortName}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex items-center gap-3">
            {dataSource === "sample" ? (
              <Link
                href="/about-the-data"
                className="eyebrow rounded border border-gold/30 bg-gold/10 px-2 py-0.5 text-gold"
              >
                Sample data
              </Link>
            ) : null}
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Masthead */}
      <div className="relative mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <Link href="/" className="flex shrink-0 items-baseline gap-1.5">
          <span className="headline text-2xl tracking-tight">BASS</span>
          <span className="headline rounded bg-accent px-1.5 text-2xl text-accent-ink">
            STATS
          </span>
        </Link>

        <nav aria-label="Main" className="ml-4 hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <SiteSearch className="relative hidden w-64 md:block xl:w-80" />
          <span className="lg:hidden">
            <ThemeToggle />
          </span>
          <MobileNav items={NAV_ITEMS} />
        </div>
      </div>

      <div className="px-4 pb-3 md:hidden">
        <SiteSearch className="relative" />
      </div>
    </header>
  );
}
