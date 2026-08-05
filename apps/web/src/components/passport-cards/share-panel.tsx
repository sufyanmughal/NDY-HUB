"use client";

import { useState } from "react";
import { Link2, QrCode, Wifi, Wallet } from "lucide-react";

/** Matches the mockup's 2x2 "Share Your NDY Passport" tile grid. Share Link
 * and QR Code are real actions (native share sheet / clipboard, and
 * scrolling the QR into view respectively). NFC Card and Add to Wallet
 * aren't built yet — Wallet passes and NFC writing are both real
 * integrations with their own platform requirements, not something to fake
 * with a dead button — so they're disabled tiles with a clear reason
 * instead of pretending to work. */
export function SharePanel({
  publicUrl,
  onScrollToQr,
}: {
  publicUrl: string;
  onScrollToQr: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function handleShareLink() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "NDY Passport", url: publicUrl });
        return;
      } catch {
        /* user cancelled — fall through to copy */
      }
    }
    await navigator.clipboard.writeText(publicUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface p-5">
      <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
        Share Your NDY Passport
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          onClick={handleShareLink}
          className="flex flex-col items-center gap-2 rounded-lg border border-border px-3 py-4 text-xs font-medium hover:bg-surface-2"
        >
          <Link2 size={18} strokeWidth={2} />
          {copied ? "Link copied!" : "Share Link"}
        </button>
        <button
          onClick={onScrollToQr}
          className="flex flex-col items-center gap-2 rounded-lg border border-border px-3 py-4 text-xs font-medium hover:bg-surface-2"
        >
          <QrCode size={18} strokeWidth={2} />
          QR Code
        </button>
        <button
          disabled
          title="Physical NFC cards aren't available yet — see the NFC Card panel below."
          className="flex cursor-not-allowed flex-col items-center gap-2 rounded-lg border border-border px-3 py-4 text-xs font-medium text-foreground-muted opacity-50"
        >
          <Wifi size={18} strokeWidth={2} />
          NFC Card
        </button>
        <button
          disabled
          title="Apple Wallet / Google Wallet passes are on the roadmap."
          className="flex cursor-not-allowed flex-col items-center gap-2 rounded-lg border border-border px-3 py-4 text-xs font-medium text-foreground-muted opacity-50"
        >
          <Wallet size={18} strokeWidth={2} />
          Add to Wallet
        </button>
      </div>
    </div>
  );
}
