"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./auth-context";
import { getMyNdybits, type NdybitsSummary } from "./api";

export function useNdybitsSummary(): NdybitsSummary | null {
  const { auth } = useAuth();
  const [summary, setSummary] = useState<NdybitsSummary | null>(null);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    let cancelled = false;
    getMyNdybits(auth.accessToken).then((result) => {
      if (!cancelled) setSummary(result);
    });
    return () => {
      cancelled = true;
    };
  }, [auth]);

  return summary;
}
