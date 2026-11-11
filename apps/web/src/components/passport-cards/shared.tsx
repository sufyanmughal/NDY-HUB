import Image from "next/image";

/** Shared visual building blocks for the 2026-11 Passport card redesign
 * (NDYHUB — Logo 4K + Passport Figma handoff). Pulled into one file so the
 * three card designs (vertical-card.tsx, business-card.tsx, minimal-card.tsx)
 * draw the same silver-metal gradient and logo badge instead of each
 * hand-rolling a slightly different one. Values below were pixel-sampled off
 * the reference mockups (see .figma-reference/*.png, not committed) the same
 * way this file's predecessor comments describe for the original passport
 * card design. */

/** Brushed-silver gradient — used as a solid fill (Business Card's header
 * bar, the vertical card's tier pill) and as a thin border/ring (Minimal
 * Dark's card outline). Light gray -> mid gray -> lighter gray, dark navy
 * text reads cleanly on top of it everywhere it's used as a fill. */
export const SILVER_GRADIENT = "linear-gradient(135deg, #e8e8ec 0%, #9a9ca3 50%, #c7c9cf 100%)";
export const SILVER_TEXT_DARK = "#0f1420";

/** The brand's violet/magenta/sky ring gradient, used around the small
 * rounded-square logo badge on every card design (replacing the old full
 * "ND / NDJOYIT / HUB" wordmark lockup with a compact badge, per the new
 * Figma design). */
const LOGO_RING_GRADIENT = "linear-gradient(135deg, #e14fff 0%, #8b5cf6 50%, #38bdf8 100%)";

/** Small rounded-square badge: thin brand-gradient ring around
 * public/logo-mark.png (the real 2026-11 4K brand art, square 512x512 — see
 * components/logo.tsx for the other place this same file is used at app
 * chrome scale). `size` is the badge's full outer footprint in px. */
export function LogoBadge({ size = 44 }: { size?: number }) {
  return (
    <div
      className="shrink-0 rounded-[11px] p-[2px]"
      style={{ width: size, height: size, background: LOGO_RING_GRADIENT }}
    >
      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-[9px] bg-[#05070d]">
        <Image
          src="/logo-mark.png"
          alt="NDY HUB"
          width={size * 2}
          height={size * 2}
          className="h-full w-full object-cover"
        />
      </div>
    </div>
  );
}
