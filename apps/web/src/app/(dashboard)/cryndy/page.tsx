import { StatTile } from "@/components/stat-tile";
import {
  mockCryndyAvailableBalance,
  mockCryndyBreakdown,
  mockCryndyPurchases,
  type CryndyPurchaseStatus,
} from "@/lib/mock-data";

// How each pipeline stage should read to a user glancing at their balance:
// spendable now, owned-but-not-yet, still moving through intake/review, or
// terminated. Never collapse this into a single number — that's the whole
// point of the status breakdown (pending/locked/allocated CRYNDY must never
// look "available" unless it actually is).
const STATUS_META: Record<
  CryndyPurchaseStatus,
  { label: string; tone: "good" | "warn" | "critical" | "neutral" }
> = {
  PAYMENT_PENDING: { label: "Payment Pending", tone: "neutral" },
  PAYMENT_CONFIRMED: { label: "Payment Confirmed", tone: "neutral" },
  UNDER_REVIEW: { label: "Under Review", tone: "neutral" },
  VERIFIED: { label: "Verified", tone: "warn" },
  ALLOCATED: { label: "Allocated", tone: "warn" },
  LOCKED: { label: "Locked", tone: "warn" },
  AVAILABLE: { label: "Available", tone: "good" },
  DISTRIBUTED_ON_CHAIN: { label: "Distributed On-Chain", tone: "good" },
  CANCELLED: { label: "Cancelled", tone: "critical" },
  REFUNDED: { label: "Refunded", tone: "critical" },
};

const toneClasses: Record<string, string> = {
  good: "bg-good/15 text-good",
  warn: "bg-warn/15 text-warn",
  critical: "bg-critical/15 text-critical",
  neutral: "bg-accent/15 text-accent",
};

export default function CryndyPage() {
  const activeBreakdown = (Object.keys(mockCryndyBreakdown) as CryndyPurchaseStatus[])
    .map((status) => ({ status, ...mockCryndyBreakdown[status] }))
    .filter((entry) => entry.count > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">CRYNDY</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Your CRYNDY purchase history and current holdings across the presale pipeline.
          </p>
        </div>
        <button
          type="button"
          disabled
          title="Buying CRYNDY isn't wired up yet"
          className="shrink-0 cursor-not-allowed rounded-md bg-accent/40 px-4 py-2 text-sm font-medium text-white/70"
        >
          Buy CRYNDY
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Available Balance"
          value={`${mockCryndyAvailableBalance.toLocaleString()} CRYNDY`}
          badge={{ text: "Spendable", tone: "good" }}
        />
        {activeBreakdown.map(({ status, count, cryndyAmount }) => (
          <StatTile
            key={status}
            label={STATUS_META[status].label}
            value={`${cryndyAmount.toLocaleString()} CRYNDY`}
            badge={{ text: `${count} purchase${count === 1 ? "" : "s"}`, tone: STATUS_META[status].tone }}
          />
        ))}
      </div>

      <div className="rounded-lg border border-border bg-surface p-5">
        <h2 className="text-sm font-medium text-foreground-muted">Purchase History</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-foreground-muted">
                <th className="py-2 pr-4 font-medium">Reference</th>
                <th className="py-2 pr-4 font-medium">Package</th>
                <th className="py-2 pr-4 font-medium">Paid</th>
                <th className="py-2 pr-4 font-medium">CRYNDY</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mockCryndyPurchases.map((purchase) => {
                const meta = STATUS_META[purchase.status];
                return (
                  <tr key={purchase.id}>
                    <td className="py-3 pr-4 font-mono text-xs">{purchase.reference}</td>
                    <td className="py-3 pr-4 text-foreground-muted">
                      {purchase.packageName ?? "—"}
                    </td>
                    <td className="py-3 pr-4 tabular-nums">
                      {purchase.amountPaid.toLocaleString()} {purchase.currency}
                    </td>
                    <td className="py-3 pr-4 tabular-nums">
                      {purchase.cryndyAmount.toLocaleString()}
                      {purchase.bonusAmount > 0 && (
                        <span className="ml-1 text-xs text-good">
                          +{purchase.bonusAmount.toLocaleString()} bonus
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${toneClasses[meta.tone]}`}
                      >
                        {meta.label}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-foreground-muted">
                      {new Date(purchase.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-foreground-muted">
        Only CRYNDY in Available or Distributed On-Chain status can be used or transferred — Locked
        and Allocated CRYNDY is yours but not yet spendable.
      </p>
    </div>
  );
}
