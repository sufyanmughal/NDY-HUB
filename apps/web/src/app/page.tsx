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
  Boxes,
  Bitcoin,
  ArrowUp,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useEcosystemOverview } from "@/lib/use-ecosystem-overview";
import { Sparkline } from "@/components/sparkline";
import { Logo } from "@/components/logo";
import { API_BASE_URL } from "@/lib/api";
import {
  EcosystemHero,
  EcosystemDirectory,
  EcosystemStatsRow,
  LauncherCardView,
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

  const stats = [
    { label: "Total Users", value: overview?.totalUsers, icon: Users, color: "violet" },
    { label: "New Today", value: overview?.newUsersToday, icon: UserPlus, color: "blue" },
    { label: "Connected Platforms", value: overview?.connectedPlatforms, icon: Link2, color: "emerald" },
    { label: "Transactions (24h)", value: overview?.transactions24h, icon: Activity, color: "pink" },
    { label: "CRYNDY Sold", value: overview?.cryndy.totalSold, icon: Coins, color: "amber" },
    { label: "NDYBITS Issued", value: overview?.ndybitsIssued, icon: Boxes, color: "cyan" },
  ];

  return (
    <div className="min-h-screen">
      <div className="relative">
        <header className="relative z-10 flex items-center justify-between px-6 py-5">
          <Logo />
          <Link
            href="/login"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
          >
            Sign In / Sign Up
          </Link>
        </header>
        <EcosystemHero />
      </div>

      <main className="mx-auto max-w-6xl space-y-6 px-6 pb-16">
        <div className="text-center">
          <Link
            href="/login"
            className="inline-block rounded-md bg-accent px-6 py-3 text-sm font-medium text-white hover:bg-accent/90"
          >
            Get Started — Sign In / Sign Up
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((card) => (
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
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-6 text-xs text-foreground-muted sm:flex-row">
          <Logo size={20} />
          <span>Powered by NDJOYIT</span>
          <nav className="flex items-center gap-4">
            <span className="cursor-default opacity-60">Privacy Policy</span>
            <span className="cursor-default opacity-60">Terms of Service</span>
            <span className="cursor-default opacity-60">Support</span>
            <span className="cursor-default opacity-60">Status</span>
          </nav>
          <span>&copy; {new Date().getFullYear()} NDJOYIT. All rights reserved.</span>
        </div>
      </footer>

      <a
        href="#top"
        aria-label="Back to top"
        className="fixed bottom-6 right-6 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-foreground-muted shadow-lg hover:bg-surface-2 hover:text-foreground"
      >
        <ArrowUp size={18} strokeWidth={2} />
      </a>
    </div>
  );
}
