import { cn } from "@/lib/cn";
import { hueFromString } from "@/lib/format";

/**
 * Stand-in hero art for an event. Real photography drops in via
 * `events.cover_image_url`; until then this renders a deterministic
 * water-surface abstraction keyed to the event slug.
 */
export function EventArt({
  slug,
  label,
  imageUrl,
  className,
  children,
}: {
  slug: string;
  label?: string | null;
  imageUrl?: string | null;
  className?: string;
  children?: React.ReactNode;
}) {
  const hue = hueFromString(slug);
  return (
    <div className={cn("relative overflow-hidden bg-surface-2", className)}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote hosts are unknown until ingest supplies them
        <img src={imageUrl} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                `linear-gradient(155deg, oklch(0.38 0.09 ${hue}) 0%, oklch(0.22 0.06 ${(hue + 30) % 360}) 55%, oklch(0.15 0.04 ${(hue + 60) % 360}) 100%)`,
            }}
          />
          <div className="waterline absolute inset-0 opacity-70" />
          {label ? (
            <div className="absolute inset-x-0 bottom-0 p-4">
              <span className="headline text-xl text-white/25">{label}</span>
            </div>
          ) : null}
        </>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
      {children}
    </div>
  );
}
