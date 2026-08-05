import Image from "next/image";

/** The real brand mark — cropped from the user's NDJOYIT HUB brand image
 * (public/logo-mark.png), replacing the earlier hand-drawn 3-ring SVG
 * placeholder. Rendered via next/image so it's optimized/responsive
 * automatically; width/height are the image's own aspect ratio (583x320)
 * so it never stretches. Self-contained (no CSS class dependency) since
 * it's used both inside the scoped .ndy-homepage sections and in the
 * dashboard sidebar/mobile-nav chrome outside that scope. */
export function BrandMark({ size = 38 }: { size?: number }) {
  const width = Math.round(size * (583 / 320));
  return (
    <Image
      src="/logo-mark.png"
      alt="NDY HUB"
      width={width}
      height={size}
      priority
      style={{ height: size, width: "auto", flexShrink: 0 }}
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
