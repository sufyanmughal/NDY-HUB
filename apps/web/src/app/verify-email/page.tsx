"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Email verification moved from a link-token URL param to a typed-in
 * 6-digit code, entered inline on the login/register form (see
 * password-auth-form.tsx's pendingVerificationEmail state) — there's
 * nothing left for a separate route to read from the address bar. Kept
 * as a redirect (not deleted outright) in case anything still links
 * here, including old already-sent emails from before this change.
 */
export default function VerifyEmailPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return null;
}
