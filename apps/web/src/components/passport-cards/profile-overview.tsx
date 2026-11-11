"use client";

import Link from "next/link";
import {
  BadgeCheck,
  ChevronRight,
  CreditCard,
  Database,
  ShieldCheck,
  SlidersHorizontal,
  User,
  type LucideIcon,
} from "lucide-react";

interface OverviewRow {
  icon: LucideIcon;
  label: string;
  href?: string;
  disabledReason?: string;
}

/** New "Profile Overview" section (2026-11 Figma handoff, passport-profile-
 * mockup.png in .figma-reference/, not committed) — sits below the vertical
 * NDY Passport card on the authenticated /passport dashboard page only (the
 * public /passport/[ndyId] view has no self-service settings to link to).
 *
 * Each row routes to the most honest real destination already in this app
 * rather than a new page built just for this list:
 *  - Personal Information -> Settings' own Profile form (name/bio/country/
 *    website/phone/socials — settings/page.tsx's ProfileForm).
 *  - Security -> the Security page (sessions/devices/connected sites).
 *  - Identity & Trust -> Security's own "Identity Verification (LEVEL_3)"
 *    section specifically (anchor-scrolled), since that section already
 *    covers exactly this.
 *  - Payment Methods -> there is no card/billing-method management page in
 *    this app. Memberships is the closest honest match (it's where the real
 *    Stripe checkout flow and billing history live), so it links there
 *    instead of a dedicated page that doesn't exist.
 *  - Preferences -> genuinely nothing real exists yet (Settings' own header
 *    copy says as much: "Notification preferences... land in a later
 *    milestone") — rendered disabled with an explanatory title, same
 *    disabled+tooltip convention as components/ndy-economy/ActionTile.tsx,
 *    instead of linking to a page that wouldn't do anything.
 *  - Privacy & Data -> Settings' "Data & Privacy" section (GDPR export +
 *    delete account), anchor-scrolled.
 */
const ROWS: OverviewRow[] = [
  { icon: User, label: "Personal Information", href: "/settings#personal-information" },
  { icon: ShieldCheck, label: "Security", href: "/security" },
  { icon: BadgeCheck, label: "Identity & Trust", href: "/security#identity-verification" },
  {
    icon: CreditCard,
    label: "Payment Methods",
    href: "/memberships/manage",
  },
  {
    icon: SlidersHorizontal,
    label: "Preferences",
    disabledReason: "Notification and app preferences aren't built yet — on the roadmap.",
  },
  { icon: Database, label: "Privacy & Data", href: "/settings#data-privacy" },
];

export function ProfileOverview() {
  return (
    <div className="mt-6">
      <h2 className="mb-3 text-lg font-semibold">Profile Overview</h2>
      <div className="overflow-hidden rounded-xl border border-border">
        {ROWS.map((row, i) => (
          <OverviewItem key={row.label} row={row} isLast={i === ROWS.length - 1} />
        ))}
      </div>
    </div>
  );
}

function OverviewItem({ row, isLast }: { row: OverviewRow; isLast: boolean }) {
  const content = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-foreground-muted">
        <row.icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <span className="flex-1 text-sm font-medium">{row.label}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-violet-400" strokeWidth={2} />
    </>
  );

  const rowClassName = `flex items-center gap-3 px-4 py-3.5 ${!isLast ? "border-b border-border" : ""}`;

  if (!row.href) {
    return (
      <button
        type="button"
        disabled
        title={row.disabledReason}
        aria-label={row.disabledReason ? `${row.label} — ${row.disabledReason}` : row.label}
        className={`${rowClassName} w-full cursor-not-allowed text-left opacity-50`}
      >
        {content}
      </button>
    );
  }

  return (
    <Link href={row.href} className={`${rowClassName} hover:bg-surface-2`}>
      {content}
    </Link>
  );
}
