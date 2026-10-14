import Link from "next/link";
import { EventArt } from "@/components/ui/EventArt";
import { cn } from "@/lib/cn";
import { TimeAgo } from "@/components/ui/TimeAgo";
import type { ArticleWithContext } from "@/lib/types";

export function ArticleCard({
  article,
  className,
  compact = false,
}: {
  article: ArticleWithContext;
  className?: string;
  compact?: boolean;
}) {
  const org = article.org;
  const meta = [article.event?.series.shortName, article.event?.waterBody]
    .filter(Boolean)
    .join(" · ");

  if (compact) {
    return (
      <article className={cn("group relative flex gap-3 py-3", className)}>
        <EventArt
          slug={article.slug}
          imageUrl={article.heroImageUrl}
          className="size-16 shrink-0 rounded-md"
        />
        <div className="min-w-0">
          <p className="eyebrow truncate text-faint">{meta || org?.shortName}</p>
          <h3 className="mt-1 line-clamp-2 text-sm leading-snug font-medium">
            <Link href={`/news/${article.slug}`} className="after:absolute after:inset-0 hover:text-accent">
              {article.title}
            </Link>
          </h3>
          <p className="mt-1 text-xs text-faint"><TimeAgo iso={article.publishedAt} /></p>
        </div>
      </article>
    );
  }

  return (
    <article className={cn("card group relative flex flex-col overflow-hidden", className)}>
      <EventArt
        slug={article.slug}
        imageUrl={article.heroImageUrl}
        label={article.event?.waterBody}
        className="h-36 w-full"
      >
        {org ? (
          <span
            className="eyebrow absolute top-3 left-3 rounded-sm border-l-2 bg-black/55 px-1.5 py-1 leading-none text-white backdrop-blur-sm"
            style={{ borderLeftColor: org.accentColor }}
          >
            {org.shortName}
          </span>
        ) : null}
      </EventArt>
      <div className="flex flex-1 flex-col p-4">
        <p className="eyebrow truncate text-faint">{meta}</p>
        <h3 className="headline mt-1.5 text-lg leading-tight">
          <Link href={`/news/${article.slug}`} className="after:absolute after:inset-0 hover:text-accent">
            {article.title}
          </Link>
        </h3>
        {article.dek ? (
          <p className="mt-2 line-clamp-2 text-sm text-muted">{article.dek}</p>
        ) : null}
        <p className="mt-auto pt-3 text-xs text-faint"><TimeAgo iso={article.publishedAt} /></p>
      </div>
    </article>
  );
}
