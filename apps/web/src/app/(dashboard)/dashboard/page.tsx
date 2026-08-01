"use client";

import { useAuth } from "@/lib/auth-context";
import { useEcosystemOverview } from "@/lib/use-ecosystem-overview";
import { useMe } from "@/lib/use-me";
import { API_BASE_URL } from "@/lib/api";
import {
  EcosystemHero,
  FeatureCardGrid,
  StatsBar,
  TokenCard,
  EcosystemDirectory,
  type LauncherCard,
} from "@/components/homepage-widgets";
import "@/styles/homepage.css";

export default function DashboardPage() {
  const { auth } = useAuth();
  const me = useMe();
  const overview = useEcosystemOverview();
  if (auth.status !== "authenticated") return null;

  const cards: LauncherCard[] = [
    {
      href: "/security",
      icon: "login",
      color: "#8b5cf6",
      title: "Security",
      description: "Manage access and active sessions on your account.",
    },
    {
      href: "/passport",
      icon: "passport",
      color: "#4f7cff",
      title: "NDY Passport",
      description: "View and manage your digital identity.",
    },
    ...(me?.role === "FOUNDER"
      ? [
          {
            href: "/founder",
            icon: "founder" as const,
            color: "#22c58b",
            title: "Founder Mission Control",
            description: "Exclusive dashboard for founders.",
          },
        ]
      : []),
    ...(me?.role === "ADMIN" || me?.role === "FOUNDER"
      ? [
          {
            href: "/admin",
            icon: "admin" as const,
            color: "#e0a83c",
            title: "Admin Center",
            description: "Manage of the platform.",
          },
        ]
      : []),
    {
      href: `${API_BASE_URL}/.well-known/openid-configuration`,
      external: true,
      icon: "api",
      color: "#22d3ee",
      title: "API",
      description: "API documentation and integrations.",
    },
    {
      href: "#",
      icon: "developer",
      color: "#ec4899",
      title: "Developer Portal",
      description: "Documentation, SDKs and developer tools.",
      comingSoon: true,
    },
  ];

  const stats = [
    { label: "Total Users", value: overview?.totalUsers, icon: "users" as const, color: "#8b5cf6" },
    { label: "New Today", value: overview?.newUsersToday, icon: "users" as const, color: "#4f7cff" },
    { label: "Connected Platforms", value: overview?.connectedPlatforms, icon: "layers" as const, color: "#22c58b" },
    { label: "CRYNDY Sold", value: overview?.cryndy.totalSold, icon: "coins" as const, color: "#e0a83c" },
    { label: "NDYBITS Issued", value: overview?.ndybitsIssued, icon: "boxes" as const, color: "#4f7cff" },
    { label: "Transactions (24h)", value: overview?.transactions24h, icon: "activity" as const, color: "#ec4899" },
  ];

  return (
    <div className="ndy-homepage -mx-6 -mt-6">
      <div className="hp-page">
        <EcosystemHero />

        <FeatureCardGrid cards={cards} />

        <StatsBar items={stats} />

        <section className="hp-tokens">
          <TokenCard
            icon="C"
            color="#8b5cf6"
            name="CRYNDY"
            sub="Community Token"
            price={overview ? `${overview.cryndy.totalSold.toLocaleString()} sold` : "…"}
            changePct={null}
            chartValues={overview && overview.cryndy.dailySeries.some((v) => v > 0) ? overview.cryndy.dailySeries : null}
          />
          <TokenCard
            icon="₿"
            color="#f59e0b"
            name="Bitcoin"
            sub="Live market reference"
            price={overview?.bitcoin ? overview.bitcoin.priceUsd.toLocaleString(undefined, { style: "currency", currency: "USD" }) : "…"}
            changePct={overview?.bitcoin?.change24hPct ?? null}
            chartValues={overview?.bitcoin?.sparkline7d ?? null}
          />
        </section>

        <EcosystemDirectory />

        <div className="pb-8" />
      </div>
    </div>
  );
}
