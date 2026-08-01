"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getMembershipTiers,
  getMyMembership,
  subscribeToTier,
  cancelMembership,
  type TierInfo,
  type MembershipTier,
  type BillingCycle,
  type MembershipSummary,
} from "@/lib/api";

const TIER_ORDER: MembershipTier[] = [
  "RISE",
  "FLOW",
  "PULSE",
  "VAULT",
  "MODE",
  "LEGACY",
];

export default function MembershipsPage() {
  const { auth } = useAuth();
  const [tiers, setTiers] = useState<Record<MembershipTier, TierInfo> | null>(
    null,
  );
  const [summary, setSummary] = useState<MembershipSummary | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("MONTHLY");
  const [busyTier, setBusyTier] = useState<MembershipTier | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (auth.status !== "authenticated") return;
    getMyMembership()
      .then(setSummary)
      .catch((err) => setError((err as Error).message));
  }, [auth]);

  useEffect(() => {
    getMembershipTiers()
      .then(setTiers)
      .catch((err) => setError((err as Error).message));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (auth.status !== "authenticated") return null;
  async function handleSubscribe(tier: MembershipTier) {
    setBusyTier(tier);
    setError(null);
    try {
      const result = await subscribeToTier(tier, billingCycle);
      if (result.mode === "checkout") {
        window.location.assign(result.checkoutUrl);
        return;
      }
      // dev-activated: no real Stripe configured on this server, so the
      // subscription is already live — just refetch to show it.
      refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyTier(null);
    }
  }

  async function handleCancel(membershipId: string) {
    setError(null);
    try {
      await cancelMembership(membershipId);
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Memberships</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Your current plan, billing, and every tier available in the ecosystem.
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
          {error}
        </p>
      )}

      {summary?.current && (
        <div className="rounded-lg border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-foreground-muted">
                Current plan
              </div>
              <div className="mt-1 text-lg font-semibold">
                {summary.current.tierLabel}
              </div>
            </div>
            <span className="rounded-full bg-good/15 px-3 py-1 text-xs font-medium text-good">
              {summary.current.status}
            </span>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-foreground-muted">Billing</dt>
              <dd className="font-mono">
                {summary.current.billingCycle === "ANNUAL"
                  ? "Annual"
                  : "Monthly"}
              </dd>
            </div>
            <div>
              <dt className="text-foreground-muted">Started</dt>
              <dd className="font-mono">
                {new Date(summary.current.startedAt).toLocaleDateString()}
              </dd>
            </div>
            <div>
              <dt className="text-foreground-muted">Renews</dt>
              <dd className="font-mono">
                {new Date(
                  summary.current.currentPeriodEnd,
                ).toLocaleDateString()}
              </dd>
            </div>
          </dl>
          <button
            onClick={() => handleCancel(summary.current!.id)}
            className="mt-4 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-2"
          >
            Cancel membership
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <ToggleButton
          active={billingCycle === "MONTHLY"}
          onClick={() => setBillingCycle("MONTHLY")}
        >
          Monthly
        </ToggleButton>
        <ToggleButton
          active={billingCycle === "ANNUAL"}
          onClick={() => setBillingCycle("ANNUAL")}
        >
          Annual
        </ToggleButton>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiers &&
          TIER_ORDER.map((tier) => {
            const info = tiers[tier];
            const priceCents =
              billingCycle === "ANNUAL"
                ? info.annualPriceCents
                : info.monthlyPriceCents;
            const isCurrent = summary?.current?.tier === tier;
            return (
              <div
                key={tier}
                className="flex flex-col rounded-lg border border-border bg-surface p-5"
              >
                <div className="text-sm font-semibold">{info.label}</div>
                <div className="mt-2 font-mono text-2xl tabular-nums">
                  ${(priceCents / 100).toFixed(0)}
                  <span className="text-sm font-normal text-foreground-muted">
                    /{billingCycle === "ANNUAL" ? "yr" : "mo"}
                  </span>
                </div>
                <ul className="mt-3 flex-1 space-y-1 text-xs text-foreground-muted">
                  {info.benefits.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <button
                  onClick={() => handleSubscribe(tier)}
                  disabled={isCurrent || busyTier === tier}
                  className="mt-4 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCurrent
                    ? "Current plan"
                    : busyTier === tier
                      ? "…"
                      : "Subscribe"}
                </button>
              </div>
            );
          })}
      </div>

      {summary && summary.history.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="text-sm font-medium text-foreground-muted">
            Membership History
          </h2>
          <ul className="mt-3 divide-y divide-border">
            {summary.history.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between py-3 text-sm"
              >
                <div>
                  <div className="font-medium">{m.tierLabel}</div>
                  <div className="text-xs text-foreground-muted">
                    {new Date(m.startedAt).toLocaleDateString()}
                    {m.cancelledAt &&
                      ` – ${new Date(m.cancelledAt).toLocaleDateString()}`}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    m.status === "ACTIVE"
                      ? "bg-good/15 text-good"
                      : "bg-foreground-muted/15 text-foreground-muted"
                  }`}
                >
                  {m.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
        active
          ? "bg-accent text-white"
          : "border border-border text-foreground-muted hover:bg-surface-2"
      }`}
    >
      {children}
    </button>
  );
}
