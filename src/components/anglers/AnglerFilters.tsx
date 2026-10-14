"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { CLASS_LABEL } from "@/lib/format";
import type { AnglerClass } from "@/lib/types";

const CLASSES: AnglerClass[] = [
  "pro", "boater", "co_angler", "amateur", "college", "high_school",
];

const SORTS = [
  ["earnings", "Career earnings"],
  ["wins", "Wins"],
  ["events", "Events fished"],
  ["name", "Name"],
] as const;

/**
 * The angler directory is server-paginated over 1,000+ records, so filters
 * live in the URL and each change refetches a page rather than shipping the
 * whole roster to the browser.
 */
export function AnglerFilters({
  orgs,
  states,
}: {
  orgs: Array<{ slug: string; name: string }>;
  states: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  // The box is a local draft of the "search" URL param, so it can update on
  // every keystroke without a navigation. When the param changes from
  // elsewhere — a browser back/forward, a link with a different query — the
  // draft needs to catch up. That adjustment happens here, during render
  // (React's documented pattern for "reset state when a prop changes"),
  // rather than in an effect, which would commit the stale value for one
  // extra frame before correcting it.
  const urlSearch = params.get("search") ?? "";
  const [search, setSearch] = useState(urlSearch);
  const [trackedUrlSearch, setTrackedUrlSearch] = useState(urlSearch);
  if (urlSearch !== trackedUrlSearch) {
    setTrackedUrlSearch(urlSearch);
    setSearch(urlSearch);
  }

  function apply(next: Record<string, string>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    sp.delete("page");
    startTransition(() => router.replace(`${pathname}?${sp.toString()}`, { scroll: false }));
  }

  // Debounce typing so each keystroke doesn't trigger a query.
  useEffect(() => {
    const current = params.get("search") ?? "";
    if (search === current) return;
    const t = setTimeout(() => apply({ search }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const active =
    ["search", "class", "state", "org"].filter((k) => params.get(k)).length;

  return (
    <div className="card p-3 sm:p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="block lg:col-span-2">
          <span className="eyebrow mb-1.5 block text-faint">Search</span>
          <div className="relative">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or hometown"
              className="w-full rounded-md border border-line bg-bg px-3 py-2 text-sm placeholder:text-faint focus:border-accent/60 focus:outline-none"
            />
            {pending ? (
              <Loader2
                size={14}
                className="absolute top-1/2 right-3 -translate-y-1/2 animate-spin text-faint"
              />
            ) : null}
          </div>
        </label>

        <Select
          label="Class"
          value={params.get("class") ?? ""}
          onChange={(v) => apply({ class: v })}
        >
          <option value="">All classes</option>
          {CLASSES.map((c) => (
            <option key={c} value={c}>{CLASS_LABEL[c]}</option>
          ))}
        </Select>

        <Select
          label="Organization"
          value={params.get("org") ?? ""}
          onChange={(v) => apply({ org: v })}
        >
          <option value="">All organizations</option>
          {orgs.map((o) => (
            <option key={o.slug} value={o.slug}>{o.name}</option>
          ))}
        </Select>

        <Select
          label="Home state"
          value={params.get("state") ?? ""}
          onChange={(v) => apply({ state: v })}
        >
          <option value="">Anywhere</option>
          {states.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="eyebrow text-faint">Sort</span>
          <div className="flex flex-wrap gap-1">
            {SORTS.map(([value, label]) => {
              const current = params.get("sort") ?? "earnings";
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => apply({ sort: value })}
                  aria-pressed={current === value}
                  className={`rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                    current === value
                      ? "bg-accent text-accent-ink"
                      : "bg-surface-2 text-muted hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {active > 0 ? (
          <button
            type="button"
            onClick={() => startTransition(() => router.replace(pathname, { scroll: false }))}
            className="ml-auto flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs text-muted transition-colors hover:text-ink"
          >
            <X size={13} /> Clear filters
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="eyebrow mb-1.5 block text-faint">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full truncate rounded-md border border-line bg-bg px-2.5 py-2 text-sm focus:border-accent/60 focus:outline-none"
      >
        {children}
      </select>
    </label>
  );
}
