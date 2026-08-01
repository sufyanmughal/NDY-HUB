/** The concentric-ring mark used in the header, matching the brand mockup
 * exactly (radar/target rings in a purple-to-blue gradient) — built as SVG
 * rather than a cropped image so it's crisp at any size and has no
 * background-removal artifacts. */
function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <defs>
        <linearGradient id="ndy-logo-grad" x1="0" y1="0" x2="32" y2="32">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#4f7cff" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="14.5" stroke="url(#ndy-logo-grad)" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="10" stroke="url(#ndy-logo-grad)" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="5.5" stroke="url(#ndy-logo-grad)" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="1.75" fill="url(#ndy-logo-grad)" />
    </svg>
  );
}

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={size} />
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
