"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  searchAdminUsers,
  adminUpdateRole,
  adminSetSuspended,
  getAdminAuditLog,
  ApiError,
  type AdminUserSummary,
  type AuditLogEntry,
} from "@/lib/api";

export default function AdminPage() {
  const { auth } = useAuth();
  const [users, setUsers] = useState<AdminUserSummary[] | null>(null);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [auditLog, setAuditLog] = useState<AuditLogEntry[] | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    (q?: string) => {
      if (auth.status !== "authenticated") return;
      searchAdminUsers(auth.accessToken, q)
        .then(({ users, total }) => {
          setUsers(users);
          setTotal(total);
        })
        .catch((err) => {
          if (err instanceof ApiError && err.status === 403) {
            setAccessDenied(true);
          } else {
            setError((err as Error).message);
          }
        });
      getAdminAuditLog(auth.accessToken)
        .then(({ entries }) => setAuditLog(entries))
        .catch(() => {
          /* audit log is secondary — the access-denied state above already covers the real case */
        });
    },
    [auth],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (auth.status !== "authenticated") return null;
  const accessToken = auth.accessToken;

  if (accessDenied) {
    return (
      <div className="rounded-lg border border-critical/30 bg-critical/10 p-6 text-center">
        <p className="text-sm font-medium text-critical">Admin access required.</p>
        <p className="mt-1 text-xs text-foreground-muted">
          {auth.ndyId} is signed in but isn&apos;t an admin on this server.
        </p>
      </div>
    );
  }

  async function handlePromote(user: AdminUserSummary) {
    const reason = window.prompt(
      `${user.role === "ADMIN" ? "Demote" : "Promote"} ${user.ndyId}? Optional reason for the audit log:`,
    );
    if (reason === null) return; // cancelled
    setBusyUserId(user.id);
    setError(null);
    try {
      await adminUpdateRole(accessToken, user.id, user.role === "ADMIN" ? "USER" : "ADMIN", reason || undefined);
      refresh(query);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleSuspendToggle(user: AdminUserSummary) {
    const nextSuspended = !user.suspended;
    const reason = window.prompt(
      `${nextSuspended ? "Suspend" : "Unsuspend"} ${user.ndyId}? Optional reason for the audit log:`,
    );
    if (reason === null) return;
    setBusyUserId(user.id);
    setError(null);
    try {
      await adminSetSuspended(accessToken, user.id, nextSuspended, reason || undefined);
      refresh(query);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          User search, roles, and suspension. Every action here is written to the audit log.
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
          {error}
        </p>
      )}

      <div className="rounded-lg border border-border bg-surface p-5">
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && refresh(query)}
            placeholder="Search by email, NDY ID, or name…"
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            onClick={() => refresh(query)}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
          >
            Search
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-foreground-muted">
                <th className="py-2 pr-4 font-medium">NDY ID</th>
                <th className="py-2 pr-4 font-medium">Email</th>
                <th className="py-2 pr-4 font-medium">Role</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Joined</th>
                <th className="py-2 pr-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users?.map((u) => (
                <tr key={u.id}>
                  <td className="py-3 pr-4 font-mono text-xs">{u.ndyId}</td>
                  <td className="py-3 pr-4">{u.email}</td>
                  <td className="py-3 pr-4">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        u.role === "ADMIN" ? "bg-accent/15 text-accent" : "bg-foreground-muted/15 text-foreground-muted"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        u.suspended ? "bg-critical/15 text-critical" : "bg-good/15 text-good"
                      }`}
                    >
                      {u.suspended ? "Suspended" : "Active"}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-foreground-muted">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePromote(u)}
                        disabled={busyUserId === u.id}
                        className="rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-2 disabled:opacity-50"
                      >
                        {u.role === "ADMIN" ? "Demote" : "Promote"}
                      </button>
                      <button
                        onClick={() => handleSuspendToggle(u)}
                        disabled={busyUserId === u.id}
                        className="rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-2 disabled:opacity-50"
                      >
                        {u.suspended ? "Unsuspend" : "Suspend"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-foreground-muted">{total} total user(s).</p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-5">
        <h2 className="text-sm font-medium text-foreground-muted">Audit Log</h2>
        {auditLog && auditLog.length === 0 ? (
          <p className="mt-3 text-sm text-foreground-muted">No admin actions yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {auditLog?.map((entry) => (
              <li key={entry.id} className="py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs">{entry.action}</span>
                  <span className="text-xs text-foreground-muted">
                    {new Date(entry.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 text-xs text-foreground-muted">
                  {entry.adminNdyId} → {entry.targetNdyId ?? "—"}
                  {entry.reason && <> · &ldquo;{entry.reason}&rdquo;</>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
