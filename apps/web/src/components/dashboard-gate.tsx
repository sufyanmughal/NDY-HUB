"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

/**
 * Everything under (dashboard) requires a session. Rather than guess at
 * loading vs. logged-out on the server (no cookie to inspect yet — see the
 * auth-client.ts note on why sessions live in localStorage for now), this
 * gate resolves client-side and bounces to /login once it's sure there's no
 * valid session, instead of flashing real content first.
 */
export function DashboardGate({ children }: { children: React.ReactNode }) {
  const { auth } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.status === "unauthenticated") {
      router.replace("/login");
    }
  }, [auth.status, router]);

  if (auth.status !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-foreground-muted">
        {auth.status === "loading" ? "Checking your session…" : "Redirecting to login…"}
      </div>
    );
  }

  return <>{children}</>;
}
