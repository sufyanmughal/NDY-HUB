"use client";

import { useEffect, useState } from "react";

const SPLASH_DURATION_MS = 5000;
const SPLASH_SESSION_KEY = "ndyhub-splash-shown";

const FEATURES = [
  { label: "One Identity", sub: "Your unique NDY ID" },
  { label: "One Passport", sub: "Your digital identity" },
  { label: "Secure Access", sub: "Verify. Approve. Connect." },
  { label: "All Services Connected", sub: "One login. All platforms." },
  { label: "Your Assets & Rewards", sub: "CRYNDY. NDYBITS. More." },
  { label: "Full Ecosystem Control", sub: "Manage. Track. Grow." },
] as const;

/**
 * A one-time, 5-second brand moment shown when a visitor first lands on
 * /login — not on every visit to the page. sessionStorage (not a React
 * state flag) is what makes "once per browser session" survive a hard
 * reload of /login itself; a fresh tab/browser session has no key set at
 * all, so the splash plays again for a genuinely new visit.
 */
export function useShouldShowSplash(): [boolean, () => void] {
  // Lazy initializer, not an effect: sessionStorage is only readable
  // client-side, but reading it here (rather than after mount) means
  // showSplash is correct on the very first render instead of flashing
  // dashboard content for one frame before flipping true.
  const [show, setShow] = useState(() => {
    if (typeof window === "undefined") return false;
    return !sessionStorage.getItem(SPLASH_SESSION_KEY);
  });

  function dismiss() {
    sessionStorage.setItem(SPLASH_SESSION_KEY, "1");
    setShow(false);
  }

  return [show, dismiss];
}

export function EcosystemSplash({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const frame = () => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, Math.round((elapsed / SPLASH_DURATION_MS) * 100));
      setProgress(pct);
      if (elapsed < SPLASH_DURATION_MS) {
        requestAnimationFrame(frame);
      } else {
        onDone();
      }
    };
    const raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onDone is stable from the caller's perspective; re-running this on identity change would restart the timer
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center overflow-y-auto px-6 py-10 text-center"
      style={{
        backgroundColor: "#0a0714",
        backgroundImage: "url(/splash-background.jpeg)",
        backgroundSize: "cover",
        backgroundPosition: "bottom center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="m-auto flex w-full max-w-2xl flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- a static brand asset from /public, not worth next/image's overhead on a screen shown once for 5s */}
        <img
          src="/splash-nd-logo.png"
          alt="NDJOYIT HUB"
          className="h-auto w-64 sm:w-80"
        />

        <div className="mt-4 font-[system-ui] text-4xl font-extrabold tracking-tight sm:text-5xl">
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage:
                "linear-gradient(90deg, #e879f9 0%, #a78bfa 45%, #60a5fa 100%)",
            }}
          >
            NDJOYIT
          </span>
        </div>
        <div
          className="-mt-1 text-4xl font-extrabold tracking-tight sm:text-5xl bg-clip-text text-transparent"
          style={{
            backgroundImage:
              "linear-gradient(90deg, #a78bfa 0%, #60a5fa 100%)",
          }}
        >
          HUB
        </div>

        <p className="mt-3 text-xs font-medium uppercase tracking-[0.2em] text-violet-200/80 sm:text-sm">
          One Identity. <span className="text-fuchsia-300">One Passport.</span>{" "}
          <span className="text-sky-300">One Ecosystem</span>
        </p>

        <div className="mt-8 grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-6 sm:gap-x-4">
          {FEATURES.map((f, i) => (
            <FeatureIcon key={f.label} index={i} label={f.label} sub={f.sub} />
          ))}
        </div>

        <div className="mt-12">
          <p
            className="text-xl font-semibold bg-clip-text text-transparent sm:text-2xl"
            style={{
              backgroundImage: "linear-gradient(90deg, #e879f9, #60a5fa)",
            }}
          >
            WELCOME TO NDY HUB
          </p>
          <p className="mt-1 text-sm text-white/70">
            Your Identity. Your Passport. Your Ecosystem.
          </p>
        </div>

        <div className="mt-8 flex flex-col items-center gap-2">
          <PulsingGlobe />
          <p className="mt-2 text-sm font-medium tracking-wide text-violet-100">
            LOADING YOUR ECOSYSTEM
          </p>
          <p className="text-xs text-white/60">
            Please wait while we prepare everything for you.
          </p>
        </div>

        <div className="mt-6 flex w-full max-w-sm items-center gap-3">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-[width] duration-150 ease-linear"
              style={{
                width: `${progress}%`,
                backgroundImage:
                  "linear-gradient(90deg, #e879f9, #a78bfa, #60a5fa)",
              }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-sm font-medium tabular-nums text-sky-200">
            {progress}%
          </span>
        </div>

        <div className="mt-8 flex items-center gap-3 text-[11px] tracking-wide text-sky-200/70">
          <span className="h-px w-10 bg-sky-200/30" />
          <LockIcon className="h-3.5 w-3.5" />
          <span>SECURE CONNECTION ESTABLISHED</span>
          <span className="h-px w-10 bg-sky-200/30" />
        </div>
      </div>
    </div>
  );
}

function FeatureIcon({
  label,
  sub,
}: {
  index: number;
  label: string;
  sub: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-300/30 bg-white/5 sm:h-12 sm:w-12">
        <span className="h-2 w-2 rounded-full bg-gradient-to-br from-fuchsia-300 to-sky-300" />
      </div>
      <p className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-white/90 sm:text-[11px]">
        {label}
      </p>
      <p className="hidden text-[9px] leading-tight text-white/50 sm:block">
        {sub}
      </p>
    </div>
  );
}

function PulsingGlobe() {
  return (
    <svg viewBox="0 0 40 40" className="h-8 w-8 animate-pulse">
      <circle
        cx="20"
        cy="20"
        r="14"
        stroke="url(#globe-grad)"
        strokeWidth="1.5"
        fill="none"
      />
      <ellipse
        cx="20"
        cy="20"
        rx="14"
        ry="6"
        stroke="url(#globe-grad)"
        strokeWidth="1"
        fill="none"
      />
      <line x1="6" y1="20" x2="34" y2="20" stroke="url(#globe-grad)" strokeWidth="1" />
      <defs>
        <linearGradient id="globe-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e879f9" />
          <stop offset="100%" stopColor="#60a5fa" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <rect
        x="5"
        y="11"
        width="14"
        height="9"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M8 11V7a4 4 0 0 1 8 0v4"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
