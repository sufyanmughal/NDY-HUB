"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useEcosystemOverview } from "@/lib/use-ecosystem-overview";
import { Logo } from "@/components/logo";
import { API_BASE_URL } from "@/lib/api";
import {
  EcosystemHero,
  FeatureCardGrid,
  StatsBar,
  TokenCard,
  EcosystemDirectory,
  HomepageFooter,
  type LauncherCard,
} from "@/components/homepage-widgets";
import "@/styles/homepage.css";

const CARDS: LauncherCard[] = [
  {
    href: "/login",
    icon: "login",
    color: "#8b5cf6",
    title: "Sign In / Sign Up",
    description: "Access your NDY account, or create one in seconds.",
  },
  {
    href: "/login?next=/passport",
    icon: "passport",
    color: "#4f7cff",
    title: "NDY Passport",
    description: "Your one digital identity for the whole ecosystem.",
  },
  {
    href: "/login?next=/founder",
    icon: "founder",
    color: "#22c58b",
    title: "Founder Mission Control",
    description: "Exclusive dashboard for founders.",
  },
  {
    href: "/login?next=/admin",
    icon: "admin",
    color: "#e0a83c",
    title: "Admin Center",
    description: "Manage of the platform.",
  },
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

export default function LandingPage() {
  const { auth } = useAuth();
  const router = useRouter();
  const overview = useEcosystemOverview();

  useEffect(() => {
    if (auth.status === "authenticated") router.replace("/dashboard");
  }, [auth.status, router]);

  if (auth.status !== "unauthenticated") return null;

  const stats = [
    { label: "Total Users", value: overview?.totalUsers, icon: "users" as const, color: "#8b5cf6" },
    { label: "New Today", value: overview?.newUsersToday, icon: "users" as const, color: "#4f7cff" },
    { label: "Connected Platforms", value: overview?.connectedPlatforms, icon: "layers" as const, color: "#22c58b" },
    { label: "CRYNDY Sold", value: overview?.cryndy.totalSold, icon: "coins" as const, color: "#e0a83c" },
    { label: "NDYBITS Issued", value: overview?.ndybitsIssued, icon: "boxes" as const, color: "#4f7cff" },
    { label: "Transactions (24h)", value: overview?.transactions24h, icon: "activity" as const, color: "#ec4899" },
  ];

  return (
    <div className="ndy-homepage" id="top">
      <div className="hp-page">
        <header className="hp-topbar">
          <Logo />
          <Link href="/login" className="hp-signin-btn">
            Sign In / Sign Up
          </Link>
        </header>

        <EcosystemHero />

        <FeatureCardGrid cards={CARDS} />

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

        <HomepageFooter />
      </div>
    </div>
  );
}
