"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getMe,
  updateProfile,
  changePassword,
  downloadDataExport,
  deleteAccount,
  resendEmailVerification,
  type MeProfile,
} from "@/lib/api";

export default function SettingsPage() {
  const { auth, logout } = useAuth();
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    getMe(auth.accessToken)
      .then(setProfile)
      .catch((err) => setLoadError((err as Error).message));
  }, [auth]);

  if (auth.status !== "authenticated") return null;

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Profile details and account security. Notification preferences and recovery methods
          land in a later milestone.
        </p>
      </div>

      {loadError && (
        <p className="rounded-md border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
          {loadError}
        </p>
      )}

      {profile && profile.verificationLevel === "LEVEL_0" && (
        <EmailVerificationBanner accessToken={auth.accessToken} />
      )}

      {profile && <ProfileForm accessToken={auth.accessToken} profile={profile} onSaved={setProfile} />}
      <PasswordForm accessToken={auth.accessToken} />
      {profile && (
        <DataPrivacySection
          accessToken={auth.accessToken}
          ndyId={profile.ndyId}
          onAccountDeleted={logout}
        />
      )}
    </div>
  );
}

function ProfileForm({
  accessToken,
  profile,
  onSaved,
}: {
  accessToken: string;
  profile: MeProfile;
  onSaved: (profile: MeProfile) => void;
}) {
  const [fullName, setFullName] = useState(profile.fullName ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "good" | "critical"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const updated = await updateProfile(accessToken, { fullName });
      onSaved({ ...profile, ...updated });
      setMessage({ kind: "good", text: "Profile updated." });
    } catch (err) {
      setMessage({ kind: "critical", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-medium text-foreground-muted">Profile</h2>

      <label className="mt-4 block text-xs uppercase tracking-wide text-foreground-muted">Email</label>
      <input
        value={profile.email}
        disabled
        className="mt-1 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground-muted"
      />

      <label className="mt-4 block text-xs uppercase tracking-wide text-foreground-muted">Full name</label>
      <input
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />

      {message && (
        <p className={`mt-3 text-sm ${message.kind === "good" ? "text-good" : "text-critical"}`}>
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

function EmailVerificationBanner({ accessToken }: { accessToken: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "good" | "critical"; text: string } | null>(null);

  async function handleResend() {
    setBusy(true);
    setMessage(null);
    try {
      await resendEmailVerification(accessToken);
      setMessage({ kind: "good", text: "Verification email sent — check your inbox." });
    } catch (err) {
      setMessage({ kind: "critical", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-accent/30 bg-accent/10 p-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-foreground">Your email address isn&apos;t verified yet.</p>
        <button
          onClick={handleResend}
          disabled={busy}
          className="shrink-0 rounded-md border border-accent/40 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
        >
          {busy ? "Sending…" : "Resend verification email"}
        </button>
      </div>
      {message && (
        <p className={`mt-2 text-xs ${message.kind === "good" ? "text-good" : "text-critical"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}

function PasswordForm({ accessToken }: { accessToken: string }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "good" | "critical"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await changePassword(accessToken, currentPassword, newPassword);
      setMessage({ kind: "good", text: "Password changed." });
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setMessage({ kind: "critical", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-medium text-foreground-muted">Password</h2>

      <label className="mt-4 block text-xs uppercase tracking-wide text-foreground-muted">
        Current password
      </label>
      <input
        type="password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />

      <label className="mt-4 block text-xs uppercase tracking-wide text-foreground-muted">
        New password
      </label>
      <input
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        minLength={8}
        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />

      {message && (
        <p className={`mt-3 text-sm ${message.kind === "good" ? "text-good" : "text-critical"}`}>
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || !currentPassword || newPassword.length < 8}
        className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Changing…" : "Change password"}
      </button>
    </form>
  );
}

function DataPrivacySection({
  accessToken,
  ndyId,
  onAccountDeleted,
}: {
  accessToken: string;
  ndyId: string;
  onAccountDeleted: () => void;
}) {
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleExport() {
    setExportBusy(true);
    setExportError(null);
    try {
      await downloadDataExport(accessToken, ndyId);
    } catch (err) {
      setExportError((err as Error).message);
    } finally {
      setExportBusy(false);
    }
  }

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteAccount(accessToken, password);
      // The account is anonymized and every session/connection revoked
      // server-side the moment this resolves — clear the local session too
      // so DashboardGate sends this tab back to /login immediately.
      onAccountDeleted();
    } catch (err) {
      setDeleteError((err as Error).message);
      setDeleteBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-medium text-foreground-muted">Data &amp; Privacy</h2>
      <p className="mt-2 text-sm text-foreground-muted">
        Download a copy of everything tied to your account, or permanently delete it.
      </p>

      <button
        onClick={handleExport}
        disabled={exportBusy}
        className="mt-4 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface-2 disabled:opacity-50"
      >
        {exportBusy ? "Preparing…" : "Export my data"}
      </button>
      {exportError && <p className="mt-2 text-sm text-critical">{exportError}</p>}

      <div className="mt-6 border-t border-critical/20 pt-5">
        <h3 className="text-sm font-medium text-critical">Delete account</h3>
        <p className="mt-1 text-xs text-foreground-muted">
          Your profile, email, and password are permanently wiped, and every device and
          connected website is signed out. Purchase and membership history is retained for
          legal/financial record-keeping, no longer linked to identifying information.
        </p>

        {!confirmOpen ? (
          <button
            onClick={() => setConfirmOpen(true)}
            className="mt-3 rounded-md border border-critical/40 px-4 py-2 text-sm font-medium text-critical hover:bg-critical/10"
          >
            Delete my account
          </button>
        ) : (
          <form onSubmit={handleDelete} className="mt-3 space-y-3">
            <div>
              <label className="block text-xs uppercase tracking-wide text-foreground-muted">
                Current password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-foreground-muted">
                Type DELETE to confirm
              </label>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>

            {deleteError && <p className="text-sm text-critical">{deleteError}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={deleteBusy || !password || confirmText !== "DELETE"}
                className="rounded-md bg-critical px-4 py-2 text-sm font-medium text-white hover:bg-critical/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleteBusy ? "Deleting…" : "Permanently delete"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
