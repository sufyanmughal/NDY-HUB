import { StatTile } from "@/components/stat-tile";
import { mockNdybitsBalance, mockNdybitsLedger } from "@/lib/mock-data";

const REASON_LABELS: Record<string, string> = {
  daily_login: "Daily Login Reward",
  referral_bonus: "Referral Bonus",
  purchase_reward: "Purchase Reward",
  reward_redemption: "Reward Redemption",
};

function reasonLabel(reason: string): string {
  return REASON_LABELS[reason] ?? reason;
}

export default function NdybitsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">NDYBITS</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Your points balance and recent earning activity across the NDJOYIT ecosystem.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="NDYBITS Balance"
          value={mockNdybitsBalance.toLocaleString()}
          badge={{ text: "Available", tone: "good" }}
        />
        <StatTile label="Ledger Entries" value={String(mockNdybitsLedger.length)} />
      </div>

      <div className="rounded-lg border border-border bg-surface p-5">
        <h2 className="text-sm font-medium text-foreground-muted">Recent Activity</h2>
        <ul className="mt-3 divide-y divide-border">
          {mockNdybitsLedger.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between py-3 text-sm">
              <div>
                <div className="font-medium">{reasonLabel(entry.reason)}</div>
                <div className="text-xs text-foreground-muted">
                  {new Date(entry.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              </div>
              <div
                className={`font-mono text-sm font-semibold tabular-nums ${
                  entry.amount >= 0 ? "text-good" : "text-critical"
                }`}
              >
                {entry.amount >= 0 ? "+" : ""}
                {entry.amount.toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
