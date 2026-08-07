"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, X } from "lucide-react";
import { confirmEmailVerification } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type ConfirmPhase =
  | { phase: "loading" }
  | { phase: "success" }
  | { phase: "error"; message: string };

function VerifyEmailPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { login } = useAuth();
  const token = searchParams.get("token");
  const [state, setState] = useState<ConfirmPhase>({ phase: "loading" });

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    confirmEmailVerification(token)
      .then(async () => {
        if (cancelled) return;
        // confirmEmailVerification now issues the account's first real
        // session (register() no longer does) — the cookie is already set
        // server-side by the time this resolves, so this just syncs
        // AuthProvider's own state from it, same as every other
        // freshly-issued-session flow (password login, 2FA, passkey, …).
        await login();
        if (!cancelled) setState({ phase: "success" });
      })
      .catch((err: Error) => {
        if (!cancelled) setState({ phase: "error", message: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [token, login]);

  useEffect(() => {
    if (state.phase !== "success") return;
    const timer = setTimeout(() => router.replace("/dashboard"), 1200);
    return () => clearTimeout(timer);
  }, [state.phase, router]);

  const effective: ConfirmPhase = token
    ? state
    : {
        phase: "error",
        message: "This verification link is missing its token.",
      };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <span className="text-xl font-semibold tracking-tight">
          NDY <span className="text-accent">HUB</span>
          <sup className="text-[10px] align-super text-foreground-muted">™</sup>
        </span>
      </div>

      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 text-center">
        {effective.phase === "loading" && (
          <p className="py-10 text-sm text-foreground-muted">Verifying…</p>
        )}

        {effective.phase === "success" && (
          <div>
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-good/15 text-good">
              <Check size={20} strokeWidth={2.5} />
            </div>
            <p className="mt-3 text-sm font-medium">Your email is verified.</p>
            <p className="mt-1 text-xs text-foreground-muted">
              Taking you to your dashboard…
            </p>
            <Link
              href="/dashboard"
              className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
            >
              Go to dashboard
            </Link>
          </div>
        )}

        {effective.phase === "error" && (
          <div>
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-critical/15 text-critical">
              <X size={20} strokeWidth={2.5} />
            </div>
            <p className="mt-3 text-sm">{effective.message}</p>
            <p className="mt-3 text-xs text-foreground-muted">
              Verification links expire after 4 minutes and 59 seconds, or
              after one use — go back and sign in to request a new one.
            </p>
            <Link
              href="/login"
              className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
            >
              Back to sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailPageInner />
    </Suspense>
  );
}
