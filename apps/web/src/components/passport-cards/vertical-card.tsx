import { Wifi, Fingerprint, MapPin, Mail, Globe, ShieldCheck } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { BrandMark } from "@/components/logo";
import type { PassportCardData } from "./types";
import "@/styles/passport-card.css";

/** "Passport" design — a pixel-accurate clone of the user's reference
 * mockup (passportcard.jpeg): dark card, ND wordmark + "PASSPORT / Digital
 * Business Card" header with an NFC glyph, photo+name+role+bio on the
 * left, icon-led contact rows on the right, and a footer row pairing a
 * "Verified Member / <tier>" badge with a scannable QR. Rendered
 * identically on the authenticated dashboard (self-view, shows email) and
 * the public /passport/[ndyId] page (no email, no tier — see
 * PassportCardData.membershipTierLabel's doc comment). */
export function VerticalPassportCard({ data }: { data: PassportCardData }) {
  const roleLine = [data.businessRole, data.businessName].filter(Boolean).join(" | ");

  return (
    <div className="ndy-passport-card">
      <div className="pc-top">
        <div className="pc-brand">
          <BrandMark size={44} />
        </div>
        <div className="pc-heading">
          <p className="pc-heading-title">PASSPORT</p>
          <p className="pc-heading-sub">Digital Business Card</p>
        </div>
      </div>
      <Wifi size={20} strokeWidth={1.6} className="pc-nfc" style={{ position: "absolute", top: 26, right: 24 }} />

      <hr className="pc-divider" />

      <div className="pc-body">
        {/* left: identity */}
        <div>
          <div className="pc-avatar-wrap">
            <Avatar
              photoUrl={data.profilePhotoUrl}
              name={data.displayName}
              size={84}
              className="text-2xl"
            />
            {data.verified && (
              <span className="pc-verified-dot">
                <ShieldCheck size={12} strokeWidth={2.4} />
              </span>
            )}
          </div>

          <h3 className="pc-name">{data.displayName}</h3>
          {roleLine && <p className="pc-role">{roleLine}</p>}
          {data.bio && <p className="pc-bio">{data.bio}</p>}
        </div>

        {/* right: icon-led contact rows */}
        <div className="pc-info-list">
          <InfoRow icon={<Fingerprint />} label="NDY ID" value={data.ndyId} />
          {data.country && <InfoRow icon={<MapPin />} label="Location" value={data.country} />}
          {data.email && <InfoRow icon={<Mail />} label="Email" value={data.email} />}
          {data.website && (
            <InfoRow
              icon={<Globe />}
              label="Website"
              value={
                <a href={data.website} target="_blank" rel="noreferrer">
                  {data.website.replace(/^https?:\/\//, "")}
                </a>
              }
            />
          )}
        </div>
      </div>

      <div className="pc-footer">
        <div className="pc-badge">
          <p className="pc-badge-label">{data.verified ? "Verified Member" : "Not Verified"}</p>
          <p className="pc-badge-value">{data.membershipTierLabel ?? "NDY HUB"}</p>
        </div>

        <div className="pc-qr-block">
          <div className="pc-qr-frame">
            {data.qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.qrDataUrl} alt="Scan to connect" width={74} height={74} />
            ) : (
              <span style={{ fontSize: 9, color: "rgba(0,0,0,0.4)" }}>…</span>
            )}
          </div>
          <p className="pc-qr-caption">Scan to connect</p>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="pc-info-row">
      <span className="pc-info-icon">{icon}</span>
      <div>
        <p className="pc-info-label">{label}</p>
        <p className="pc-info-value">{value}</p>
      </div>
    </div>
  );
}
