"use client";

import { useEffect, useState } from "react";
import { verify2fa, sendSmsChallenge, type TwoFactorMethod } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

/**
 * Step 2 of any login path that lands on a 2FA-enabled account — password
 * sign-in and the Google/Apple OAuth callback both trade their own proof
 * of "factor 1" for one of these challenge tokens, then finish here the
 * same way regardless of how the user got this far.
 *
 * Method-aware: a single-method account (just TOTP, or just SMS) skips
 * straight to that method's input. An account with both shows a picker
 * first — the actual SMS send only happens once the user picks SMS (or
 * immediately, if SMS is the only option), so choosing TOTP on a
 * both-enabled account never costs a real text message.
 */
export function TwoFactorChallengeForm({
  challengeToken,
  methods,
  onCancel,
}: {
  challengeToken: string;
  methods: TwoFactorMethod[];
  onCancel?: () => void;
}) {
  const { login } = useAuth();
  const [method, setMethod] = useState<TwoFactorMethod | null>(
    methods.length === 1 ? methods[0] : null,
  );
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [smsSent, setSmsSent] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);

  useEffect(() => {
    // A single-method SMS account already has its code sent server-side
    // by AuthService.login() itself — nothing to trigger here. This only
    // covers the both-enabled case, once the user picks SMS below.
    if (methods.length === 1 && methods[0] === "SMS") {
      setSmsSent(true);
    }
  }, [methods]);

  async function handleChooseSms() {
    setMethod("SMS");
    setError(null);
    try {
      await sendSmsChallenge(challengeToken);
      setSmsSent(true);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleResendSms() {
    setResendBusy(true);
    setError(null);
    try {
      await sendSmsChallenge(challengeToken);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setResendBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await verify2fa(challengeToken, code);
      await login();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (!method) {
    return (
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6">
        <h2 className="text-sm font-medium text-foreground">
          Two-factor authentication
        </h2>
        <p className="mt-1 text-xs text-foreground-muted">
          Choose how you&apos;d like to verify it&apos;s you.
        </p>
        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={() => setMethod("TOTP")}
            className="w-full rounded-md border border-border px-4 py-2 text-left text-sm hover:bg-background"
          >
            Use authenticator app
          </button>
          <button
            type="button"
            onClick={handleChooseSms}
            className="w-full rounded-md border border-border px-4 py-2 text-left text-sm hover:bg-background"
          >
            Text me a code
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-critical">{error}</p>}
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="mt-4 w-full text-center text-xs text-foreground-muted hover:underline"
          >
            Back to sign in
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6">
      <h2 className="text-sm font-medium text-foreground">
        Two-factor authentication
      </h2>
      <p className="mt-1 text-xs text-foreground-muted">
        {method === "SMS"
          ? smsSent
            ? "We texted a code to your phone."
            : "Sending a code to your phone…"
          : "Enter the 6-digit code from your authenticator app, or one of your backup codes."}
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
        {method === "SMS" && (
          <button
            type="button"
            onClick={handleResendSms}
            disabled={resendBusy}
            className="w-full text-center text-xs text-foreground-muted hover:underline disabled:opacity-50"
          >
            {resendBusy ? "Resending…" : "Resend code"}
          </button>
        )}
        {methods.length > 1 && (
          <button
            type="button"
            onClick={() => {
              setMethod(null);
              setCode("");
              setError(null);
            }}
            className="w-full text-center text-xs text-foreground-muted hover:underline"
          >
            Use a different method
          </button>
        )}
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
