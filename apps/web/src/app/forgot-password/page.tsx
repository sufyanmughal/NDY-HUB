"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  forgotPassword,
  resendPasswordResetCode,
  resetPassword,
} from "@/lib/api";
import { useCountdown, formatCountdown } from "@/lib/use-countdown";

/**
 * Single-page state machine — email entry, then code + new password —
 * rather than a separate /reset-password route hit from an emailed link.
 * The code is typed in by hand now (not a URL param), so there's nothing
 * for a second route to read from the address bar; keeping both steps
 * here mirrors the same "swap the form out" pattern password-auth-form.tsx
 * already uses for its own pendingVerificationEmail / 2FA-challenge states.
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<"request" | "code" | "done">("request");

  const [expirySeed, setExpirySeed] = useState(0);
  const { secondsLeft, expired } = useCountdown(expirySeed);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { expiresInSeconds } = await forgotPassword(email);
      // The backend deliberately resolves the same way whether or not the
      // email is registered — showing a different message here for "not
      // found" would defeat that and let this page be used to check which
      // emails have accounts. Always advances to the code step.
      setExpirySeed(expiresInSeconds);
      setStage("code");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setResendBusy(true);
    setResendMessage(null);
    try {
      const { expiresInSeconds } = await resendPasswordResetCode(email);
      setExpirySeed(expiresInSeconds);
      setResendMessage("Code sent — check your inbox.");
    } catch (err) {
      setResendMessage((err as Error).message);
    } finally {
      setResendBusy(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await resetPassword(email, code, newPassword);
      setStage("done");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <span className="text-xl font-semibold tracking-tight">
          NDY <span className="text-accent">HUB</span>
          <sup className="text-[10px] align-super text-foreground-muted">™</sup>
        </span>
      </div>

      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6">
        {stage === "request" && (
          <form onSubmit={handleRequestCode} className="space-y-3">
            <div>
              <h1 className="text-lg font-semibold">Reset your password</h1>
              <p className="mt-1 text-sm text-foreground-muted">
                Enter your email and we&apos;ll send you a code.
              </p>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-foreground-muted">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>

            {error && <p className="text-sm text-critical">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send code"}
            </button>
          </form>
        )}

        {stage === "code" && (
          <form onSubmit={handleResetPassword} className="space-y-3 text-left">
            <div className="text-center">
              <h1 className="text-lg font-semibold">Enter your code</h1>
              <p className="mt-1 text-sm text-foreground-muted">
                We sent a 6-digit code to{" "}
                <span className="font-medium text-foreground">{email}</span>.
              </p>
              <p className="mt-2 text-sm font-medium tabular-nums">
                {expired ? (
                  <span className="text-critical">Code expired</span>
                ) : (
                  <>
                    Expires in{" "}
                    <span className="text-foreground">
                      {formatCountdown(secondsLeft)}
                    </span>
                  </>
                )}
              </p>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-foreground-muted">
                Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-center text-lg tracking-[0.5em] tabular-nums"
                placeholder="000000"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-foreground-muted">
                New password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-foreground-muted">
                Confirm password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>

            {error && <p className="text-sm text-critical">{error}</p>}
            {resendMessage && (
              <p className="text-sm text-accent">{resendMessage}</p>
            )}

            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Resetting…" : "Reset password"}
            </button>
            <button
              type="button"
              onClick={handleResend}
              disabled={resendBusy || !expired}
              className="w-full rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resendBusy ? "Sending…" : "Resend code"}
            </button>
          </form>
        )}

        {stage === "done" && (
          <div className="text-center">
            <p className="text-sm text-foreground-muted">
              Your password has been reset. Every device is now signed out —
              sign in again with your new password.
            </p>
            <button
              type="button"
              onClick={() => router.replace("/login")}
              className="mt-4 w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
            >
              Go to sign in
            </button>
          </div>
        )}
      </div>

      {stage !== "done" && (
        <Link href="/login" className="text-xs text-accent hover:underline">
          Back to sign in
        </Link>
      )}
    </div>
  );
}
