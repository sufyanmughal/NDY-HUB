"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useMe } from "@/lib/use-me";
import {
  getMySessions,
  revokeSessionById,
  revokeAllSessions,
  getMyDevices,
  revokeDeviceById,
  getConnectedSites,
  revokeConnectedSite,
  getMySecurityEvents,
  requestIdentityVerification,
  getMyIdentityVerificationRequests,
  type SecuritySession,
  type SecurityDevice,
  type ConnectedSite,
  type SecurityEvent,
  type SecurityEventType,
  type IdentityVerificationRequest,
} from "@/lib/api";

const SECURITY_EVENT_LABELS: Record<SecurityEventType, string> = {
  LOGIN_SUCCESS: "Signed in",
  NEW_DEVICE: "New device signed in",
  PASSWORD_CHANGED: "Password changed",
  PASSKEY_ADDED: "Passkey added",
  PASSKEY_REMOVED: "Passkey removed",
  TOTP_ENABLED: "Two-factor authentication enabled",
  TOTP_DISABLED: "Two-factor authentication disabled",
  SMS_2FA_ENABLED: "SMS two-factor authentication enabled",
  SMS_2FA_DISABLED: "SMS two-factor authentication disabled",
  RECOVERY_CODE_USED: "Recovery code used to sign in",
  EMAIL_CHANGED: "Email address changed",
  OAUTH_APP_CONNECTED: "Connected a new app",
  OAUTH_APP_REVOKED: "Revoked access to an app",
  OAUTH_TOKEN_REUSE_DETECTED: "Suspicious activity — a connected app's login was reused",
  DEVICE_REVOKED: "Signed out a device",
};

export default function SecurityPage() {
  const { auth, logout } = useAuth();
  const me = useMe();
  const [sessions, setSessions] = useState<SecuritySession[] | null>(null);
  const [devices, setDevices] = useState<SecurityDevice[] | null>(null);
  const [sites, setSites] = useState<ConnectedSite[] | null>(null);
  const [events, setEvents] = useState<SecurityEvent[] | null>(null);
  const [idvRequests, setIdvRequests] = useState<
    IdentityVerificationRequest[] | null
  >(null);
  const [idvNote, setIdvNote] = useState("");
  const [idvSubmitting, setIdvSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deviceBusyId, setDeviceBusyId] = useState<string | null>(null);
  const [siteBusyId, setSiteBusyId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (auth.status !== "authenticated") return;
    getMySessions()
      .then(setSessions)
      .catch((err) => setError((err as Error).message));
  }, [auth]);

  const refreshDevices = useCallback(() => {
    if (auth.status !== "authenticated") return;
    getMyDevices()
      .then(setDevices)
      .catch((err) => setError((err as Error).message));
  }, [auth]);

  const refreshSites = useCallback(() => {
    if (auth.status !== "authenticated") return;
    getConnectedSites()
      .then(setSites)
      .catch((err) => setError((err as Error).message));
  }, [auth]);

  const refreshEvents = useCallback(() => {
    if (auth.status !== "authenticated") return;
    getMySecurityEvents()
      .then(setEvents)
      .catch((err) => setError((err as Error).message));
  }, [auth]);

  const refreshIdv = useCallback(() => {
    if (auth.status !== "authenticated") return;
    getMyIdentityVerificationRequests()
      .then(setIdvRequests)
      .catch((err) => setError((err as Error).message));
  }, [auth]);

  useEffect(() => {
    refresh();
    refreshDevices();
    refreshSites();
    refreshEvents();
    refreshIdv();
  }, [refresh, refreshDevices, refreshSites, refreshEvents, refreshIdv]);

  async function handleRequestIdv(e: React.FormEvent) {
    e.preventDefault();
    setIdvSubmitting(true);
    setError(null);
    try {
      await requestIdentityVerification(idvNote || undefined);
      setIdvNote("");
      refreshIdv();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIdvSubmitting(false);
    }
  }

  if (auth.status !== "authenticated") return null;
  async function handleRevoke(sessionId: string) {
    setBusyId(sessionId);
    setError(null);
    try {
      await revokeSessionById(sessionId);
      refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleRevokeDevice(deviceId: string) {
    setDeviceBusyId(deviceId);
    setError(null);
    try {
      await revokeDeviceById(deviceId);
      // A revoked device may include the one making this call — refresh
      // sessions too, since its Session row (if any) just got killed
      // alongside it, same ecosystem-wide propagation the backend does.
      refreshDevices();
      refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeviceBusyId(null);
    }
  }

  async function handleRevokeSite(grantId: string) {
    setSiteBusyId(grantId);
    setError(null);
    try {
      await revokeConnectedSite(grantId);
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
      await revokeAllSessions();
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
        <h2 className="text-sm font-medium text-foreground-muted">
          Active Sessions
        </h2>
        {sessions && sessions.length === 0 ? (
          <p className="mt-3 text-sm text-foreground-muted">
            No active sessions.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {sessions?.map((session) => (
              <li
                key={session.id}
                className="flex items-center justify-between py-3 text-sm"
              >
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
        <h2 className="text-sm font-medium text-foreground-muted">
          Devices
        </h2>
        <p className="mt-1 text-xs text-foreground-muted">
          Revoking a device signs it out everywhere — this NDY HUB session
          and every connected NDY app it&apos;s used, not just here.
        </p>
        {devices && devices.length === 0 ? (
          <p className="mt-3 text-sm text-foreground-muted">
            No devices recognized yet — signing in from an app that sends a
            device identifier will show up here.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {devices?.map((device) => (
              <li
                key={device.id}
                className="flex items-center justify-between py-3 text-sm"
              >
                <div>
                  <div className="font-medium">{device.label}</div>
                  <div className="text-xs text-foreground-muted">
                    Last active {new Date(device.lastSeenAt).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => handleRevokeDevice(device.id)}
                  disabled={deviceBusyId === device.id}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-2 disabled:opacity-50"
                >
                  {deviceBusyId === device.id ? "…" : "Revoke"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-border bg-surface p-5">
        <h2 className="text-sm font-medium text-foreground-muted">
          Connected Websites
        </h2>
        {sites && sites.length === 0 ? (
          <p className="mt-3 text-sm text-foreground-muted">
            No third-party sites are connected to your NDY HUB account yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {sites?.map((site) => (
              <li
                key={site.id}
                className="flex items-center justify-between py-3 text-sm"
              >
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

      <div className="rounded-lg border border-border bg-surface p-5">
        <h2 className="text-sm font-medium text-foreground-muted">
          Security History
        </h2>
        {events && events.length === 0 ? (
          <p className="mt-3 text-sm text-foreground-muted">
            No security activity recorded yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {events?.map((event) => (
              <li key={event.id} className="py-3 text-sm">
                <div className="font-medium">
                  {SECURITY_EVENT_LABELS[event.type] ?? event.type}
                </div>
                <div className="text-xs text-foreground-muted">
                  {new Date(event.createdAt).toLocaleString()}
                  {event.ip ? ` · ${event.ip}` : ""}
                  {event.userAgent ? ` · ${event.userAgent}` : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-border bg-surface p-5">
        <h2 className="text-sm font-medium text-foreground-muted">
          Identity Verification (LEVEL_3)
        </h2>
        {me?.verificationLevel === "LEVEL_3" ? (
          <p className="mt-3 text-sm text-good">
            Your identity is verified.
          </p>
        ) : (
          <>
            <p className="mt-1 text-xs text-foreground-muted">
              Request a manual identity review. NDY HUB does not accept
              document uploads here — describe how you&apos;ve already shared
              proof of identity (e.g. a support ticket) and a reviewer will
              follow up.
            </p>
            {idvRequests?.some((r) => r.status === "PENDING") ? (
              <p className="mt-3 text-sm text-warn">
                Your request is pending review.
              </p>
            ) : (
              <form onSubmit={handleRequestIdv} className="mt-4 space-y-3">
                <textarea
                  value={idvNote}
                  onChange={(e) => setIdvNote(e.target.value)}
                  placeholder="Optional note — e.g. how/where you already sent proof of identity"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  rows={2}
                  maxLength={1000}
                />
                <button
                  type="submit"
                  disabled={idvSubmitting}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Request Verification
                </button>
              </form>
            )}
            {idvRequests && idvRequests.length > 0 && (
              <ul className="mt-4 space-y-2">
                {idvRequests.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-md border border-border p-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span>{new Date(r.createdAt).toLocaleString()}</span>
                      <span
                        className={
                          r.status === "APPROVED"
                            ? "text-good"
                            : r.status === "REJECTED"
                              ? "text-critical"
                              : "text-warn"
                        }
                      >
                        {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                      </span>
                    </div>
                    {r.reviewReason && (
                      <p className="mt-1 text-xs text-foreground-muted">
                        &ldquo;{r.reviewReason}&rdquo;
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <p className="text-xs text-foreground-muted">
        Revoking a session stops it from staying signed in past its current
        15-minute access token — it can no longer refresh into a new one.
        Revoking a connected website also kills every refresh token it holds for
        your account, so it can&apos;t silently mint new access tokens after the
        fact. NDYAPPS connection controls land in a later milestone.
      </p>
    </div>
  );
}
