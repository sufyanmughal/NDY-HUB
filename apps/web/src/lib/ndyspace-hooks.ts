"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./auth-context";
import {
  getNdyspaceOverview,
  getDriveStorageUsage,
  listNdyspaceNotifications,
  type NdyspaceOverview,
  type DriveStorageUsage,
  type NdyspaceNotification,
} from "./ndyspace-api";

// Same "poll on an interval, no WebSocket" pattern as use-ndybits.ts and
// the rest of this app — see NDYSPACE build notes: real-time sync is
// explicitly out of scope for this pass.
const POLL_INTERVAL_MS = 30_000;

/** Generic authed-poll hook every NDYSPACE widget/page hook below is built
 * from — one fetch on mount/auth-change, refetch on an interval, and a
 * manual `refetch` for the moment right after a mutation (send mail,
 * create event, etc.) when waiting for the next poll tick would feel laggy. */
function useAuthedPoll<T>(fetcher: () => Promise<T>): {
  data: T | null;
  error: string | null;
  loading: boolean;
  refetch: () => void;
} {
  const { auth } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    let cancelled = false;
    // Deferred rather than called synchronously in the effect body — same
    // reasoning as use-passport.ts's setPassport(null) on logout: a
    // microtask hop keeps this out of the render phase the effect body
    // itself runs in, satisfying react-hooks/set-state-in-effect, while
    // still landing before the fetch's own .then()/.catch() can.
    Promise.resolve().then(() => {
      if (!cancelled) setLoading(true);
    });
    fetcher()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, tick]);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    const id = setInterval(() => setTick((t) => t + 1), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [auth]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  return { data, error, loading, refetch };
}

export function useNdyspaceOverview() {
  return useAuthedPoll<NdyspaceOverview>(getNdyspaceOverview);
}

export function useDriveStorage(): DriveStorageUsage | null {
  return useAuthedPoll<DriveStorageUsage>(getDriveStorageUsage).data;
}

export function useNdyspaceNotificationsList() {
  return useAuthedPoll<NdyspaceNotification[]>(listNdyspaceNotifications);
}

/** Time-of-day-aware greeting (§2.3: "Good morning/afternoon/evening,
 * {firstName}" + emoji). Pure function, no hook state needed, but lives
 * here alongside the other Overview-page helpers. */
export function getGreeting(fullName: string | null): { text: string; emoji: string } {
  const hour = new Date().getHours();
  const firstName = fullName?.trim().split(/\s+/)[0] || "there";
  if (hour < 12) return { text: `Good morning, ${firstName}`, emoji: "☀️" };
  if (hour < 18) return { text: `Good afternoon, ${firstName}`, emoji: "🌤️" };
  return { text: `Good evening, ${firstName}`, emoji: "🌙" };
}
