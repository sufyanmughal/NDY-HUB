"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getOAuthAuthorizeStatus, submitOAuthConsent, type OAuthAuthorizeStatus } from "@/lib/api";

type ConsentPhase =
  | { phase: "loading" }
  | { phase: "auto-approving" }
  | { phase: "ready"; status: OAuthAuthorizeStatus }
  | { phase: "submitting" }
  | { phase: "error"; message: string };

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-foreground-muted">
      {children}
    </div>
  );
}

function ConsentPageInner() {
  const { auth } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const clientId = searchParams.get("client_id");
  const redirectUri = searchParams.get("redirect_uri");
  const scope = searchParams.get("scope") ?? "openid";
  const state = searchParams.get("state") ?? undefined;
  const codeChallenge = searchParams.get("code_challenge") ?? undefined;
  const codeChallengeMethod = searchParams.get("code_challenge_method") ?? undefined;
  const paramsError =
    !clientId || !redirectUri ? "This sign-in link is missing required parameters." : null;

  const [consent, setConsent] = useState<ConsentPhase>({ phase: "loading" });

  // Bounces through /login and back — this route needs a logged-in browser
  // to answer "who's approving this," and only /login (via the QR/NDYAPPS
  // flow) can establish that. See sanitizeNext in /login for why `next` is
  // safe to round-trip like this.
  useEffect(() => {
    if (auth.status !== "unauthenticated") return;
    const here = `/oauth/consent?${searchParams.toString()}`;
    router.replace(`/login?next=${encodeURIComponent(here)}`);
  }, [auth.status, router, searchParams]);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    if (paramsError || !clientId || !redirectUri) return;
    const accessToken = auth.accessToken;

    let cancelled = false;
    getOAuthAuthorizeStatus(accessToken, clientId, scope)
      .then((status) => {
        if (cancelled) return;
        if (!status.alreadyGranted) {
          setConsent({ phase: "ready", status });
          return;
        }
        // Already granted everything being asked for — this is the actual
        // "one login, not one consent screen per visit" part of SSO.
        setConsent({ phase: "auto-approving" });
        return submitOAuthConsent(accessToken, {
          clientId,
          redirectUri,
          scope,
          state,
          approve: true,
          codeChallenge,
          codeChallengeMethod,
        }).then((result) => {
          if (!cancelled) window.location.href = result.redirectUrl;
        });
      })
      .catch((err: Error) => {
        if (!cancelled) setConsent({ phase: "error", message: err.message });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status]);

  async function respond(approve: boolean) {
    if (auth.status !== "authenticated" || !clientId || !redirectUri) return;
    const accessToken = auth.accessToken;
    setConsent({ phase: "submitting" });
    try {
      const result = await submitOAuthConsent(accessToken, {
        clientId,
        redirectUri,
        scope,
        state,
        approve,
        codeChallenge,
        codeChallengeMethod,
      });
      window.location.href = result.redirectUrl;
    } catch (err) {
      setConsent({ phase: "error", message: (err as Error).message });
    }
  }

  if (auth.status === "loading" || auth.status === "unauthenticated") {
    return <CenteredMessage>Checking your session…</CenteredMessage>;
  }
  if (paramsError) {
    return <CenteredMessage>{paramsError}</CenteredMessage>;
  }
  if (consent.phase === "loading") {
    return <CenteredMessage>Loading request…</CenteredMessage>;
  }
  if (consent.phase === "auto-approving" || consent.phase === "submitting") {
    return <CenteredMessage>Signing you in…</CenteredMessage>;
  }
  if (consent.phase === "error") {
    return <CenteredMessage>{consent.message}</CenteredMessage>;
  }

  const { status } = consent;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <span className="text-xl font-semibold tracking-tight">
          NDY <span className="text-accent">HUB</span>
          <sup className="text-[10px] align-super text-foreground-muted">™</sup>
        </span>
      </div>
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6">
        <p className="text-center text-sm text-foreground-muted">
          <span className="font-medium text-foreground">{status.client.name}</span> wants to connect to
          your NDY HUB account.
        </p>
        <ul className="mt-4 space-y-2">
          {status.scopeDescriptions.map((s) => (
            <li key={s.scope} className="text-sm text-foreground-muted">
              &bull; {s.description}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => respond(false)}
            className="flex-1 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface-2"
          >
            Deny
          </button>
          <button
            onClick={() => respond(true)}
            className="flex-1 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
          >
            Approve
          </button>
        </div>
      </div>
      <p className="max-w-sm text-center text-xs text-foreground-muted">
        You can revoke this connection at any time from Security in your NDY HUB dashboard.
      </p>
    </div>
  );
}

export default function ConsentPage() {
  return (
    <Suspense fallback={<CenteredMessage>Loading…</CenteredMessage>}>
      <ConsentPageInner />
    </Suspense>
  );
}
