// lucide-react's installed version here has no brand marks (LinkedIn/
// Instagram/X icons don't exist in it) — same reason homepage-widgets.tsx
// hand-draws its own icons instead of pulling in a brand-icon package for
// a handful of glyphs. Generic, unbranded social-link marks. Shared by the
// public passport page and the Passport section's card designs.
export function SocialIcon({
  kind,
}: {
  kind: "linkedin" | "instagram" | "x" | "website" | "email";
}) {
  if (kind === "linkedin") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
        <path d="M7.5 10.5v6M7.5 7.8v.01M11.5 16.5v-3.7c0-1.4 1-2.3 2.2-2.3s2.1.9 2.1 2.3v3.7" />
      </svg>
    );
  }
  if (kind === "instagram") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (kind === "x") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
        <path d="M5 5l14 14M19 5 5 19" />
      </svg>
    );
  }
  if (kind === "email") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
        <path d="M4.5 6.5 12 12l7.5-5.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.2 2.3 3.4 5.2 3.4 8.5s-1.2 6.2-3.4 8.5c-2.2-2.3-3.4-5.2-3.4-8.5S9.8 5.8 12 3.5Z" />
    </svg>
  );
}
