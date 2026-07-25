"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./auth-context";
import { getMyMembership, type MembershipSummary } from "./api";

export function useMembershipSummary(): MembershipSummary | null {
  const { auth } = useAuth();
  const [summary, setSummary] = useState<MembershipSummary | null>(null);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    let cancelled = false;
    getMyMembership(auth.accessToken).then((result) => {
      if (!cancelled) setSummary(result);
    });
    return () => {
      cancelled = true;
    };
  }, [auth]);

  return summary;
}
