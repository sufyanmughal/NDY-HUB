"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getAdminAuditLog,
  getOAuthScopeCatalog,
  listAdminOAuthClients,
  createAdminOAuthClient,
  setAdminOAuthClientActive,
  adminListSupportTickets,
  adminReplySupportTicket,
  type AuditLogEntry,
  type AdminOAuthClient,
  type AdminSupportTicket,
} from "@/lib/api";
import { useMe } from "@/lib/use-me";
import { roleHasPermission, roleHasAnyPermission } from "@/lib/permissions";
import { UserManagementPanel } from "@/components/user-management-panel";
import { RoleChangeRequestPanel } from "@/components/role-change-request-panel";
import { IdentityVerificationReviewPanel } from "@/components/identity-verification-review-panel";

/**
 * With 9 roles each granting different, non-overlapping admin capabilities
 * (see common/permissions.ts on the API side), there's no single "admin
 * access" gate anymore — a Support agent legitimately sees only Support
 * Tickets here, an Auditor only the Audit Log, and so on. Each section is
 * shown or hidden based on the viewer's own role rather than one
 * all-or-nothing check.
 */
export default function AdminPage() {
  const { auth } = useAuth();
  const me = useMe();
  // UserManagementPanel and RoleChangeRequestPanel are independent
  // components with their own fetch state — this is what tells the queue
  // to refetch right after a request is created, instead of only updating
  // on the next full page load.
  const [roleRequestsVersion, setRoleRequestsVersion] = useState(0);

  if (auth.status !== "authenticated") return null;
  // me is null only while the /auth/me fetch is still in flight — render
  // nothing rather than flash "no access" and then sections popping in.
  if (!me) return null;

  const canManageUsers = roleHasPermission(me.role, "MANAGE_USERS");
  const canManageRoles = roleHasPermission(me.role, "MANAGE_ROLES");
  const canViewAuditLog = roleHasPermission(me.role, "VIEW_AUDIT_LOG");
  const canManageOAuthClients = roleHasPermission(
    me.role,
    "MANAGE_OAUTH_CLIENTS",
  );
  const canManageSupportTickets = roleHasPermission(
    me.role,
    "MANAGE_SUPPORT_TICKETS",
  );
  const canReviewIdentityVerification = roleHasPermission(
    me.role,
    "REVIEW_IDENTITY_VERIFICATION",
  );
  const hasAnyAdminAccess = roleHasAnyPermission(me.role, [
    "MANAGE_USERS",
    "MANAGE_ROLES",
    "VIEW_AUDIT_LOG",
    "MANAGE_OAUTH_CLIENTS",
    "MANAGE_SUPPORT_TICKETS",
    "REVIEW_IDENTITY_VERIFICATION",
  ]);

  if (!hasAnyAdminAccess) {
    return (
      <div className="rounded-lg border border-critical/30 bg-critical/10 p-6 text-center">
        <p className="text-sm font-medium text-critical">
          Admin access required.
        </p>
        <p className="mt-1 text-xs text-foreground-muted">
          {auth.ndyId} is signed in as {me.role}, which doesn&apos;t include any
          admin permissions on this server.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Signed in as {me.role}. Sections below reflect exactly what that role
          can do — every action taken is written to the audit log.
        </p>
      </div>

      {canManageUsers && (
        <UserManagementPanel
          onRoleChangeRequested={() => setRoleRequestsVersion((v) => v + 1)}
        />
      )}
      {canManageRoles && (
        <RoleChangeRequestPanel refreshKey={roleRequestsVersion} />
      )}
      {canViewAuditLog && <AuditLogSection />}
      {canManageOAuthClients && <OAuthClientsSection />}
      {canManageSupportTickets && <SupportTicketsSection />}
      {canReviewIdentityVerification && <IdentityVerificationReviewPanel />}
    </div>
  );
}

function AuditLogSection() {
  const [auditLog, setAuditLog] = useState<AuditLogEntry[] | null>(null);

  useEffect(() => {
    getAdminAuditLog()
      .then(({ entries }) => setAuditLog(entries))
      .catch(() => {
        /* section just stays empty on failure — this viewer already passed the client-side permission check */
      });
  }, []);

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-medium text-foreground-muted">Audit Log</h2>
      {auditLog && auditLog.length === 0 ? (
        <p className="mt-3 text-sm text-foreground-muted">
          No admin actions yet.
        </p>
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
  );
}

function OAuthClientsSection() {
  const [clients, setClients] = useState<AdminOAuthClient[] | null>(null);
  const [scopeCatalog, setScopeCatalog] = useState<Record<
    string,
    string
  > | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyClientId, setBusyClientId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [redirectUrisText, setRedirectUrisText] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["openid"]);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<{
    clientId: string;
    clientSecret: string;
  } | null>(null);

  const refresh = useCallback(() => {
    listAdminOAuthClients()
      .then(setClients)
      .catch((err) => setLoadError((err as Error).message));
  }, []);

  useEffect(() => {
    refresh();
    getOAuthScopeCatalog()
      .then(({ scopes }) => setScopeCatalog(scopes))
      .catch(() => {
        /* the create form just won't have scope descriptions if this fails */
      });
  }, [refresh]);

  async function handleToggleActive(client: AdminOAuthClient) {
    setBusyClientId(client.id);
    setToggleError(null);
    try {
      await setAdminOAuthClientActive(client.id, !client.isActive);
      refresh();
    } catch (err) {
      setToggleError((err as Error).message);
    } finally {
      setBusyClientId(null);
    }
  }

  function toggleScope(scope: string) {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const redirectUris = redirectUrisText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    setCreateBusy(true);
    setCreateError(null);
    try {
      const created = await createAdminOAuthClient({
        name,
        redirectUris,
        allowedScopes: selectedScopes,
      });
      setRevealedSecret({
        clientId: created.clientId,
        clientSecret: created.clientSecret,
      });
      setName("");
      setRedirectUrisText("");
      setSelectedScopes(["openid"]);
      setFormOpen(false);
      refresh();
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setCreateBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-foreground-muted">
            Connected Websites (OAuth Clients)
          </h2>
          <p className="mt-1 text-xs text-foreground-muted">
            NDJOYIT sites registered to sign users in through NDY HUB via
            OAuth/OIDC.
          </p>
        </div>
        <button
          onClick={() => setFormOpen((v) => !v)}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90"
        >
          {formOpen ? "Cancel" : "Register a site"}
        </button>
      </div>

      {loadError && <p className="mt-3 text-sm text-critical">{loadError}</p>}
      {toggleError && (
        <p className="mt-3 text-sm text-critical">{toggleError}</p>
      )}

      {revealedSecret && (
        <div className="mt-4 rounded-md border border-good/40 bg-good/10 p-3 text-sm">
          <p className="font-medium text-good">
            Client registered — copy the secret now, it won&apos;t be shown
            again.
          </p>
          <p className="mt-2 font-mono text-xs">
            client_id: {revealedSecret.clientId}
          </p>
          <p className="mt-1 break-all font-mono text-xs">
            client_secret: {revealedSecret.clientSecret}
          </p>
          <button
            onClick={() => setRevealedSecret(null)}
            className="mt-2 rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-2"
          >
            Done, I&apos;ve copied it
          </button>
        </div>
      )}

      {formOpen && (
        <form
          onSubmit={handleCreate}
          className="mt-4 space-y-3 rounded-md border border-border p-4"
        >
          <div>
            <label className="block text-xs uppercase tracking-wide text-foreground-muted">
              Site name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
              placeholder="NDYQUIZ"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-foreground-muted">
              Redirect URIs (one per line)
            </label>
            <textarea
              value={redirectUrisText}
              onChange={(e) => setRedirectUrisText(e.target.value)}
              required
              rows={3}
              placeholder="https://ndyquiz.com/auth/callback"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-foreground-muted">
              Allowed scopes
            </label>
            <div className="mt-1 space-y-1">
              {Object.entries(
                scopeCatalog ?? { openid: "Confirm who you are (required)" },
              ).map(([scope, description]) => (
                <label key={scope} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedScopes.includes(scope)}
                    onChange={() => toggleScope(scope)}
                    disabled={scope === "openid"}
                  />
                  <span className="font-mono text-xs">{scope}</span>
                  <span className="text-xs text-foreground-muted">
                    — {description}
                  </span>
                </label>
              ))}
            </div>
          </div>
          {createError && (
            <p className="text-sm text-critical">{createError}</p>
          )}
          <button
            type="submit"
            disabled={createBusy}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {createBusy ? "Registering…" : "Register site"}
          </button>
        </form>
      )}

      {clients && clients.length === 0 && (
        <p className="mt-4 text-sm text-foreground-muted">
          No sites registered yet.
        </p>
      )}
      {clients && clients.length > 0 && (
        <ul className="mt-4 divide-y divide-border">
          {clients.map((client) => (
            <li
              key={client.id}
              className="flex items-center justify-between py-3 text-sm"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{client.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      client.isActive
                        ? "bg-good/15 text-good"
                        : "bg-critical/15 text-critical"
                    }`}
                  >
                    {client.isActive ? "Active" : "Deactivated"}
                  </span>
                </div>
                <p className="mt-1 font-mono text-xs text-foreground-muted">
                  {client.clientId}
                </p>
                <p className="mt-1 text-xs text-foreground-muted">
                  {client.allowedScopes.join(", ")} ·{" "}
                  {client.redirectUris.length} redirect URI(s)
                </p>
              </div>
              <button
                onClick={() => handleToggleActive(client)}
                disabled={busyClientId === client.id}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-2 disabled:opacity-50"
              >
                {client.isActive ? "Deactivate" : "Activate"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SupportTicketsSection() {
  const [tickets, setTickets] = useState<AdminSupportTicket[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [busyTicketId, setBusyTicketId] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    adminListSupportTickets()
      .then(setTickets)
      .catch((err) => setLoadError((err as Error).message));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleReply(ticket: AdminSupportTicket) {
    const reply = (replyDrafts[ticket.id] ?? "").trim();
    if (!reply) return;
    setBusyTicketId(ticket.id);
    setReplyError(null);
    try {
      await adminReplySupportTicket(ticket.id, reply);
      setReplyDrafts((prev) => ({ ...prev, [ticket.id]: "" }));
      refresh();
    } catch (err) {
      setReplyError((err as Error).message);
    } finally {
      setBusyTicketId(null);
    }
  }

  const openTickets = tickets?.filter((t) => t.status === "OPEN") ?? [];
  const resolvedTickets = tickets?.filter((t) => t.status === "RESOLVED") ?? [];

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-medium text-foreground-muted">
        Support Tickets
      </h2>
      {loadError && <p className="mt-3 text-sm text-critical">{loadError}</p>}
      {replyError && <p className="mt-3 text-sm text-critical">{replyError}</p>}

      {tickets && tickets.length === 0 && (
        <p className="mt-3 text-sm text-foreground-muted">
          No support requests yet.
        </p>
      )}

      {openTickets.length > 0 && (
        <ul className="mt-4 space-y-4">
          {openTickets.map((t) => (
            <li key={t.id} className="rounded-md border border-accent/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">{t.subject}</p>
                <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">
                  Open
                </span>
              </div>
              <p className="mt-1 text-xs text-foreground-muted">
                {t.user.ndyId} · {t.user.email} ·{" "}
                {new Date(t.createdAt).toLocaleString()}
              </p>
              <p className="mt-2 text-sm">{t.message}</p>
              <textarea
                value={replyDrafts[t.id] ?? ""}
                onChange={(e) =>
                  setReplyDrafts((prev) => ({
                    ...prev,
                    [t.id]: e.target.value,
                  }))
                }
                placeholder="Write a reply…"
                rows={2}
                className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
              <button
                onClick={() => handleReply(t)}
                disabled={
                  busyTicketId === t.id || !(replyDrafts[t.id] ?? "").trim()
                }
                className="mt-2 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busyTicketId === t.id ? "Sending…" : "Reply & resolve"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {resolvedTickets.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-medium text-foreground-muted">
            {resolvedTickets.length} resolved
          </summary>
          <ul className="mt-3 space-y-3">
            {resolvedTickets.map((t) => (
              <li
                key={t.id}
                className="rounded-md border border-border p-3 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{t.subject}</p>
                  <span className="shrink-0 rounded-full bg-good/15 px-2 py-0.5 text-[11px] font-medium text-good">
                    Resolved
                  </span>
                </div>
                <p className="mt-1 text-xs text-foreground-muted">
                  {t.user.ndyId} · {t.user.email}
                </p>
                <p className="mt-2 text-foreground-muted">{t.message}</p>
                {t.adminReply && (
                  <p className="mt-2 rounded-md bg-surface-2 p-2">
                    {t.adminReply}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
