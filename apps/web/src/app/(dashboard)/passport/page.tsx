"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, Users, Coins, Boxes, Link2, ShieldCheck, type LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { usePassport } from "@/lib/use-passport";
import { useCryndySummary } from "@/lib/use-cryndy";
import { useNdybitsSummary } from "@/lib/use-ndybits";
import { useMembershipSummary } from "@/lib/use-membership";
import { mockConnectedPlatformsCount } from "@/lib/mock-data";
import { API_BASE_URL } from "@/lib/api";
import { downloadPassportPdf } from "@/lib/passport-pdf";
import { Avatar } from "@/components/avatar";

export default function PassportPage() {
  const { auth } = useAuth();
  const passport = usePassport();
  const cryndy = useCryndySummary();
  const ndybits = useNdybitsSummary();
  const membership = useMembershipSummary();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const ndyId = auth.status === "authenticated" ? auth.ndyId : null;

  // Encodes the real, live public-passport API endpoint — scanning this
  // resolves to actual JSON for this NDY ID today. A dedicated, nicely
  // rendered public verification page at that URL is a natural follow-up,
  // not something to fake a link to before it exists.
  useEffect(() => {
    if (!ndyId) return;
    let cancelled = false;
    const publicPassportUrl = `${API_BASE_URL}/passport/${ndyId}`;
    QRCode.toDataURL(publicPassportUrl, { margin: 1, width: 240 }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [ndyId]);

  if (auth.status !== "authenticated") return null;

  const displayName = passport?.fullName ?? "Name not set yet";
  // A passport at LEVEL_0 has nothing confirmed yet — showing it as
  // "Verified" regardless of level (the old behavior here) overstated
  // every brand-new account's status.
  const verified = passport ? passport.verificationLevel !== "LEVEL_0" : false;
  const verificationLevelLabel = passport
    ? `Level ${passport.verificationLevel.replace("LEVEL_", "")}`
    : "…";
  const membershipLabel = membership?.current?.tierLabel ?? "No active membership";
  const cryndyLabel = `${(cryndy?.availableBalance ?? 0).toLocaleString()} CRYNDY`;
  const ndybitsLabel = `${(ndybits?.balance ?? 0).toLocaleString()} NDYBITS`;
  const connectedPlatformsLabel = `${mockConnectedPlatformsCount} Platforms`;

  const canDownload = Boolean(passport && qrDataUrl);

  async function handleDownload() {
    if (!passport || !qrDataUrl || auth.status !== "authenticated") return;
    setDownloadError(null);
    setDownloading(true);
    try {
      await downloadPassportPdf({
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
      });
    } catch (err) {
      setDownloadError((err as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">NDY Passport</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Your identity, membership, and ownership record across the NDJOYIT ecosystem.
          </p>
        </div>
        <button
          onClick={handleDownload}
          disabled={!canDownload || downloading}
          className="flex shrink-0 items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={16} strokeWidth={2} />
          {downloading ? "Preparing…" : "Download PDF"}
        </button>
      </div>

      {downloadError && (
        <p className="mt-3 rounded-md border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
          {downloadError}
        </p>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-[320px_1fr]">
        <div className="overflow-hidden rounded-xl border border-border bg-surface p-6 text-center">
          <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
            NDY Passport
          </div>

          <div className="mx-auto mt-6">
            <Avatar
              photoUrl={passport?.profilePhotoUrl}
              name={displayName}
              size={128}
              className="mx-auto text-4xl ring-4 ring-surface-2 shadow-lg"
            />
          </div>

          <div className="mt-4 text-lg font-semibold">{displayName}</div>

          <div className="mt-3 text-[10px] uppercase tracking-widest text-foreground-muted">NDY ID</div>
          <div className="font-mono text-sm">{auth.ndyId}</div>

          <div className="mx-auto mt-4 flex h-[180px] w-[180px] items-center justify-center rounded-lg bg-white p-2">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="NDY Passport verification QR code" width={164} height={164} />
            ) : (
              <span className="text-xs text-black/40">Generating…</span>
            )}
          </div>

          <div className="mt-4">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                verified ? "bg-good/15 text-good" : "bg-critical/15 text-critical"
              }`}
            >
              {verified ? "Verified" : "Not Verified"}
            </span>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="border-b border-border bg-surface-2 px-5 py-3 text-xs font-medium uppercase tracking-wide text-foreground-muted">
            Passport Details
          </div>
          <dl className="divide-y divide-border text-sm">
            <Row icon={Users} label="Membership" value={membershipLabel} />
            <Row icon={Coins} label="CRYNDY Holdings" value={cryndyLabel} />
            <Row icon={Boxes} label="NDYBITS" value={ndybitsLabel} />
            <Row icon={Link2} label="Connected Platforms" value={connectedPlatformsLabel} />
            <Row icon={ShieldCheck} label="Verification Level" value={verificationLevelLabel} />
          </dl>
        </div>
      </div>

      <p className="mt-4 text-xs text-foreground-muted">
        Full Passport editing and privacy controls over what connected platforms can see land in
        a later milestone. Connected Platforms above is still mock data — no platforms backend
        exists yet.
      </p>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
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
