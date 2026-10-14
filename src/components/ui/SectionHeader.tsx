import Link from "next/link";
import { cn } from "@/lib/cn";

export function SectionHeader({
  title,
  kicker,
  href,
  hrefLabel = "View all",
  className,
}: {
  title: string;
  kicker?: string;
  href?: string;
  hrefLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-4 pb-4", className)}>
      <div className="min-w-0">
        {kicker ? <div className="eyebrow text-accent">{kicker}</div> : null}
        <h2 className="headline mt-1 text-2xl sm:text-3xl">{title}</h2>
      </div>
      {href ? (
        <Link
          href={href}
          className="eyebrow shrink-0 text-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
        >
          {hrefLabel} →
        </Link>
      ) : null}
    </div>
  );
}
