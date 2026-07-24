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
        You&apos;re seeing this page because the QR login flow at{" "}
        <Link href="/login" className="text-accent hover:underline">
          /login
        </Link>{" "}
        already gates the whole dashboard — the session it issues is real, this page listing
        it and letting you revoke it isn&apos;t built yet.
      </p>
    </div>
  );
}
