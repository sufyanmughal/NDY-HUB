import { Avatar } from "@/components/avatar";
import type { PassportCardData } from "./types";

/** "NDY Passport" design — the original vertical layout, matching the
 * mockup's phone-screen "My NDY Passport" view. Default design. */
export function VerticalPassportCard({ data }: { data: PassportCardData }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface p-6 text-center">
      <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
        NDY Passport
      </div>

      <div className="mx-auto mt-6">
        <Avatar
          photoUrl={data.profilePhotoUrl}
          name={data.displayName}
          size={128}
          className="mx-auto text-4xl ring-4 ring-surface-2 shadow-lg"
        />
      </div>

      <div className="mt-4 text-lg font-semibold">{data.displayName}</div>
      {(data.businessRole || data.businessName) && (
        <div className="mt-1 text-sm text-foreground-muted">
          {[data.businessRole, data.businessName].filter(Boolean).join(" · ")}
        </div>
      )}

      <div className="mt-3 text-[10px] uppercase tracking-widest text-foreground-muted">
        NDY ID
      </div>
      <div className="font-mono text-sm">{data.ndyId}</div>

      <div className="mx-auto mt-4 flex h-[180px] w-[180px] items-center justify-center rounded-lg bg-white p-2">
        {data.qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.qrDataUrl}
            alt="NDY Passport verification QR code"
            width={164}
            height={164}
          />
        ) : (
          <span className="text-xs text-black/40">Generating…</span>
        )}
      </div>

      <div className="mt-4">
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
            data.verified ? "bg-good/15 text-good" : "bg-critical/15 text-critical"
          }`}
        >
          {data.verified ? "Verified" : "Not Verified"}
        </span>
      </div>
    </div>
  );
}
