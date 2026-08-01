"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./auth-context";
import { getMe, type MeProfile } from "./api";

export function useMe(): MeProfile | null {
  const { auth } = useAuth();
  const [me, setMe] = useState<MeProfile | null>(null);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    let cancelled = false;
    getMe(auth.accessToken)
      .then((result) => {
        if (!cancelled) setMe(result);
      })
      .catch(() => {
        /* consuming pages fall back to role-gated content staying hidden while me stays null */
      });
    return () => {
      cancelled = true;
    };
  }, [auth]);

  return me;
}
