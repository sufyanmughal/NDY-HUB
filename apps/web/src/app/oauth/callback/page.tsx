"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { exchangeOAuthCode, type TwoFactorMethod } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { TwoFactorChallengeForm } from "@/components/two-factor-challenge-form";

// Same "only an in-app relative path" rule as LoginPage's own sanitizeNext —
// this one came back through a redirect chain this app's own API built,
// but it's still untrusted input by the time it reaches client JS.
function sanitizeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Sign-in was cancelled.",
  invalid_request: "This sign-in link is invalid or has expired — try again.",
  account_suspended: "This account has been suspended.",
  google_sign_in_failed:
    "Something went wrong signing in with Google — try again.",
  apple_sign_in_failed:
    "Something went wrong signing in with Apple — try again.",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <span className="text-xl font-semibold tracking-tight">
          NDY <span className="text-accent">HUB</span>
          <sup className="text-[10px] align-super text-foreground-muted">™</sup>
        </span>
      </div>
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 text-center">
        {children}
      </div>
    </div>
  );
}

function OAuthCallbackInner() {
  const { auth, login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = sanitizeNext(searchParams.get("next"));
  const error = searchParams.get("error");
  const challengeToken = searchParams.get("challengeToken");
  const methods = (searchParams.get("methods")?.split(",").filter(Boolean) ??
    []) as TwoFactorMethod[];
  const code = searchParams.get("code");

  const [exchangeError, setExchangeError] = useState<string | null>(null);

  // Covers both paths that end in a real session: the direct code exchange
  // below, and TwoFactorChallengeForm's own login() call after a
  // successful code — neither has anywhere else on this page to navigate
  // away from once auth-context actually reflects it.
  useEffect(() => {
    if (auth.status === "authenticated") router.replace(next);
  }, [auth.status, next, router]);

  useEffect(() => {
    if (!code) return;
    exchangeOAuthCode(code)
      .then(login)
      .catch((err) => setExchangeError((err as Error).message));
  }, [code, login]);

  if (challengeToken) {
    return (
      <TwoFactorChallengeForm
        challengeToken={challengeToken}
        methods={methods}
      />
    );
  }

  if (error) {
    return (
      <Shell>
        <p className="text-sm text-critical">
          {ERROR_MESSAGES[error] ?? "Sign-in failed."}
        </p>
        <Link
          href="/login"
          className="mt-4 inline-block text-xs text-accent hover:underline"
        >
          Back to sign in
        </Link>
      </Shell>
    );
  }

  if (exchangeError) {
    return (
      <Shell>
        <p className="text-sm text-critical">{exchangeError}</p>
        <Link
          href="/login"
          className="mt-4 inline-block text-xs text-accent hover:underline"
        >
          Back to sign in
        </Link>
      </Shell>
    );
  }

  if (code) {
    return (
      <Shell>
        <p className="text-sm text-foreground-muted">Signing you in…</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-sm text-critical">
        This sign-in link is missing what it needs — try again.
      </p>
      <Link
        href="/login"
        className="mt-4 inline-block text-xs text-accent hover:underline"
      >
        Back to sign in
      </Link>
    </Shell>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <OAuthCallbackInner />
    </Suspense>
  );
}
