import { NextResponse } from "next/server";
import { listAnglers, listEvents } from "@/lib/data";

/** Typeahead for the masthead search box. */
export async function GET(request: Request) {
  const term = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (term.length < 2) {
    return NextResponse.json({ anglers: [], events: [] });
  }

  const [anglers, events] = await Promise.all([
    listAnglers({ search: term, limit: 5, sort: "earnings" }),
    listEvents({ search: term, limit: 5 }),
  ]);

  return NextResponse.json({
    anglers: anglers.items.map(({ angler, stats }) => ({
      slug: angler.slug,
      name: angler.displayName,
      first: angler.firstName,
      last: angler.lastName,
      sub: [
        [angler.hometownCity, angler.hometownState].filter(Boolean).join(", "),
        stats.events ? `${stats.events} events` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    })),
    events: events.map((e) => ({
      slug: e.slug,
      name: e.name,
      sub: [e.org.shortName, e.season.year, e.waterBody].filter(Boolean).join(" · "),
    })),
  });
}
