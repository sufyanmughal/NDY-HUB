"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import {
  Download,
  Pencil,
  Users,
  Coins,
  Boxes,
  Link2,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { usePassport } from "@/lib/use-passport";
import { useCryndySummary } from "@/lib/use-cryndy";
import { useNdybitsSummary } from "@/lib/use-ndybits";
import { useMembershipSummary } from "@/lib/use-membership";
import { mockConnectedPlatformsCount } from "@/lib/mock-data";
import { downloadPassportPdf } from "@/lib/passport-pdf";
import { getMe } from "@/lib/api";
import {
  PassportCard,
  PASSPORT_CARD_DESIGNS,
  type PassportCardData,
  type PassportCardDesignId,
} from "@/components/passport-cards";
import { SharePanel } from "@/components/passport-cards/share-panel";
import { NfcPanel } from "@/components/passport-cards/nfc-panel";

// No selectable "tabs" anymore — every design renders on the one page,
// stacked, each with its own download button. This constant only exists
// to track which download is currently in flight (so only that card's
// button shows "Preparing…", not all three at once).
export default function PassportPage() {
  const { auth } = useAuth();
  const passport = usePassport();
  const cryndy = useCryndySummary();
  const ndybits = useNdybitsSummary();
  const membership = useMembershipSummary();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [downloadingDesign, setDownloadingDesign] = useState<PassportCardDesignId | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const qrSectionRef = useRef<HTMLDivElement>(null);

  const ndyId = auth.status === "authenticated" ? auth.ndyId : null;

  // getMe() (not usePassport(), which only returns the public-safe shape)
  // is the only place the account's real email is available — shown on
  // this self-view only, never rendered from the public /passport/[ndyId]
  // page.
  useEffect(() => {
    if (auth.status !== "authenticated") return;
    getMe()
      .then((me) => setEmail(me.email))
      .catch(() => {
        /* email is a nice-to-have on the card — not worth surfacing an
         * error banner over */
      });
  }, [auth.status]);

  // Encodes the real, rendered public passport page (apps/web's own
  // /passport/[ndyId] route) — this used to point at the raw JSON API
  // endpoint directly, so scanning it just returned unformatted data
  // instead of the actual card view a person scanning someone's passport
  // should land on. window.location.origin (not API_BASE_URL) since this
  // is the web app's own route, not the API's.
  useEffect(() => {
    if (!ndyId) return;
    let cancelled = false;
    const publicPassportUrl = `${window.location.origin}/passport/${ndyId}`;
    QRCode.toDataURL(publicPassportUrl, { margin: 1, width: 240 }).then(
      (url) => {
        if (!cancelled) setQrDataUrl(url);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [ndyId]);

  if (auth.status !== "authenticated") return null;

  const displayName = passport?.fullName ?? "Name not set yet";
  // Server-computed: normal accounts need verificationLevel past LEVEL_0,
  // but Founder/Super Admin accounts always read as verified regardless
  // (see the API's isPassportVerified for why) — this app never
  // re-derives that role logic client-side.
  const verified = passport?.isVerified ?? false;
  const verificationLevelLabel = passport
    ? `Level ${passport.verificationLevel.replace("LEVEL_", "")}`
    : "…";
  const membershipLabel =
    membership?.current?.tierLabel ?? "No active membership";
  const cryndyLabel = `${(cryndy?.availableBalance ?? 0).toLocaleString()} CRYNDY`;
  const ndybitsLabel = `${(ndybits?.balance ?? 0).toLocaleString()} NDYBITS`;
  const connectedPlatformsLabel = `${mockConnectedPlatformsCount} Platforms`;
  const publicPassportUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/passport/${auth.ndyId}`;

  const canDownload = Boolean(passport && qrDataUrl);

  const cardData: PassportCardData = {
    ndyId: auth.ndyId,
    displayName,
    profilePhotoUrl: passport?.profilePhotoUrl,
    verified,
    bio: passport?.bio,
    country: passport?.country,
    website: passport?.website,
    linkedinUrl: passport?.socials?.linkedin,
    instagramUrl: passport?.socials?.instagram,
    xUrl: passport?.socials?.x,
    businessName: passport?.business?.name,
    businessRole: passport?.business?.role,
    email,
    phone: passport?.phone,
    membershipTierLabel: membership?.current?.tierLabel,
    qrDataUrl,
  };

  async function handleDownload(design: PassportCardDesignId) {
    if (!passport || !qrDataUrl || auth.status !== "authenticated") return;
    setDownloadError(null);
    setDownloadingDesign(design);
    try {
      await downloadPassportPdf(
        {
          ndyId: auth.ndyId,
          fullName: displayName,
          verified,
          verificationLevelLabel,
          membershipLabel,
          cryndyBalanceLabel: cryndyLabel,
          ndybitsBalanceLabel: ndybitsLabel,
          connectedPlatformsLabel,
          qrDataUrl,
          photoUrl: passport.profilePhotoUrl,
          bio: passport.bio,
          country: passport.country,
          website: passport.website,
          businessName: passport.business?.name,
          businessRole: passport.business?.role,
          membershipTierLabel: membership?.current?.tierLabel,
          email,
          phone: passport.phone,
        },
        design,
      );
    } catch (err) {
      setDownloadError((err as Error).message);
    } finally {
      setDownloadingDesign(null);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">NDY Passport</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Your digital identity and digital business card across the NDJOYIT
            ecosystem.
          </p>
        </div>
        <Link
          href="/passport/complete"
          className="flex shrink-0 items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface-2"
        >
          <Pencil size={16} strokeWidth={2} />
          Edit Passport
        </Link>
      </div>

      {downloadError && (
        <p className="mt-3 rounded-md border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
          {downloadError}
        </p>
      )}

      {/* Every card design, one page, no tabs — each with its own download
          button so any of the three can be saved as a PDF independently. */}
      <div className="mt-6 space-y-6" ref={qrSectionRef}>
        {PASSPORT_CARD_DESIGNS.map((d) => (
          <div key={d.id}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">{d.label}</h2>
                <p className="text-xs text-foreground-muted">{d.description}</p>
              </div>
              <button
                onClick={() => handleDownload(d.id)}
                disabled={!canDownload || downloadingDesign !== null}
                className="flex shrink-0 items-center gap-2 rounded-md bg-accent px-3.5 py-2 text-xs font-medium text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download size={14} strokeWidth={2} />
                {downloadingDesign === d.id ? "Preparing…" : "Download PDF"}
              </button>
            </div>
            <PassportCard design={d.id} data={cardData} />
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="border-b border-border bg-surface-2 px-5 py-3 text-xs font-medium uppercase tracking-wide text-foreground-muted">
            Passport Details
          </div>
          <dl className="divide-y divide-border text-sm">
            <Row icon={Users} label="Membership" value={membershipLabel} />
            <Row icon={Coins} label="CRYNDY Holdings" value={cryndyLabel} />
            <Row icon={Boxes} label="NDYBITS" value={ndybitsLabel} />
            <Row
              icon={Link2}
              label="Connected Platforms"
              value={connectedPlatformsLabel}
            />
            <Row
              icon={ShieldCheck}
              label="Verification Level"
              value={verificationLevelLabel}
            />
          </dl>
        </div>

        <SharePanel
          publicUrl={publicPassportUrl}
          onScrollToQr={() => qrSectionRef.current?.scrollIntoView({ behavior: "smooth" })}
        />

        <NfcPanel ndyId={auth.ndyId} displayName={displayName} />
      </div>

      <p className="mt-4 text-xs text-foreground-muted">
        Connected Platforms above is still mock data — no platforms backend
        exists yet. NFC cards and Apple/Google Wallet passes are on the
        roadmap.
      </p>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <dt className="flex items-center gap-3 text-foreground-muted">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-accent">
          <Icon size={14} strokeWidth={2} />
        </span>
        {label}
      </dt>
      <dd className="font-mono tabular-nums">{value}</dd>
    </div>
  );
}
