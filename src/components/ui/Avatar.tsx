import { cn } from "@/lib/cn";
import { hueFromString, initials } from "@/lib/format";

/**
 * Anglers have no photos until a scrape supplies one, so the fallback is a
 * deterministic duotone monogram — stable per angler, never a broken image.
 */
export function Avatar({
  firstName,
  lastName,
  slug,
  photoUrl,
  size = 40,
  className,
}: {
  firstName: string;
  lastName: string;
  slug: string;
  photoUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const hue = hueFromString(slug);
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote hosts are unknown until ingest supplies them
      <img
        src={photoUrl}
        alt=""
        width={size}
        height={size}
        className={cn("shrink-0 rounded-full object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-semibold text-white/90 select-none",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(145deg, oklch(0.5 0.12 ${hue}), oklch(0.32 0.08 ${(hue + 40) % 360}))`,
      }}
    >
      {initials(firstName, lastName)}
    </span>
  );
}
