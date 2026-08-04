"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getMe, updateProfile, type MeProfile } from "@/lib/api";

/** Runs immediately after every signup path (password, OAuth, passkey —
 * DashboardGate is the single chokepoint that routes here) and any time an
 * existing user without a full name reaches the dashboard. Deliberately
 * outside (dashboard) so it isn't itself gated by the check it satisfies;
 * guards itself with useAuth() directly instead of DashboardGate. Full
 * name is the only required field (already collected at signup in most
 * cases) — everything else is skippable and editable later from Settings,
 * using the exact same fields/endpoint (ProfileForm in
 * (dashboard)/settings/page.tsx). */
const COUNTRIES = [
  "United States", "United Kingdom", "Canada", "Australia", "Germany",
  "France", "Netherlands", "Spain", "Italy", "Portugal", "Ireland",
  "Sweden", "Norway", "Denmark", "Finland", "Switzerland", "Austria",
  "Belgium", "Poland", "United Arab Emirates", "Saudi Arabia", "Qatar",
  "India", "Pakistan", "Bangladesh", "Singapore", "Malaysia", "Indonesia",
  "Philippines", "Japan", "South Korea", "China", "Hong Kong", "Vietnam",
  "Thailand", "New Zealand", "South Africa", "Nigeria", "Kenya", "Egypt",
  "Turkey", "Brazil", "Mexico", "Argentina", "Chile", "Colombia",
].sort();

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

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status === "unauthenticated") {
      router.replace("/login");
    }
  }, [auth.status, router]);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
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
      })
      .catch((err) => setError((err as Error).message));
  }, [auth.status]);

  if (auth.status !== "authenticated" || !profile) return null;

  async function finish() {
    // Any already-complete field (e.g. fullName from OAuth) stays as-is;
    // DashboardGate re-checks passportComplete on the next /auth/me call
    // triggered by the redirect below landing on a fresh mount.
    router.replace("/dashboard");
  }

  async function handleSkip() {
    if (!fullName.trim()) {
      setError("Full name is required — everything else can be skipped.");
      return;
    }
    if (fullName.trim() === (profile!.fullName ?? "")) {
      // Nothing changed beyond what's already saved — no need to call the API.
      await finish();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateProfile({ fullName: fullName.trim() });
      await finish();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      setError("Full name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateProfile({
        fullName: fullName.trim(),
        bio: bio.trim() || undefined,
        country: country || undefined,
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
            Complete Your NDY Passport
          </h1>
          <p className="mt-1 text-sm text-foreground-muted">
            This becomes your digital identity card across the ecosystem.
            Only your name is required — everything else can be added later
            from Settings.
          </p>
        </div>

        <form
          onSubmit={handleSave}
          className="mt-6 rounded-lg border border-border bg-surface p-5"
        >
          <label className="block text-xs uppercase tracking-wide text-foreground-muted">
            Full name *
          </label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />

          <label className="mt-4 block text-xs uppercase tracking-wide text-foreground-muted">
            Bio
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={280}
            rows={3}
            placeholder="A short line about who you are."
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />

          <label className="mt-4 block text-xs uppercase tracking-wide text-foreground-muted">
            Country
          </label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Prefer not to say</option>
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

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs uppercase tracking-wide text-foreground-muted">
                LinkedIn
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
                Instagram
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
                X / Twitter
              </label>
              <input
                value={xUrl}
                onChange={(e) => setXUrl(e.target.value)}
                placeholder="https://x.com/…"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

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

          {error && (
            <p className="mt-3 text-sm text-critical">{error}</p>
          )}

          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleSkip}
              disabled={busy}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Skip for now
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save & Continue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
