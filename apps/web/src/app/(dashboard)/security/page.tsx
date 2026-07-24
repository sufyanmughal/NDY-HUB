import Link from "next/link";
import { PlaceholderSection } from "@/components/placeholder-page";

export default function SecurityPage() {
  return (
    <div className="space-y-4">
      <PlaceholderSection
        title="Security"
        milestone="Ships in M3 + M7"
        description="Active sessions, login history, NDYAPPS connection controls, and 2FA — the QR/deep-link login work in M3 is what this page is built on top of."
      />
      <p className="text-sm text-foreground-muted">
        The QR login flow itself is already wired up end to end —{" "}
        <Link href="/login" className="text-accent hover:underline">
          see it working here
        </Link>
        . It talks to the real API; this dashboard just doesn&apos;t consume the session yet.
      </p>
    </div>
  );
}
