"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./auth-context";
import { getMyCryndy, type CryndySummary } from "./api";

/** Same fetch-on-auth pattern as usePassport — shared by the Dashboard
 * overview and the dedicated /cryndy page instead of each holding its own
 * copy of "how do I load this user's CRYNDY summary." */
export function useCryndySummary(): CryndySummary | null {
  const { auth } = useAuth();
  const [summary, setSummary] = useState<CryndySummary | null>(null);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    let cancelled = false;
    getMyCryndy()
      .then((result) => {
        if (!cancelled) setSummary(result);
      })
      .catch(() => {
        /* consuming pages fall back to "…"/0 while summary stays null */
      });
    return () => {
      cancelled = true;
    };
  }, [auth]);

  return summary;
}
