"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listRoleChangeRequests,
  approveRoleChangeRequest,
  rejectRoleChangeRequest,
  type RoleChangeRequest,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { decodeAccessToken } from "@/lib/auth-client";

/**
 * The review queue for dual-approval role changes. A request created by
 * UserManagementPanel shows up here for a *different* admin to approve or
 * reject — the requester's own row is shown but its buttons are disabled,
 * since the server rejects self-approval anyway (this is just not making
 * someone click a button that's guaranteed to 403).
 */
export function RoleChangeRequestPanel({
  accessToken,
  refreshKey,
}: {
  accessToken: string;
  /** Bump this (e.g. a counter) from the parent whenever a request might
   * have been created elsewhere on the page — this component has its own
   * fetch state and otherwise only refreshes after its own actions. */
  refreshKey?: number;
}) {
  const { auth } = useAuth();
  const [pending, setPending] = useState<RoleChangeRequest[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    listRoleChangeRequests(accessToken, "PENDING")
      .then(setPending)
      .catch((err) => setError((err as Error).message));
  }, [accessToken]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  async function handleDecision(request: RoleChangeRequest, approve: boolean) {
    const reason = window.prompt(
      `${approve ? "Approve" : "Reject"} changing ${request.targetNdyId}'s role to ${request.requestedRole}? Optional reason:`,
    );
    if (reason === null) return;
    setBusyId(request.id);
    setError(null);
    try {
      if (approve) {
        await approveRoleChangeRequest(accessToken, request.id, reason || undefined);
      } else {
        await rejectRoleChangeRequest(accessToken, request.id, reason || undefined);
      }
      refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  const currentUserId =
    auth.status === "authenticated" ? decodeAccessToken(auth.accessToken)?.sub ?? null : null;

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-medium text-foreground-muted">Pending Role Change Requests</h2>
      <p className="mt-1 text-xs text-foreground-muted">
        A role change proposed by one admin has to be approved by a different admin before it takes effect.
      </p>

      {error && (
        <p className="mt-3 rounded-md border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
          {error}
        </p>
      )}

      {pending && pending.length === 0 && (
        <p className="mt-4 text-sm text-foreground-muted">No pending requests.</p>
      )}

      {pending && pending.length > 0 && (
        <ul className="mt-4 space-y-3">
          {pending.map((r) => {
            const isOwnRequest = r.requestedByUserId === currentUserId;
            return (
              <li key={r.id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <p>
                    <span className="font-mono text-xs">{r.targetNdyId}</span>: {r.previousRole} →{" "}
                    <span className="font-medium">{r.requestedRole}</span>
                  </p>
                  <span className="shrink-0 rounded-full bg-warn/15 px-2 py-0.5 text-[11px] font-medium text-warn">
                    Pending
                  </span>
                </div>
                <p className="mt-1 text-xs text-foreground-muted">
                  Requested by {r.requestedByNdyId} · {new Date(r.createdAt).toLocaleString()}
                  {r.requestReason && <> · &ldquo;{r.requestReason}&rdquo;</>}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleDecision(r, true)}
                    disabled={busyId === r.id || isOwnRequest}
                    title={isOwnRequest ? "You requested this — a different admin has to approve it" : undefined}
                    className="rounded-md bg-good/15 px-3 py-1.5 text-xs font-medium text-good hover:bg-good/25 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleDecision(r, false)}
                    disabled={busyId === r.id || isOwnRequest}
                    title={isOwnRequest ? "You requested this — a different admin has to review it" : undefined}
                    className="rounded-md bg-critical/15 px-3 py-1.5 text-xs font-medium text-critical hover:bg-critical/25 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Reject
                  </button>
                  {isOwnRequest && (
                    <span className="self-center text-xs text-foreground-muted">Your request — needs another admin</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

