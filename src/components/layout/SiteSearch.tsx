"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Loader2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";

interface Hit {
  anglers: Array<{ slug: string; name: string; sub: string; first: string; last: string }>;
  events: Array<{ slug: string; name: string; sub: string }>;
}

const EMPTY: Hit = { anglers: [], events: [] };

export function SiteSearch({ className }: { className?: string }) {
  const [q, setQ] = useState("");
  // The last *fetched* results — stale on purpose while a short query is
  // typed, so the dropdown doesn't flicker empty between keystrokes. What's
  // actually shown is derived below from `q`, not stored redundantly.
  const [fetchedHits, setFetchedHits] = useState<Hit>(EMPTY);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const term = q.trim();
  const hits = term.length < 2 ? EMPTY : fetchedHits;

  useEffect(() => {
    if (term.length < 2) return;
    const ctrl = new AbortController();
    // setLoading(true) lives inside the debounce callback, not here, so the
    // indicator only appears once a request is actually about to go out
    // (avoiding a loading flash for every keystroke) and so this effect body
    // itself never calls setState synchronously.
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
          signal: ctrl.signal,
        });
        if (res.ok) setFetchedHits((await res.json()) as Hit);
      } catch {
        // Aborted or offline — leave the previous hits in place.
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [term]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const total = hits.anglers.length + hits.events.length;

  return (
    <div ref={boxRef} className={className}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) {
            router.push(`/anglers?search=${encodeURIComponent(q.trim())}`);
            setOpen(false);
          }
        }}
        className="relative"
      >
        <Search
          size={15}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint"
        />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search anglers, events, waters"
          aria-label="Search anglers and events"
          className="w-full rounded-md border border-line bg-surface py-2 pr-3 pl-9 text-sm text-ink placeholder:text-faint focus:border-accent/60 focus:outline-none"
        />
        {loading ? (
          <Loader2
            size={14}
            className="absolute top-1/2 right-3 -translate-y-1/2 animate-spin text-faint"
          />
        ) : null}
      </form>

      {open && q.trim().length >= 2 ? (
        <div className="absolute z-50 mt-2 w-[min(28rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-line bg-elevated shadow-pop">
          {total === 0 && !loading ? (
            <p className="px-4 py-6 text-center text-sm text-muted">
              No matches for “{q.trim()}”.
            </p>
          ) : null}

          {hits.anglers.length > 0 ? (
            <section>
              <h3 className="eyebrow border-b border-line-soft px-4 py-2 text-faint">Anglers</h3>
              {hits.anglers.map((a) => (
                <Link
                  key={a.slug}
                  href={`/anglers/${a.slug}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2"
                >
                  <Avatar firstName={a.first} lastName={a.last} slug={a.slug} size={28} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{a.name}</span>
                    <span className="block truncate text-xs text-muted">{a.sub}</span>
                  </span>
                </Link>
              ))}
            </section>
          ) : null}

          {hits.events.length > 0 ? (
            <section>
              <h3 className="eyebrow border-y border-line-soft px-4 py-2 text-faint">Events</h3>
              {hits.events.map((e) => (
                <Link
                  key={e.slug}
                  href={`/events/${e.slug}`}
                  onClick={() => setOpen(false)}
                  className="block px-4 py-2.5 transition-colors hover:bg-surface-2"
                >
                  <span className="block truncate text-sm font-medium">{e.name}</span>
                  <span className="block truncate text-xs text-muted">{e.sub}</span>
                </Link>
              ))}
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
