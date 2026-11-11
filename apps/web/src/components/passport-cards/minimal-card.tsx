"use client";

import { Download } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { LogoBadge, SILVER_GRADIENT } from "./shared";
import type { PassportCardData } from "./types";

/** "Minimal Dark" design — 2026-11 Figma handoff (minimal-dark-mockup.png in
 * .figma-reference/, not committed) added an external "NDY Passport /
 * Minimal Dark" header above the card, a thin metallic silver border ring
 * around the card (replacing the old plain border), and swapped the old
 * "NDY HUB" text wordmark for the new logo badge. "Download PDF" moves from
 * a generic header button (above the card, shared with the other two
 * designs) to its own full-width button directly below the card, matching
 * the mockup — still the exact same jsPDF export (lib/passport-pdf.ts),
 * just relocated. Email/phone stay as a compact single line — a business
 * card with no way to contact the person isn't useful even minimally. */
export function MinimalPassportCard({
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
  const contactLine = [data.email, data.phone].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto w-full max-w-[380px]">
      <div className="mb-3 text-center">
        <h2 className="text-xl font-bold text-white">NDY Passport</h2>
        <div className="mt-1.5 flex items-center justify-center gap-3">
          <span className="h-px w-8 bg-white/20" />
          <span className="text-sm text-slate-400">Minimal Dark</span>
          <span className="h-px w-8 bg-white/20" />
        </div>
      </div>

      <div className="rounded-2xl p-[1.5px]" style={{ background: SILVER_GRADIENT }}>
        <div className="rounded-[14px] bg-background p-6">
          <div className="flex items-center justify-between">
            <span
              className={`h-2 w-2 rounded-full ${data.verified ? "bg-good" : "bg-foreground-muted/40"}`}
              title={data.verified ? "Verified" : "Not Verified"}
            />
            <LogoBadge size={40} />
          </div>

          <div className="mt-8 flex items-center gap-4">
            <Avatar
              photoUrl={data.profilePhotoUrl}
              name={data.displayName}
              size={56}
              className="text-lg"
            />
            <div className="min-w-0">
              <div className="truncate text-lg font-semibold leading-tight">
                {data.displayName}
              </div>
              <div className="truncate font-mono text-xs text-foreground-muted">{data.ndyId}</div>
              {contactLine && (
                <div className="mt-0.5 truncate text-xs text-foreground-muted">{contactLine}</div>
              )}
            </div>
          </div>

          <div className="mx-auto mt-8 flex h-[150px] w-[150px] items-center justify-center rounded-lg bg-white p-2">
            {data.qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.qrDataUrl} alt="NDY Passport QR code" width={134} height={134} />
            ) : (
              <span className="text-xs text-black/40">Generating…</span>
            )}
          </div>
          <div className="mt-2 text-center text-xs text-foreground-muted">Scan to connect</div>

          <div className="mt-6 text-center text-[10px] uppercase tracking-widest text-foreground-muted">
            One Identity. One Passport. One Ecosystem.
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onDownloadPdf}
        disabled={downloadDisabled}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-semibold hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Download className="h-4 w-4" strokeWidth={2} />
        {downloadLabel}
      </button>
    </div>
  );
}
