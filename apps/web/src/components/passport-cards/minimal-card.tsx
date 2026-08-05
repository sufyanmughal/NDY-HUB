import { Avatar } from "@/components/avatar";
import type { PassportCardData } from "./types";

/** "Minimal Dark" design — stripped-back, high-contrast, no detail rows.
 * Just identity + QR, for a cleaner share-first look. */
export function MinimalPassportCard({ data }: { data: PassportCardData }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-background p-6">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold tracking-tight">
          NDY <span className="text-accent">HUB</span>
        </span>
        <span
          className={`h-2 w-2 rounded-full ${data.verified ? "bg-good" : "bg-foreground-muted/40"}`}
          title={data.verified ? "Verified" : "Not Verified"}
        />
      </div>

      <div className="mt-8 flex items-center gap-4">
        <Avatar
          photoUrl={data.profilePhotoUrl}
          name={data.displayName}
          size={56}
          className="text-lg"
        />
        <div>
          <div className="text-lg font-semibold leading-tight">{data.displayName}</div>
          <div className="font-mono text-xs text-foreground-muted">{data.ndyId}</div>
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

      <div className="mt-6 text-center text-[10px] uppercase tracking-widest text-foreground-muted">
        One Identity. One Passport. One Ecosystem.
      </div>
    </div>
  );
}
