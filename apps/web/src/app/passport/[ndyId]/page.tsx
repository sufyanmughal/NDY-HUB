"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import QRCode from "qrcode";
import { Share2 } from "lucide-react";
import { Logo } from "@/components/logo";
import { VerticalPassportCard, type PassportCardData } from "@/components/passport-cards";
import { useAuth } from "@/lib/auth-context";
import { getPublicPassport, type PublicPassport } from "@/lib/api";
import "@/styles/homepage.css";
import "@/styles/passport-public.css";

/** The real fix for "scanning the QR just returns raw JSON" — this is the
 * page that URL now renders. Fully public/unauthenticated: no DashboardGate,
 * no usePassport() (that hook is self-only, tied to the logged-in user's
 * own ndyId) — this calls getPublicPassport(ndyId) directly off the route
 * param, which is exactly what the QR on the authenticated Passport page
 * already encodes (apps/web/src/app/(dashboard)/passport/page.tsx). Every
 * field here may be null either because the owner never set it or chose to
 * keep it private — the API already resolved that before this ever saw the
 * response, so this only ever renders what's meant to be public.
 *
 * Renders through the exact same <VerticalPassportCard> component the
 * dashboard's own Passport page uses (components/passport-cards/
 * vertical-card.tsx) — a pixel-accurate clone of the user's passportcard.jpeg
 * reference mockup — so the public card is guaranteed to look identical to
 * the authenticated self-view, not a second hand-maintained copy of the
 * same design. No email (PublicPassport never exposes it — privacy by
 * design) and no membership tier (no public endpoint exposes a stranger's
 * paid tier); the card's badge falls back to "NDY HUB" and the "Not
 * Verified"/"Verified Member" label uses verificationLevel instead, which
 * IS public. */
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
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    QRCode.toDataURL(window.location.href, { margin: 1, width: 200 }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const verified = passport ? passport.verificationLevel !== "LEVEL_0" : false;

  const cardData: PassportCardData | null = passport
    ? {
        ndyId: passport.ndyId,
        displayName: passport.fullName ?? passport.ndyId,
        profilePhotoUrl: passport.profilePhotoUrl,
        verified,
        bio: passport.bio,
        country: passport.country,
        website: passport.website,
        linkedinUrl: passport.socials?.linkedin,
        instagramUrl: passport.socials?.instagram,
        xUrl: passport.socials?.x,
        businessName: passport.business?.name,
        businessRole: passport.business?.role,
        email: null,
        membershipTierLabel: null,
        qrDataUrl,
      }
    : null;

  return (
    <div className="ndy-homepage">
      <div className="pp-page">
        <header className="pp-header">
          <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
            <Logo />
          </Link>
          {auth.status === "authenticated" ? (
            <Link href="/dashboard" className="hp-signin-btn">
              Dashboard
            </Link>
          ) : (
            <Link href="/login" className="hp-signin-btn">
              Sign in to NDY HUB
            </Link>
          )}
        </header>

        <main className="pp-main">
          <div className="hp-earth" />
          <div className="hp-stars" />

          {error && (
            <p
              style={{
                borderRadius: 10,
                padding: "12px 16px",
                fontSize: 13,
                color: "#f0605a",
                background: "rgba(240, 96, 90, 0.1)",
                border: "1px solid rgba(240, 96, 90, 0.3)",
              }}
            >
              {error}
            </p>
          )}

          {!error && !cardData && (
            <p style={{ fontSize: 13, color: "var(--hp-fg-muted)" }}>
              Loading passport…
            </p>
          )}

          {cardData && (
            <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <motion.div
                style={{ width: "100%", maxWidth: 420 }}
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              >
                <VerticalPassportCard data={cardData} />
              </motion.div>

              <motion.div
                className="pp-actions"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.15 }}
              >
                <button onClick={handleShare} className="pp-share-btn">
                  <Share2 size={15} strokeWidth={2} />
                  {shareCopied ? "Link copied!" : "Share this Passport"}
                </button>
              </motion.div>

              {auth.status !== "authenticated" && (
                <p className="pp-claim-note">
                  This is {passport?.fullName ?? "their"} NDY Passport — one identity
                  across the whole NDJOYIT ecosystem.{" "}
                  <Link href="/login">Claim your own</Link>
                </p>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
