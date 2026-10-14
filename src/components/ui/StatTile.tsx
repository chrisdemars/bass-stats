import { cn } from "@/lib/cn";

/** A single headline number — career earnings, wins, best finish. */
export function StatTile({
  label,
  value,
  sub,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "default" | "gold" | "water" | "accent";
  className?: string;
}) {
  const valueTone =
    tone === "gold" ? "text-gold"
    : tone === "water" ? "text-water"
    : tone === "accent" ? "text-accent"
    : "text-ink";
  return (
    <div className={cn("card px-4 py-3.5", className)}>
      <div className="eyebrow text-faint">{label}</div>
      <div className={cn("tnum mt-1.5 text-2xl leading-none font-semibold", valueTone)}>
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-muted">{sub}</div> : null}
    </div>
  );
}
