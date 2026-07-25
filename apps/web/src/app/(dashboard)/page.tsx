"use client";

import Link from "next/link";
import { IdCard, ShieldCheck, Users, Smartphone, Coins, Boxes, Link2, Activity } from "lucide-react";
import { StatTile } from "@/components/stat-tile";
import { useAuth } from "@/lib/auth-context";
import { usePassport } from "@/lib/use-passport";
import { useCryndySummary } from "@/lib/use-cryndy";
import { useNdybitsSummary } from "@/lib/use-ndybits";
import { useMembershipSummary } from "@/lib/use-membership";
import { useTransactions } from "@/lib/use-transactions";
import { mockUser, mockConnectedPlatformsCount } from "@/lib/mock-data";

export default function DashboardPage() {
  const { auth } = useAuth();
  const passport = usePassport();
  const cryndy = useCryndySummary();
  const ndybits = useNdybitsSummary();
  const membership = useMembershipSummary();
  const transactions = useTransactions();
  if (auth.status !== "authenticated") return null;

  const firstName = (passport?.fullName ?? auth.ndyId).split(" ")[0];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Welcome back, {firstName}</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="NDY ID" value={auth.ndyId} icon={IdCard} />
        <StatTile
          label="Passport"
          value={passport ? "Verified" : "…"}
          badge={passport ? { text: `Level ${passport.verificationLevel.replace("LEVEL_", "")}`, tone: "good" } : undefined}
          icon={ShieldCheck}
        />
        <StatTile
          label="Membership"
          value={membership?.current?.tierLabel ?? "None"}
          badge={
            membership?.current
              ? { text: membership.current.status, tone: "good" }
              : { text: "Not subscribed", tone: "neutral" }
          }
          icon={Users}
        />
        <StatTile
          label="NDYAPPS"
          value={passport?.ndyappsConnected ? "Connected" : "Not connected"}
          badge={{
            text: passport?.ndyappsConnected ? "Active" : "Action needed",
            tone: passport?.ndyappsConnected ? "good" : "warn",
          }}
          icon={Smartphone}
        />
      </div>

      {/* Connected Platforms and Recent Activity are still mock data — no
          platforms or activity-log backend exists yet. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="CRYNDY Balance" value={(cryndy?.availableBalance ?? 0).toLocaleString()} icon={Coins} />
        <StatTile label="NDYBITS Balance" value={(ndybits?.balance ?? 0).toLocaleString()} icon={Boxes} />
        <StatTile label="Connected Platforms" value={String(mockConnectedPlatformsCount)} icon={Link2} />
        <StatTile label="Recent Activity" value={`${mockUser.recentActivityCount} new`} icon={Activity} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="text-sm font-medium text-foreground-muted">Recent Transactions</h2>
          {transactions && transactions.length === 0 ? (
            <p className="mt-3 text-sm text-foreground-muted">No transactions yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {transactions?.slice(0, 4).map((tx) => (
                <li key={tx.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <div className="font-medium">{tx.label}</div>
                    <div className="text-foreground-muted">{tx.detail}</div>
                  </div>
                  <div className="text-right">
                    <div className="rounded-full bg-good/15 px-2 py-0.5 text-[11px] font-medium text-good">
                      {tx.status}
                    </div>
                    <div className="mt-1 text-xs text-foreground-muted">
                      {new Date(tx.date).toLocaleDateString()}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="text-sm font-medium text-foreground-muted">Security Status</h2>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-good/15 text-good">
              <ShieldCheck size={20} strokeWidth={2} />
            </div>
            <div>
              <div className="text-sm font-medium">All systems secure</div>
              <div className="text-xs text-foreground-muted">
                Signed in as {auth.ndyId}
              </div>
            </div>
          </div>
          <Link
            href="/security"
            className="mt-4 inline-block rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/90"
          >
            View Security
          </Link>
        </div>
      </div>
    </div>
  );
}
