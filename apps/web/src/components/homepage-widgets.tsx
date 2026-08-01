import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Sparkle,
  MessageCircle,
  Plane,
  Building2,
  Gamepad2,
  Coins,
  ShieldCheck,
  Gem,
} from "lucide-react";

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

export const CARD_COLORS: Record<
  string,
  { border: string; ring: string; icon: string; iconRing: string; glow: string; button: string }
> = {
  violet: {
    border: "border-violet-500/30",
    ring: "hover:ring-1 hover:ring-violet-500/40",
    icon: "text-violet-400",
    iconRing: "border-violet-500/50",
    glow: "shadow-[0_0_20px_-4px_rgba(139,92,246,0.5)]",
    button: "text-violet-400 hover:text-violet-300",
  },
  blue: {
    border: "border-blue-500/30",
    ring: "hover:ring-1 hover:ring-blue-500/40",
    icon: "text-blue-400",
    iconRing: "border-blue-500/50",
    glow: "shadow-[0_0_20px_-4px_rgba(59,130,246,0.5)]",
    button: "text-blue-400 hover:text-blue-300",
  },
  emerald: {
    border: "border-emerald-500/30",
    ring: "hover:ring-1 hover:ring-emerald-500/40",
    icon: "text-emerald-400",
    iconRing: "border-emerald-500/50",
    glow: "shadow-[0_0_20px_-4px_rgba(16,185,129,0.5)]",
    button: "text-emerald-400 hover:text-emerald-300",
  },
  amber: {
    border: "border-amber-500/30",
    ring: "hover:ring-1 hover:ring-amber-500/40",
    icon: "text-amber-400",
    iconRing: "border-amber-500/50",
    glow: "shadow-[0_0_20px_-4px_rgba(245,158,11,0.5)]",
    button: "text-amber-400 hover:text-amber-300",
  },
  cyan: {
    border: "border-cyan-500/30",
    ring: "hover:ring-1 hover:ring-cyan-500/40",
    icon: "text-cyan-400",
    iconRing: "border-cyan-500/50",
    glow: "shadow-[0_0_20px_-4px_rgba(34,211,238,0.5)]",
    button: "text-cyan-400 hover:text-cyan-300",
  },
  pink: {
    border: "border-pink-500/30",
    ring: "hover:ring-1 hover:ring-pink-500/40",
    icon: "text-pink-400",
    iconRing: "border-pink-500/50",
    glow: "shadow-[0_0_20px_-4px_rgba(236,72,153,0.5)]",
    button: "text-pink-400 hover:text-pink-300",
  },
};

export function LauncherCardView({ card }: { card: LauncherCard }) {
  const colors = CARD_COLORS[card.color];
  const Icon = card.icon;

  const inner = (
    <div
      className={`h-full rounded-xl border bg-surface/60 p-6 text-center backdrop-blur-sm transition ${
        card.comingSoon ? "border-border opacity-60" : `${colors.border} ${colors.ring}`
      }`}
    >
      <div
        className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 bg-background ${
          card.comingSoon ? "border-border text-foreground-muted" : `${colors.iconRing} ${colors.icon} ${colors.glow}`
        }`}
      >
        <Icon size={24} strokeWidth={2} />
      </div>
      <div className="mt-4 font-semibold">{card.title}</div>
      <p className="mt-1 text-xs text-foreground-muted">{card.description}</p>
      <div
        className={`mt-4 inline-flex items-center gap-1 text-xs font-semibold ${
          card.comingSoon ? "text-foreground-muted" : colors.button
        }`}
      >
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

export function EcosystemStatsRow({
  items,
}: {
  items: { label: string; value: number | undefined; icon: LucideIcon; color: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-5 rounded-xl border border-border bg-surface/60 p-5 backdrop-blur-sm sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => {
        const colors = CARD_COLORS[item.color];
        const Icon = item.icon;
        return (
          <div key={item.label} className="flex items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background ${colors.icon}`}>
              <Icon size={18} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <div className="font-mono text-lg font-semibold tabular-nums">
                {item.value === undefined ? "…" : item.value.toLocaleString()}
              </div>
              <div className="text-xs leading-tight text-foreground-muted">{item.label}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const ECOSYSTEM_ITEMS: {
  label: string;
  sub: string;
  icon: LucideIcon;
  bg: string;
  href?: string;
  comingSoon?: boolean;
}[] = [
  { label: "NDJOYIT", sub: "Lifestyle Platform", icon: Sparkle, bg: "bg-emerald-500 text-white" },
  { label: "NDYAPPS", sub: "Smart Messaging", icon: MessageCircle, bg: "bg-blue-500 text-white", comingSoon: true },
  { label: "NDYSTAYS", sub: "Travel & Stays", icon: Plane, bg: "bg-pink-500 text-white", comingSoon: true },
  { label: "NDYXTRA", sub: "AI Marketplace", icon: Building2, bg: "bg-orange-500 text-white", comingSoon: true },
  { label: "NDYQUIZ", sub: "Learn · Play · Earn", icon: Gamepad2, bg: "bg-violet-500 text-white", comingSoon: true },
  { label: "CRYNDY", sub: "Community Token", icon: Coins, bg: "bg-purple-500 text-white", href: "/cryndy" },
  { label: "NDYNEX", sub: "Crypto & Bitcoin", icon: ShieldCheck, bg: "bg-amber-500 text-white", comingSoon: true },
  { label: "NDYCOLLECT", sub: "Collectibles", icon: Gem, bg: "bg-cyan-500 text-white", comingSoon: true },
];

export function EcosystemBadge({
  label,
  sub,
  icon: Icon,
  bg,
  href,
  comingSoon,
}: {
  label: string;
  sub: string;
  icon: LucideIcon;
  bg: string;
  href?: string;
  comingSoon?: boolean;
}) {
  const content = (
    <div
      className={`flex items-center gap-2.5 rounded-lg border border-border bg-surface p-3 ${
        comingSoon ? "opacity-50" : "hover:bg-surface-2"
      }`}
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${bg}`}>
        <Icon size={16} strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs font-semibold">{label}</div>
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
        {ECOSYSTEM_ITEMS.map((item) => (
          <EcosystemBadge key={item.label} {...item} />
        ))}
      </div>
    </div>
  );
}

/** Full-bleed hero — no border/box, a radial glow evoking a planet horizon
 * against dark space instead of the mockup's literal photo (no image asset
 * available), content centered on top. Meant to be rendered outside any
 * padded container so it can span edge to edge. */
export function EcosystemHero({ eyebrow = "Welcome to NDY HUB" }: { eyebrow?: string }) {
  return (
    <div className="relative overflow-hidden px-6 pb-16 pt-14 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-1/4 top-1/3 h-[36rem] w-[36rem] rounded-full bg-blue-600/25 blur-[100px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 h-96 w-96 rounded-full bg-violet-600/20 blur-[100px]"
      />
      <p className="relative text-xs font-semibold uppercase tracking-widest text-accent-2">{eyebrow}</p>
      <h1 className="relative mt-3 text-4xl font-bold sm:text-5xl">
        One Identity. One Passport.{" "}
        <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">
          One Ecosystem.
        </span>
      </h1>
      <p className="relative mx-auto mt-4 max-w-2xl text-sm text-foreground-muted sm:text-base">
        NDY HUB is your central gateway to everything in the NDJOYIT ecosystem — manage your
        identity, connect platforms, and help build a global ecosystem.
      </p>
    </div>
  );
}
