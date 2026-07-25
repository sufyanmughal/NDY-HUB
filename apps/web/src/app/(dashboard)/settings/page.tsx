"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getMe, updateProfile, changePassword, type MeProfile } from "@/lib/api";

export default function SettingsPage() {
  const { auth } = useAuth();
  const [profile, setProfile] = useState<MeProfile | null>(null);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    getMe(auth.accessToken).then(setProfile);
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

      {profile && <ProfileForm accessToken={auth.accessToken} profile={profile} onSaved={setProfile} />}
      <PasswordForm accessToken={auth.accessToken} />
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
