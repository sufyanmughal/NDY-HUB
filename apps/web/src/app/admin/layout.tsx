"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

// Deliberately outside the (dashboard) route group — an "Admin" link has no
// business showing up in the regular sidebar for every user. This layout
// only handles "is anyone logged in at all"; whether that person is
// actually an admin is enforced by the server (JwtAuthGuard + AdminGuard on
// every /admin/* endpoint) and surfaced as a 403 in the page itself, not
// hidden client-side.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { auth } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.status === "unauthenticated") router.replace("/login");
  }, [auth.status, router]);

  if (auth.status !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-foreground-muted">
        {auth.status === "loading" ? "Checking your session…" : "Redirecting to login…"}
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-5xl">{children}</div>
    </div>
  );
}
