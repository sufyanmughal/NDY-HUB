"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getMySessions,
  revokeSessionById,
  revokeAllSessions,
  getConnectedSites,
  revokeConnectedSite,
  type SecuritySession,
  type ConnectedSite,
} from "@/lib/api";

export default function SecurityPage() {
  const { auth, logout } = useAuth();
  const [sessions, setSessions] = useState<SecuritySession[] | null>(null);
  const [sites, setSites] = useState<ConnectedSite[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [siteBusyId, setSiteBusyId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (auth.status !== "authenticated") return;
    getMySessions(auth.accessToken)
      .then(setSessions)
      .catch((err) => setError((err as Error).message));
  }, [auth]);

  const refreshSites = useCallback(() => {
    if (auth.status !== "authenticated") return;
    getConnectedSites(auth.accessToken)
      .then(setSites)
      .catch((err) => setError((err as Error).message));
  }, [auth]);

  useEffect(() => {
    refresh();
    refreshSites();
  }, [refresh, refreshSites]);

  if (auth.status !== "authenticated") return null;
  const accessToken = auth.accessToken;

  async function handleRevoke(sessionId: string) {
    setBusyId(sessionId);
    setError(null);
    try {
      await revokeSessionById(accessToken, sessionId);
      refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleRevokeSite(grantId: string) {
    setSiteBusyId(grantId);
    setError(null);
    try {
      await revokeConnectedSite(accessToken, grantId);
      refreshSites();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSiteBusyId(null);
    }
  }

  async function handleRevokeAll() {
    setError(null);
    try {
      await revokeAllSessions(accessToken);
      // Revokes the current session too — the local session is now stale,
      // so clear it and let DashboardGate send this tab back to /login.
      logout();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Security</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Every device currently signed in as {auth.ndyId}.
          </p>
        </div>
        {sessions && sessions.length > 0 && (
          <button
            onClick={handleRevokeAll}
            className="shrink-0 rounded-md border border-critical/40 px-3 py-2 text-sm font-medium text-critical hover:bg-critical/10"
          >
            Log out everywhere
          </button>
        )}
      </div>

      {error && (
        <p className="rounded-md border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
          {error}
        </p>
      )}

      <div className="rounded-lg border border-border bg-surface p-5">
        <h2 className="text-sm font-medium text-foreground-muted">Active Sessions</h2>
        {sessions && sessions.length === 0 ? (
          <p className="mt-3 text-sm text-foreground-muted">No active sessions.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {sessions?.map((session) => (
              <li key={session.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    {session.userAgent ?? "Unknown device"}
                    {session.isCurrent && (
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">
                        This device
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-foreground-muted">
                    {session.ip ?? "Unknown IP"} · Signed in{" "}
                    {new Date(session.createdAt).toLocaleString()}
                  </div>
                </div>
                {!session.isCurrent && (
                  <button
                    onClick={() => handleRevoke(session.id)}
                    disabled={busyId === session.id}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-2 disabled:opacity-50"
                  >
                    {busyId === session.id ? "…" : "Revoke"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-border bg-surface p-5">
        <h2 className="text-sm font-medium text-foreground-muted">Connected Websites</h2>
        {sites && sites.length === 0 ? (
          <p className="mt-3 text-sm text-foreground-muted">
            No third-party sites are connected to your NDY HUB account yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {sites?.map((site) => (
              <li key={site.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <div className="font-medium">{site.clientName}</div>
                  <div className="text-xs text-foreground-muted">
                    Access: {site.scope.split(" ").join(", ")} · Connected{" "}
                    {new Date(site.createdAt).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => handleRevokeSite(site.id)}
                  disabled={siteBusyId === site.id}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-2 disabled:opacity-50"
                >
                  {siteBusyId === site.id ? "…" : "Revoke"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-foreground-muted">
        Revoking a session stops it from staying signed in past its current 15-minute access
        token — it can no longer refresh into a new one. Revoking a connected website also kills
        every refresh token it holds for your account, so it can&apos;t silently mint new access
        tokens after the fact. NDYAPPS connection controls and login history land in a later
        milestone.
      </p>
    </div>
  );
}
