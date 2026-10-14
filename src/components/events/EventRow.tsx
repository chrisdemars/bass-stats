import Link from "next/link";
import { Trophy } from "lucide-react";
import { StatusPill } from "@/components/ui/StatusPill";
import { dateRange, weightLbsOz } from "@/lib/format";
import type { EventItem } from "@/lib/event-item";

/** Dense row for the list view of the event browser. */
export function EventRow({ event }: { event: EventItem }) {
  const place = [event.city, event.state].filter(Boolean).join(", ");
  return (
    <li className="relative grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1 border-b border-line-soft px-3 py-3 transition-colors last:border-0 hover:bg-surface-2 sm:grid-cols-[7rem_1fr_auto] sm:px-4">
      <span
        className="eyebrow self-start rounded-sm border-l-2 bg-surface-2 px-1.5 py-1 leading-none"
        style={{ borderLeftColor: event.orgAccent }}
      >
        {event.orgShortName}
      </span>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-medium">
            <Link href={`/events/${event.slug}`} className="after:absolute after:inset-0 hover:text-accent">
              {event.waterBody ?? event.name}
            </Link>
          </h3>
          <StatusPill status={event.status} />
        </div>
        <p className="mt-0.5 truncate text-xs text-muted">
          {event.seriesShortName}
          {event.divisionName ? ` · ${event.divisionName}` : ""}
          {place ? ` · ${place}` : ""}
        </p>
      </div>

      <div className="col-span-2 flex items-center justify-between gap-4 sm:col-span-1 sm:justify-end">
        {event.winnerName ? (
          <span className="flex items-center gap-1.5 text-xs">
            <Trophy size={12} className="text-gold" />
            <span className="max-w-[12rem] truncate">{event.winnerName}</span>
            {event.winnerWeight != null ? (
              <span className="tnum text-muted">{weightLbsOz(event.winnerWeight)}</span>
            ) : null}
          </span>
        ) : null}
        <span className="tnum w-36 shrink-0 text-right text-xs text-muted">
          {dateRange(event.startDate, event.endDate)}
        </span>
      </div>
    </li>
  );
}
