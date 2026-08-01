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
  Bitcoin,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useEcosystemOverview } from "@/lib/use-ecosystem-overview";
import { useMe } from "@/lib/use-me";
import { Sparkline } from "@/components/sparkline";
import { API_BASE_URL } from "@/lib/api";
import {
  EcosystemHero,
  EcosystemDirectory,
  LauncherCardView,
  EcosystemStatCard,
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

  return (
    <div className="space-y-6">
      <EcosystemHero />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <LauncherCardView key={card.title} card={card} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <EcosystemStatCard label="Total Users" value={overview?.totalUsers} icon={Users} />
        <EcosystemStatCard label="New Today" value={overview?.newUsersToday} icon={UserPlus} />
        <EcosystemStatCard label="Connected Platforms" value={overview?.connectedPlatforms} icon={Link2} />
        <EcosystemStatCard label="Transactions (24h)" value={overview?.transactions24h} icon={Activity} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/15 text-violet-400">
              <Coins size={18} strokeWidth={2} />
            </div>
            <div>
              <div className="font-medium">CRYNDY</div>
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

        <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/15 text-orange-400">
              <Bitcoin size={18} strokeWidth={2} />
            </div>
            <div>
              <div className="font-medium">Bitcoin</div>
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
                  className={`flex items-center justify-end gap-1 text-xs ${
                    overview.bitcoin.change24hPct >= 0 ? "text-good" : "text-critical"
                  }`}
                >
                  {overview.bitcoin.change24hPct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {overview.bitcoin.change24hPct.toFixed(2)}%
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
