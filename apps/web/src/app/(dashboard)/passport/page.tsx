"use client";

import { useAuth } from "@/lib/auth-context";
import { usePassport } from "@/lib/use-passport";
import { useCryndySummary } from "@/lib/use-cryndy";
import { useNdybitsSummary } from "@/lib/use-ndybits";
import { useMembershipSummary } from "@/lib/use-membership";
import { mockConnectedPlatformsCount } from "@/lib/mock-data";

export default function PassportPage() {
  const { auth } = useAuth();
  const passport = usePassport();
  const cryndy = useCryndySummary();
  const ndybits = useNdybitsSummary();
  const membership = useMembershipSummary();
  if (auth.status !== "authenticated") return null;

  const displayName = passport?.fullName ?? "Name not set yet";

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">NDY Passport</h1>
      <p className="mt-1 text-sm text-foreground-muted">
        Your identity, membership, and ownership record across the NDJOYIT ecosystem.
      </p>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex items-center gap-4 border-b border-border bg-surface-2 p-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-2 text-xl font-semibold text-white">
            {displayName.charAt(0)}
          </div>
          <div>
            <div className="text-lg font-semibold">{displayName}</div>
            <div className="font-mono text-sm text-foreground-muted">{auth.ndyId}</div>
          </div>
          <span className="ml-auto rounded-full bg-good/15 px-3 py-1 text-xs font-medium text-good">
            {passport ? "Verified" : "Loading…"}
          </span>
        </div>

        <dl className="divide-y divide-border text-sm">
          {/* Connected Platforms is still mock data — no platforms backend
              exists yet. Membership, CRYNDY, and NDYBITS are real now. */}
          <Row label="Membership" value={membership?.current?.tierLabel ?? "No active membership"} />
          <Row label="CRYNDY Holdings" value={`${(cryndy?.availableBalance ?? 0).toLocaleString()} CRYNDY`} />
          <Row label="NDYBITS" value={`${(ndybits?.balance ?? 0).toLocaleString()} NDYBITS`} />
          <Row label="Connected Platforms" value={`${mockConnectedPlatformsCount} Platforms`} />
          <Row
            label="Verification Level"
            value={passport ? `Level ${passport.verificationLevel.replace("LEVEL_", "")}` : "…"}
          />
        </dl>
      </div>

      <p className="mt-4 text-xs text-foreground-muted">
        Full Passport editing, the personal QR code, and privacy controls over what connected
        platforms can see land in a later milestone — this is the read-only shell.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <dt className="text-foreground-muted">{label}</dt>
      <dd className="font-mono tabular-nums">{value}</dd>
    </div>
  );
}
