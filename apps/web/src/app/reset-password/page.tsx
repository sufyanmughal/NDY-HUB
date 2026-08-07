"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Password reset moved from a link-token URL param to a typed-in 6-digit
 * code, entered inline on /forgot-password — there's nothing left for a
 * separate route to read from the address bar. Kept as a redirect (not
 * deleted outright) in case anything still links here, including old
 * already-sent emails from before this change.
 */
export default function ResetPasswordPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/forgot-password");
  }, [router]);

  return null;
}
