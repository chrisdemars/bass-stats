import Link from "next/link";
import { cn } from "@/lib/cn";
import type { Organization } from "@/lib/types";

/**
 * Organization chip. Each org carries its own accent color from the database,
 * so B.A.S.S. red, MLF blue and NPFL gold read apart at a glance in mixed lists.
 */
export function OrgMark({
  org,
  href,
  size = "sm",
  className,
}: {
  org: Pick<Organization, "slug" | "shortName" | "accentColor">;
  href?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const body = (
    <span
      className={cn(
        "eyebrow inline-flex items-center gap-1.5 rounded-sm border-l-2 bg-surface-2 py-1 pr-2 pl-2 leading-none text-ink/90",
        size === "md" && "text-sm py-1.5",
        className,
      )}
      style={{ borderLeftColor: org.accentColor }}
    >
      {org.shortName}
    </span>
  );
  return href ? (
    <Link href={href} className="transition-opacity hover:opacity-80">{body}</Link>
  ) : body;
}
