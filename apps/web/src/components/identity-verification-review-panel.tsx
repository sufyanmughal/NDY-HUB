"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listIdentityVerificationRequests,
  approveIdentityVerificationRequest,
  rejectIdentityVerificationRequest,
  type IdentityVerificationRequest,
} from "@/lib/api";

/**
 * The LEVEL_3 identity-document review queue — Phase 7, gated behind
 * REVIEW_IDENTITY_VERIFICATION (a dedicated permission, not MANAGE_USERS,
 * per the client's explicit answer #10). No document is shown here: the
 * request's evidenceNote is whatever free text the requester left about
 * how they already shared proof of identity out-of-band — reviewing the
 * actual evidence happens outside NDY HUB entirely, per the client's
 * follow-up clarification that no ID/passport document storage exists yet.
 */
export function IdentityVerificationReviewPanel() {
  const [pending, setPending] = useState<IdentityVerificationRequest[] | null>(
    null,
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    listIdentityVerificationRequests("PENDING")
      .then(setPending)
      .catch((err) => setError((err as Error).message));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleDecision(
    request: IdentityVerificationRequest,
    approve: boolean,
  ) {
    const reason = window.prompt(
      `${approve ? "Approve" : "Reject"} identity verification for user ${request.userId}? Optional reason:`,
    );
    if (reason === null) return;
    setBusyId(request.id);
    setError(null);
    try {
      if (approve) {
        await approveIdentityVerificationRequest(request.id, reason || undefined);
      } else {
        await rejectIdentityVerificationRequest(request.id, reason || undefined);
      }
      refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-medium text-foreground-muted">
        Identity Verification Requests (LEVEL_3)
      </h2>
      <p className="mt-1 text-xs text-foreground-muted">
        NDY HUB doesn&apos;t store identity documents — review whatever
        evidence the requester describes below against however it was
        actually shared (support ticket, email), then approve or reject here.
      </p>

      {error && (
        <p className="mt-3 rounded-md border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
          {error}
        </p>
      )}

      {pending && pending.length === 0 && (
        <p className="mt-4 text-sm text-foreground-muted">
          No pending requests.
        </p>
      )}

      {pending && pending.length > 0 && (
        <ul className="mt-4 space-y-3">
          {pending.map((r) => (
            <li key={r.id} className="rounded-md border border-border p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-xs">{r.userId}</span>
                <span className="shrink-0 rounded-full bg-warn/15 px-2 py-0.5 text-[11px] font-medium text-warn">
                  Pending
                </span>
              </div>
              <p className="mt-1 text-xs text-foreground-muted">
                Requested {new Date(r.createdAt).toLocaleString()}
                {r.evidenceNote && <> · &ldquo;{r.evidenceNote}&rdquo;</>}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => handleDecision(r, true)}
                  disabled={busyId === r.id}
                  className="rounded-md bg-good/15 px-3 py-1.5 text-xs font-medium text-good hover:bg-good/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleDecision(r, false)}
                  disabled={busyId === r.id}
                  className="rounded-md bg-critical/15 px-3 py-1.5 text-xs font-medium text-critical hover:bg-critical/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
