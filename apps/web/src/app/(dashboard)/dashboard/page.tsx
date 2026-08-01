"use client";

import {
  Lock,
  IdCard,
  Rocket,
  Shield,
  Code,
  Terminal,
  Users,
  UserPlus,
  Link2,
  Activity,
  Coins,
  Boxes,
  Bitcoin,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useEcosystemOverview } from "@/lib/use-ecosystem-overview";
import { useMe } from "@/lib/use-me";
import { Sparkline } from "@/components/sparkline";
import { API_BASE_URL } from "@/lib/api";
import {
  EcosystemHero,
  EcosystemDirectory,
  EcosystemStatsRow,
  LauncherCardView,
  type LauncherCard,
} from "@/components/homepage-widgets";

export default function DashboardPage() {
  const { auth } = useAuth();
  const me = useMe();
  const overview = useEcosystemOverview();
  if (auth.status !== "authenticated") return null;

  const cards: LauncherCard[] = [
    {
      href: "/security",
      icon: Lock,
      color: "violet",
      title: "Security",
      description: "Manage access and active sessions on your account.",
    },
    {
      href: "/passport",
      icon: IdCard,
      color: "blue",
      title: "NDY Passport",
      description: "View and manage your digital identity.",
    },
    ...(me?.role === "FOUNDER"
      ? [
          {
            href: "/founder",
            icon: Rocket,
            color: "emerald",
            title: "Founder Mission Control",
            description: "Exclusive command center for founders.",
          },
        ]
      : []),
    ...(me?.role === "ADMIN" || me?.role === "FOUNDER"
      ? [
          {
            href: "/admin",
            icon: Shield,
            color: "amber",
            title: "Admin Center",
            description: "Manage users, roles, and the platform.",
          },
        ]
      : []),
    {
      href: `${API_BASE_URL}/.well-known/openid-configuration`,
      external: true,
      icon: Code,
      color: "cyan",
      title: "API",
      description: "Live OIDC/OAuth discovery document and endpoints.",
    },
    {
      href: "#",
      icon: Terminal,
      color: "pink",
      title: "Developer Portal",
      description: "Docs, SDKs, and developer tools.",
      comingSoon: true,
    },
  ];

  const stats = [
    { label: "Total Users", value: overview?.totalUsers, icon: Users, color: "violet" },
    { label: "New Today", value: overview?.newUsersToday, icon: UserPlus, color: "blue" },
    { label: "Connected Platforms", value: overview?.connectedPlatforms, icon: Link2, color: "emerald" },
    { label: "Transactions (24h)", value: overview?.transactions24h, icon: Activity, color: "pink" },
    { label: "CRYNDY Sold", value: overview?.cryndy.totalSold, icon: Coins, color: "amber" },
    { label: "NDYBITS Issued", value: overview?.ndybitsIssued, icon: Boxes, color: "cyan" },
  ];

  return (
    <div className="space-y-6">
      {/* -m-6 cancels the dashboard layout's `<main className="p-6">` padding
          so the hero can be full-bleed, matching the mockup — the rest of
          the page stays inside the normal padded flow. */}
      <div className="-mx-6 -mt-6">
        <EcosystemHero />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <LauncherCardView key={card.title} card={card} />
        ))}
      </div>

      <EcosystemStatsRow items={stats} />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex items-center justify-between rounded-xl border border-violet-500/30 bg-surface/60 p-5 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-violet-500/50 bg-background text-violet-400">
              <Coins size={20} strokeWidth={2} />
            </div>
            <div>
              <div className="font-semibold">CRYNDY</div>
              <div className="text-xs text-foreground-muted">
                {overview ? `${overview.cryndy.totalSold.toLocaleString()} sold` : "…"}
              </div>
            </div>
          </div>
          {overview && overview.cryndy.dailySeries.some((v) => v > 0) ? (
            <Sparkline values={overview.cryndy.dailySeries} color="#8b5cf6" />
          ) : (
            <span className="text-xs text-foreground-muted">No sales yet</span>
          )}
        </div>

        <div className="flex items-center justify-between rounded-xl border border-orange-500/30 bg-surface/60 p-5 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-orange-500/50 bg-background text-orange-400">
              <Bitcoin size={20} strokeWidth={2} />
            </div>
            <div>
              <div className="font-semibold">Bitcoin</div>
              <div className="text-xs text-foreground-muted">Live market reference</div>
            </div>
          </div>
          {overview?.bitcoin ? (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="font-mono text-sm font-semibold">
                  {overview.bitcoin.priceUsd.toLocaleString(undefined, { style: "currency", currency: "USD" })}
                </div>
                <div
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    overview.bitcoin.change24hPct >= 0 ? "bg-good/15 text-good" : "bg-critical/15 text-critical"
                  }`}
                >
                  {overview.bitcoin.change24hPct >= 0 ? "▲" : "▼"} {Math.abs(overview.bitcoin.change24hPct).toFixed(2)}%
                </div>
              </div>
              <Sparkline values={overview.bitcoin.sparkline7d} color="#f97316" />
            </div>
          ) : (
            <span className="text-xs text-foreground-muted">Unavailable</span>
          )}
        </div>
      </div>

      <EcosystemDirectory />
    </div>
  );
}
