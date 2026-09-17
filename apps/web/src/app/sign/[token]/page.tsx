"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Check, FileText, PenLine, X } from "lucide-react";
import {
  declineSignature,
  getSignaturePreview,
  signDocument,
  type SignaturePreview,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type Phase =
  | { phase: "loading" }
  | { phase: "ready"; preview: SignaturePreview }
  | { phase: "signed" }
  | { phase: "declined" }
  | { phase: "error"; message: string };

/**
 * Where a signing link lands — standalone (no dashboard shell), same shape as
 * /workspace-invites/accept: the signer may arrive with no session, so this
 * page handles "sign in first" itself.
 *
 * Signing is authenticated by design: a signature is always attributable to a
 * real NDY identity, so the API refuses to record one for an anonymous caller.
 * The token in the URL authorizes THIS signer slot; the session says who is
 * filling it, and the API requires them to match.
 *
 * The consent acknowledgement below is present but must not be presented as
 * legally-binding e-signature — that is an open decision (see
 * docs/phase8-signature-trust-design.md §5.3).
 */
export default function SignDocumentPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const { auth } = useAuth();
  const [state, setState] = useState<Phase>({ phase: "loading" });
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);

  const authenticated = auth.status === "authenticated";

  useEffect(() => {
    if (!token || !authenticated) return;
    let cancelled = false;
    getSignaturePreview(token)
      .then((preview) => {
        if (!cancelled) setState({ phase: "ready", preview });
      })
      .catch((err: Error) => {
        if (!cancelled) setState({ phase: "error", message: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [token, authenticated]);

  const handleSign = useCallback(async () => {
    if (!token || state.phase !== "ready") return;
    setBusy(true);
    try {
      await signDocument(token);
      setState({ phase: "signed" });
    } catch (err) {
      setState({ phase: "error", message: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }, [token, state]);

  const handleDecline = useCallback(async () => {
    if (!token || state.phase !== "ready") return;
    setBusy(true);
    try {
      await declineSignature(token);
      setState({ phase: "declined" });
    } catch (err) {
      setState({ phase: "error", message: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }, [token, state]);

  const signPath = token ? `/sign/${encodeURIComponent(token)}` : "/";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <span className="text-xl font-semibold tracking-tight">
          NDY <span className="text-accent">HUB</span>
          <sup className="text-[10px] align-super text-foreground-muted">™</sup>
        </span>
      </div>

      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6">
        {!token && <ErrorState message="This signing link is missing its token." />}

        {token && auth.status === "loading" && (
          <p className="py-10 text-center text-sm text-foreground-muted">
            Checking your session…
          </p>
        )}

        {token && auth.status === "unauthenticated" && (
          <div className="text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-accent">
              <PenLine size={20} strokeWidth={2.5} />
            </div>
            <p className="mt-3 text-sm font-medium">You have a document to sign</p>
            <p className="mt-1 text-xs text-foreground-muted">
              Sign in to review it. The signature is recorded against your NDY
              identity, so it has to be your account.
            </p>
            <Link
              href={`/login?next=${encodeURIComponent(signPath)}`}
              className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
            >
              Sign in to continue
            </Link>
          </div>
        )}

        {token && authenticated && state.phase === "loading" && (
          <p className="py-10 text-center text-sm text-foreground-muted">
            Loading the document…
          </p>
        )}

        {token && authenticated && state.phase === "ready" && (
          <div>
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-accent">
              <FileText size={20} strokeWidth={2.5} />
            </div>
            <h1 className="mt-3 text-center text-lg font-semibold">
              {state.preview.title}
            </h1>
            <p className="mt-1 text-center text-xs text-foreground-muted">
              Requested by{" "}
              <span className="font-mono">{state.preview.createdByNdyId}</span>
            </p>

            <dl className="mt-4 space-y-2 rounded-md border border-border p-3 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-foreground-muted">Status</dt>
                <dd className="font-medium">{state.preview.status}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-foreground-muted">Expires</dt>
                <dd className="font-medium">
                  {new Date(state.preview.expiresAt).toLocaleString()}
                </dd>
              </div>
              {state.preview.contentRef && (
                <div className="flex justify-between gap-3">
                  <dt className="text-foreground-muted">Document</dt>
                  <dd className="truncate font-medium">
                    {/^https?:\/\//.test(state.preview.contentRef) ? (
                      <a
                        href={state.preview.contentRef}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent underline"
                      >
                        Open
                      </a>
                    ) : (
                      state.preview.contentRef
                    )}
                  </dd>
                </div>
              )}
            </dl>

            {state.preview.signedAt || state.preview.declinedAt ? (
              <p className="mt-4 rounded-md border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">
                You&apos;ve already {state.preview.signedAt ? "signed" : "declined"}{" "}
                this document.
              </p>
            ) : (
              <>
                <label className="mt-4 flex items-start gap-2 text-xs text-foreground-muted">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    I intend to sign this document as my NDY identity.
                  </span>
                </label>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={handleSign}
                    disabled={busy || !consent}
                    className="flex-1 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? "Signing…" : "Sign"}
                  </button>
                  <button
                    onClick={handleDecline}
                    disabled={busy}
                    className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface-2 disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </>
            )}

            <p className="mt-3 text-center text-[11px] text-foreground-muted">
              This records an internal attestation by your NDY identity. It is
              not presented as a legally-binding e-signature.
            </p>
          </div>
        )}

        {state.phase === "signed" && (
          <div className="text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-good/15 text-good">
              <Check size={20} strokeWidth={2.5} />
            </div>
            <p className="mt-3 text-sm font-medium">Signed. Thank you.</p>
            <p className="mt-1 text-xs text-foreground-muted">
              The request creator has been notified.
            </p>
            <Link
              href="/dashboard"
              className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
            >
              Go to dashboard
            </Link>
          </div>
        )}

        {state.phase === "declined" && (
          <div className="text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-warn/15 text-warn">
              <X size={20} strokeWidth={2.5} />
            </div>
            <p className="mt-3 text-sm font-medium">You declined to sign.</p>
            <Link
              href="/dashboard"
              className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
            >
              Go to dashboard
            </Link>
          </div>
        )}

        {state.phase === "error" && <ErrorState message={state.message} />}
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-critical/15 text-critical">
        <X size={20} strokeWidth={2.5} />
      </div>
      <p className="mt-3 text-sm">{message}</p>
      <p className="mt-3 text-xs text-foreground-muted">
        Signing links expire, and a slot can only be signed once.
      </p>
      <Link
        href="/dashboard"
        className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
      >
        Go to dashboard
      </Link>
    </div>
  );
}
