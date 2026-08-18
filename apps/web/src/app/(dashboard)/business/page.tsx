"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, UserPlus, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  requestBusinessWorkspace,
  getMyBusinessWorkspaceRequests,
  listBusinessWorkspaceMembers,
  listWorkspaceInvites,
  inviteToWorkspace,
  revokeWorkspaceInvite,
  type BusinessWorkspaceRequest,
  type WorkspaceMembershipRow,
  type WorkspaceInvite,
  type WorkspaceRole,
} from "@/lib/api";

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-warn/15 text-warn",
  APPROVED: "bg-good/15 text-good",
  REJECTED: "bg-critical/15 text-critical",
  ACCEPTED: "bg-good/15 text-good",
  DECLINED: "bg-critical/15 text-critical",
  EXPIRED: "bg-foreground-muted/15 text-foreground-muted",
  REVOKED: "bg-foreground-muted/15 text-foreground-muted",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[status] ?? "bg-foreground-muted/15 text-foreground-muted"}`}
    >
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

/**
 * NDY Business Center v1 — per the client's explicit 25-answer sign-off:
 * admin-approved workspace creation (propose/approve, same pattern as role
 * changes), simple Owner/Admin/Member roles, a department field on
 * membership, own top-level nav item. No Shared Team Inbox, AI Business
 * Assistant, or Automations yet — those are the later Business AI layer
 * per the client's own "sit on top of Business Center" framing.
 */
export default function BusinessCenterPage() {
  const { auth } = useAuth();
  const [requests, setRequests] = useState<BusinessWorkspaceRequest[] | null>(
    null,
  );
  const [businessName, setBusinessName] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (auth.status !== "authenticated") return;
    getMyBusinessWorkspaceRequests()
      .then(setRequests)
      .catch((err) => setError((err as Error).message));
  }, [auth]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!businessName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await requestBusinessWorkspace(businessName.trim(), reason || undefined);
      setBusinessName("");
      setReason("");
      refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (auth.status !== "authenticated") return null;

  const approvedWorkspaceIds = (requests ?? [])
    .filter((r) => r.status === "APPROVED" && r.createdWorkspaceId)
    .map((r) => r.createdWorkspaceId as string);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Business Center</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Create a Business Workspace and manage your team — invites, roles,
          and departments.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-5">
        <h2 className="text-sm font-medium text-foreground-muted">
          Request a Business Workspace
        </h2>
        <p className="mt-1 text-xs text-foreground-muted">
          Every new Business Workspace goes through admin review before
          it&apos;s created — once approved, you become its Owner.
        </p>
        <form onSubmit={submitRequest} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-foreground-muted">
              Business name
            </label>
            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. NDJOYIT Services B.V."
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              maxLength={200}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground-muted">
              Reason (optional)
            </label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="What this workspace is for"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              maxLength={1000}
            />
          </div>
          {error && (
            <p className="rounded-md border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting || !businessName.trim()}
            className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Building2 className="h-4 w-4" />
            Request Workspace
          </button>
        </form>
      </div>

      <div className="rounded-lg border border-border bg-surface p-5">
        <h2 className="text-sm font-medium text-foreground-muted">
          Your Requests
        </h2>
        {requests && requests.length === 0 && (
          <p className="mt-3 text-sm text-foreground-muted">
            No requests yet.
          </p>
        )}
        {requests && requests.length > 0 && (
          <ul className="mt-3 space-y-3">
            {requests.map((r) => (
              <li
                key={r.id}
                className="rounded-md border border-border p-3 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{r.businessName}</p>
                  <StatusPill status={r.status} />
                </div>
                <p className="mt-1 text-xs text-foreground-muted">
                  Requested {new Date(r.createdAt).toLocaleString()}
                  {r.reviewReason && <> · &ldquo;{r.reviewReason}&rdquo;</>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {approvedWorkspaceIds.map((workspaceId) => (
        <TeamPanel key={workspaceId} workspaceId={workspaceId} />
      ))}
    </div>
  );
}

function TeamPanel({ workspaceId }: { workspaceId: string }) {
  const [members, setMembers] = useState<WorkspaceMembershipRow[] | null>(
    null,
  );
  const [invites, setInvites] = useState<WorkspaceInvite[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("MEMBER");
  const [department, setDepartment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    listBusinessWorkspaceMembers(workspaceId)
      .then(setMembers)
      .catch(() => setMembers([]));
    listWorkspaceInvites(workspaceId)
      .then(setInvites)
      .catch(() => setInvites([]));
  }, [workspaceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await inviteToWorkspace(
        workspaceId,
        email.trim(),
        role,
        department || undefined,
      );
      setEmail("");
      setDepartment("");
      refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(inviteId: string) {
    setBusy(true);
    try {
      await revokeWorkspaceInvite(workspaceId, inviteId);
      refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-medium text-foreground-muted">Team</h2>

      {members && members.length > 0 && (
        <ul className="mt-3 space-y-2">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between rounded-md border border-border p-3 text-sm"
            >
              <span className="font-mono text-xs">{m.userId}</span>
              <span className="flex items-center gap-2 text-xs text-foreground-muted">
                {m.department && <span>{m.department} ·</span>}
                <span className="font-medium text-foreground">{m.role}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={sendInvite}
        className="mt-4 flex flex-wrap items-end gap-2 border-t border-border pt-4"
      >
        <div>
          <label className="block text-xs font-medium text-foreground-muted">
            Email
          </label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="teammate@company.com"
            className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground-muted">
            Role
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as WorkspaceRole)}
            className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="ADMIN">Admin</option>
            <option value="MEMBER">Member</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground-muted">
            Department (optional)
          </label>
          <input
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="e.g. Sales"
            className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={busy || !email.trim()}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-xs font-medium text-accent-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Invite
        </button>
      </form>

      {error && (
        <p className="mt-3 rounded-md border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
          {error}
        </p>
      )}

      {invites && invites.filter((i) => i.status === "PENDING").length > 0 && (
        <ul className="mt-4 space-y-2">
          {invites
            .filter((i) => i.status === "PENDING")
            .map((i) => (
              <li
                key={i.id}
                className="flex items-center justify-between rounded-md border border-border p-3 text-sm"
              >
                <span>
                  {i.invitedEmail} · {i.invitedRole}
                  {i.invitedDepartment && <> · {i.invitedDepartment}</>}
                </span>
                <button
                  onClick={() => handleRevoke(i.id)}
                  disabled={busy}
                  className="rounded-md p-1.5 text-critical hover:bg-critical/10 disabled:opacity-50"
                  title="Revoke invite"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
