import { Badge } from "./Badge";
import { EVENT_STATUS_LABEL } from "@/lib/format";
import type { EventStatus } from "@/lib/types";

export function StatusPill({ status }: { status: EventStatus }) {
  if (status === "in_progress") {
    return (
      <Badge tone="live">
        <span className="live-dot size-1.5 rounded-full bg-accent" aria-hidden />
        Live
      </Badge>
    );
  }
  const tone =
    status === "official" ? "outline"
    : status === "scheduled" ? "water"
    : "neutral";
  return <Badge tone={tone}>{EVENT_STATUS_LABEL[status]}</Badge>;
}
