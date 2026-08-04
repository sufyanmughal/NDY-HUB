"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  getMyMembership,
  cancelMembership,
  type MembershipSummary,
} from "@/lib/api";

/** Account-management view for an existing membership — current plan,
 * billing dates, cancellation, and history. Tier browsing/subscribing
 * lives at the public /memberships marketing page instead of here, so
 * this page stays a simple account screen (same shape as Security/
 * Settings) rather than re-rendering the full premium tier grid. */
export default function ManageMembershipPage() {
  const { auth } = useAuth();
  const [summary, setSummary] = useState<MembershipSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const refresh = useCallback(() => {
    if (auth.status !== "authenticated") return;
    getMyMembership()
      .then(setSummary)
      .catch((err) => setError((err as Error).message));
  }, [auth]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Membership</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Your current plan, billing, and membership history.
          </p>
        </div>
        <Link
          href="/memberships"
          className="shrink-0 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/90"
        >
          Browse all tiers
        </Link>
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
            You don&rsquo;t have an active membership yet.
          </p>
          <Link
            href="/memberships"
            className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
          >
            Explore membership tiers
          </Link>
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
  );
}
