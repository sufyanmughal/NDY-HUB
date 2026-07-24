import { StatTile } from "@/components/stat-tile";
import { mockUser, mockTransactions, mockPlatforms } from "@/lib/mock-data";

export default function DashboardPage() {
  const connectedCount = mockPlatforms.filter((p) => p.status === "Connected").length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">
        Welcome back, {mockUser.firstName}
      </h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="NDY ID" value={mockUser.ndyId} />
        <StatTile
          label="Passport"
          value={mockUser.passportVerified ? "Verified" : "Unverified"}
          badge={{ text: `Level ${mockUser.verificationLevel}`, tone: "good" }}
        />
        <StatTile label="Membership" value={mockUser.membership} />
        <StatTile
          label="NDYAPPS"
          value={mockUser.ndyappsConnected ? "Connected" : "Not connected"}
          badge={{
            text: mockUser.ndyappsConnected ? "Active" : "Action needed",
            tone: mockUser.ndyappsConnected ? "good" : "warn",
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="CRYNDY Balance" value={mockUser.cryndyBalance.toLocaleString()} />
        <StatTile label="NDYBITS Balance" value={mockUser.ndybitsBalance.toLocaleString()} />
        <StatTile label="Connected Platforms" value={String(connectedCount)} />
        <StatTile label="Recent Activity" value={`${mockUser.recentActivityCount} new`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="text-sm font-medium text-foreground-muted">Recent Transactions</h2>
          <ul className="mt-3 divide-y divide-border">
            {mockTransactions.map((tx) => (
              <li key={`${tx.label}-${tx.when}`} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <div className="font-medium">{tx.label}</div>
                  <div className="text-foreground-muted">{tx.detail}</div>
                </div>
                <div className="text-right">
                  <div className="rounded-full bg-good/15 px-2 py-0.5 text-[11px] font-medium text-good">
                    {tx.status}
                  </div>
                  <div className="mt-1 text-xs text-foreground-muted">{tx.when}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-border bg-surface p-5">
          <h2 className="text-sm font-medium text-foreground-muted">Security Status</h2>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-good/15 text-good">
              ✓
            </div>
            <div>
              <div className="text-sm font-medium">All systems secure</div>
              <div className="text-xs text-foreground-muted">
                Last login: {mockUser.lastLogin.when} · {mockUser.lastLogin.where}
              </div>
            </div>
          </div>
          <a
            href="/security"
            className="mt-4 inline-block rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/90"
          >
            View Security
          </a>
        </div>
      </div>
    </div>
  );
}
