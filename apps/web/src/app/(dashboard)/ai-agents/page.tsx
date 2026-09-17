"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import {
  ApiError,
  grantAgentConsent,
  listAgentGrants,
  listAgentScopes,
  revokeAgentConsent,
  type AiAgentConsentScope,
  type AiAgentGrant,
} from "@/lib/api";

const INPUT_CLASS =
  "w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent";

/** Plain-language labels — a consent screen should read as "what the agent may
 * do", not as scope enum values. */
const SCOPE_LABEL: Record<AiAgentConsentScope, string> = {
  CALENDAR: "Your calendar",
  CONTACTS: "Your contacts",
  TASKS: "Your tasks",
  NOTES: "Your notes",
  ECONOMY_READ: "Your economy balances (read-only)",
};

export default function AiAgentsPage() {
  const [grants, setGrants] = useState<AiAgentGrant[]>([]);
  const [available, setAvailable] = useState<AiAgentConsentScope[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showGrant, setShowGrant] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [grantsResult, scopesResult] = await Promise.all([
        listAgentGrants(),
        listAgentScopes(),
      ]);
      setGrants(grantsResult);
      setAvailable(scopesResult.scopes);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Couldn't load your AI agent access.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="h-6 w-6 text-accent" strokeWidth={2} />
            <h1 className="text-2xl font-bold">AI Agents</h1>
          </div>
          <p className="mt-1 text-sm text-foreground-muted">
            AI agents can act on your behalf only within the access you grant
            here. Nothing is shared by default, and revoking takes effect on the
            agent&apos;s next attempt.
          </p>
        </div>
        <button
          onClick={() => setShowGrant((v) => !v)}
          className="flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Grant access
        </button>
      </header>

      {showGrant && (
        <GrantForm
          available={available}
          onGranted={(grant) => {
            setGrants((prev) => [
              grant,
              ...prev.filter((g) => g.oauthClientId !== grant.oauthClientId),
            ]);
            setShowGrant(false);
          }}
          onCancel={() => setShowGrant(false)}
        />
      )}

      {error && (
        <p className="mt-6 rounded-md border border-critical/40 bg-critical/10 px-4 py-3 text-sm text-critical">
          {error}
        </p>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground-muted">
          Agents with access
        </h2>

        {loading ? (
          <p className="flex items-center gap-2 py-10 text-sm text-foreground-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        ) : grants.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-12 text-center">
            <ShieldCheck className="mx-auto h-7 w-7 text-foreground-muted" />
            <p className="mt-3 text-sm font-medium">No agents have access</p>
            <p className="mt-1 text-sm text-foreground-muted">
              That&apos;s the default. Grant access only to agents you trust.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {grants.map((grant) => (
              <GrantRow
                key={grant.id}
                grant={grant}
                onRevoked={() =>
                  setGrants((prev) => prev.filter((g) => g.id !== grant.id))
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function GrantRow({
  grant,
  onRevoked,
}: {
  grant: AiAgentGrant;
  onRevoked: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function revoke() {
    if (!confirm(`Revoke access for "${grant.clientName}"?`)) return;
    setBusy(true);
    try {
      await revokeAgentConsent(grant.oauthClientId);
      onRevoked();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-surface p-4">
      <div className="min-w-0">
        <div className="font-medium">{grant.clientName}</div>
        <div className="mt-0.5 truncate font-mono text-[11px] text-foreground-muted">
          {grant.oauthClientId}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {grant.scopes.map((scope) => (
            <span
              key={scope}
              className="rounded-full border border-border px-2 py-0.5 text-[11px] text-foreground-muted"
            >
              {SCOPE_LABEL[scope] ?? scope}
            </span>
          ))}
        </div>
        <div className="mt-2 text-xs text-foreground-muted">
          Granted {new Date(grant.grantedAt).toLocaleDateString()}
        </div>
      </div>
      <button
        onClick={() => void revoke()}
        disabled={busy}
        title="Revoke access"
        className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface-2 disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5 text-critical" /> Revoke
      </button>
    </div>
  );
}

function GrantForm({
  available,
  onGranted,
  onCancel,
}: {
  available: AiAgentConsentScope[];
  onGranted: (grant: AiAgentGrant) => void;
  onCancel: () => void;
}) {
  const [oauthClientId, setOauthClientId] = useState("");
  const [scopes, setScopes] = useState<AiAgentConsentScope[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(scope: AiAgentConsentScope) {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onGranted(await grantAgentConsent(oauthClientId.trim(), scopes));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't grant access.");
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-6 space-y-4 rounded-xl border border-border bg-surface p-5"
    >
      <h2 className="font-semibold">Grant an AI agent access</h2>

      <label className="block">
        <span className="mb-1 block text-xs uppercase tracking-wide text-foreground-muted">
          Agent client ID
        </span>
        <input
          required
          value={oauthClientId}
          onChange={(e) => setOauthClientId(e.target.value)}
          placeholder="cl_…"
          className={INPUT_CLASS}
        />
      </label>

      <div>
        <span className="mb-2 block text-xs uppercase tracking-wide text-foreground-muted">
          What it may do
        </span>
        <div className="space-y-2">
          {available.map((scope) => (
            <label key={scope} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={scopes.includes(scope)}
                onChange={() => toggle(scope)}
              />
              <span>{SCOPE_LABEL[scope] ?? scope}</span>
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-critical">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy || scopes.length === 0}
          className="flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Grant access
        </button>
      </div>
    </form>
  );
}
