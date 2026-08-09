import { BrandMark } from "@/components/logo";

// Global footer (reference mockup: ring logo + "NDY HUB" wordmark, "Powered
// by NDJOYIT", plain-text policy/support links, copyright) — this row lives
// below the sidebar+content flex row, not inside <main>, so it spans the
// full viewport width the way the mockup shows it. "Privacy Policy",
// "Terms of Service", and "Support" are plain, non-interactive text in the
// mockup (no destination pages exist yet for them), so they're rendered as
// text rather than dead links — same "visually present, honestly inert"
// treatment as the search input and theme toggle.
export function NdyspaceFooter() {
  return (
    <footer className="ndyspace-footer flex flex-wrap items-center justify-between gap-3 px-6 py-4 text-xs">
      <div className="flex items-center gap-2">
        <BrandMark size={20} />
        <span className="font-semibold text-foreground">NDY HUB</span>
        <span className="ml-2 border-l border-border pl-3">Powered by NDJOYIT</span>
      </div>
      <div className="flex items-center gap-5">
        <span>Privacy Policy</span>
        <span>Terms of Service</span>
        <span>Support</span>
      </div>
      <div>© 2024 NDJOYIT. All rights reserved.</div>
    </footer>
  );
}
