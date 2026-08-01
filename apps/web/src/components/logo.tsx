/** Transcribed exactly from the reference build: a radial-gradient circle
 * badge (not a flat icon) with a simple 3-ring mark on top, "NDY" + "HUB"
 * (accent-colored) beside it. Self-contained (inline styles, not a CSS
 * class) since it's used both inside the scoped .ndy-homepage sections and
 * in the dashboard sidebar/mobile-nav chrome outside that scope. */
export function BrandMark({ size = 38 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background:
          "radial-gradient(circle at 35% 30%, #6d8cff, #4f7cff 45%, #8b5cf6 100%)",
        boxShadow: "0 0 18px rgba(79, 124, 255, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth={1.6}
        width={size * 0.53}
        height={size * 0.53}
      >
        <circle cx="12" cy="12" r="9.5" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2.2" fill="#fff" stroke="none" />
      </svg>
    </div>
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
