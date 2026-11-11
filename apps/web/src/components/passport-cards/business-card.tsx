"use client";

import { useState } from "react";
import { Check, Download, IdCard, Mail, MapPin, Share2 } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { SocialIcon } from "@/components/social-icon";
import { LogoBadge, SILVER_GRADIENT, SILVER_TEXT_DARK } from "./shared";
import type { PassportCardData } from "./types";

type CardStyle = "midnight" | "silver";

/** "Business Card" design. 2026-11 Figma handoff (business-card-mockup.png
 * in .figma-reference/, not committed) added a brand-new "Silver" look and
 * a real "Card Style: Midnight | Silver" switch — "Midnight" is this
 * component's pre-existing dark/flat design (unchanged below, just gated
 * behind the toggle), "Silver" is the new brushed-metal-header look.
 * Defaults to Silver since that's what the client's mockup points at.
 *
 * Share Card and Download PDF are both real, live in both styles: Share
 * Card uses the same navigator.share-with-clipboard-fallback pattern
 * already established by SharePanel/the public passport page's share
 * button (just pointed at this card's own public passport URL); Download
 * PDF calls back into the same jsPDF export (lib/passport-pdf.ts) this
 * page has always used, now rendered as a button owned by this card
 * instead of a generic header button above it, per the mockup's layout. */
export function BusinessPassportCard({
  data,
  onDownloadPdf,
  downloadLabel = "Download PDF",
  downloadDisabled = false,
}: {
  data: PassportCardData;
  onDownloadPdf?: () => void;
  downloadLabel?: string;
  downloadDisabled?: boolean;
}) {
  const [style, setStyle] = useState<CardStyle>("silver");
  const [shareCopied, setShareCopied] = useState(false);

  async function handleShareCard() {
    const url =
      typeof window !== "undefined" ? `${window.location.origin}/passport/${data.ndyId}` : "";
    if (navigator.share) {
      try {
        await navigator.share({ title: `${data.displayName} — NDY Passport`, url });
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
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Business Card</h2>
          <p className="text-xs text-foreground-muted">
            Horizontal layout for sharing contact and business details.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-foreground-muted">Card Style:</span>
          <div className="inline-flex rounded-full border border-border bg-surface-2 p-1">
            <StyleOption label="Midnight" active={style === "midnight"} onClick={() => setStyle("midnight")} />
            <StyleOption label="Silver" active={style === "silver"} onClick={() => setStyle("silver")} />
          </div>
        </div>
      </div>

      {style === "silver" ? (
        <SilverBusinessCard data={data} />
      ) : (
        <MidnightBusinessCard data={data} />
      )}

      <div className="mt-3 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={handleShareCard}
          className="flex items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-semibold hover:bg-surface-2"
        >
          <Share2 className="h-4 w-4" strokeWidth={2} />
          {shareCopied ? "Link copied!" : "Share Card"}
        </button>
        <button
          type="button"
          onClick={onDownloadPdf}
          disabled={downloadDisabled}
          className="flex items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-semibold hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-4 w-4" strokeWidth={2} />
          {downloadLabel}
        </button>
      </div>
    </div>
  );
}

function StyleOption({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? "bg-foreground text-background" : "text-foreground-muted hover:text-foreground"
      }`}
    >
      {active && <Check className="h-3 w-3" strokeWidth={2.5} />}
      {label}
    </button>
  );
}

/** New 2026-11 look: brushed-silver header bar (logo badge + "NDYHUB"),
 * dark body with avatar/name/verified pill, icon rows (email/country/NDY
 * ID), and a white QR panel — matches business-card-mockup.png. */
function SilverBusinessCard({ data }: { data: PassportCardData }) {
  const initial = (data.displayName.trim().charAt(0) || "N").toUpperCase();

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex items-center gap-3 px-5 py-3.5" style={{ background: SILVER_GRADIENT }}>
        <LogoBadge size={36} />
        <div className="h-6 w-px shrink-0" style={{ background: "rgba(15,20,32,0.25)" }} />
        <span className="text-lg font-extrabold tracking-tight" style={{ color: SILVER_TEXT_DARK }}>
          NDYHUB
        </span>
      </div>

      <div className="flex flex-col gap-6 bg-[#0d1220] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            {data.profilePhotoUrl ? (
              <Avatar photoUrl={data.profilePhotoUrl} name={data.displayName} size={56} />
            ) : (
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-bold"
                style={{ background: SILVER_GRADIENT, color: SILVER_TEXT_DARK }}
              >
                {initial}
              </div>
            )}
            <div className="h-10 w-px shrink-0 bg-white/15" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-lg font-bold text-white">{data.displayName}</span>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-white">
                  {data.verified && <Check className="h-3 w-3" strokeWidth={2.5} />}
                  {data.verified ? "Verified" : "Not Verified"}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2.5 border-t border-white/10 pt-4">
            {data.email && <SilverIconRow icon={Mail} text={data.email} />}
            {data.country && <SilverIconRow icon={MapPin} text={data.country} />}
            <SilverIconRow icon={IdCard} text={data.ndyId} />
          </div>
        </div>

        <div className="hidden w-px self-stretch bg-white/10 sm:block" />

        <div className="flex shrink-0 flex-col items-center gap-2">
          <div className="flex h-[108px] w-[108px] items-center justify-center rounded-xl bg-white p-2">
            {data.qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- data: URL
              <img src={data.qrDataUrl} alt="NDY Passport QR code" width={92} height={92} />
            ) : (
              <span className="text-[9px] text-black/40">Generating…</span>
            )}
          </div>
          <span className="text-xs text-slate-400">Scan to connect</span>
        </div>
      </div>
    </div>
  );
}

function SilverIconRow({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 text-sm text-slate-200">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
        style={{ background: SILVER_GRADIENT, color: SILVER_TEXT_DARK }}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
      </span>
      <span className="truncate">{text}</span>
    </div>
  );
}

/** Pre-existing "Midnight" look (the only Business Card design before this
 * redesign) — unchanged, just lifted verbatim into its own function so the
 * new Card Style toggle can switch to it. */
function MidnightBusinessCard({ data }: { data: PassportCardData }) {
  const hasContactRow = data.country || data.website || data.email || data.phone;
  const hasSocials = data.linkedinUrl || data.instagramUrl || data.xUrl;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Avatar
            photoUrl={data.profilePhotoUrl}
            name={data.displayName}
            size={64}
            className="text-xl ring-2 ring-surface-2"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold">{data.displayName}</span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  data.verified
                    ? "bg-good/15 text-good"
                    : "bg-foreground-muted/15 text-foreground-muted"
                }`}
              >
                {data.verified ? "Verified" : "Not Verified"}
              </span>
            </div>
            {(data.businessRole || data.businessName) && (
              <div className="mt-0.5 text-sm text-foreground-muted">
                {[data.businessRole, data.businessName].filter(Boolean).join(" · ")}
              </div>
            )}
            {data.bio && (
              <p className="mt-1.5 max-w-xs text-xs text-foreground-muted">{data.bio}</p>
            )}
          </div>
        </div>

        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-white p-1.5">
          {data.qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.qrDataUrl} alt="NDY Passport QR code" width={72} height={72} />
          ) : (
            <span className="text-[9px] text-black/40">Generating…</span>
          )}
        </div>
      </div>

      {(hasContactRow || hasSocials) && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <div className="space-y-1 text-xs text-foreground-muted">
            {data.country && <div>{data.country}</div>}
            {data.website && (
              <a
                href={data.website}
                target="_blank"
                rel="noreferrer"
                className="block hover:text-foreground"
              >
                {data.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            {data.email && <div>{data.email}</div>}
            {data.phone && <div>{data.phone}</div>}
          </div>

          {hasSocials && (
            <div className="flex items-center gap-2">
              {data.linkedinUrl && (
                <a
                  href={data.linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="LinkedIn"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-border p-1.5 text-foreground-muted hover:text-foreground"
                >
                  <SocialIcon kind="linkedin" />
                </a>
              )}
              {data.instagramUrl && (
                <a
                  href={data.instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Instagram"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-border p-1.5 text-foreground-muted hover:text-foreground"
                >
                  <SocialIcon kind="instagram" />
                </a>
              )}
              {data.xUrl && (
                <a
                  href={data.xUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="X / Twitter"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-border p-1.5 text-foreground-muted hover:text-foreground"
                >
                  <SocialIcon kind="x" />
                </a>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-[10px] text-foreground-muted">
        <span className="font-mono">{data.ndyId}</span>
      </div>
    </div>
  );
}
