"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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
import {
  WhyMembershipSection,
  TrustSecuritySection,
  MembershipClosingCta,
} from "@/components/membership-sections";
import "@/styles/homepage.css";
import "@/styles/membership.css";

/** Public marketing + live subscribe page for NDY Membership, at the
 * single URL /memberships. Deliberately NOT gated by auth — this is meant
 * to be the page a prospect lands on before they ever sign up, so it has
 * to sell the identity/ecosystem story on its own. Logged-in visitors get
 * the same visuals with real plan/subscribe state layered in; the
 * account-management surface (cancel, billing history) lives at the
 * separate /memberships/manage URL rather than here, so this page never
 * needs to branch its whole layout on auth status. Tier cards and the
 * why/trust/CTA sections all live in shared components (tier-grid.tsx,
 * membership-sections.tsx), reused by /memberships/manage so an existing
 * member sees the same full page without leaving the dashboard shell. */

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

        <WhyMembershipSection />

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

        <TrustSecuritySection />
        <MembershipClosingCta />

        <HomepageFooter />
      </div>
    </div>
  );
}
