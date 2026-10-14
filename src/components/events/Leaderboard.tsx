"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { CLASS_LABEL, money, ordinal, weightDecimal, weightLbsOz } from "@/lib/format";
import type { AnglerClass } from "@/lib/types";

export interface BoardRow {
  id: string;
  place: number | null;
  status: string;
  anglerClass: AnglerClass;
  slug: string;
  name: string;
  firstName: string;
  lastName: string;
  hometown: string;
  photoUrl: string | null;
  totalWeight: number | null;
  totalFish: number | null;
  bigBass: number | null;
  points: number | null;
  payoutUsd: number | null;
  days: Array<{ dayNumber: number; weight: number | null; fishCount: number | null }>;
}

export function Leaderboard({
  rows,
  daysScheduled,
  cutTo,
  live,
}: {
  rows: BoardRow[];
  daysScheduled: number | null;
  cutTo: number | null;
  live: boolean;
}) {
  const classes = useMemo(() => {
    const seen: AnglerClass[] = [];
    for (const r of rows) if (!seen.includes(r.anglerClass)) seen.push(r.anglerClass);
    return seen;
  }, [rows]);

  const [tab, setTab] = useState<AnglerClass>(classes[0] ?? "pro");
  const board = useMemo(
    () => rows.filter((r) => r.anglerClass === tab).sort((a, b) => (a.place ?? 1e9) - (b.place ?? 1e9)),
    [rows, tab],
  );

  const dayCount = Math.max(
    daysScheduled ?? 0,
    ...board.map((r) => r.days.length),
    0,
  );
  const dayNumbers = Array.from({ length: dayCount }, (_, i) => i + 1);
  const showCut = cutTo != null && cutTo > 0 && cutTo < board.length && dayCount > 2;

  return (
    <section aria-label="Leaderboard">
      {classes.length > 1 ? (
        <div className="mb-3 flex gap-1 overflow-x-auto" role="tablist" aria-label="Division">
          {classes.map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={tab === c}
              onClick={() => setTab(c)}
              className={cn(
                "eyebrow shrink-0 rounded-md px-3 py-2 transition-colors",
                tab === c
                  ? "bg-accent text-accent-ink"
                  : "bg-surface-2 text-muted hover:text-ink",
              )}
            >
              {CLASS_LABEL[c]}
            </button>
          ))}
        </div>
      ) : null}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] text-sm">
            <caption className="sr-only">
              Final standings{live ? " (in progress)" : ""}
            </caption>
            <thead>
              <tr className="border-b border-line bg-surface-2/60 text-left">
                <Th className="w-14 text-center">#</Th>
                <Th>Angler</Th>
                {dayNumbers.map((d) => (
                  <Th key={d} className="w-20 text-right">
                    Day {d}
                  </Th>
                ))}
                <Th className="w-24 text-right">Total</Th>
                <Th className="w-16 text-right">Fish</Th>
                <Th className="hidden w-20 text-right lg:table-cell">Big bass</Th>
                <Th className="hidden w-16 text-right lg:table-cell">Pts</Th>
                <Th className="w-24 text-right">Payout</Th>
              </tr>
            </thead>
            <tbody>
              {board.map((r) => {
                const atCut = showCut && r.place === cutTo;
                return (
                  <tr
                    key={r.id}
                    className={cn(
                      "border-b border-line-soft transition-colors last:border-0 hover:bg-surface-2/60",
                      r.place === 1 && "bg-gold/[0.06]",
                      atCut && "border-b-2 border-b-accent/50",
                    )}
                  >
                    <Td className="text-center">
                      <span
                        className={cn(
                          "tnum font-semibold",
                          r.place === 1 && "text-gold",
                          r.place != null && r.place <= 10 && r.place !== 1 && "text-water",
                        )}
                      >
                        {r.place ?? "—"}
                      </span>
                    </Td>
                    <Td>
                      <Link
                        href={`/anglers/${r.slug}`}
                        className="flex items-center gap-2.5 hover:text-accent"
                      >
                        <Avatar
                          firstName={r.firstName}
                          lastName={r.lastName}
                          slug={r.slug}
                          photoUrl={r.photoUrl}
                          size={28}
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{r.name}</span>
                          {r.hometown ? (
                            <span className="block truncate text-xs text-muted">{r.hometown}</span>
                          ) : null}
                        </span>
                      </Link>
                    </Td>
                    {dayNumbers.map((d) => {
                      const day = r.days.find((x) => x.dayNumber === d);
                      return (
                        <Td key={d} className="tnum text-right text-muted">
                          {day?.weight != null ? weightLbsOz(day.weight) : "—"}
                        </Td>
                      );
                    })}
                    <Td className="tnum text-right font-semibold" title={weightDecimal(r.totalWeight)}>
                      {weightLbsOz(r.totalWeight)}
                    </Td>
                    <Td className="tnum text-right text-muted">{r.totalFish ?? "—"}</Td>
                    <Td className="tnum hidden text-right text-muted lg:table-cell">
                      {r.bigBass != null ? weightLbsOz(r.bigBass) : "—"}
                    </Td>
                    <Td className="tnum hidden text-right text-muted lg:table-cell">
                      {r.points != null ? Math.round(r.points) : "—"}
                    </Td>
                    <Td className="tnum text-right">
                      {r.payoutUsd ? money(r.payoutUsd) : <span className="text-faint">—</span>}
                    </Td>
                  </tr>
                );
              })}
              {board.length === 0 ? (
                <tr>
                  <td colSpan={dayNumbers.length + 6} className="px-4 py-12 text-center text-muted">
                    No results posted yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {showCut ? (
        <p className="mt-2 text-xs text-muted">
          The accent rule marks the cut to {ordinal(cutTo)}; anglers below it did
          not fish the final round.
        </p>
      ) : null}
    </section>
  );
}

function Th({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <th scope="col" className={cn("eyebrow px-3 py-2.5 text-faint", className)}>
      {children}
    </th>
  );
}

function Td({ className, children, title }: { className?: string; children: React.ReactNode; title?: string }) {
  return (
    <td className={cn("px-3 py-2.5", className)} title={title}>
      {children}
    </td>
  );
}
