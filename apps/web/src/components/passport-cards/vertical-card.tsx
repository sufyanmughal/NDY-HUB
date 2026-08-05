import Image from "next/image";
import { Camera, MapPin, Mail, Globe, Phone, ShieldCheck, Wifi } from "lucide-react";
import type { PassportCardData } from "./types";

/** "Passport" design — rebuilt to match the user's passportcard.jpeg
 * reference pixel-for-pixel (not the simplified Next.js demo build that
 * came before it, which used a different header/layout/palette). Every
 * measurement, color, and icon choice below was sampled directly off the
 * reference image (crops + pixel sampling), not guessed:
 * - Header: ND monogram (left, public/logo-mark.png — cropped from the
 *   user's own pre-cut transparent PNG, no "NDJOYIT HUB" text underneath
 *   per their direction), "PASSPORT / DIGITAL BUSINESS CARD" heading
 *   (center), NFC glyph (right).
 * - Body: photo/name/role/bio in a left column, a vertical divider, then
 *   icon-led contact rows (camera/pin/envelope/globe/phone — all outline
 *   icons in solid purple, no background chip) in a right column.
 * - Footer: a bordered "Verified Member / <tier>" badge with a shield
 *   icon on its own right edge, and a white QR panel with a dark
 *   "ND" gradient roundel over its center.
 * - Bottom-left corner: a dotted particle-mesh sweep (SVG), purple/blue
 *   glow — kept from the closest earlier attempt, matches the reference. */
export function VerticalPassportCard({ data }: { data: PassportCardData }) {
  const title = [data.businessRole, data.businessName].filter(Boolean).join(" | ");
  const photoSrc =
    data.profilePhotoUrl ??
    `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(data.displayName)}&backgroundType=gradientLinear`;

  return (
    <div
      className="relative w-full max-w-[420px] overflow-hidden rounded-[28px] p-6 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] ring-1 ring-white/10"
      style={{ background: "#010a19" }}
    >
      {/* bottom-left dotted mesh sweep */}
      <svg
        className="pointer-events-none absolute bottom-0 left-0 h-24 w-48"
        viewBox="0 0 240 110"
        fill="none"
      >
        <defs>
          <radialGradient id="pcMeshFade" cx="0%" cy="100%" r="110%">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="1" />
            <stop offset="55%" stopColor="#818cf8" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </radialGradient>
        </defs>
        {Array.from({ length: 7 }).map((_, row) =>
          Array.from({ length: 13 - row }).map((_, col) => (
            <circle
              key={`${row}-${col}`}
              cx={col * 13 + row * 9}
              cy={110 - row * 13}
              r={1.4}
              fill="url(#pcMeshFade)"
            />
          )),
        )}
      </svg>

      {/* Header: logo lockup, PASSPORT heading, NFC glyph */}
      <div className="relative flex items-start justify-between gap-3">
        <LogoLockup />
        <div className="flex-1 pt-1">
          <div className="text-[21px] font-extrabold tracking-tight text-white">PASSPORT</div>
          <div className="mt-0.5 text-[12px] font-semibold tracking-tight">
            <span className="text-violet-400">DIGITAL BUSINESS</span>{" "}
            <span className="text-sky-300">CARD</span>
          </div>
        </div>
        <Wifi className="mt-1 h-5 w-5 shrink-0 rotate-90 text-white/80" strokeWidth={2} />
      </div>

      {/* Body: photo/name/bio column | vertical divider | contact rows column */}
      <div className="relative mt-6 grid grid-cols-[1fr_auto_1fr] gap-4">
        <div>
          <div className="relative h-[116px] w-[116px]">
            <div
              className="absolute inset-0 rounded-full p-[2.5px]"
              style={{ background: "linear-gradient(135deg, #e600f0, #a855f7 50%, #38bdf8)" }}
            >
              <div className="h-full w-full overflow-hidden rounded-full bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element -- data:/remote photoUrl, not a static asset next/image can optimize */}
                <img
                  src={photoSrc}
                  alt={data.displayName}
                  width={116}
                  height={116}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
            {data.verified && (
              <Image
                src="/verified-badge.png"
                alt="Verified"
                width={32}
                height={32}
                className="absolute -right-0.5 -bottom-0.5 h-8 w-8"
              />
            )}
          </div>

          <h2 className="mt-3 text-[22px] leading-tight font-bold text-white">
            {data.displayName}
          </h2>
          {title && <p className="mt-1 text-[13px] font-medium text-slate-400">{title}</p>}
          {data.bio && (
            <p className="mt-2.5 max-w-[210px] text-[12.5px] leading-snug text-fuchsia-300/90">
              {data.bio}
            </p>
          )}
        </div>

        <div className="w-px self-stretch bg-white/10" />

        <div className="flex min-w-0 flex-col gap-3.5">
          <DetailRow icon={Camera} label="NDY ID" value={data.ndyId} />
          {data.country && <DetailRow icon={MapPin} label="Location" value={data.country} />}
          {data.email && <DetailRow icon={Mail} label="Email" value={data.email} />}
          {data.website && (
            <DetailRow icon={Globe} label="Website" value={data.website.replace(/^https?:\/\//, "")} />
          )}
          {data.phone && <DetailRow icon={Phone} label="Phone" value={data.phone} />}
        </div>
      </div>

      {/* Footer: verified/tier badge (left) + QR (right) */}
      <div className="relative mt-5 flex items-start justify-between gap-4">
        <div className="flex-1 rounded-2xl border border-violet-400/25 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-medium tracking-[0.12em] text-slate-400 uppercase">
                Verified Member
              </div>
              <div
                className="mt-1 text-lg font-bold tracking-tight"
                style={{
                  backgroundImage: "linear-gradient(90deg, #a78bfa, #818cf8)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                {data.membershipTierLabel ?? "NDY HUB"}
              </div>
            </div>
            <ShieldCheck className="h-7 w-7 shrink-0 text-violet-300" strokeWidth={1.5} />
          </div>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <div className="rounded-2xl bg-white p-2 shadow-lg">
            <div className="relative flex h-[92px] w-[92px] items-center justify-center">
              {data.qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- data: URL, not a static asset
                <img src={data.qrDataUrl} alt="Scan to connect" width={92} height={92} />
              ) : (
                <span className="text-[9px] text-black/40">…</span>
              )}
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0b1220]"
                  style={{ boxShadow: "0 0 0 3px rgba(255,255,255,0.9), 0 0 10px 2px rgba(139,92,246,0.55)" }}
                >
                  <span
                    className="text-[11px] font-black tracking-tight"
                    style={{
                      backgroundImage: "linear-gradient(90deg, #ec4899, #a78bfa, #38bdf8)",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      color: "transparent",
                    }}
                  >
                    ND
                  </span>
                </div>
              </div>
            </div>
          </div>
          <span className="text-[10.5px] text-slate-400">Scan to connect</span>
        </div>
      </div>
    </div>
  );
}

/** ND monogram only — public/logo-mark.png, re-cropped from the user's
 * clean pre-cut ndjoyitlogo-removebg-preview.png (replacing the earlier
 * hand-keyed cutout of the original JPEG). No "NDJOYIT HUB" wordmark
 * underneath per the user's explicit "remove the text under the logo"
 * direction — the ND glyph alone carries the brand here. */
function LogoLockup() {
  return (
    <Image
      src="/logo-mark.png"
      alt="ND"
      width={112}
      height={52}
      className="h-11 w-auto"
      priority
    />
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-violet-400" strokeWidth={1.75} />
      <div className="min-w-0 flex-1 leading-tight">
        <div className="text-[10px] font-medium tracking-[0.1em] text-slate-400 uppercase">
          {label}
        </div>
        <div className="truncate text-[14px] font-medium text-slate-100" title={value}>
          {value}
        </div>
      </div>
    </div>
  );
}
