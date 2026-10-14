import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { CLASS_LABEL, money, ordinal } from "@/lib/format";
import type { AnglerListItem } from "@/lib/data";

export function AnglerCard({
  item,
  className,
}: {
  item: AnglerListItem;
  className?: string;
}) {
  const { angler, stats, orgSlugs } = item;
  const home = [angler.hometownCity, angler.hometownState].filter(Boolean).join(", ");

  return (
    <article
      className={cn(
        "card group relative flex flex-col p-4 transition-colors hover:border-accent/40",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar
          firstName={angler.firstName}
          lastName={angler.lastName}
          slug={angler.slug}
          photoUrl={angler.photoUrl}
          size={48}
        />
        <div className="min-w-0 flex-1">
          <h3 className="headline truncate text-lg">
            <Link
              href={`/anglers/${angler.slug}`}
              className="after:absolute after:inset-0 hover:text-accent"
            >
              {angler.displayName}
            </Link>
          </h3>
          <p className="truncate text-xs text-muted">{home || angler.country}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone={angler.primaryClass === "pro" ? "accent" : "outline"}>
              {CLASS_LABEL[angler.primaryClass]}
            </Badge>
            {orgSlugs.slice(0, 3).map((slug) => (
              <Badge key={slug} tone="outline">{slug}</Badge>
            ))}
          </div>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-4 gap-2 border-t border-line-soft pt-3 text-center">
        <Mini label="Events" value={String(stats.events)} />
        <Mini label="Wins" value={String(stats.wins)} tone={stats.wins > 0 ? "gold" : undefined} />
        <Mini label="Best" value={stats.bestPlace ? ordinal(stats.bestPlace) : "—"} />
        <Mini label="Earned" value={money(stats.careerEarnings, true)} />
      </dl>
    </article>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: "gold" }) {
  return (
    <div>
      <dt className="eyebrow text-[0.625rem] text-faint">{label}</dt>
      <dd className={cn("tnum mt-0.5 text-sm font-semibold", tone === "gold" && "text-gold")}>
        {value}
      </dd>
    </div>
  );
}
