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
  ApiError,
  type AuditLogEntry,
  type AdminOAuthClient,
  type AdminSupportTicket,
} from "@/lib/api";
import { UserManagementPanel } from "@/components/user-management-panel";

export default function AdminPage() {
  const { auth } = useAuth();
  const [auditLog, setAuditLog] = useState<AuditLogEntry[] | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const refresh = useCallback(() => {
    if (auth.status !== "authenticated") return;
    getAdminAuditLog(auth.accessToken)
      .then(({ entries }) => setAuditLog(entries))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setAccessDenied(true);
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
        <p className="text-sm font-medium text-critical">Admin access required.</p>
        <p className="mt-1 text-xs text-foreground-muted">
          {auth.ndyId} is signed in but isn&apos;t an admin on this server.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          User search, roles, and suspension. Every action here is written to the audit log.
        </p>
      </div>

      <UserManagementPanel accessToken={accessToken} />

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

      <OAuthClientsSection accessToken={accessToken} />
      <SupportTicketsSection accessToken={accessToken} />
    </div>
  );
}

function OAuthClientsSection({ accessToken }: { accessToken: string }) {
  const [clients, setClients] = useState<AdminOAuthClient[] | null>(null);
  const [scopeCatalog, setScopeCatalog] = useState<Record<string, string> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyClientId, setBusyClientId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [redirectUrisText, setRedirectUrisText] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["openid"]);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<{ clientId: string; clientSecret: string } | null>(null);

  const refresh = useCallback(() => {
    listAdminOAuthClients(accessToken)
      .then(setClients)
      .catch((err) => setLoadError((err as Error).message));
  }, [accessToken]);

  useEffect(() => {
    refresh();
    getOAuthScopeCatalog(accessToken)
      .then(({ scopes }) => setScopeCatalog(scopes))
      .catch(() => {
        /* the create form just won't have scope descriptions if this fails */
      });
  }, [accessToken, refresh]);

  async function handleToggleActive(client: AdminOAuthClient) {
    setBusyClientId(client.id);
    setToggleError(null);
    try {
      await setAdminOAuthClientActive(accessToken, client.id, !client.isActive);
      refresh();
    } catch (err) {
      setToggleError((err as Error).message);
    } finally {
      setBusyClientId(null);
    }
  }

  function toggleScope(scope: string) {
    setSelectedScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));
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
      const created = await createAdminOAuthClient(accessToken, {
        name,
        redirectUris,
        allowedScopes: selectedScopes,
      });
      setRevealedSecret({ clientId: created.clientId, clientSecret: created.clientSecret });
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
          <h2 className="text-sm font-medium text-foreground-muted">Connected Websites (OAuth Clients)</h2>
          <p className="mt-1 text-xs text-foreground-muted">
            NDJOYIT sites registered to sign users in through NDY HUB via OAuth/OIDC.
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
      {toggleError && <p className="mt-3 text-sm text-critical">{toggleError}</p>}

      {revealedSecret && (
        <div className="mt-4 rounded-md border border-good/40 bg-good/10 p-3 text-sm">
          <p className="font-medium text-good">
            Client registered — copy the secret now, it won&apos;t be shown again.
          </p>
          <p className="mt-2 font-mono text-xs">client_id: {revealedSecret.clientId}</p>
          <p className="mt-1 break-all font-mono text-xs">client_secret: {revealedSecret.clientSecret}</p>
          <button
            onClick={() => setRevealedSecret(null)}
            className="mt-2 rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-2"
          >
            Done, I&apos;ve copied it
          </button>
        </div>
      )}

      {formOpen && (
        <form onSubmit={handleCreate} className="mt-4 space-y-3 rounded-md border border-border p-4">
          <div>
            <label className="block text-xs uppercase tracking-wide text-foreground-muted">Site name</label>
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
            <label className="block text-xs uppercase tracking-wide text-foreground-muted">Allowed scopes</label>
            <div className="mt-1 space-y-1">
              {Object.entries(scopeCatalog ?? { openid: "Confirm who you are (required)" }).map(
                ([scope, description]) => (
                  <label key={scope} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedScopes.includes(scope)}
                      onChange={() => toggleScope(scope)}
                      disabled={scope === "openid"}
                    />
                    <span className="font-mono text-xs">{scope}</span>
                    <span className="text-xs text-foreground-muted">— {description}</span>
                  </label>
                ),
              )}
            </div>
          </div>
          {createError && <p className="text-sm text-critical">{createError}</p>}
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
        <p className="mt-4 text-sm text-foreground-muted">No sites registered yet.</p>
      )}
      {clients && clients.length > 0 && (
        <ul className="mt-4 divide-y divide-border">
          {clients.map((client) => (
            <li key={client.id} className="flex items-center justify-between py-3 text-sm">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{client.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      client.isActive ? "bg-good/15 text-good" : "bg-critical/15 text-critical"
                    }`}
                  >
                    {client.isActive ? "Active" : "Deactivated"}
                  </span>
                </div>
                <p className="mt-1 font-mono text-xs text-foreground-muted">{client.clientId}</p>
                <p className="mt-1 text-xs text-foreground-muted">
                  {client.allowedScopes.join(", ")} · {client.redirectUris.length} redirect URI(s)
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

function SupportTicketsSection({ accessToken }: { accessToken: string }) {
  const [tickets, setTickets] = useState<AdminSupportTicket[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [busyTicketId, setBusyTicketId] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    adminListSupportTickets(accessToken)
      .then(setTickets)
      .catch((err) => setLoadError((err as Error).message));
  }, [accessToken]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleReply(ticket: AdminSupportTicket) {
    const reply = (replyDrafts[ticket.id] ?? "").trim();
    if (!reply) return;
    setBusyTicketId(ticket.id);
    setReplyError(null);
    try {
      await adminReplySupportTicket(accessToken, ticket.id, reply);
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
      <h2 className="text-sm font-medium text-foreground-muted">Support Tickets</h2>
      {loadError && <p className="mt-3 text-sm text-critical">{loadError}</p>}
      {replyError && <p className="mt-3 text-sm text-critical">{replyError}</p>}

      {tickets && tickets.length === 0 && (
        <p className="mt-3 text-sm text-foreground-muted">No support requests yet.</p>
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
                {t.user.ndyId} · {t.user.email} · {new Date(t.createdAt).toLocaleString()}
              </p>
              <p className="mt-2 text-sm">{t.message}</p>
              <textarea
                value={replyDrafts[t.id] ?? ""}
                onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [t.id]: e.target.value }))}
                placeholder="Write a reply…"
                rows={2}
                className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
              <button
                onClick={() => handleReply(t)}
                disabled={busyTicketId === t.id || !(replyDrafts[t.id] ?? "").trim()}
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
              <li key={t.id} className="rounded-md border border-border p-3 text-sm">
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
                {t.adminReply && <p className="mt-2 rounded-md bg-surface-2 p-2">{t.adminReply}</p>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
