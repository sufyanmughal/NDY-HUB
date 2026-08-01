import Image from "next/image";

/** The real NDJOYIT/NDY HUB mark — cropped and background-removed from the
 * brand artwork (apps/web/public/ndy-logo-mark.png) rather than a plain
 * text wordmark. Shared between Sidebar and MobileNavDrawer so both headers
 * stay in sync. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2">
      <Image
        src="/ndy-logo-mark.png"
        alt="NDY HUB"
        width={size * 1.8}
        height={size}
        className="h-auto"
        style={{ width: "auto", height: size }}
        priority
      />
      <span className="font-semibold tracking-tight text-lg">
        NDY <span className="text-accent">HUB</span>
        <sup className="text-[10px] align-super text-foreground-muted">™</sup>
      </span>
    </span>
  );
}
