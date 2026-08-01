"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Check, X } from "lucide-react";
import {
  buildLoginDeepLink,
  loginWithPassword,
  registerWithPassword,
  approveLoginRequestAs,
} from "@/lib/api";
import { useLoginRequest } from "@/lib/use-login-request";
import { useAuth } from "@/lib/auth-context";

const DEV_EMAIL = "dev-test@ndyhub.local";
const DEV_PASSWORD = "dev-test-password-123";

export function QrLoginCard({ redirectTo = "/" }: { redirectTo?: string }) {
  const { state, restart } = useLoginRequest();
  const { login } = useAuth();

  // Re-syncs AuthProvider the moment the exchange succeeds (the httpOnly
  // cookie is already set by that response), so DashboardGate sees an
  // authenticated user the instant someone clicks through instead of
  // re-deriving it from scratch.
  useEffect(() => {
    if (state.phase === "success") void login();
  }, [state, login]);

  return (
    <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 text-center">
      {state.phase === "loading" && (
        <StatusText>Requesting a secure code…</StatusText>
      )}

      {state.phase === "pending" && (
        <PendingView token={state.token} expiresAt={state.expiresAt} />
      )}

      {state.phase === "approved" && (
        <StatusText>Approved — signing you in…</StatusText>
      )}

      {state.phase === "success" && (
        <div>
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-good/15 text-good">
            <Check size={20} strokeWidth={2.5} />
          </div>
          <p className="mt-3 text-sm font-medium">You&apos;re logged in.</p>
          <Link
            href={redirectTo}
            className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
          >
            Go to dashboard
          </Link>
        </div>
      )}

      {state.phase === "denied" && (
        <TerminalView message="Login request denied." onRetry={restart} />
      )}
      {state.phase === "expired" && (
        <TerminalView message="This code expired." onRetry={restart} />
      )}
      {state.phase === "error" && (
        <TerminalView message={state.message} onRetry={restart} />
      )}
    </div>
  );
}

function PendingView({
  token,
  expiresAt,
}: {
  token: string;
  expiresAt: string;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [devBusy, setDevBusy] = useState(false);
  const [devError, setDevError] = useState<string | null>(null);
  const secondsLeft = useCountdown(expiresAt);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(buildLoginDeepLink(token), { margin: 1, width: 220 }).then(
      (url) => {
        if (!cancelled) setQrDataUrl(url);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleDevApprove() {
    setDevBusy(true);
    setDevError(null);
    try {
      // Same thing NDYAPPS would do: get a bearer token for a real account,
      // then approve with it. Falls back to registering the dev account the
      // first time this runs on a fresh database.
      const result = await loginWithPassword(DEV_EMAIL, DEV_PASSWORD).catch(
        () => registerWithPassword(DEV_EMAIL, DEV_PASSWORD, "Dev Test User"),
      );
      if ("requires2fa" in result) {
        throw new Error(
          "The dev shortcut account has 2FA enabled — disable it in Settings to use this shortcut.",
        );
      }
      await approveLoginRequestAs(token, result.accessToken);
      // No further action needed here — the WebSocket subscription already
      // listening on this token (in useLoginRequest) picks up APPROVED and
      // drives the rest of the flow itself.
    } catch (err) {
      setDevError((err as Error).message);
      setDevBusy(false);
    }
  }

  return (
    <div>
      <p className="text-sm text-foreground-muted">
        Scan this with NDYAPPS to log in
      </p>
      <div className="mx-auto mt-4 flex h-[220px] w-[220px] items-center justify-center rounded-lg bg-white p-2">
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrDataUrl}
            alt="NDY HUB login QR code"
            width={204}
            height={204}
          />
        ) : (
          <span className="text-xs text-black/40">Generating…</span>
        )}
      </div>
      <p className="mt-3 font-mono text-xs text-foreground-muted">
        {secondsLeft > 0 ? `Expires in ${secondsLeft}s` : "Expiring…"}
      </p>

      {process.env.NODE_ENV !== "production" && (
        <div className="mt-5 border-t border-border pt-4">
          <button
            onClick={handleDevApprove}
            disabled={devBusy}
            className="w-full rounded-md border border-dashed border-accent/50 px-3 py-2 text-xs font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
          >
            {devBusy
              ? "Approving…"
              : "Skip NDYAPPS — approve as test user (dev only)"}
          </button>
          {devError && <p className="mt-2 text-xs text-critical">{devError}</p>}
        </div>
      )}
    </div>
  );
}

function TerminalView({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div>
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-critical/15 text-critical">
        <X size={20} strokeWidth={2.5} />
      </div>
      <p className="mt-3 text-sm">{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface-2"
      >
        Try again
      </button>
    </div>
  );
}

function StatusText({ children }: { children: React.ReactNode }) {
  return <p className="py-10 text-sm text-foreground-muted">{children}</p>;
}

function useCountdown(expiresAt: string): number {
  const [secondsLeft, setSecondsLeft] = useState(() => secondsUntil(expiresAt));

  useEffect(() => {
    const interval = setInterval(
      () => setSecondsLeft(secondsUntil(expiresAt)),
      1000,
    );
    return () => clearInterval(interval);
  }, [expiresAt]);

  return secondsLeft;
}

function secondsUntil(iso: string): number {
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 1000));
}
