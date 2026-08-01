"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, Coins, Boxes } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  getFinancialSummary,
  ApiError,
  type FinancialSummary,
} from "@/lib/api";
import { StatTile } from "@/components/stat-tile";

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

export default function FinancialsPage() {
  const { auth } = useAuth();
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (auth.status !== "authenticated") return;
    getFinancialSummary()
      .then(setSummary)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setAccessDenied(true);
        } else {
          setError((err as Error).message);
        }
      });
  }, [auth]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (auth.status !== "authenticated") return null;

  if (accessDenied) {
    return (
      <div className="rounded-lg border border-critical/30 bg-critical/10 p-6 text-center">
        <p className="text-sm font-medium text-critical">
          Finance access required.
        </p>
        <p className="mt-1 text-xs text-foreground-muted">
          {auth.ndyId} is signed in but doesn&apos;t have financial visibility
          on this server.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Financials</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Revenue, CRYNDY sales, and NDYBITS issuance.
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Revenue Today"
          value={summary ? formatCents(summary.revenue.todayCents) : "…"}
          icon={CreditCard}
        />
        <StatTile
          label="CRYNDY Sales Today"
          value={
            summary
              ? `${summary.cryndy.salesToday.count} · ${formatCents(summary.cryndy.salesToday.amountCents)}`
              : "…"
          }
          icon={Coins}
        />
        <StatTile
          label="CRYNDY Sales All-Time"
          value={
            summary
              ? `${summary.cryndy.salesAllTime.count} · ${formatCents(summary.cryndy.salesAllTime.amountCents)}`
              : "…"
          }
          icon={Coins}
        />
        <StatTile
          label="NDYBITS Issued Today"
          value={summary ? summary.ndybits.issuedToday.toLocaleString() : "…"}
          icon={Boxes}
        />
      </div>

      {summary && (
        <p className="text-xs text-foreground-muted">{summary.revenue.note}</p>
      )}
    </div>
  );
}
