"use client";

import { useMemo, useState } from "react";
import { LayoutGrid, List, X } from "lucide-react";
import { EventCard } from "./EventCard";
import { EventRow } from "./EventRow";
import { cn } from "@/lib/cn";
import { LEVEL_LABEL } from "@/lib/format";
import type { BrowseCatalog, EventItem } from "@/lib/event-item";
import type { EventStatus } from "@/lib/types";

/**
 * Organization → series → division → event, filtered live.
 *
 * The whole event list is handed over up front (a few dozen KB), so every
 * filter change is instant and nothing round-trips to the server.
 */
export function EventBrowser({
  events,
  catalog,
  initial,
}: {
  events: EventItem[];
  catalog: BrowseCatalog;
  /** Deep-link defaults from the query string. */
  initial?: {
    org?: string; series?: string; division?: string; year?: string; status?: string;
  };
}) {
  const [org, setOrg] = useState(initial?.org ?? "");
  const [series, setSeries] = useState(initial?.series ?? "");
  const [division, setDivision] = useState(initial?.division ?? "");
  const [year, setYear] = useState(initial?.year ?? "");
  const [status, setStatus] = useState<EventStatus | "">(
    (initial?.status as EventStatus | undefined) ?? "",
  );
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"cards" | "list">("cards");

  // Each level of the cascade only offers what the level above allows.
  const seriesOptions = useMemo(
    () => catalog.series.filter((s) => (org ? s.orgSlug === org : true)),
    [catalog.series, org],
  );
  const divisionOptions = useMemo(
    () =>
      catalog.divisions.filter((d) =>
        series
          ? d.seriesSlug === series
          : seriesOptions.some((s) => s.slug === d.seriesSlug),
      ),
    [catalog.divisions, series, seriesOptions],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (org && e.orgSlug !== org) return false;
      if (series && e.seriesSlug !== series) return false;
      if (division && e.divisionSlug !== division) return false;
      if (year && String(e.year) !== year) return false;
      if (status && e.status !== status) return false;
      if (q) {
        const hay = `${e.name} ${e.waterBody ?? ""} ${e.city ?? ""} ${e.state ?? ""} ${e.seriesName} ${e.winnerName ?? ""}`;
        if (!hay.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [events, org, series, division, year, status, search]);

  const active = [org, series, division, year, status, search].filter(Boolean).length;

  function reset() {
    setOrg(""); setSeries(""); setDivision(""); setYear(""); setStatus(""); setSearch("");
  }

  return (
    <div>
      <div className="card p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Organization">
            <Select
              value={org}
              onChange={(v) => { setOrg(v); setSeries(""); setDivision(""); }}
            >
              <option value="">All organizations</option>
              {catalog.orgs.map((o) => (
                <option key={o.slug} value={o.slug}>{o.name}</option>
              ))}
            </Select>
          </Field>

          <Field label="Series">
            <Select value={series} onChange={(v) => { setSeries(v); setDivision(""); }}>
              <option value="">All series</option>
              {seriesOptions.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name} — {LEVEL_LABEL[s.level]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Division">
            <Select
              value={division}
              onChange={setDivision}
              disabled={divisionOptions.length === 0}
            >
              <option value="">
                {divisionOptions.length ? "All divisions" : "No divisions"}
              </option>
              {divisionOptions.map((d) => (
                <option key={d.slug} value={d.slug}>{d.name}</option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Season">
              <Select value={year} onChange={setYear}>
                <option value="">All</option>
                {catalog.years.map((y) => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={status} onChange={(v) => setStatus(v as EventStatus | "")}>
                <option value="">Any</option>
                <option value="in_progress">Live</option>
                <option value="official">Final</option>
                <option value="scheduled">Upcoming</option>
              </Select>
            </Field>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by water, town or winner"
            aria-label="Filter events"
            className="min-w-0 flex-1 rounded-md border border-line bg-bg px-3 py-2 text-sm placeholder:text-faint focus:border-accent/60 focus:outline-none"
          />

          {active > 0 ? (
            <button
              type="button"
              onClick={reset}
              className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-2 text-xs text-muted transition-colors hover:text-ink"
            >
              <X size={13} /> Clear {active}
            </button>
          ) : null}

          <div className="flex overflow-hidden rounded-md border border-line" role="group" aria-label="View">
            {([["cards", LayoutGrid], ["list", List]] as const).map(([mode, Icon]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                aria-pressed={view === mode}
                aria-label={`${mode} view`}
                className={cn(
                  "grid size-9 place-items-center transition-colors",
                  view === mode ? "bg-accent text-accent-ink" : "text-muted hover:bg-surface-2",
                )}
              >
                <Icon size={15} />
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-4 mb-3 text-sm text-muted" aria-live="polite">
        <span className="tnum font-medium text-ink">{filtered.length}</span>{" "}
        {filtered.length === 1 ? "event" : "events"}
        {active > 0 ? " match your filters" : ""}
      </p>

      {filtered.length === 0 ? (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <p className="headline text-xl">Nothing matches</p>
          <p className="mt-1.5 max-w-sm text-sm text-muted">
            Try widening the season or clearing the division filter.
          </p>
        </div>
      ) : view === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      ) : (
        <ul className="card overflow-hidden">
          {filtered.map((e) => (
            <EventRow key={e.id} event={e} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="eyebrow mb-1.5 block text-faint">{label}</span>
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  disabled,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="w-full truncate rounded-md border border-line bg-bg px-2.5 py-2 text-sm text-ink focus:border-accent/60 focus:outline-none disabled:opacity-50"
    >
      {children}
    </select>
  );
}
