"use client";

import { useCallback, useEffect, useState } from "react";
import {
  searchAdminUsers,
  adminUpdateRole,
  adminSetSuspended,
  type AdminUserSummary,
} from "@/lib/api";

/**
 * Shared between /admin and /founder — both roles reach the same
 * user-search/role/suspend endpoints (AdminGuard accepts ADMIN and
 * FOUNDER), so this is one implementation instead of two copies drifting
 * apart. The promote/demote toggle deliberately only cycles USER<->ADMIN;
 * assigning FOUNDER stays a manual, deliberate action (see the "Bootstrapping
 * the first Founder" doc) rather than something reachable from a list-view
 * button click.
 */
export function UserManagementPanel({ accessToken }: { accessToken: string }) {
  const [users, setUsers] = useState<AdminUserSummary[] | null>(null);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    (q?: string) => {
      searchAdminUsers(accessToken, q)
        .then(({ users, total }) => {
          setUsers(users);
          setTotal(total);
        })
        .catch((err) => setError((err as Error).message));
    },
    [accessToken],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handlePromote(user: AdminUserSummary) {
    if (user.role === "FOUNDER") return; // not reachable from here, see doc comment above
    const nextRole = user.role === "ADMIN" ? "USER" : "ADMIN";
    const reason = window.prompt(
      `${nextRole === "ADMIN" ? "Promote" : "Demote"} ${user.ndyId} to ${nextRole}? Optional reason for the audit log:`,
    );
    if (reason === null) return; // cancelled
    setBusyUserId(user.id);
    setError(null);
    try {
      await adminUpdateRole(accessToken, user.id, nextRole, reason || undefined);
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

  function roleBadgeClass(role: AdminUserSummary["role"]) {
    if (role === "FOUNDER") return "bg-warn/15 text-warn";
    if (role === "ADMIN") return "bg-accent/15 text-accent";
    return "bg-foreground-muted/15 text-foreground-muted";
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground-muted">User Management</h2>
      </div>

      {error && (
        <p className="mt-3 rounded-md border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
          {error}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2">
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
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${roleBadgeClass(u.role)}`}>
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
                      disabled={busyUserId === u.id || u.role === "FOUNDER"}
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
  );
}
