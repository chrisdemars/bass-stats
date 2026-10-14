import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { money, weightLbsOz } from "@/lib/format";
import type { StandingRow } from "@/lib/types";

export function StandingsTable({
  rows,
  limit,
  showEarnings = true,
  qualifyLabel,
}: {
  rows: StandingRow[];
  limit?: number;
  showEarnings?: boolean;
  /** e.g. "Classic berth" — drawn as a rule under the last qualifying angler. */
  qualifyLabel?: string;
}) {
  const shown = limit ? rows.slice(0, limit) : rows;
  const lastQualified = qualifyLabel
    ? shown.reduce((acc, r) => (r.qualified ? r.rank ?? acc : acc), 0)
    : 0;

  if (shown.length === 0) {
    return (
      <div className="card px-6 py-12 text-center text-sm text-muted">
        No standings posted for this season yet.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2/60 text-left">
              <th scope="col" className="eyebrow w-14 px-3 py-2.5 text-center text-faint">#</th>
              <th scope="col" className="eyebrow px-3 py-2.5 text-faint">Angler</th>
              <th scope="col" className="eyebrow w-20 px-3 py-2.5 text-right text-faint">Pts</th>
              <th scope="col" className="eyebrow w-16 px-3 py-2.5 text-right text-faint">Ev</th>
              <th scope="col" className="eyebrow hidden w-16 px-3 py-2.5 text-right text-faint sm:table-cell">Wins</th>
              <th scope="col" className="eyebrow hidden w-20 px-3 py-2.5 text-right text-faint md:table-cell">Top 10</th>
              <th scope="col" className="eyebrow hidden w-24 px-3 py-2.5 text-right text-faint lg:table-cell">Weight</th>
              {showEarnings ? (
                <th scope="col" className="eyebrow w-28 px-3 py-2.5 text-right text-faint">Earnings</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr
                key={r.id}
                className={cn(
                  "border-b border-line-soft transition-colors last:border-0 hover:bg-surface-2/60",
                  r.isAoy && "bg-gold/[0.06]",
                  qualifyLabel && r.rank === lastQualified && "border-b-2 border-b-water/50",
                )}
              >
                <td className="px-3 py-2.5 text-center">
                  <span
                    className={cn(
                      "tnum font-semibold",
                      r.rank === 1 && "text-gold",
                      r.rank != null && r.rank <= 10 && r.rank !== 1 && "text-water",
                    )}
                  >
                    {r.rank ?? "—"}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <Link
                    href={`/anglers/${r.angler.slug}`}
                    className="flex items-center gap-2.5 hover:text-accent"
                  >
                    <Avatar
                      firstName={r.angler.firstName}
                      lastName={r.angler.lastName}
                      slug={r.angler.slug}
                      photoUrl={r.angler.photoUrl}
                      size={28}
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">{r.angler.displayName}</span>
                        {r.isAoy ? <Badge tone="gold">AOY</Badge> : null}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {[r.angler.hometownCity, r.angler.hometownState].filter(Boolean).join(", ")}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="tnum px-3 py-2.5 text-right font-semibold">
                  {r.points != null ? Math.round(r.points) : "—"}
                </td>
                <td className="tnum px-3 py-2.5 text-right text-muted">{r.eventsFished}</td>
                <td className="tnum hidden px-3 py-2.5 text-right text-muted sm:table-cell">{r.wins}</td>
                <td className="tnum hidden px-3 py-2.5 text-right text-muted md:table-cell">{r.top10s}</td>
                <td className="tnum hidden px-3 py-2.5 text-right text-muted lg:table-cell">
                  {weightLbsOz(r.totalWeight)}
                </td>
                {showEarnings ? (
                  <td className="tnum px-3 py-2.5 text-right">{money(r.earningsUsd, true)}</td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {qualifyLabel && lastQualified > 0 ? (
        <p className="border-t border-line px-3 py-2 text-xs text-muted">
          The rule marks the {qualifyLabel} cutoff at {lastQualified}.
        </p>
      ) : null}
    </div>
  );
}
