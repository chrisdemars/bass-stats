import Link from "next/link";
import { MapPin, Trophy } from "lucide-react";
import { EventArt } from "@/components/ui/EventArt";
import { StatusPill } from "@/components/ui/StatusPill";
import { cn } from "@/lib/cn";
import { dateRange, weightLbsOz } from "@/lib/format";
import type { EventItem } from "@/lib/event-item";

export function EventCard({
  event,
  className,
  size = "md",
}: {
  event: EventItem;
  className?: string;
  size?: "md" | "lg";
}) {
  const place = [event.city, event.state].filter(Boolean).join(", ");
  return (
    <article
      className={cn(
        "card group relative flex flex-col overflow-hidden transition-colors hover:border-accent/40",
        className,
      )}
    >
      <EventArt
        slug={event.slug}
        label={event.waterBody}
        className={cn("w-full", size === "lg" ? "h-44" : "h-32")}
      >
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span
            className="eyebrow rounded-sm border-l-2 bg-black/55 px-1.5 py-1 leading-none text-white backdrop-blur-sm"
            style={{ borderLeftColor: event.orgAccent }}
          >
            {event.orgShortName}
          </span>
          <StatusPill status={event.status} />
        </div>
      </EventArt>

      <div className="flex flex-1 flex-col p-4">
        <p className="eyebrow text-faint">
          {event.seriesShortName}
          {event.divisionName ? ` · ${event.divisionName}` : ""}
        </p>

        <h3 className="headline mt-1.5 text-lg">
          <Link
            href={`/events/${event.slug}`}
            className="after:absolute after:inset-0 hover:text-accent"
          >
            {event.waterBody ?? event.name}
          </Link>
        </h3>

        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
          <MapPin size={12} className="shrink-0" />
          <span className="truncate">{place || event.name}</span>
        </p>

        <div className="mt-auto pt-3">
          <p className="tnum text-xs text-muted">
            {dateRange(event.startDate, event.endDate)}
          </p>
          {event.winnerName ? (
            <p className="mt-2 flex items-center gap-1.5 border-t border-line-soft pt-2 text-xs">
              <Trophy size={12} className="shrink-0 text-gold" />
              <span className="truncate font-medium">{event.winnerName}</span>
              {event.winnerWeight != null ? (
                <span className="tnum ml-auto shrink-0 text-muted">
                  {weightLbsOz(event.winnerWeight)}
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
