"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import QRCode from "qrcode";
import { Wifi, MapPin, Globe, Share2, Fingerprint, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";
import { Avatar } from "@/components/avatar";
import { SocialIcon } from "@/components/social-icon";
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
 * Visual design follows the user's "digital business card" reference
 * mockup: photo+bio on the left, an icon-led contact list on the right,
 * a verified badge + QR along the bottom, framer-motion entrance. Doesn't
 * show a paid membership tier (the mockup's "LEGACY" badge) — there's no
 * public endpoint exposing a stranger's membership, and adding one wasn't
 * part of this pass; verificationLevel is the public-safe equivalent
 * "badge" shown instead. Email/phone aren't shown either — email isn't in
 * PublicPassport's public-safe shape at all (by design), and no phone
 * field exists anywhere in the schema. */
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
    QRCode.toDataURL(window.location.href, { margin: 1, width: 160 }).then((url) => {
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
  const hasSocials =
    passport?.socials?.linkedin || passport?.socials?.instagram || passport?.socials?.x;

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

          {!error && !passport && (
            <p style={{ fontSize: 13, color: "var(--hp-fg-muted)" }}>
              Loading passport…
            </p>
          )}

          {passport && (
            <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <motion.div
                className="pp-card"
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              >
                <div className="pp-card-top">
                  <div className="pp-card-brand">
                    <Logo size={26} />
                    <span className="pp-card-brand-tag">Passport</span>
                  </div>
                  <Wifi size={20} strokeWidth={1.6} className="pp-nfc-icon" />
                </div>
                <p className="pp-card-subtitle">Digital Business Card</p>

                <div className="pp-card-body">
                  {/* left: identity */}
                  <div>
                    <div className="pp-avatar-wrap">
                      <Avatar
                        photoUrl={passport.profilePhotoUrl}
                        name={passport.fullName ?? passport.ndyId}
                        size={96}
                        className="text-3xl"
                      />
                      {verified && (
                        <span className="pp-verified-dot">
                          <ShieldCheck size={13} strokeWidth={2.4} />
                        </span>
                      )}
                    </div>

                    <h1 className="pp-name">{passport.fullName ?? "NDY HUB Member"}</h1>
                    {(passport.business?.role || passport.business?.name) && (
                      <p className="pp-role">
                        {[passport.business.role, passport.business.name]
                          .filter(Boolean)
                          .join(" | ")}
                      </p>
                    )}
                    {passport.bio && <p className="pp-bio">{passport.bio}</p>}
                  </div>

                  {/* right: contact-style info rows */}
                  <div className="pp-info-list">
                    <InfoRow icon={<Fingerprint />} label="NDY ID" value={passport.ndyId} mono />
                    {passport.country && (
                      <InfoRow icon={<MapPin />} label="Location" value={passport.country} />
                    )}
                    {passport.website && (
                      <InfoRow
                        icon={<Globe />}
                        label="Website"
                        value={
                          <a href={passport.website} target="_blank" rel="noreferrer">
                            {passport.website.replace(/^https?:\/\//, "")}
                          </a>
                        }
                      />
                    )}
                    {hasSocials && (
                      <div className="pp-social-row">
                        {passport.socials?.linkedin && (
                          <a
                            href={passport.socials.linkedin}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="LinkedIn"
                            className="pp-social-link"
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
                            className="pp-social-link"
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
                            className="pp-social-link"
                          >
                            <SocialIcon kind="x" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pp-card-footer">
                  <div className="pp-badge">
                    <p className="pp-badge-label">Status</p>
                    <p className={`pp-badge-value ${verified ? "pp-verified" : "pp-unverified"}`}>
                      <ShieldCheck size={16} strokeWidth={2.2} />
                      {verified ? "Verified Member" : "Not Verified"}
                    </p>
                  </div>

                  <div className="pp-qr-block">
                    <div className="pp-qr-frame">
                      {qrDataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={qrDataUrl} alt="Scan to open this passport" width={80} height={80} />
                      ) : (
                        <span style={{ fontSize: 9, color: "rgba(0,0,0,0.4)" }}>…</span>
                      )}
                    </div>
                    <p className="pp-qr-caption">Scan to connect</p>
                  </div>
                </div>

                <div className="pp-ndyid-line">
                  <span>
                    Member since {new Date(passport.memberSince).toLocaleDateString()}
                  </span>
                  <span>One Identity. One Passport. One Ecosystem.</span>
                </div>
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
                  This is {passport.fullName ?? "their"} NDY Passport — one identity
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

function InfoRow({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="pp-info-row">
      <span className="pp-info-icon">{icon}</span>
      <div>
        <p className="pp-info-label">{label}</p>
        <p className="pp-info-value" style={mono ? { fontFamily: "var(--font-mono, ui-monospace, monospace)" } : undefined}>
          {value}
        </p>
      </div>
    </div>
  );
}
