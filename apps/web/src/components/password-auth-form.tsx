"use client";

import { useState } from "react";
import Link from "next/link";
import { loginWithPassword, registerWithPassword, verify2fa } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

/**
 * The password-based login page's own effect (auth.status === "authenticated"
 * -> router.replace(next)) picks up right after login() below updates
 * context — this component doesn't need to navigate anywhere itself.
 */
export function PasswordAuthForm() {
  const { login } = useAuth();
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [code, setCode] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result =
        mode === "signin"
          ? await loginWithPassword(email, password)
          : await registerWithPassword(email, password, fullName);
      if ("requires2fa" in result) {
        setChallengeToken(result.challengeToken);
        setBusy(false);
        return;
      }
      login(result);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function handleVerify2fa(e: React.FormEvent) {
    e.preventDefault();
    if (!challengeToken) return;
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

  if (challengeToken) {
    return (
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6">
        <h2 className="text-sm font-medium text-foreground">Two-factor authentication</h2>
        <p className="mt-1 text-xs text-foreground-muted">
          Enter the 6-digit code from your authenticator app, or one of your backup codes.
        </p>
        <form onSubmit={handleVerify2fa} className="mt-4 space-y-3">
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
          <button
            type="button"
            onClick={() => {
              setChallengeToken(null);
              setCode("");
              setError(null);
            }}
            className="w-full text-center text-xs text-foreground-muted hover:underline"
          >
            Back to sign in
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6">
      <div className="flex gap-1 rounded-md bg-surface-2 p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`flex-1 rounded px-3 py-1.5 font-medium ${
            mode === "signin" ? "bg-accent text-white" : "text-foreground-muted hover:text-foreground"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode("register")}
          className={`flex-1 rounded px-3 py-1.5 font-medium ${
            mode === "register" ? "bg-accent text-white" : "text-foreground-muted hover:text-foreground"
          }`}
        >
          Create account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        {mode === "register" && (
          <div>
            <label className="block text-xs uppercase tracking-wide text-foreground-muted">
              Full name
            </label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
        )}

        <div>
          <label className="block text-xs uppercase tracking-wide text-foreground-muted">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wide text-foreground-muted">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        {mode === "signin" && (
          <div className="text-right">
            <Link href="/forgot-password" className="text-xs text-accent hover:underline">
              Forgot password?
            </Link>
          </div>
        )}

        {error && <p className="text-sm text-critical">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>
    </div>
  );
}
