"use client";

import { useAuth } from "@/lib/auth-context";
import { useEcosystemOverview } from "@/lib/use-ecosystem-overview";
import { useMyActivity } from "@/lib/use-my-activity";
import { useMe } from "@/lib/use-me";
import { API_BASE_URL } from "@/lib/api";
import {
  EcosystemHero,
  FeatureCardGrid,
  StatsBar,
  TokenCard,
  RecentActivityPanel,
  EcosystemDirectory,
  type LauncherCard,
} from "@/components/homepage-widgets";
import "@/styles/homepage.css";

export default function DashboardPage() {
  const { auth } = useAuth();
  const me = useMe();
  const overview = useEcosystemOverview();
  const activity = useMyActivity();
  if (auth.status !== "authenticated") return null;

  const cards: LauncherCard[] = [
    {
      href: "/ndyspace",
      icon: "ndyspace",
      color: "#6366f1",
      title: "NDYSPACE™",
      description:
        "Your personal digital space. Mail, Calendar, Drive, Contacts, and more – all in one secure place.",
      featured: true,
    },
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
    ...(me?.role === "FINANCE" || me?.role === "FOUNDER"
      ? [
          {
            href: "/finance",
            icon: "finance" as const,
            color: "#e0a83c",
            title: "Financials",
            description: "Revenue, CRYNDY sales, and NDYBITS issuance.",
          },
        ]
      : []),
    ...(me?.role === "SUPER_ADMIN" || me?.role === "FOUNDER"
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
    {
      label: "Total Members",
      value: overview?.totalMembers,
      icon: "users" as const,
      color: "#694dfa",
    },
    {
      label: "Connected Platforms",
      value: overview?.connectedPlatforms,
      icon: "layers" as const,
      color: "#01e19a",
    },
    {
      label: "System Uptime",
      value: overview?.systemUptimePct,
      icon: "shieldCheck" as const,
      color: "#ff8623",
      suffix: "%",
    },
    {
      label: "Countries",
      value: overview?.countries,
      icon: "globe" as const,
      color: "#0b9afa",
    },
    {
      label: "Transactions (24h)",
      value: overview?.transactions24h,
      icon: "activity" as const,
      color: "#fe3c90",
    },
  ];

  return (
    <div className="ndy-homepage -mx-6 -mt-6">
      <div className="hp-page">
        <EcosystemHero
          idCard={me ? { ndyId: me.ndyId, memberSince: me.createdAt } : undefined}
        />

        <FeatureCardGrid cards={cards} />

        <StatsBar items={stats} />

        <section className="hp-tokens">
          <TokenCard
            icon="C"
            color="#8b5cf6"
            name="CRYNDY"
            sub="Community Token"
            price={
              overview
                ? `${overview.cryndy.totalSold.toLocaleString()} sold`
                : "…"
            }
            changePct={null}
            chartValues={
              overview && overview.cryndy.dailySeries.some((v) => v > 0)
                ? overview.cryndy.dailySeries
                : null
            }
          />
          <TokenCard
            icon="₿"
            color="#f59e0b"
            name="Bitcoin"
            sub="Live market reference"
            price={
              overview?.bitcoin
                ? overview.bitcoin.priceUsd.toLocaleString(undefined, {
                    style: "currency",
                    currency: "USD",
                  })
                : "…"
            }
            changePct={overview?.bitcoin?.change24hPct ?? null}
            chartValues={overview?.bitcoin?.sparkline7d ?? null}
          />
        </section>

        <RecentActivityPanel items={activity} />

        <EcosystemDirectory />

        <div className="pb-8" />
      </div>
    </div>
  );
}
