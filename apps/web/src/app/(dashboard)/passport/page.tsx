"use client";

import { useAuth } from "@/lib/auth-context";
import { usePassport } from "@/lib/use-passport";
import {
  mockUser,
  mockCryndyAvailableBalance,
  mockNdybitsBalance,
  mockConnectedPlatformsCount,
} from "@/lib/mock-data";

export default function PassportPage() {
  const { auth } = useAuth();
  const passport = usePassport();
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
          {/* Membership is still mock data until the billing module (M4)
              lands. CRYNDY/NDYBITS/Connected Platforms are the same mock
              data the /cryndy, /ndybits, and /platforms pages use — not a
              live fetch yet, but a single source instead of a duplicate. */}
          <Row label="Membership" value={mockUser.membership} />
          <Row label="CRYNDY Holdings" value={`${mockCryndyAvailableBalance.toLocaleString()} CRYNDY`} />
          <Row label="NDYBITS" value={`${mockNdybitsBalance.toLocaleString()} NDYBITS`} />
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
