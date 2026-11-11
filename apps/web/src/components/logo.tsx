import Image from "next/image";

/** The real brand mark — public/logo-mark.png, the 2026-11 "NDY HUB / One
 * Identity. One Hub." 4K artwork (downscaled to 512x512), replacing the
 * earlier non-square brand image. Square 1:1 source, so width/height are
 * equal — no aspect-ratio math needed. Self-contained (no CSS class
 * dependency) since it's used both inside the scoped .ndy-homepage
 * sections and in the dashboard sidebar/mobile-nav chrome outside that
 * scope. */
export function BrandMark({ size = 38 }: { size?: number }) {
  return (
    <Image
      src="/logo-mark.png"
      alt="NDY HUB"
      width={size}
      height={size}
      priority
      style={{ height: size, width: size, flexShrink: 0 }}
    />
  );
}

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark size={size} />
      <span className="font-semibold tracking-tight text-lg">
        NDY{" "}
        <span className="bg-gradient-to-r from-accent-2 to-accent bg-clip-text text-transparent">
          HUB
        </span>
        <sup className="text-[10px] align-super text-foreground-muted">™</sup>
      </span>
    </span>
  );
}
