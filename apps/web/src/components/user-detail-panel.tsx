import { Avatar } from "@/components/avatar";
import type { AdminUserDetail } from "@/lib/api";

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-foreground-muted">{label}</div>
      <div className="mt-0.5 text-sm">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
        {title}
      </h3>
      <div className="mt-3 grid grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function YesNo({ value }: { value: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
        value ? "bg-good/15 text-good" : "bg-foreground-muted/15 text-foreground-muted"
      }`}
    >
      {value ? "Yes" : "No"}
    </span>
  );
}

/**
 * The full profile — every field an admin might need for a support or
 * security review, not just the flat summary row the table shows.
 * Deliberately omits anything that's a secret rather than a fact
 * (password hash, TOTP secret, one-time token hashes): the API's
 * getUserDetail() never returns those in the first place, so there's
 * nothing to accidentally leak here.
 */
export function UserDetailPanel({
  detail,
  loading,
  error,
  onClose,
}: {
  detail: AdminUserDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold">User Details</h2>
          <button
            onClick={onClose}
            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-2"
          >
            Close
          </button>
        </div>

        {loading && (
          <p className="mt-6 text-sm text-foreground-muted">Loading…</p>
        )}

        {error && (
          <p className="mt-4 rounded-md border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
            {error}
          </p>
        )}

        {detail && (
          <div className="mt-5 space-y-5">
            <div className="flex items-center gap-4">
              <Avatar
                photoUrl={detail.profilePhotoUrl}
                name={detail.fullName ?? detail.ndyId}
                size={56}
              />
              <div>
                <div className="text-base font-medium">
                  {detail.fullName ?? "(no name set)"}
                </div>
                <div className="font-mono text-xs text-foreground-muted">{detail.ndyId}</div>
              </div>
            </div>

            <Section title="Identity">
              <Field label="Email" value={detail.email} />
              <Field label="Role" value={detail.role} />
              <Field label="Verification level" value={detail.verificationLevel} />
              <Field
                label="Status"
                value={
                  detail.deletedAt
                    ? "Deleted"
                    : detail.suspended
                      ? "Suspended"
                      : "Active"
                }
              />
            </Section>

            <Section title="Account timeline">
              <Field label="Joined" value={formatDateTime(detail.createdAt)} />
              <Field label="Last updated" value={formatDateTime(detail.updatedAt)} />
              {detail.suspendedAt && (
                <Field label="Suspended at" value={formatDateTime(detail.suspendedAt)} />
              )}
              {detail.deletedAt && (
                <Field label="Deleted at" value={formatDateTime(detail.deletedAt)} />
              )}
            </Section>

            <Section title="Verification">
              <Field label="Email verified" value={formatDateTime(detail.emailVerifiedAt)} />
              <Field label="Phone verified" value={formatDateTime(detail.phoneVerifiedAt)} />
              <Field label="Identity verified" value={formatDateTime(detail.identityVerifiedAt)} />
            </Section>

            <Section title="Security">
              <Field label="Two-factor (TOTP) enabled" value={<YesNo value={detail.twoFactorEnabled} />} />
              <Field label="Passkeys registered" value={detail.passkeyCount} />
              <Field label="Active sessions" value={detail.activeSessionCount} />
            </Section>

            <Section title="Connections">
              <Field label="NDYAPPS connected" value={<YesNo value={detail.ndyappsConnected} />} />
              {detail.ndyappsConnectedAt && (
                <Field
                  label="NDYAPPS connected at"
                  value={formatDateTime(detail.ndyappsConnectedAt)}
                />
              )}
              <div className="col-span-2">
                <div className="text-xs uppercase tracking-wide text-foreground-muted">
                  Linked social accounts
                </div>
                {detail.connectedProviders.length === 0 ? (
                  <div className="mt-0.5 text-sm text-foreground-muted">None</div>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {detail.connectedProviders.map((p, i) => (
                      <li key={i} className="text-sm">
                        {p.provider}
                        {p.email ? ` — ${p.email}` : ""}{" "}
                        <span className="text-xs text-foreground-muted">
                          (linked {formatDateTime(p.linkedAt)})
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Section>

            <Section title="Ecosystem activity">
              <Field
                label="Membership"
                value={
                  detail.membership
                    ? `${detail.membership.tierLabel} (${detail.membership.status})`
                    : "None"
                }
              />
              <Field label="CRYNDY available balance" value={detail.cryndyAvailableBalance} />
              <Field label="CRYNDY purchases" value={detail.cryndyPurchaseCount} />
              <Field label="NDYBITS balance" value={detail.ndybitsBalance} />
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}
