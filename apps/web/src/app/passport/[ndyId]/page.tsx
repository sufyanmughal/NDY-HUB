"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Globe, Share2 } from "lucide-react";
import { Logo } from "@/components/logo";
import { Avatar } from "@/components/avatar";
import { SocialIcon } from "@/components/social-icon";
import { useAuth } from "@/lib/auth-context";
import { getPublicPassport, type PublicPassport } from "@/lib/api";

/** The real fix for "scanning the QR just returns raw JSON" — this is the
 * page that URL now renders. Fully public/unauthenticated: no DashboardGate,
 * no usePassport() (that hook is self-only, tied to the logged-in user's
 * own ndyId) — this calls getPublicPassport(ndyId) directly off the route
 * param, which is exactly what the QR on the authenticated Passport page
 * already encodes (apps/web/src/app/(dashboard)/passport/page.tsx). Every
 * field here may be null either because the owner never set it or chose to
 * keep it private — the API already resolved that before this ever saw the
 * response, so this only ever renders what's meant to be public. */
export default function PublicPassportPage({
  params,
}: {
  params: Promise<{ ndyId: string }>;
}) {
  const { ndyId } = use(params);
  const { auth } = useAuth();
  const [passport, setPassport] = useState<PublicPassport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPublicPassport(ndyId)
      .then((result) => {
        if (!cancelled) setPassport(result);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [ndyId]);

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: "NDY Passport", url });
        return;
      } catch {
        /* user cancelled the native share sheet — fall through to copy */
      }
    }
    await navigator.clipboard.writeText(url).catch(() => {});
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <Link href="/">
          <Logo />
        </Link>
        {auth.status === "authenticated" ? (
          <Link
            href="/dashboard"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
          >
            Dashboard
          </Link>
        ) : (
          <Link
            href="/login"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
          >
            Sign in to NDY HUB
          </Link>
        )}
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        {error && (
          <p className="rounded-md border border-critical/30 bg-critical/10 px-4 py-3 text-sm text-critical">
            {error}
          </p>
        )}

        {!error && !passport && (
          <p className="text-sm text-foreground-muted">Loading passport…</p>
        )}

        {passport && (
          <div className="w-full max-w-sm overflow-hidden rounded-xl border border-border bg-surface p-6 text-center">
            <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
              NDY Passport
            </div>

            <div className="mx-auto mt-6">
              <Avatar
                photoUrl={passport.profilePhotoUrl}
                name={passport.fullName ?? passport.ndyId}
                size={96}
                className="mx-auto text-3xl ring-4 ring-surface-2 shadow-lg"
              />
            </div>

            <div className="mt-4 text-lg font-semibold">
              {passport.fullName ?? "NDY HUB Member"}
            </div>

            {(passport.business?.name || passport.business?.role) && (
              <div className="mt-1 text-sm text-foreground-muted">
                {[passport.business.role, passport.business.name]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            )}

            <div className="mt-3">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                  passport.verificationLevel !== "LEVEL_0"
                    ? "bg-good/15 text-good"
                    : "bg-foreground-muted/15 text-foreground-muted"
                }`}
              >
                {passport.verificationLevel !== "LEVEL_0"
                  ? "Verified"
                  : "Not Verified"}
              </span>
            </div>

            {passport.bio && (
              <p className="mt-4 text-sm text-foreground-muted">
                {passport.bio}
              </p>
            )}

            {passport.country && (
              <p className="mt-2 text-xs text-foreground-muted">
                {passport.country}
              </p>
            )}

            {(passport.website ||
              passport.socials?.linkedin ||
              passport.socials?.instagram ||
              passport.socials?.x) && (
              <div className="mt-4 flex items-center justify-center gap-3">
                {passport.website && (
                  <a
                    href={passport.website}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Website"
                    className="rounded-full border border-border p-2 text-foreground-muted hover:bg-surface-2 hover:text-foreground"
                  >
                    <Globe size={16} strokeWidth={2} />
                  </a>
                )}
                {passport.socials?.linkedin && (
                  <a
                    href={passport.socials.linkedin}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="LinkedIn"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border p-2 text-foreground-muted hover:bg-surface-2 hover:text-foreground"
                  >
                    <SocialIcon kind="linkedin" />
                  </a>
                )}
                {passport.socials?.instagram && (
                  <a
                    href={passport.socials.instagram}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Instagram"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border p-2 text-foreground-muted hover:bg-surface-2 hover:text-foreground"
                  >
                    <SocialIcon kind="instagram" />
                  </a>
                )}
                {passport.socials?.x && (
                  <a
                    href={passport.socials.x}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="X / Twitter"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border p-2 text-foreground-muted hover:bg-surface-2 hover:text-foreground"
                  >
                    <SocialIcon kind="x" />
                  </a>
                )}
              </div>
            )}

            <div className="mt-5 border-t border-border pt-4">
              <div className="text-[10px] uppercase tracking-widest text-foreground-muted">
                NDY ID
              </div>
              <div className="font-mono text-sm">{passport.ndyId}</div>
              <div className="mt-1 text-xs text-foreground-muted">
                Member since{" "}
                {new Date(passport.memberSince).toLocaleDateString()}
              </div>
            </div>

            <button
              onClick={handleShare}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface-2"
            >
              <Share2 size={15} strokeWidth={2} />
              {shareCopied ? "Link copied!" : "Share"}
            </button>

            {auth.status !== "authenticated" && (
              <p className="mt-4 text-xs text-foreground-muted">
                This is {passport.fullName ?? "their"} NDY Passport — one
                identity across the whole NDJOYIT ecosystem.{" "}
                <Link href="/login" className="text-accent hover:underline">
                  Claim your own
                </Link>
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
