"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  getMe,
  updateProfile,
  uploadProfilePhoto,
  type MeProfile,
} from "@/lib/api";
import { COUNTRIES } from "@/lib/countries";
import { Avatar } from "@/components/avatar";

const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Runs immediately after the OAuth/passkey signup paths (password signup
 * now collects everything up front in the registration form itself — see
 * components/password-auth-form.tsx — so it never needs this step for
 * name/country/etc; it still needs this step for the photo, since photo
 * upload requires a session that doesn't exist until registration
 * returns). DashboardGate is the single chokepoint that routes here
 * whenever passportComplete is false. Also reachable any time afterwards
 * as the general "complete/edit your Passport" entry point. Required:
 * full name, country, photo. Skippable: bio, website, socials, business —
 * matches isPassportComplete() in auth.service.ts exactly. */

export default function CompletePassportPage() {
  const { auth } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("");
  const [website, setWebsite] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [xUrl, setXUrl] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessRole, setBusinessRole] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  useEffect(() => {
    if (auth.status === "unauthenticated") {
      router.replace("/login");
    }
  }, [auth.status, router]);

  // Populates the form from the server exactly once. Deliberately NOT
  // re-run on every auth.status flicker (a stale-cookie 401 immediately
  // after a fresh registration, followed by a retry, was observed to
  // trigger a second GET /auth/me here) — a second populate firing after
  // the user has already uploaded a photo or edited a field would silently
  // clobber that local state with the pre-upload/pre-edit server snapshot,
  // which is exactly what caused "Save & Continue" to wrongly claim no
  // photo was set right after a successful upload.
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  useEffect(() => {
    if (auth.status !== "authenticated" || hasLoadedOnce) return;
    getMe()
      .then((me) => {
        setProfile(me);
        setFullName(me.fullName ?? "");
        setBio(me.bio ?? "");
        setCountry(me.country ?? "");
        setWebsite(me.website ?? "");
        setLinkedinUrl(me.linkedinUrl ?? "");
        setInstagramUrl(me.instagramUrl ?? "");
        setXUrl(me.xUrl ?? "");
        setBusinessName(me.businessName ?? "");
        setBusinessRole(me.businessRole ?? "");
        setPhotoUrl(me.profilePhotoUrl);
        // Only latched on success — a failed attempt (e.g. the stale-cookie
        // 401 right after a fresh registration) is allowed to retry on the
        // next auth.status change instead of permanently stranding the page
        // with profile still null.
        setHasLoadedOnce(true);
      })
      .catch((err) => setError((err as Error).message));
  }, [auth.status, hasLoadedOnce]);

  if (auth.status !== "authenticated" || !profile) return null;

  // Two ways to land here: DashboardGate forcing a genuinely-incomplete
  // passport (profile.passportComplete was false on load — go on to the
  // dashboard once fixed), or an already-complete user clicking "Edit
  // Passport" from the Passport page (go back there instead of detouring
  // through the dashboard).
  const isEditing = profile.passportComplete;

  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setError("Photo must be a JPEG, PNG, or WEBP image.");
      return;
    }
    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      setError("Photo must be smaller than 5MB.");
      return;
    }
    setPhotoBusy(true);
    setError(null);
    try {
      const { profilePhotoUrl } = await uploadProfilePhoto(file);
      setPhotoUrl(profilePhotoUrl);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function finish() {
    // DashboardGate re-checks passportComplete on the next /auth/me call
    // triggered by the redirect below landing on a fresh mount.
    router.replace(isEditing ? "/passport" : "/dashboard");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      setError("Full name is required.");
      return;
    }
    if (!country) {
      setError("Country is required.");
      return;
    }
    if (!photoUrl) {
      setError("A profile photo is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateProfile({
        fullName: fullName.trim(),
        country,
        bio: bio.trim() || undefined,
        website: website.trim() || undefined,
        linkedinUrl: linkedinUrl.trim() || undefined,
        instagramUrl: instagramUrl.trim() || undefined,
        xUrl: xUrl.trim() || undefined,
        businessName: businessName.trim() || undefined,
        businessRole: businessRole.trim() || undefined,
      });
      await finish();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen justify-center bg-background px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="text-center">
          <span className="text-xl font-semibold tracking-tight">
            NDY <span className="text-accent">HUB</span>
          </span>
          <h1 className="mt-3 text-2xl font-semibold">
            {isEditing ? "Edit Your NDY Passport" : "Complete Your NDY Passport"}
          </h1>
          <p className="mt-1 text-sm text-foreground-muted">
            {isEditing
              ? "Update your digital identity card. Changes here also update your public passport page."
              : "This becomes your digital identity card across the ecosystem. Fields marked * are required — the rest can be added any time from Settings."}
          </p>
        </div>

        <form
          onSubmit={handleSave}
          className="mt-6 rounded-lg border border-border bg-surface p-5"
        >
          <label className="block text-xs uppercase tracking-wide text-foreground-muted">
            Photo *
          </label>
          <div className="mt-2 flex items-center gap-4">
            <Avatar
              photoUrl={photoUrl}
              name={fullName || "?"}
              size={64}
              className="text-xl ring-2 ring-surface-2"
            />
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_PHOTO_TYPES.join(",")}
                onChange={handlePhotoSelected}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={photoBusy}
                className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {photoBusy ? "Uploading…" : photoUrl ? "Change photo" : "Upload photo"}
              </button>
              <p className="mt-1 text-xs text-foreground-muted">
                JPEG, PNG, or WEBP — up to 5MB.
              </p>
            </div>
          </div>

          <label className="mt-4 block text-xs uppercase tracking-wide text-foreground-muted">
            Full name *
          </label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />

          <label className="mt-4 block text-xs uppercase tracking-wide text-foreground-muted">
            Country *
          </label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Select a country…
            </option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <label className="mt-4 block text-xs uppercase tracking-wide text-foreground-muted">
            Website
          </label>
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs uppercase tracking-wide text-foreground-muted">
                Business name
              </label>
              <input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-foreground-muted">
                Role / Title
              </label>
              <input
                value={businessRole}
                onChange={(e) => setBusinessRole(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <label className="mt-4 block text-xs uppercase tracking-wide text-foreground-muted">
            Bio <span className="normal-case text-foreground-muted/70">(optional)</span>
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={280}
            rows={3}
            placeholder="A short line about who you are."
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs uppercase tracking-wide text-foreground-muted">
                LinkedIn <span className="normal-case text-foreground-muted/70">(optional)</span>
              </label>
              <input
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/…"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-foreground-muted">
                Instagram <span className="normal-case text-foreground-muted/70">(optional)</span>
              </label>
              <input
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                placeholder="https://instagram.com/…"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-foreground-muted">
                X / Twitter <span className="normal-case text-foreground-muted/70">(optional)</span>
              </label>
              <input
                value={xUrl}
                onChange={(e) => setXUrl(e.target.value)}
                placeholder="https://x.com/…"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          {error && (
            <p className="mt-3 text-sm text-critical">{error}</p>
          )}

          <div className="mt-5 flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Saving…" : isEditing ? "Save Changes" : "Save & Continue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
