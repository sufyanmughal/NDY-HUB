"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getMyMembership,
  getMembershipTiers,
  subscribeToTier,
  cancelMembership,
  type MembershipSummary,
  type TierInfo,
  type MembershipTier,
  type BillingCycle,
} from "@/lib/api";
import { TierGrid, TierCompareTable, TIER_ORDER } from "@/components/tier-grid";
import { WhyMembershipSection, TrustSecuritySection } from "@/components/membership-sections";
import "@/styles/homepage.css";
import "@/styles/membership.css";

/** Account-management view for an existing membership — current plan,
 * billing dates, cancellation, history, AND full tier browsing/upgrading
 * (via the shared TierGrid, same component the public /memberships page
 * uses) so a member can move to a higher tier without ever leaving the
 * dashboard shell. Previously this just linked out to the public marketing
 * page for that, which drops the sidebar entirely — jarring for someone
 * already inside the app.
 *
 * Two different widths on purpose: the account/plan/history sections stay
 * in a narrow `max-w-3xl` column (they're just data, reading well narrow),
 * while the tier grid + why/trust sections break out to the full width of
 * <main> — the tier cards were cramped into that same 3xl column before,
 * which is the "membership tiers in half of screen" the user flagged. */
export default function ManageMembershipPage() {
  const { auth } = useAuth();
  const [summary, setSummary] = useState<MembershipSummary | null>(null);
  const [tiers, setTiers] = useState<Record<MembershipTier, TierInfo> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [busyTier, setBusyTier] = useState<MembershipTier | null>(null);

  const refresh = useCallback(() => {
    if (auth.status !== "authenticated") return;
    getMyMembership()
      .then(setSummary)
      .catch((err) => setError((err as Error).message));
  }, [auth]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    getMembershipTiers()
      .then(setTiers)
      .catch(() => {
        /* tier grid just stays empty — the plan/history sections above
           still work without it */
      });
  }, []);

  if (auth.status !== "authenticated") return null;

  async function handleCancel(membershipId: string) {
    setCancelling(true);
    setError(null);
    try {
      await cancelMembership(membershipId);
      refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCancelling(false);
    }
  }

  async function handleSubscribe(tier: MembershipTier, billingCycle: BillingCycle) {
    setBusyTier(tier);
    setError(null);
    try {
      const result = await subscribeToTier(tier, billingCycle);
      if (result.mode === "checkout") {
        window.location.assign(result.checkoutUrl);
        return;
      }
      refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyTier(null);
    }
  }

  const currentTier = summary?.current?.tier ?? null;

  // Frames the CTA as "Upgrade"/"Downgrade" relative to the current tier
  // instead of a flat "Subscribe" for every card, once a plan is active.
  function ctaLabelForTier(tier: MembershipTier, isCurrent: boolean): string {
    if (isCurrent) return "Current plan";
    if (!currentTier) return "Subscribe";
    const currentIndex = TIER_ORDER.indexOf(currentTier);
    const tierIndex = TIER_ORDER.indexOf(tier);
    return tierIndex > currentIndex ? "Upgrade" : "Switch plan";
  }

  return (
    <div className="space-y-8">
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Membership</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Your current plan, billing, and membership history.
          </p>
        </div>

        {error && (
          <p className="rounded-md border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
            {error}
          </p>
        )}

        {summary === null && !error && (
          <p className="text-sm text-foreground-muted">Loading…</p>
        )}

        {summary && !summary.current && (
          <div className="rounded-lg border border-border bg-surface p-6 text-center">
            <p className="text-sm text-foreground-muted">
              You don&rsquo;t have an active membership yet — choose a tier below
              to get started.
            </p>
          </div>
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
              disabled={cancelling}
              className="mt-4 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cancelling ? "Cancelling…" : "Cancel membership"}
            </button>
          </div>
        )}

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

      {/* Full-width breakout — tiers, comparison, why-membership, and trust
          sections all use the same .mem-* grid/section styles the public
          page does, so they need the page's full width to lay out the same
          way (previously constrained to max-w-3xl, which is the "tiers in
          half the screen" bug). Wrapped in .ndy-homepage for the --hp-*
          custom properties these classes are styled against. */}
      <div className="ndy-homepage -mx-6">
        <div className="mem-manage-tiers">
          <h2 className="mem-manage-tiers-heading">
            {summary?.current ? "Change your plan" : "Choose a plan"}
          </h2>
          <TierGrid
            tiers={tiers}
            currentTier={currentTier}
            isAuthenticated
            busyTier={busyTier}
            onSubscribe={handleSubscribe}
            ctaLabelForTier={ctaLabelForTier}
          />
          <TierCompareTable tiers={tiers} />
        </div>

        <WhyMembershipSection />
        <TrustSecuritySection />
      </div>
    </div>
  );
}
