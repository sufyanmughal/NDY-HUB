"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { QrLoginCard } from "@/components/qr-login-card";
import { useAuth } from "@/lib/auth-context";

/** `next` comes straight off the query string of a page anyone can link to
 * (including the OAuth consent flow) — treat it as untrusted. Only an
 * in-app relative path is let through; anything shaped like it could send
 * the browser off-site (a scheme, a protocol-relative `//host`) falls back
 * to the dashboard root instead. Same "never redirect on unvalidated input"
 * rule the /oauth/authorize endpoint follows. */
function sanitizeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

function LoginPageInner() {
  const { auth } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = sanitizeNext(searchParams.get("next"));

  useEffect(() => {
    if (auth.status === "authenticated") router.replace(next);
  }, [auth.status, router, next]);

  if (auth.status !== "unauthenticated") {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <span className="text-xl font-semibold tracking-tight">
          NDY <span className="text-accent">HUB</span>
          <sup className="text-[10px] align-super text-foreground-muted">™</sup>
        </span>
        <p className="mt-1 text-sm text-foreground-muted">One Identity. One Passport. One Ecosystem.</p>
      </div>
      <QrLoginCard redirectTo={next} />
      <p className="max-w-sm text-center text-xs text-foreground-muted">
        Don&apos;t have NDYAPPS yet? Email and password login lands alongside NDYAPPS in this same
        milestone.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
