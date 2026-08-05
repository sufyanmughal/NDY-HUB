"use client";

import { useState } from "react";
import { Wifi, Bell, BellOff } from "lucide-react";

const NOTIFY_KEY = "ndy-nfc-notify-interest";

/** The mockup shows an "NFC CARD (FUTURE)" tile — physical NFC cards aren't
 * built yet (no card ordering/fulfillment, no NFC write flow), so this
 * panel is honest about that instead of pretending a tap-to-connect flow
 * exists. It's still a real, working piece of UI: a visual preview of what
 * the physical card will look like (reusing the Minimal design, which is
 * closest to a printed card), and a genuine "notify me" preference —
 * stored locally since there's no backend field for it yet — rather than a
 * dead button. */
export function NfcPanel({ ndyId, displayName }: { ndyId: string; displayName: string }) {
  const [notify, setNotify] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(NOTIFY_KEY) === "1",
  );

  function toggleNotify() {
    const next = !notify;
    setNotify(next);
    localStorage.setItem(NOTIFY_KEY, next ? "1" : "0");
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
          NFC Card
        </div>
        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
          Coming soon
        </span>
      </div>

      <div className="mx-auto mt-5 flex aspect-[1.6/1] max-w-xs items-center justify-between rounded-xl border border-border/60 bg-background px-5">
        <div>
          <div className="text-sm font-semibold tracking-tight">
            NDY <span className="text-accent">HUB</span>
          </div>
          <div className="mt-1 text-[10px] text-foreground-muted">NDY PASSPORT</div>
        </div>
        <Wifi size={22} strokeWidth={1.5} className="rotate-90 text-foreground-muted" />
      </div>

      <p className="mt-4 text-sm text-foreground-muted">
        Tap-to-connect physical cards for {displayName.split(" ")[0] || "your"} NDY Passport
        (<span className="font-mono">{ndyId}</span>) are on the roadmap — the same public profile
        your QR code opens today will be what an NFC tap opens too, no new setup required once it
        ships.
      </p>

      <button
        onClick={toggleNotify}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface-2"
      >
        {notify ? <BellOff size={15} strokeWidth={2} /> : <Bell size={15} strokeWidth={2} />}
        {notify ? "We'll notify you — tap to cancel" : "Notify me when NFC cards launch"}
      </button>
    </div>
  );
}
