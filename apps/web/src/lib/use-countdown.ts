"use client";

import { useEffect, useState } from "react";

/**
 * Ticks down from an initial second count to 0, restarting whenever
 * `seedSeconds` changes — used by the email-verification and
 * password-reset-code screens, both of which show a live "expires in"
 * timer and need it to reset to a fresh window on every resend.
 */
export function useCountdown(seedSeconds: number): {
  secondsLeft: number;
  expired: boolean;
} {
  const [secondsLeft, setSecondsLeft] = useState(seedSeconds);

  useEffect(() => {
    setSecondsLeft(seedSeconds);
    // One interval per seed value (i.e. per resend) — ticks itself down
    // to 0 and then just stops, no need to watch secondsLeft to decide
    // whether to keep the interval alive.
    const timer = setInterval(() => {
      setSecondsLeft((s) => (s <= 0 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [seedSeconds]);

  return { secondsLeft, expired: secondsLeft <= 0 };
}

/** "4:59" style, matching the emails' own copy. */
export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
