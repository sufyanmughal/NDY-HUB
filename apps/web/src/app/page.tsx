"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LogIn,
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
import { Sparkline } from "@/components/sparkline";
import { Logo } from "@/components/logo";
import { API_BASE_URL } from "@/lib/api";
import {
  EcosystemDirectory,
  LauncherCardView,
  EcosystemStatCard,
  type LauncherCard,
} from "@/components/homepage-widgets";

const CARDS: LauncherCard[] = [
  {
    href: "/login",
    icon: LogIn,
    color: "violet",
    title: "Sign In / Sign Up",
    description: "Access your NDY account, or create one in seconds.",
  },
  {
    href: "/login?next=/passport",
    icon: IdCard,
    color: "blue",
    title: "NDY Passport",
    description: "Your one digital identity for the whole ecosystem.",
  },
  {
    href: "/login?next=/founder",
    icon: Rocket,
    color: "emerald",
    title: "Founder Mission Control",
    description: "Exclusive command center for founders.",
  },
  {
    href: "/login?next=/admin",
    icon: Shield,
    color: "amber",
    title: "Admin Center",
    description: "Manage users, roles, and the platform.",
  },
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

export default function LandingPage() {
  const { auth } = useAuth();
  const router = useRouter();
  const overview = useEcosystemOverview();

  useEffect(() => {
    if (auth.status === "authenticated") router.replace("/dashboard");
  }, [auth.status, router]);

  if (auth.status !== "unauthenticated") return null;

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <Logo />
        <Link
          href="/login"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
        >
          Sign In / Sign Up
        </Link>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-10 text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent-2/20 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl"
          />
          <p className="relative text-xs font-semibold uppercase tracking-widest text-accent-2">
            Welcome to NDY HUB
          </p>
          <h1 className="relative mt-2 text-3xl font-semibold sm:text-5xl">
            One Identity. One Passport.{" "}
            <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">
              One Ecosystem.
            </span>
          </h1>
          <p className="relative mx-auto mt-3 max-w-2xl text-sm text-foreground-muted sm:text-base">
            NDY HUB is your central gateway to everything in the NDJOYIT ecosystem — manage your
            identity, connect platforms, and help build a global ecosystem.
          </p>
          <Link
            href="/login"
            className="relative mt-6 inline-block rounded-md bg-accent px-6 py-3 text-sm font-medium text-white hover:bg-accent/90"
          >
            Get Started — Sign In / Sign Up
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((card) => (
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
      </main>

      <footer className="border-t border-border px-6 py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-xs text-foreground-muted sm:flex-row">
          <Logo size={20} />
          <span>Powered by NDJOYIT</span>
          <span>&copy; {new Date().getFullYear()} NDJOYIT. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
