import { Globe } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { SocialIcon } from "@/components/social-icon";
import type { PassportCardData } from "./types";

/** "Business Card" design — horizontal layout matching the mockup's
 * "Digital Business Card Preview": photo + name + role/business on the
 * left, contact details below, QR on the right. */
export function BusinessPassportCard({ data }: { data: PassportCardData }) {
  const hasContactRow =
    data.country || data.website || data.email || data.phone;
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
              <p className="mt-1.5 max-w-xs text-xs text-foreground-muted">
                {data.bio}
              </p>
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
        <span className="flex items-center gap-1">
          <Globe size={11} strokeWidth={2} />
          NDY HUB
        </span>
      </div>
    </div>
  );
}
