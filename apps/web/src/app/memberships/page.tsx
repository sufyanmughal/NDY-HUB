"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { useAuth } from "@/lib/auth-context";
import {
  getMembershipTiers,
  getMyMembership,
  subscribeToTier,
  type TierInfo,
  type MembershipTier,
  type BillingCycle,
  type MembershipSummary,
} from "@/lib/api";
import { HomepageFooter } from "@/components/homepage-widgets";
import { TierGrid, TierCompareTable } from "@/components/tier-grid";
import "@/styles/homepage.css";
import "@/styles/membership.css";

/** Public marketing + live subscribe page for NDY Membership, at the
 * single URL /memberships. Deliberately NOT gated by auth — this is meant
 * to be the page a prospect lands on before they ever sign up, so it has
 * to sell the identity/ecosystem story on its own. Logged-in visitors get
 * the same visuals with real plan/subscribe state layered in; the
 * account-management surface (cancel, billing history) lives at the
 * separate /memberships/manage URL rather than here, so this page never
 * needs to branch its whole layout on auth status. Tier cards themselves
 * live in components/tier-grid.tsx, shared with /memberships/manage so an
 * existing member can browse/upgrade without leaving the dashboard shell. */

const WHY_TILES: {
  color: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    color: "#8b5cf6",
    title: "One Identity, Everywhere",
    description:
      "A single NDY identity carries across every app in the ecosystem — no re-registering, no fragmented profiles.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <circle cx="12" cy="12" r="9.5" />
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
      </svg>
    ),
  },
  {
    color: "#4f7cff",
    title: "Priority Access",
    description:
      "Members see new NDJOYIT platforms, features, and drops before anyone else — first in line, every time.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="m5 12 5 5L20 7" />
      </svg>
    ),
  },
  {
    color: "#22c58b",
    title: "Built-In Trust & Security",
    description:
      "Passkeys, 2FA, and encrypted sessions protect your identity the same way a passport is protected — by design, not as an afterthought.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M12 2.5 19 5.5v5.5c0 5-3 8.2-7 9.5-4-1.3-7-4.5-7-9.5V5.5Z" />
        <path d="m9 11.5 2 2 4-4.2" />
      </svg>
    ),
  },
  {
    color: "#e0a83c",
    title: "Grow With the Ecosystem",
    description:
      "As NDJOYIT expands into new platforms and tokens, your membership grows with it — one relationship, compounding value.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M4 20V9l8-6 8 6v11" />
        <path d="M9 20v-6h6v6" />
      </svg>
    ),
  },
];

const TRUST_CHIPS: { title: string; sub: string; icon: React.ReactNode }[] = [
  {
    title: "Passkeys",
    sub: "Passwordless login",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <circle cx="12" cy="8" r="3.2" />
        <path d="M7 20c1-3.2 2.8-4.8 5-4.8s4 1.6 5 4.8" />
      </svg>
    ),
  },
  {
    title: "2FA",
    sub: "Two-factor verification",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="7" y="10.5" width="10" height="9" rx="2" />
        <path d="M9.5 10.5V8a2.5 2.5 0 0 1 5 0v2.5" />
      </svg>
    ),
  },
  {
    title: "OAuth",
    sub: "Google & Apple sign-in",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.5 3.8 6 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-6-3.8-9s1.3-6.5 3.8-9Z" />
      </svg>
    ),
  },
  {
    title: "GDPR Compliant",
    sub: "Your data, your control",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M12 2.5 19 5.5v5.5c0 5-3 8.2-7 9.5-4-1.3-7-4.5-7-9.5V5.5Z" />
        <path d="M9 12h6M9 15h4" />
      </svg>
    ),
  },
  {
    title: "Encrypted",
    sub: "End-to-end session security",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
        <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
      </svg>
    ),
  },
];

export default function MembershipsMarketingPage() {
  const { auth, logout } = useAuth();
  const [tiers, setTiers] = useState<Record<MembershipTier, TierInfo> | null>(
    null,
  );
  const [summary, setSummary] = useState<MembershipSummary | null>(null);
  const [busyTier, setBusyTier] = useState<MembershipTier | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Public endpoint — safe to call before we know auth status, so the
    // tier cards render with real pricing for logged-out visitors too.
    getMembershipTiers()
      .then(setTiers)
      .catch((err) => setError((err as Error).message));
  }, []);

  const refreshSummary = useCallback(() => {
    if (auth.status !== "authenticated") return;
    getMyMembership()
      .then(setSummary)
      .catch(() => {
        /* best-effort — the page still works for browsing/subscribing
           even if this fails */
      });
  }, [auth]);

  useEffect(() => {
    refreshSummary();
  }, [refreshSummary]);

  async function handleSubscribe(tier: MembershipTier, billingCycle: BillingCycle) {
    if (auth.status !== "authenticated") {
      window.location.assign(`/login?next=/memberships`);
      return;
    }
    setBusyTier(tier);
    setError(null);
    try {
      const result = await subscribeToTier(tier, billingCycle);
      if (result.mode === "checkout") {
        window.location.assign(result.checkoutUrl);
        return;
      }
      refreshSummary();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyTier(null);
    }
  }

  const currentTier = summary?.current?.tier ?? null;

  return (
    <div className="ndy-homepage" id="top">
      <div className="hp-page">
        {/* This is the public marketing page — outside the (dashboard)
            shell, so there's no sidebar here, which reads as "the app
            broke" to an authenticated user who clicked in from
            /memberships/manage's "Browse all tiers" link. This bar makes
            the way back unmissable instead of relying on the smaller
            "Dashboard" link buried in the header below. */}
        {auth.status === "authenticated" && (
          <div className="mem-back-bar">
            <Link href="/dashboard" className="mem-back-bar-link">
              <ArrowLeft size={14} strokeWidth={2} />
              Back to Dashboard
            </Link>
          </div>
        )}

        <header className="hp-topbar">
          <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
            <Logo />
          </Link>
          {auth.status === "authenticated" ? (
            <div className="mem-topbar-account">
              <Link href="/memberships/manage" className="mem-topbar-link">
                Manage membership
              </Link>
              <Link href="/dashboard" className="mem-topbar-link">
                Dashboard
              </Link>
              <button
                onClick={logout}
                className="hp-signin-btn"
                style={{ background: "transparent", border: "1px solid var(--hp-border)" }}
              >
                Log out
              </button>
            </div>
          ) : (
            <Link href="/login" className="hp-signin-btn">
              Sign In / Sign Up
            </Link>
          )}
        </header>

        {/* ---------- hero ---------- */}
        <section className="hp-hero mem-hero">
          <div className="hp-earth" />
          <div className="hp-stars" />
          <p className="hp-eyebrow">NDJOYIT Ecosystem</p>
          <h1>
            Claim Your <span className="hp-grad">NDY Identity</span>
          </h1>
          <p style={{ fontWeight: 600, color: "var(--hp-fg)", marginBottom: 6 }}>
            One Identity. One Passport. One Ecosystem.
          </p>
          <p>
            NDY Membership isn&rsquo;t a subscription — it&rsquo;s your passport into
            everything NDJOYIT is building. One identity that follows you across
            every platform, token, and experience in the ecosystem, backed by
            the trust and security to prove it&rsquo;s really you.
          </p>
          <div className="mem-hero-actions">
            <a href="#tiers" className="mem-cta-primary">
              Explore Membership Tiers
            </a>
            {auth.status !== "authenticated" && (
              <Link href="/login" className="mem-cta-secondary">
                Sign in
              </Link>
            )}
          </div>
        </section>

        {error && (
          <p
            style={{
              margin: "20px 40px 0",
              padding: "10px 14px",
              borderRadius: 10,
              fontSize: 13,
              color: "#f0605a",
              background: "rgba(240, 96, 90, 0.1)",
              border: "1px solid rgba(240, 96, 90, 0.3)",
            }}
          >
            {error}
          </p>
        )}

        {/* ---------- why membership ---------- */}
        <div className="mem-section-title">
          <p className="hp-eyebrow">Why NDY Membership</p>
          <h2>More than access. It&rsquo;s an identity.</h2>
          <p>
            Every membership tier is a deeper stake in one connected identity —
            not a feature toggle for a single app.
          </p>
        </div>
        <div className="mem-why-grid">
          {WHY_TILES.map((tile, i) => (
            <motion.div
              key={tile.title}
              className="mem-why-tile"
              style={{ "--card-c": tile.color } as CSSProperties}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            >
              <div className="mem-why-icon">{tile.icon}</div>
              <h3>{tile.title}</h3>
              <p>{tile.description}</p>
            </motion.div>
          ))}
        </div>

        {/* ---------- tiers ---------- */}
        <div className="mem-section-title" id="tiers">
          <p className="hp-eyebrow">Membership Tiers</p>
          <h2>Choose how deep you go.</h2>
          <p>
            Every tier includes everything below it — start where you are, grow
            into the ecosystem at your own pace.
          </p>
        </div>

        <TierGrid
          tiers={tiers}
          currentTier={currentTier}
          isAuthenticated={auth.status === "authenticated"}
          busyTier={busyTier}
          onSubscribe={handleSubscribe}
        />

        {/* ---------- everything included, side by side ---------- */}
        <TierCompareTable tiers={tiers} />

        {/* ---------- trust & security ---------- */}
        <div className="mem-section-title">
          <p className="hp-eyebrow">Trust & Security</p>
          <h2>Your identity, protected like one.</h2>
        </div>
        <div className="mem-trust-row">
          {TRUST_CHIPS.map((chip) => (
            <div key={chip.title} className="mem-trust-chip">
              <div className="mem-trust-icon">{chip.icon}</div>
              <div>
                <strong>{chip.title}</strong>
                <span>{chip.sub}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ---------- closing CTA ---------- */}
        <div className="mem-cta-band">
          <h2>Ready to claim your identity?</h2>
          <p>
            Join the NDJOYIT ecosystem with one identity, one passport, and a
            membership that grows with everything we build next.
          </p>
          <a href="#tiers" className="mem-cta-primary">
            Become a Member
          </a>
        </div>

        <HomepageFooter />
      </div>
    </div>
  );
}
