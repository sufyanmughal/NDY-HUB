"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * /login used to be the sign-in page itself; that content now lives at
 * "/" (the homepage) per the client's direction — the splash + login form
 * is the first thing anyone sees at the root domain, not a separate page
 * reached by clicking through. This redirect exists so old links/
 * bookmarks to /login (and the many in-app `router.replace("/login")`
 * calls, e.g. DashboardGate) keep working without a broken-link audit
 * across the whole codebase.
 */
function LoginRedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const next = searchParams.get("next");
    router.replace(next ? `/?next=${encodeURIComponent(next)}` : "/");
  }, [router, searchParams]);

  return null;
}

export default function LoginRedirectPage() {
  return (
    <Suspense fallback={null}>
      <LoginRedirectInner />
    </Suspense>
  );
}
