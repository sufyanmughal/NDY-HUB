"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./auth-context";
import { getMyActivity, type ActivityItem } from "./api";

export function useMyActivity(): ActivityItem[] | null {
  const { auth } = useAuth();
  const [items, setItems] = useState<ActivityItem[] | null>(null);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    let cancelled = false;
    getMyActivity()
      .then((result) => {
        if (!cancelled) setItems(result);
      })
      .catch(() => {
        /* consuming pages fall back to the empty state while items stays null */
      });
    return () => {
      cancelled = true;
    };
  }, [auth]);

  return items;
}
