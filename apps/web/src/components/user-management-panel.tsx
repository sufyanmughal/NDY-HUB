"use client";

import { useCallback, useEffect, useState } from "react";
import {
  searchAdminUsers,
  createRoleChangeRequest,
  adminSetSuspended,
  ASSIGNABLE_ROLES,
  type AdminUserSummary,
  type UserRole,
} from "@/lib/api";
import { useMe } from "@/lib/use-me";

const ALL_ROLES: UserRole[] = [
  "USER",
  "SUPPORT",
  "AUDITOR",
  "DEVELOPER",
  "FINANCE",
  "CONTENT",
  "PARTNERS",
  "SUPER_ADMIN",
  "FOUNDER",
];

const ROLE_BADGE_CLASS: Record<UserRole, string> = {
  FOUNDER: "bg-warn/15 text-warn",
  SUPER_ADMIN: "bg-accent/15 text-accent",
  DEVELOPER: "bg-cyan-500/15 text-cyan-400",
  FINANCE: "bg-amber-500/15 text-amber-400",
  SUPPORT: "bg-emerald-500/15 text-emerald-400",
  CONTENT: "bg-pink-500/15 text-pink-400",
  PARTNERS: "bg-violet-500/15 text-violet-400",
  AUDITOR: "bg-blue-500/15 text-blue-400",
  USER: "bg-foreground-muted/15 text-foreground-muted",
};

/**
 * Shared between /admin and /founder — both reach the same user-search/
 * role/suspend endpoints (PermissionGuard's MANAGE_USERS/MANAGE_ROLES
 * accept both SUPER_ADMIN and FOUNDER), so this is one implementation
 * instead of two copies drifting apart.
 *
 * The role picker only *offers* what the current viewer is actually
 * allowed to assign (mirrors the backend's ASSIGNABLE_BY_SUPER_ADMIN — a
 * Founder sees every role including Founder/Super Admin, anyone else sees
 * the restricted operational set) but the server is the real authority:
 * this is UX, not the security boundary.
 */
export function UserManagementPanel({
  onRoleChangeRequested,
}: {
  /** Called after a role change request is successfully created — lets the
   * parent page refresh a sibling RoleChangeRequestPanel, which has its own
   * independent fetch state and wouldn't otherwise know a new request just
   * appeared. */
  onRoleChangeRequested?: () => void;
}) {
  const me = useMe();
  const [users, setUsers] = useState<AdminUserSummary[] | null>(null);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback((q?: string) => {
    searchAdminUsers(q)
      .then(({ users, total }) => {
        setUsers(users);
        setTotal(total);
      })
      .catch((err) => setError((err as Error).message));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const assignableRoles = me?.role === "FOUNDER" ? ALL_ROLES : ASSIGNABLE_ROLES;

  async function handleRoleChange(user: AdminUserSummary, nextRole: UserRole) {
    if (nextRole === user.role) return;
    const reason = window.prompt(
      `Request changing ${user.ndyId}'s role from ${user.role} to ${nextRole}? This won't take effect until a ` +
        `different admin approves it. Optional reason:`,
    );
    if (reason === null) return; // cancelled
    setBusyUserId(user.id);
    setError(null);
    setNotice(null);
    try {
      await createRoleChangeRequest(user.id, nextRole, reason || undefined);
      setNotice(
        `Role change requested for ${user.ndyId} — waiting on a different admin to approve it.`,
      );
      onRoleChangeRequested?.();
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
      await adminSetSuspended(user.id, nextSuspended, reason || undefined);
      refresh(query);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground-muted">
          User Management
        </h2>
      </div>

      {error && (
        <p className="mt-3 rounded-md border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
          {error}
        </p>
      )}
      {notice && (
        <p className="mt-3 rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent">
          {notice}
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
        <table className="w-full min-w-[820px] text-left text-sm">
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
            {users?.map((u) => {
              // Can't offer a role this viewer isn't allowed to assign —
              // except the user's own current role, so the <select> always
              // has a valid selected option even if that role is otherwise
              // out of the viewer's reach (e.g. a Super Admin viewing a
              // Founder's row).
              const options = assignableRoles.includes(u.role)
                ? assignableRoles
                : [u.role, ...assignableRoles];

              return (
                <tr key={u.id}>
                  <td className="py-3 pr-4 font-mono text-xs">{u.ndyId}</td>
                  <td className="py-3 pr-4">{u.email}</td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ROLE_BADGE_CLASS[u.role]}`}
                      >
                        {u.role}
                      </span>
                      <select
                        value={u.role}
                        onChange={(e) =>
                          handleRoleChange(u, e.target.value as UserRole)
                        }
                        disabled={busyUserId === u.id}
                        className="rounded-md border border-border bg-background px-1.5 py-1 text-xs disabled:opacity-50"
                        aria-label={`Change role for ${u.ndyId}`}
                      >
                        {options.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        u.suspended
                          ? "bg-critical/15 text-critical"
                          : "bg-good/15 text-good"
                      }`}
                    >
                      {u.suspended ? "Suspended" : "Active"}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-foreground-muted">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 pr-4">
                    <button
                      onClick={() => handleSuspendToggle(u)}
                      disabled={busyUserId === u.id}
                      className="rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-2 disabled:opacity-50"
                    >
                      {u.suspended ? "Unsuspend" : "Suspend"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-foreground-muted">
        {total} total user(s).
      </p>
    </div>
  );
}
