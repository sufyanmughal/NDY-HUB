"use client";

import { useEffect, useState } from "react";
import { getEcosystemOverview, type EcosystemOverview } from "./api";

/** Public endpoint — fetches regardless of auth state, so both the
 * pre-login landing page and the authenticated dashboard home can show
 * the same real numbers. */
export function useEcosystemOverview(): EcosystemOverview | null {
  const [overview, setOverview] = useState<EcosystemOverview | null>(null);

  useEffect(() => {
    let cancelled = false;
    getEcosystemOverview()
      .then((result) => {
        if (!cancelled) setOverview(result);
      })
      .catch(() => {
        /* stat tiles fall back to "…" while overview stays null */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return overview;
}
