"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, UserPlus, Activity, ShieldCheck, CreditCard, Coins, Boxes, Database } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getFounderEcosystemOverview, ApiError, type FounderEcosystemOverview } from "@/lib/api";
import { StatTile } from "@/components/stat-tile";
import { UserManagementPanel } from "@/components/user-management-panel";
import { RoleChangeRequestPanel } from "@/components/role-change-request-panel";

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default function FounderMissionControlPage() {
  const { auth } = useAuth();
  const [overview, setOverview] = useState<FounderEcosystemOverview | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleRequestsVersion, setRoleRequestsVersion] = useState(0);

  const refresh = useCallback(() => {
    if (auth.status !== "authenticated") return;
    getFounderEcosystemOverview(auth.accessToken)
      .then(setOverview)
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
  const accessToken = auth.accessToken;

  if (accessDenied) {
    return (
      <div className="rounded-lg border border-critical/30 bg-critical/10 p-6 text-center">
        <p className="text-sm font-medium text-critical">Founder access required.</p>
        <p className="mt-1 text-xs text-foreground-muted">
          {auth.ndyId} is signed in but isn&apos;t a founder on this server.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Founder Mission Control</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          The command center for the NDJOYIT ecosystem — health, users, and revenue in one place.
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
          {error}
        </p>
      )}

      <div>
        <h2 className="mb-3 text-sm font-medium text-foreground-muted">Ecosystem Overview</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Total Users"
            value={overview ? overview.users.total.toLocaleString() : "…"}
            icon={Users}
          />
          <StatTile
            label="New Users Today"
            value={overview ? overview.users.newToday.toLocaleString() : "…"}
            icon={UserPlus}
          />
          <StatTile
            label="Active Sessions"
            value={overview ? overview.users.activeSessions.toLocaleString() : "…"}
            icon={Activity}
          />
          <StatTile
            label="New Verifications Today"
            value={overview ? overview.users.newVerificationsToday.toLocaleString() : "…"}
            icon={ShieldCheck}
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Active Memberships"
            value={overview ? overview.memberships.active.toLocaleString() : "…"}
            icon={CreditCard}
          />
          <StatTile
            label="Revenue Today"
            value={overview ? formatCents(overview.revenue.todayCents) : "…"}
            icon={CreditCard}
          />
          <StatTile
            label="CRYNDY Sales Today"
            value={overview ? `${overview.cryndy.salesToday.count} · ${formatCents(overview.cryndy.salesToday.amountCents)}` : "…"}
            icon={Coins}
          />
          <StatTile
            label="NDYBITS Issued Today"
            value={overview ? overview.ndybits.issuedToday.toLocaleString() : "…"}
            icon={Boxes}
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="CRYNDY Sales All-Time"
            value={overview ? `${overview.cryndy.salesAllTime.count} · ${formatCents(overview.cryndy.salesAllTime.amountCents)}` : "…"}
            icon={Coins}
          />
          <StatTile
            label="NDYBITS Issued All-Time"
            value={overview ? overview.ndybits.issuedAllTime.toLocaleString() : "…"}
            icon={Boxes}
          />
          <StatTile
            label="System Status"
            value={overview ? (overview.systemStatus.database === "ok" ? "Healthy" : "Degraded") : "…"}
            badge={
              overview
                ? {
                    text: overview.systemStatus.database === "ok" ? "Database OK" : "Database down",
                    tone: overview.systemStatus.database === "ok" ? "good" : "critical",
                  }
                : undefined
            }
            icon={Database}
          />
        </div>

        {overview && (
          <p className="mt-3 text-xs text-foreground-muted">{overview.revenue.note}</p>
        )}
      </div>

      <UserManagementPanel
        accessToken={accessToken}
        onRoleChangeRequested={() => setRoleRequestsVersion((v) => v + 1)}
      />
      <RoleChangeRequestPanel accessToken={accessToken} refreshKey={roleRequestsVersion} />
    </div>
  );
}
