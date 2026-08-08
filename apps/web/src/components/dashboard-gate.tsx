"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

/**
 * Everything under (dashboard) requires a session. The session itself is
 * an httpOnly cookie the server sets — invisible to this component and to
 * every other client-side script by design — so there's nothing to read
 * synchronously on first render; AuthProvider resolves it via /auth/me
 * before this can know loading vs. logged-out. This gate waits for that,
 * then bounces to /login once it's sure there's no valid session, instead
 * of flashing real content first.
 *
 * It also gates on passportComplete (== fullName is set) — every signup
 * path (password, OAuth, passkey) lands here, and this is the single
 * chokepoint that sends anyone who hasn't finished the post-signup
 * "Complete Your Passport" step there instead of into the dashboard.
 * Re-checked on every mount (not just once at signup) so it's self-healing
 * regardless of how the session was established.
 */
export function DashboardGate({ children }: { children: React.ReactNode }) {
  const { auth } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.status === "unauthenticated") {
      router.replace("/login");
    } else if (auth.status === "authenticated" && !auth.passportComplete) {
      router.replace("/passport/complete");
    }
  }, [auth, router]);

  const ready = auth.status === "authenticated" && auth.passportComplete;

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-foreground-muted">
        {auth.status === "loading"
          ? "Checking your session…"
          : "Redirecting…"}
      </div>
    );
  }

  return <>{children}</>;
}
