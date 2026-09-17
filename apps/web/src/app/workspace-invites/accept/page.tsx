"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Check, X } from "lucide-react";
import {
  acceptWorkspaceInvite,
  getWorkspaceInvitePreview,
  type WorkspaceInvitePreview,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type Phase =
  | { phase: "loading" }
  | { phase: "ready"; invite: WorkspaceInvitePreview }
  | { phase: "accepted"; workspaceName: string }
  | { phase: "error"; message: string };

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
};

/**
 * Where a Business Workspace invite link lands. Standalone (no dashboard
 * shell), same shape as /verify-email: the invitee may arrive with no
 * session at all, so the page has to handle "sign in first" itself rather
 * than sitting behind DashboardGate.
 *
 * The invitee is usually already signed in when they open the link, in
 * which case the workspace is previewed before they commit. Accepting is
 * still the API's call — WorkspaceInviteService.accept re-checks that the
 * signed-in account's email matches the invited one, so a link forwarded
 * to the wrong person can be viewed but not redeemed.
 */
function AcceptInviteInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { auth } = useAuth();
  const token = searchParams.get("token");
  const [state, setState] = useState<Phase>({ phase: "loading" });
  const [busy, setBusy] = useState(false);

  const authenticated = auth.status === "authenticated";

  useEffect(() => {
    if (!token || !authenticated) return;
    let cancelled = false;
    getWorkspaceInvitePreview(token)
      .then((invite) => {
        if (!cancelled) setState({ phase: "ready", invite });
      })
      .catch((err: Error) => {
        if (!cancelled) setState({ phase: "error", message: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [token, authenticated]);

  const handleAccept = useCallback(async () => {
    if (!token || state.phase !== "ready") return;
    const workspaceName = state.invite.workspaceName;
    setBusy(true);
    try {
      await acceptWorkspaceInvite(token);
      setState({ phase: "accepted", workspaceName });
    } catch (err) {
      setState({ phase: "error", message: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }, [token, state]);

  useEffect(() => {
    if (state.phase !== "accepted") return;
    const timer = setTimeout(() => router.replace("/business"), 1500);
    return () => clearTimeout(timer);
  }, [state.phase, router]);

  const acceptPath = token
    ? `/workspace-invites/accept?token=${encodeURIComponent(token)}`
    : "/business";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <span className="text-xl font-semibold tracking-tight">
          NDY <span className="text-accent">HUB</span>
          <sup className="text-[10px] align-super text-foreground-muted">™</sup>
        </span>
      </div>

      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 text-center">
        {!token && (
          <ErrorState message="This invite link is missing its token. Ask whoever invited you to resend it." />
        )}

        {token && auth.status === "loading" && (
          <p className="py-10 text-sm text-foreground-muted">
            Checking your session…
          </p>
        )}

        {token && auth.status === "unauthenticated" && (
          <div>
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-accent">
              <Building2 size={20} strokeWidth={2.5} />
            </div>
            <p className="mt-3 text-sm font-medium">
              You&apos;ve been invited to a workspace
            </p>
            <p className="mt-1 text-xs text-foreground-muted">
              Sign in to see the invite and accept it. It was sent to a
              specific email address, so you&apos;ll need to sign in as that
              account.
            </p>
            <Link
              href={`/login?next=${encodeURIComponent(acceptPath)}`}
              className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
            >
              Sign in to continue
            </Link>
          </div>
        )}

        {token && authenticated && state.phase === "loading" && (
          <p className="py-10 text-sm text-foreground-muted">
            Loading your invite…
          </p>
        )}

        {token && authenticated && state.phase === "ready" && (
          <div className="text-left">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-accent">
              <Building2 size={20} strokeWidth={2.5} />
            </div>
            <p className="mt-3 text-center text-sm text-foreground-muted">
              You&apos;ve been invited to join
            </p>
            <p className="mt-1 text-center text-lg font-semibold">
              {state.invite.workspaceName}
            </p>

            <dl className="mt-4 space-y-2 rounded-md border border-border p-3 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-foreground-muted">Role</dt>
                <dd className="font-medium">
                  {ROLE_LABEL[state.invite.invitedRole] ??
                    state.invite.invitedRole}
                </dd>
              </div>
              {state.invite.invitedDepartment && (
                <div className="flex justify-between gap-3">
                  <dt className="text-foreground-muted">Department</dt>
                  <dd className="font-medium">
                    {state.invite.invitedDepartment}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-foreground-muted">Invited by</dt>
                <dd className="font-mono">{state.invite.invitedByNdyId}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-foreground-muted">Sent to</dt>
                <dd className="font-medium">{state.invite.invitedEmail}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-foreground-muted">Expires</dt>
                <dd className="font-medium">
                  {new Date(state.invite.expiresAt).toLocaleString()}
                </dd>
              </div>
            </dl>

            {state.invite.status !== "PENDING" ? (
              <p className="mt-4 rounded-md border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">
                This invite is no longer pending — it&apos;s already been{" "}
                {state.invite.status.toLowerCase()}.
              </p>
            ) : (
              <button
                onClick={handleAccept}
                disabled={busy}
                className="mt-4 w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Joining…" : "Accept invite"}
              </button>
            )}

            <p className="mt-3 text-center text-[11px] text-foreground-muted">
              Signing in as a different account? Accepting only works for the
              address above.
            </p>
          </div>
        )}

        {token && authenticated && state.phase === "accepted" && (
          <div>
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-good/15 text-good">
              <Check size={20} strokeWidth={2.5} />
            </div>
            <p className="mt-3 text-sm font-medium">
              You&apos;ve joined {state.workspaceName}.
            </p>
            <p className="mt-1 text-xs text-foreground-muted">
              Taking you to the Business Center…
            </p>
            <Link
              href="/business"
              className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
            >
              Go to Business Center
            </Link>
          </div>
        )}

        {token && authenticated && state.phase === "error" && (
          <ErrorState message={state.message} />
        )}
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div>
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-critical/15 text-critical">
        <X size={20} strokeWidth={2.5} />
      </div>
      <p className="mt-3 text-sm">{message}</p>
      <p className="mt-3 text-xs text-foreground-muted">
        Invites expire after 7 days or once they&apos;ve been accepted — ask
        whoever invited you for a new one if this link no longer works.
      </p>
      <Link
        href="/business"
        className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
      >
        Go to Business Center
      </Link>
    </div>
  );
}

export default function AcceptWorkspaceInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInviteInner />
    </Suspense>
  );
}
