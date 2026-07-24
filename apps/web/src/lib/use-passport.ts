"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./auth-context";
import { getPublicPassport, type PublicPassport } from "./api";

/** Shared by every dashboard surface that needs the logged-in user's
 * identity (Topbar, the overview greeting, the Passport page) so there's
 * one fetch-on-auth-change implementation instead of three. */
export function usePassport(): PublicPassport | null {
  const { auth } = useAuth();
  const [passport, setPassport] = useState<PublicPassport | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (auth.status !== "authenticated") {
      // Deferred rather than called synchronously in the effect body — same
      // reasoning as AuthProvider's resolveStoredAuth().
      Promise.resolve().then(() => {
        if (!cancelled) setPassport(null);
      });
      return () => {
        cancelled = true;
      };
    }

    getPublicPassport(auth.ndyId)
      .then((result) => {
        if (!cancelled) setPassport(result);
      })
      .catch(() => {
        /* callers fall back to auth.ndyId alone when this stays null */
      });
    return () => {
      cancelled = true;
    };
  }, [auth]);

  return passport;
}
