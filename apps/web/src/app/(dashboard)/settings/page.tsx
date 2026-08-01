"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/avatar";
import {
  getMe,
  updateProfile,
  uploadProfilePhoto,
  changePassword,
  downloadDataExport,
  deleteAccount,
  resendEmailVerification,
  begin2faSetup,
  confirm2faSetup,
  disable2fa,
  getMyPasskeys,
  removeMyPasskey,
  getOAuthProviders,
  getConnectedAccounts,
  unlinkConnectedAccount,
  beginConnectOAuthProvider,
  type MeProfile,
  type PasskeySummary,
  type ConnectedAccount,
} from "@/lib/api";
import { registerPasskey, browserSupportsWebAuthn } from "@/lib/passkey";

const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function SettingsPage() {
  const { auth, logout } = useAuth();
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    getMe()
      .then(setProfile)
      .catch((err) => setLoadError((err as Error).message));
  }, [auth]);

  if (auth.status !== "authenticated") return null;

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Profile details and account security. Notification preferences and
          recovery methods land in a later milestone.
        </p>
      </div>

      {loadError && (
        <p className="rounded-md border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
          {loadError}
        </p>
      )}

      {profile && profile.verificationLevel === "LEVEL_0" && (
        <EmailVerificationBanner />
      )}

      {profile && <ProfileForm profile={profile} onSaved={setProfile} />}
      <PasswordForm />
      {profile && <TwoFactorSection profile={profile} onChanged={setProfile} />}
      <PasskeysSection />
      <ConnectedAccountsSection />
      {profile && (
        <DataPrivacySection ndyId={profile.ndyId} onAccountDeleted={logout} />
      )}
    </div>
  );
}

function ProfileForm({
  profile,
  onSaved,
}: {
  profile: MeProfile;
  onSaved: (profile: MeProfile) => void;
}) {
  const [fullName, setFullName] = useState(profile.fullName ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    kind: "good" | "critical";
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const updated = await updateProfile({ fullName });
      onSaved({ ...profile, ...updated });
      setMessage({ kind: "good", text: "Profile updated." });
    } catch (err) {
      setMessage({ kind: "critical", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets picking the same file again re-trigger onChange
    if (!file) return;

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setPhotoError("Only JPEG, PNG, and WebP images are allowed.");
      return;
    }
    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      setPhotoError("Photo must be 5MB or smaller.");
      return;
    }

    setPhotoError(null);
    setPhotoBusy(true);
    try {
      const { profilePhotoUrl } = await uploadProfilePhoto(file);
      onSaved({ ...profile, profilePhotoUrl });
    } catch (err) {
      setPhotoError((err as Error).message);
    } finally {
      setPhotoBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-surface p-5"
    >
      <h2 className="text-sm font-medium text-foreground-muted">Profile</h2>

      <div className="mt-4 flex items-center gap-4">
        <Avatar
          photoUrl={profile.profilePhotoUrl}
          name={profile.fullName ?? profile.ndyId}
          size={56}
        />
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePhotoSelected}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={photoBusy}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {photoBusy ? "Uploading…" : "Change photo"}
          </button>
          <p className="mt-1 text-xs text-foreground-muted">
            JPEG, PNG, or WebP. Up to 5MB.
          </p>
        </div>
      </div>
      {photoError && <p className="mt-2 text-sm text-critical">{photoError}</p>}

      <label className="mt-4 block text-xs uppercase tracking-wide text-foreground-muted">
        Email
      </label>
      <input
        value={profile.email}
        disabled
        className="mt-1 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground-muted"
      />

      <label className="mt-4 block text-xs uppercase tracking-wide text-foreground-muted">
        Full name
      </label>
      <input
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />

      {message && (
        <p
          className={`mt-3 text-sm ${message.kind === "good" ? "text-good" : "text-critical"}`}
        >
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

function EmailVerificationBanner() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    kind: "good" | "critical";
    text: string;
  } | null>(null);

  async function handleResend() {
    setBusy(true);
    setMessage(null);
    try {
      await resendEmailVerification();
      setMessage({
        kind: "good",
        text: "Verification email sent — check your inbox.",
      });
    } catch (err) {
      setMessage({ kind: "critical", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-accent/30 bg-accent/10 p-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-foreground">
          Your email address isn&apos;t verified yet.
        </p>
        <button
          onClick={handleResend}
          disabled={busy}
          className="shrink-0 rounded-md border border-accent/40 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
        >
          {busy ? "Sending…" : "Resend verification email"}
        </button>
      </div>
      {message && (
        <p
          className={`mt-2 text-xs ${message.kind === "good" ? "text-good" : "text-critical"}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}

function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    kind: "good" | "critical";
    text: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await changePassword(currentPassword, newPassword);
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
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-surface p-5"
    >
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
        <p
          className={`mt-3 text-sm ${message.kind === "good" ? "text-good" : "text-critical"}`}
        >
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

/**
 * Three states: not enabled (just a toggle-on button), mid-setup (QR code
 * + manual secret + confirm-with-a-real-code, then backup codes shown
 * exactly once), or enabled (a disable form gated on password + code —
 * high friction on purpose for a security-downgrading action, same
 * reasoning as the server-side check in TotpService.disable).
 */
function TwoFactorSection({
  profile,
  onChanged,
}: {
  profile: MeProfile;
  onChanged: (profile: MeProfile) => void;
}) {
  const [setupStep, setSetupStep] = useState<
    "idle" | "confirm" | "backup-codes"
  >("idle");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [disableOpen, setDisableOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [disableBusy, setDisableBusy] = useState(false);
  const [disableError, setDisableError] = useState<string | null>(null);

  async function handleStartSetup() {
    setBusy(true);
    setError(null);
    try {
      const { secret, otpauthUri } = await begin2faSetup();
      setSecret(secret);
      setQrDataUrl(
        await QRCode.toDataURL(otpauthUri, { margin: 1, width: 200 }),
      );
      setSetupStep("confirm");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmSetup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { backupCodes } = await confirm2faSetup(confirmCode);
      setBackupCodes(backupCodes);
      setSetupStep("backup-codes");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function handleFinishSetup() {
    setSetupStep("idle");
    setQrDataUrl(null);
    setSecret(null);
    setConfirmCode("");
    setBackupCodes([]);
    onChanged({ ...profile, twoFactorEnabled: true });
  }

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    setDisableBusy(true);
    setDisableError(null);
    try {
      await disable2fa(disablePassword, disableCode);
      setDisableOpen(false);
      setDisablePassword("");
      setDisableCode("");
      onChanged({ ...profile, twoFactorEnabled: false });
    } catch (err) {
      setDisableError((err as Error).message);
    } finally {
      setDisableBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-medium text-foreground-muted">
        Two-factor authentication
      </h2>

      {profile.twoFactorEnabled && setupStep === "idle" && (
        <div className="mt-3">
          <p className="text-sm text-foreground-muted">
            Enabled — signing in requires a code from your authenticator app or
            a backup code.
          </p>
          {!disableOpen ? (
            <button
              onClick={() => setDisableOpen(true)}
              className="mt-3 rounded-md border border-critical/40 px-4 py-2 text-sm font-medium text-critical hover:bg-critical/10"
            >
              Disable two-factor authentication
            </button>
          ) : (
            <form onSubmit={handleDisable} className="mt-3 space-y-3">
              <div>
                <label className="block text-xs uppercase tracking-wide text-foreground-muted">
                  Current password
                </label>
                <input
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide text-foreground-muted">
                  Authenticator code or backup code
                </label>
                <input
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              {disableError && (
                <p className="text-sm text-critical">{disableError}</p>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDisableOpen(false)}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={disableBusy || !disablePassword || !disableCode}
                  className="rounded-md bg-critical px-4 py-2 text-sm font-medium text-white hover:bg-critical/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {disableBusy ? "Disabling…" : "Disable"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {!profile.twoFactorEnabled && setupStep === "idle" && (
        <div className="mt-3">
          <p className="text-sm text-foreground-muted">
            Not enabled. Add an authenticator app (Google Authenticator,
            1Password, Authy…) as a second step when signing in.
          </p>
          {error && <p className="mt-2 text-sm text-critical">{error}</p>}
          <button
            onClick={handleStartSetup}
            disabled={busy}
            className="mt-3 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {busy ? "Starting…" : "Enable two-factor authentication"}
          </button>
        </div>
      )}

      {setupStep === "confirm" && (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-foreground-muted">
            Scan this QR code with your authenticator app, then enter the
            6-digit code it shows.
          </p>
          {qrDataUrl && (
            /* eslint-disable-next-line @next/next/no-img-element -- a data: URL, not a remote image */
            <img
              src={qrDataUrl}
              alt="2FA setup QR code"
              width={200}
              height={200}
              className="rounded-md"
            />
          )}
          {secret && (
            <p className="text-xs text-foreground-muted">
              Can&apos;t scan it? Enter this code manually:{" "}
              <span className="font-mono text-foreground">{secret}</span>
            </p>
          )}
          <form onSubmit={handleConfirmSetup} className="space-y-3">
            <input
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value)}
              autoFocus
              required
              placeholder="123456"
              className="w-full max-w-[200px] rounded-md border border-border bg-background px-3 py-2 text-center text-lg tracking-widest"
            />
            {error && <p className="text-sm text-critical">{error}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setSetupStep("idle");
                  setQrDataUrl(null);
                  setSecret(null);
                  setConfirmCode("");
                  setError(null);
                }}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !confirmCode}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Confirming…" : "Confirm"}
              </button>
            </div>
          </form>
        </div>
      )}

      {setupStep === "backup-codes" && (
        <div className="mt-3 space-y-3">
          <p className="text-sm font-medium text-good">
            Two-factor authentication is now enabled.
          </p>
          <p className="text-sm text-foreground-muted">
            Save these backup codes somewhere safe — each works once, as a way
            back in if you lose your authenticator app. They won&apos;t be shown
            again.
          </p>
          <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-surface-2 p-3 font-mono text-sm">
            {backupCodes.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          <button
            onClick={handleFinishSetup}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
          >
            I&apos;ve saved these codes
          </button>
        </div>
      )}
    </div>
  );
}

function PasskeysSection() {
  const [passkeys, setPasskeys] = useState<PasskeySummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const supported = typeof window !== "undefined" && browserSupportsWebAuthn();

  useEffect(() => {
    // Guards against React Strict Mode's double effect-invoke in dev (and
    // any other double-fire): without this, a stale first fetch resolving
    // after a later add/remove would clobber the up-to-date list — same
    // "cancelled" pattern QrLoginCard uses for its QR data URL fetch.
    let cancelled = false;
    getMyPasskeys()
      .then((result) => {
        if (!cancelled) setPasskeys(result);
      })
      .catch((err) => {
        if (!cancelled) setLoadError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAdd() {
    setBusy(true);
    setError(null);
    try {
      // A reasonable default label beats an empty one — the user can't
      // rename it later without deleting and re-adding, but most people
      // never touch this beyond "does this list make sense to me."
      const label =
        typeof navigator !== "undefined"
          ? guessDeviceLabel(navigator.userAgent)
          : undefined;
      const created = await registerPasskey(label);
      setPasskeys((prev) => [...(prev ?? []), created]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(id: string) {
    setRemovingId(id);
    setError(null);
    try {
      await removeMyPasskey(id);
      setPasskeys((prev) => (prev ?? []).filter((p) => p.id !== id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-medium text-foreground-muted">Passkeys</h2>
      <p className="mt-2 text-sm text-foreground-muted">
        Sign in with your fingerprint, face, or device PIN instead of a password
        — phishing resistant, and nothing to remember.
      </p>

      {!supported && (
        <p className="mt-3 text-sm text-critical">
          This browser doesn&apos;t support passkeys.
        </p>
      )}
      {loadError && <p className="mt-3 text-sm text-critical">{loadError}</p>}

      {passkeys && passkeys.length > 0 && (
        <ul className="mt-4 space-y-2">
          {passkeys.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">
                  {p.deviceLabel ?? "Unnamed passkey"}
                </p>
                <p className="text-xs text-foreground-muted">
                  Added {new Date(p.createdAt).toLocaleDateString()}
                  {p.lastUsedAt
                    ? ` · last used ${new Date(p.lastUsedAt).toLocaleDateString()}`
                    : ""}
                </p>
              </div>
              <button
                onClick={() => handleRemove(p.id)}
                disabled={removingId === p.id}
                className="rounded-md border border-critical/40 px-3 py-1.5 text-xs font-medium text-critical hover:bg-critical/10 disabled:opacity-50"
              >
                {removingId === p.id ? "Removing…" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-3 text-sm text-critical">{error}</p>}

      <button
        onClick={handleAdd}
        disabled={busy || !supported}
        className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Adding…" : "Add a passkey"}
      </button>
    </div>
  );
}

function guessDeviceLabel(userAgent: string): string {
  const os = /Windows/.test(userAgent)
    ? "Windows"
    : /Mac OS/.test(userAgent)
      ? "Mac"
      : /Android/.test(userAgent)
        ? "Android"
        : /iPhone|iPad/.test(userAgent)
          ? "iOS"
          : "device";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Chrome\//.test(userAgent)
      ? "Chrome"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : "browser";
  return `${browser} on ${os}`;
}

const PROVIDER_LABELS: Record<ConnectedAccount["provider"], string> = {
  GOOGLE: "Google",
  APPLE: "Apple",
};

/**
 * Shows what's linked (from AuthIdentity, via the "sign in with the same
 * email" auto-link or an explicit Connect below) and lets a signed-in user
 * explicitly connect a Google/Apple account whose email doesn't match
 * theirs — beginConnectOAuthProvider carries the current session into the
 * redirect via linkUserId server-side, so that case doesn't depend on
 * email matching to know which account to attach to.
 */
function ConnectedAccountsSection() {
  const [accounts, setAccounts] = useState<ConnectedAccount[] | null>(null);
  const [providers, setProviders] = useState<{
    google: boolean;
    apple: boolean;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [connectBusy, setConnectBusy] = useState<"GOOGLE" | "APPLE" | null>(
    null,
  );
  const [unlinkBusy, setUnlinkBusy] = useState<string | null>(null);
  // The connect flow lands back here via a real browser redirect (Settings'
  // "Connect" button navigates the whole page, same as Google/Apple sign-in
  // does), not a fetch this component controls — so success/failure arrives
  // as query params already present on first render, read as lazy initial
  // state rather than set from an effect.
  const [actionError, setActionError] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const linkError = new URLSearchParams(window.location.search).get(
      "linkError",
    );
    if (!linkError) return null;
    return linkError === "already_linked_elsewhere"
      ? "That account is already connected to a different NDY HUB account."
      : "Something went wrong connecting that account — try again.";
  });
  const [notice] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const linked = new URLSearchParams(window.location.search).get("linked");
    if (!linked) return null;
    const provider = linked.toUpperCase() as ConnectedAccount["provider"];
    return `${PROVIDER_LABELS[provider] ?? linked} connected.`;
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([getConnectedAccounts(), getOAuthProviders()])
      .then(([accountsResult, providersResult]) => {
        if (cancelled) return;
        setAccounts(accountsResult);
        setProviders(providersResult);
      })
      .catch((err) => {
        if (!cancelled) setLoadError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Purely clearing the URL, no state to set — a refresh shouldn't re-show
  // the notice/error above.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("linked") && !url.searchParams.has("linkError"))
      return;
    url.searchParams.delete("linked");
    url.searchParams.delete("linkError");
    window.history.replaceState({}, "", url.toString());
  }, []);

  async function handleConnect(provider: "GOOGLE" | "APPLE") {
    setConnectBusy(provider);
    setActionError(null);
    try {
      const url = await beginConnectOAuthProvider(
        provider.toLowerCase() as "google" | "apple",
      );
      window.location.href = url;
    } catch (err) {
      setActionError((err as Error).message);
      setConnectBusy(null);
    }
  }

  async function handleUnlink(id: string) {
    setUnlinkBusy(id);
    setActionError(null);
    try {
      await unlinkConnectedAccount(id);
      setAccounts((prev) => (prev ?? []).filter((a) => a.id !== id));
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setUnlinkBusy(null);
    }
  }

  const connectedProviders = new Set((accounts ?? []).map((a) => a.provider));

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-medium text-foreground-muted">
        Connected accounts
      </h2>
      <p className="mt-2 text-sm text-foreground-muted">
        Sign in faster with Google or Apple, or attach one to this account for a
        backup way in.
      </p>

      {notice && <p className="mt-3 text-sm text-good">{notice}</p>}
      {loadError && <p className="mt-3 text-sm text-critical">{loadError}</p>}
      {actionError && (
        <p className="mt-3 text-sm text-critical">{actionError}</p>
      )}

      {accounts && accounts.length > 0 && (
        <ul className="mt-4 space-y-2">
          {accounts.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{PROVIDER_LABELS[a.provider]}</p>
                <p className="text-xs text-foreground-muted">
                  {a.email ?? "No email on file"} · connected{" "}
                  {new Date(a.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => handleUnlink(a.id)}
                disabled={unlinkBusy === a.id}
                className="rounded-md border border-critical/40 px-3 py-1.5 text-xs font-medium text-critical hover:bg-critical/10 disabled:opacity-50"
              >
                {unlinkBusy === a.id ? "Disconnecting…" : "Disconnect"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {providers?.google && !connectedProviders.has("GOOGLE") && (
          <button
            onClick={() => handleConnect("GOOGLE")}
            disabled={connectBusy === "GOOGLE"}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {connectBusy === "GOOGLE" ? "Redirecting…" : "Connect Google"}
          </button>
        )}
        {providers?.apple && !connectedProviders.has("APPLE") && (
          <button
            onClick={() => handleConnect("APPLE")}
            disabled={connectBusy === "APPLE"}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {connectBusy === "APPLE" ? "Redirecting…" : "Connect Apple"}
          </button>
        )}
        {providers &&
          !providers.google &&
          !providers.apple &&
          accounts?.length === 0 && (
            <p className="text-xs text-foreground-muted">
              Google and Apple sign-in aren&apos;t configured on this server
              yet.
            </p>
          )}
      </div>
    </div>
  );
}

function DataPrivacySection({
  ndyId,
  onAccountDeleted,
}: {
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
      await downloadDataExport(ndyId);
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
      await deleteAccount(password);
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
      <h2 className="text-sm font-medium text-foreground-muted">
        Data &amp; Privacy
      </h2>
      <p className="mt-2 text-sm text-foreground-muted">
        Download a copy of everything tied to your account, or permanently
        delete it.
      </p>

      <button
        onClick={handleExport}
        disabled={exportBusy}
        className="mt-4 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface-2 disabled:opacity-50"
      >
        {exportBusy ? "Preparing…" : "Export my data"}
      </button>
      {exportError && (
        <p className="mt-2 text-sm text-critical">{exportError}</p>
      )}

      <div className="mt-6 border-t border-critical/20 pt-5">
        <h3 className="text-sm font-medium text-critical">Delete account</h3>
        <p className="mt-1 text-xs text-foreground-muted">
          Your profile, email, and password are permanently wiped, and every
          device and connected website is signed out. Purchase and membership
          history is retained for legal/financial record-keeping, no longer
          linked to identifying information.
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

            {deleteError && (
              <p className="text-sm text-critical">{deleteError}</p>
            )}

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
