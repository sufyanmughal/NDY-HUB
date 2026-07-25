"use client";

import { useState } from "react";
import { verify2fa } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

/**
 * Step 2 of any login path that lands on a 2FA-enabled account — password
 * sign-in and the Google/Apple OAuth callback both trade their own proof
 * of "factor 1" for one of these challenge tokens, then finish here the
 * same way regardless of how the user got this far.
 */
export function TwoFactorChallengeForm({
  challengeToken,
  onCancel,
}: {
  challengeToken: string;
  onCancel?: () => void;
}) {
  const { login } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await verify2fa(challengeToken, code);
      login(session);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6">
      <h2 className="text-sm font-medium text-foreground">Two-factor authentication</h2>
      <p className="mt-1 text-xs text-foreground-muted">
        Enter the 6-digit code from your authenticator app, or one of your backup codes.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
          required
          placeholder="123456"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-center text-lg tracking-widest"
        />
        {error && <p className="text-sm text-critical">{error}</p>}
        <button
          type="submit"
          disabled={busy || !code}
          className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Verifying…" : "Verify"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="w-full text-center text-xs text-foreground-muted hover:underline"
          >
            Back to sign in
          </button>
        )}
      </form>
    </div>
  );
}
