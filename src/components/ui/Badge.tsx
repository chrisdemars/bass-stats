import { cn } from "@/lib/cn";

type Tone = "neutral" | "accent" | "water" | "gold" | "live" | "outline" | "pos";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted border-line",
  accent: "bg-accent text-accent-ink border-transparent",
  water: "bg-water/12 text-water border-water/30",
  gold: "bg-gold/12 text-gold border-gold/30",
  live: "bg-accent/12 text-accent border-accent/40",
  pos: "bg-pos/12 text-pos border-pos/30",
  outline: "bg-transparent text-muted border-line",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "eyebrow inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 leading-none",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
