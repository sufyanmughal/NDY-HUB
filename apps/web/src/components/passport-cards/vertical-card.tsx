import { IdCard, MapPin, Mail, Globe, Phone, ShieldCheck, Wifi, BadgeCheck } from "lucide-react";
import type { PassportCardData } from "./types";

/** "Passport" design — ported verbatim (same Tailwind classes, same
 * gradients, same layout) from the user's own hand-built reference
 * implementation at C:\Users\n8n\projects\ndy-passport-card
 * (app/components/PassportCard.tsx), which is itself a pixel-accurate
 * build of their passportcard.jpeg mockup. Only the data plumbing
 * changed: their standalone `photoUrl`/`qrValue`/`tier` props are now
 * pulled from the shared PassportCardData shape so this renders real
 * account data on both the dashboard self-view (shows email/phone) and
 * the public /passport/[ndyId] page (doesn't — see PassportCardData's
 * doc comments on those two fields). The reference used next/image +
 * qrcode.react; this uses a plain <img> for the photo (Avatar's
 * initials-fallback isn't used here since the reference always shows a
 * photo — an accountless placeholder image below covers that case
 * instead) and the data: URL PNG this app's `qrcode` package already
 * produces everywhere else, rather than adding qrcode.react as a second
 * QR dependency for one design. */
export function VerticalPassportCard({ data }: { data: PassportCardData }) {
  const title = [data.businessRole, data.businessName].filter(Boolean).join(" | ");
  const photoSrc =
    data.profilePhotoUrl ??
    `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(data.displayName)}&backgroundType=gradientLinear`;

  return (
    <div
      className="relative w-full max-w-[420px] overflow-hidden rounded-[28px] p-6 shadow-[0_25px_60px_-15px_rgba(79,70,229,0.45)] ring-1 ring-white/10"
      style={{
        background:
          "radial-gradient(120% 140% at 100% 0%, #171335 0%, #0a0a17 45%, #050509 100%)",
      }}
    >
      {/* decorative bottom-left glow / mesh */}
      <div
        className="pointer-events-none absolute -bottom-16 -left-20 h-56 w-72 rotate-[8deg] opacity-70"
        style={{
          background:
            "radial-gradient(closest-side, rgba(99,102,241,0.45), transparent 70%)",
          filter: "blur(4px)",
        }}
      />
      <svg
        className="pointer-events-none absolute bottom-0 left-0 h-40 w-64 opacity-50"
        viewBox="0 0 300 160"
        fill="none"
      >
        <defs>
          <linearGradient id="meshFade" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
          </linearGradient>
        </defs>
        {Array.from({ length: 8 }).map((_, i) => (
          <path
            key={i}
            d={`M -20 ${160 - i * 14} Q 100 ${140 - i * 18} 300 ${20 - i * 6}`}
            stroke="url(#meshFade)"
            strokeWidth="0.6"
          />
        ))}
      </svg>

      {/* Header */}
      <div className="relative flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="text-2xl font-black tracking-tight"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, #818cf8, #a78bfa, #6366f1)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              NDY
            </span>
            <span className="text-2xl font-bold tracking-tight text-white">
              PASSPORT
            </span>
          </div>
          <div className="mt-1 text-[11px] font-medium tracking-[0.18em] text-slate-400 uppercase">
            Digital Business Card
          </div>
        </div>
        <Wifi className="h-6 w-6 rotate-90 text-white/90" strokeWidth={2} />
      </div>

      {/* Body: photo/name column + details column */}
      <div className="relative mt-6 grid grid-cols-[auto_1fr] gap-5">
        <div>
          <div className="relative h-[104px] w-[104px]">
            <div
              className="absolute inset-0 rounded-full p-[2px]"
              style={{
                background:
                  "linear-gradient(135deg, #818cf8, #a78bfa, #38bdf8)",
              }}
            >
              <div className="h-full w-full overflow-hidden rounded-full bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element -- data:/remote photoUrl, not a static asset next/image can optimize */}
                <img
                  src={photoSrc}
                  alt={data.displayName}
                  width={104}
                  height={104}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
            {data.verified && (
              <div className="absolute -right-1 -bottom-1 flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500 ring-4 ring-[#0a0a17]">
                <BadgeCheck className="h-4 w-4 text-white" strokeWidth={2.5} />
              </div>
            )}
          </div>

          <h2 className="mt-4 text-[26px] leading-tight font-bold text-white">
            {data.displayName}
          </h2>
          {title && (
            <p className="mt-1 text-sm font-medium whitespace-nowrap text-indigo-200/90">
              {title}
            </p>
          )}
          {data.bio && (
            <p className="mt-3 max-w-[220px] text-[13px] leading-snug text-slate-400">
              {data.bio}
            </p>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4 pt-1">
          <DetailRow icon={IdCard} label="NDY ID" value={data.ndyId} />
          {data.country && <DetailRow icon={MapPin} label="Location" value={data.country} />}
          {data.email && <DetailRow icon={Mail} label="Email" value={data.email} />}
          {data.website && (
            <DetailRow icon={Globe} label="Website" value={data.website.replace(/^https?:\/\//, "")} />
          )}
          {data.phone && <DetailRow icon={Phone} label="Phone" value={data.phone} />}
        </div>
      </div>

      {/* Footer: verified member + QR */}
      <div className="relative mt-6 flex items-end justify-between gap-4">
        <div className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5 backdrop-blur-sm">
          <div className="text-[10px] font-medium tracking-[0.14em] text-slate-400 uppercase">
            {data.verified ? "Verified Member" : "Not Verified"}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span
              className="text-xl font-bold tracking-tight"
              style={{
                backgroundImage: "linear-gradient(90deg, #a78bfa, #818cf8)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              {data.membershipTierLabel ?? "NDY HUB"}
            </span>
            <ShieldCheck className="h-5 w-5 text-indigo-300" strokeWidth={1.75} />
          </div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="rounded-xl bg-white p-2.5 shadow-lg">
            <div className="relative flex h-[104px] w-[104px] items-center justify-center">
              {data.qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- data: URL, not a static asset
                <img src={data.qrDataUrl} alt="Scan to connect" width={104} height={104} />
              ) : (
                <span className="text-[9px] text-black/40">…</span>
              )}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white ring-2 ring-white">
                  <span
                    className="text-[10px] font-black tracking-tight"
                    style={{
                      backgroundImage:
                        "linear-gradient(90deg, #6366f1, #a78bfa)",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      color: "transparent",
                    }}
                  >
                    NDY
                  </span>
                </div>
              </div>
            </div>
          </div>
          <span className="text-[11px] text-slate-400">Scan to connect</span>
        </div>
      </div>
    </div>
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
    <div className="flex min-w-0 items-start gap-3">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-indigo-300" strokeWidth={1.75} />
      <div className="min-w-0 flex-1 leading-tight">
        <div className="text-[10px] font-medium tracking-[0.14em] text-slate-400 uppercase">
          {label}
        </div>
        <div className="truncate text-[15px] font-medium text-slate-100" title={value}>
          {value}
        </div>
      </div>
    </div>
  );
}
