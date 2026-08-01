"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  loginWithPassword,
  registerWithPassword,
  getOAuthProviders,
  buildOAuthStartUrl,
} from "@/lib/api";
import { loginWithPasskey, browserSupportsWebAuthn } from "@/lib/passkey";
import { useAuth } from "@/lib/auth-context";
import { TwoFactorChallengeForm } from "./two-factor-challenge-form";

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
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [oauthProviders, setOauthProviders] = useState<{
    google: boolean;
    apple: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getOAuthProviders()
      .then((result) => {
        if (!cancelled) setOauthProviders(result);
      })
      .catch(() => {
        /* best-effort — buttons just stay hidden if this fails */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handlePasskeyLogin() {
    setPasskeyBusy(true);
    setError(null);
    try {
      await loginWithPasskey();
      await login();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPasskeyBusy(false);
    }
  }

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
      await login();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (challengeToken) {
    return (
      <TwoFactorChallengeForm
        challengeToken={challengeToken}
        onCancel={() => setChallengeToken(null)}
      />
    );
  }

  return (
    <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6">
      <div className="flex gap-1 rounded-md bg-surface-2 p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`flex-1 rounded px-3 py-1.5 font-medium ${
            mode === "signin"
              ? "bg-accent text-white"
              : "text-foreground-muted hover:text-foreground"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode("register")}
          className={`flex-1 rounded px-3 py-1.5 font-medium ${
            mode === "register"
              ? "bg-accent text-white"
              : "text-foreground-muted hover:text-foreground"
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

        <div>
          <label className="block text-xs uppercase tracking-wide text-foreground-muted">
            Password
          </label>
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
            <Link
              href="/forgot-password"
              className="text-xs text-accent hover:underline"
            >
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
          {busy
            ? "Please wait…"
            : mode === "signin"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>

      {mode === "signin" &&
        ((typeof window !== "undefined" && browserSupportsWebAuthn()) ||
          oauthProviders?.google ||
          oauthProviders?.apple) && (
          <>
            <div className="my-3 flex items-center gap-3 text-xs text-foreground-muted">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="space-y-2">
              {typeof window !== "undefined" && browserSupportsWebAuthn() && (
                <button
                  type="button"
                  onClick={handlePasskeyLogin}
                  disabled={passkeyBusy}
                  className="w-full rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {passkeyBusy
                    ? "Waiting for passkey…"
                    : "Sign in with a passkey"}
                </button>
              )}
              {oauthProviders?.google && (
                <a
                  href={buildOAuthStartUrl("google", "/")}
                  className="block w-full rounded-md border border-border px-4 py-2 text-center text-sm font-medium hover:bg-surface-2"
                >
                  Continue with Google
                </a>
              )}
              {oauthProviders?.apple && (
                <a
                  href={buildOAuthStartUrl("apple", "/")}
                  className="block w-full rounded-md border border-border px-4 py-2 text-center text-sm font-medium hover:bg-surface-2"
                >
                  Continue with Apple
                </a>
              )}
            </div>
          </>
        )}
    </div>
  );
}
