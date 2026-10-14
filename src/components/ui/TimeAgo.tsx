"use client";

import { useEffect, useState } from "react";
import { shortDate, timeAgo } from "@/lib/format";

/**
 * Relative timestamps depend on "now", which a prerender cannot know, so the
 * server emits the absolute date and the client's first render reads the
 * real clock via a lazy initializer — no extra render, no effect needed just
 * to set the initial value. The effect below only keeps it ticking afterward.
 */
export function TimeAgo({ iso, className }: { iso: string; className?: string }) {
  const [relative, setRelative] = useState<string | null>(() =>
    typeof window === "undefined" ? null : timeAgo(iso),
  );

  useEffect(() => {
    const timer = setInterval(() => setRelative(timeAgo(iso)), 60_000);
    return () => clearInterval(timer);
  }, [iso]);

  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {relative ?? shortDate(iso)}
    </time>
  );
}
