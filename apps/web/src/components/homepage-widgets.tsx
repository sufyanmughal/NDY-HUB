import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/** Shared between the public landing page (app/page.tsx) and the
 * authenticated dashboard home ((dashboard)/dashboard/page.tsx) — same
 * visual language, different card destinations depending on whether
 * there's a session yet. */

export interface LauncherCard {
  href: string;
  external?: boolean;
  icon: LucideIcon;
  color: string;
  title: string;
  description: string;
  comingSoon?: boolean;
}

export const CARD_COLOR_CLASSES: Record<string, { ring: string; icon: string; button: string }> = {
  violet: { ring: "ring-violet-500/30", icon: "bg-violet-500/15 text-violet-400", button: "text-violet-400 hover:text-violet-300" },
  blue: { ring: "ring-blue-500/30", icon: "bg-blue-500/15 text-blue-400", button: "text-blue-400 hover:text-blue-300" },
  emerald: { ring: "ring-emerald-500/30", icon: "bg-emerald-500/15 text-emerald-400", button: "text-emerald-400 hover:text-emerald-300" },
  amber: { ring: "ring-amber-500/30", icon: "bg-amber-500/15 text-amber-400", button: "text-amber-400 hover:text-amber-300" },
  cyan: { ring: "ring-cyan-500/30", icon: "bg-cyan-500/15 text-cyan-400", button: "text-cyan-400 hover:text-cyan-300" },
  pink: { ring: "ring-pink-500/30", icon: "bg-pink-500/15 text-pink-400", button: "text-pink-400 hover:text-pink-300" },
};

export function LauncherCardView({ card }: { card: LauncherCard }) {
  const colors = CARD_COLOR_CLASSES[card.color];
  const Icon = card.icon;

  const inner = (
    <div
      className={`h-full rounded-lg border border-border bg-surface p-5 text-center transition ${
        card.comingSoon ? "opacity-60" : `hover:ring-1 ${colors.ring}`
      }`}
    >
      <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${colors.icon}`}>
        <Icon size={22} strokeWidth={2} />
      </div>
      <div className="mt-3 font-medium">{card.title}</div>
      <p className="mt-1 text-xs text-foreground-muted">{card.description}</p>
      <div className={`mt-3 inline-flex items-center gap-1 text-xs font-medium ${card.comingSoon ? "text-foreground-muted" : colors.button}`}>
        {card.comingSoon ? "Coming soon" : "Go to →"}
      </div>
    </div>
  );

  if (card.comingSoon) return inner;
  if (card.external) {
    return (
      <a href={card.href} target="_blank" rel="noreferrer">
        {inner}
      </a>
    );
  }
  return <Link href={card.href}>{inner}</Link>;
}

export function EcosystemStatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | undefined;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-foreground-muted">{label}</div>
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-accent">
          <Icon size={14} strokeWidth={2} />
        </div>
      </div>
      <div className="mt-2 font-mono text-lg font-semibold tabular-nums">
        {value === undefined ? "…" : value.toLocaleString()}
      </div>
    </div>
  );
}

export function EcosystemBadge({
  label,
  sub,
  color,
  href,
  comingSoon,
}: {
  label: string;
  sub: string;
  color: string;
  href?: string;
  comingSoon?: boolean;
}) {
  const content = (
    <div className={`flex items-center gap-2 rounded-lg border border-border bg-surface p-3 ${comingSoon ? "opacity-50" : "hover:bg-surface-2"}`}>
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${color}`}>
        {label[0]}
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs font-medium">{label}</div>
        <div className="truncate text-[11px] text-foreground-muted">{sub}</div>
      </div>
    </div>
  );

  if (href && !comingSoon) return <Link href={href}>{content}</Link>;
  return content;
}

export function EcosystemDirectory() {
  return (
    <div>
      <h2 className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-accent-2">
        NDJOYIT Ecosystem
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <EcosystemBadge label="NDJOYIT" sub="Lifestyle Platform" color="bg-emerald-500/15 text-emerald-400" />
        <EcosystemBadge label="NDYAPPS" sub="Smart Messaging" color="bg-blue-500/15 text-blue-400" comingSoon />
        <EcosystemBadge label="NDYSTAYS" sub="Travel & Stays" color="bg-pink-500/15 text-pink-400" comingSoon />
        <EcosystemBadge label="NDYXTRA" sub="AI Marketplace" color="bg-orange-500/15 text-orange-400" comingSoon />
        <EcosystemBadge label="NDYQUIZ" sub="Learn · Play · Earn" color="bg-violet-500/15 text-violet-400" comingSoon />
        <EcosystemBadge label="CRYNDY" sub="Community Token" color="bg-purple-500/15 text-purple-400" href="/cryndy" />
        <EcosystemBadge label="NDYNEX" sub="Crypto & Bitcoin" color="bg-amber-500/15 text-amber-400" comingSoon />
        <EcosystemBadge label="NDYCOLLECT" sub="Collectibles" color="bg-cyan-500/15 text-cyan-400" comingSoon />
      </div>
    </div>
  );
}

export function EcosystemHero({ eyebrow = "Welcome to NDY HUB" }: { eyebrow?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-8 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent-2/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl"
      />
      <p className="relative text-xs font-semibold uppercase tracking-widest text-accent-2">{eyebrow}</p>
      <h1 className="relative mt-2 text-3xl font-semibold sm:text-4xl">
        One Identity. One Passport.{" "}
        <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">
          One Ecosystem.
        </span>
      </h1>
      <p className="relative mx-auto mt-3 max-w-2xl text-sm text-foreground-muted">
        NDY HUB is your central gateway to everything in the NDJOYIT ecosystem — manage your
        identity, connect platforms, and help build a global ecosystem.
      </p>
    </div>
  );
}
