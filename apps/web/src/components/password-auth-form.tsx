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
import { COUNTRIES } from "@/lib/countries";
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
  // Passport Card fields — collected here, at account creation, instead of
  // a separate step afterwards. All optional except full name.
  const [showPassportFields, setShowPassportFields] = useState(false);
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("");
  const [website, setWebsite] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [xUrl, setXUrl] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessRole, setBusinessRole] = useState("");
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
          : await registerWithPassword(email, password, fullName, {
              bio: bio.trim() || undefined,
              country: country || undefined,
              website: website.trim() || undefined,
              linkedinUrl: linkedinUrl.trim() || undefined,
              instagramUrl: instagramUrl.trim() || undefined,
              xUrl: xUrl.trim() || undefined,
              businessName: businessName.trim() || undefined,
              businessRole: businessRole.trim() || undefined,
            });
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

        {mode === "register" && (
          <div className="rounded-md border border-border">
            <button
              type="button"
              onClick={() => setShowPassportFields((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-foreground-muted hover:text-foreground"
            >
              <span>
                Add your NDY Passport details{" "}
                <span className="font-normal text-foreground-muted/70">
                  (optional — can add later)
                </span>
              </span>
              <span>{showPassportFields ? "−" : "+"}</span>
            </button>

            {showPassportFields && (
              <div className="space-y-3 border-t border-border p-3">
                <div>
                  <label className="block text-xs uppercase tracking-wide text-foreground-muted">
                    Bio
                  </label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    maxLength={280}
                    rows={2}
                    placeholder="A short line about who you are."
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wide text-foreground-muted">
                    Country
                  </label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Prefer not to say</option>
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wide text-foreground-muted">
                    Website
                  </label>
                  <input
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://"
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs uppercase tracking-wide text-foreground-muted">
                      LinkedIn
                    </label>
                    <input
                      value={linkedinUrl}
                      onChange={(e) => setLinkedinUrl(e.target.value)}
                      placeholder="https://linkedin.com/in/…"
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wide text-foreground-muted">
                      Instagram
                    </label>
                    <input
                      value={instagramUrl}
                      onChange={(e) => setInstagramUrl(e.target.value)}
                      placeholder="https://instagram.com/…"
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wide text-foreground-muted">
                      X / Twitter
                    </label>
                    <input
                      value={xUrl}
                      onChange={(e) => setXUrl(e.target.value)}
                      placeholder="https://x.com/…"
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs uppercase tracking-wide text-foreground-muted">
                      Business name
                    </label>
                    <input
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wide text-foreground-muted">
                      Role / Title
                    </label>
                    <input
                      value={businessRole}
                      onChange={(e) => setBusinessRole(e.target.value)}
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>
            )}
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
