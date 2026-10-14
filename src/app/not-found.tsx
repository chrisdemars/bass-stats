import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto grid max-w-xl place-items-center px-4 py-32 text-center">
      <p className="eyebrow text-accent">404</p>
      <h1 className="headline mt-2 text-4xl sm:text-5xl">Nothing in the livewell</h1>
      <p className="mt-3 text-muted">
        That page does not exist. It may have been an event that never happened,
        or a slug that changed.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link
          href="/events"
          className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90"
        >
          Browse events
        </Link>
        <Link
          href="/anglers"
          className="rounded-md border border-line px-4 py-2.5 text-sm font-semibold transition-colors hover:border-accent/50"
        >
          Angler directory
        </Link>
      </div>
    </div>
  );
}
