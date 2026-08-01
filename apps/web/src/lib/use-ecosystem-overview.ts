"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./auth-context";
import { getEcosystemOverview, type EcosystemOverview } from "./api";

export function useEcosystemOverview(): EcosystemOverview | null {
  const { auth } = useAuth();
  const [overview, setOverview] = useState<EcosystemOverview | null>(null);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    let cancelled = false;
    getEcosystemOverview(auth.accessToken)
      .then((result) => {
        if (!cancelled) setOverview(result);
      })
      .catch(() => {
        /* stat tiles fall back to "…" while overview stays null */
      });
    return () => {
      cancelled = true;
    };
  }, [auth]);

  return overview;
}
