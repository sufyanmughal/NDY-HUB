"use client";

import { useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import {
  type TierInfo,
  type MembershipTier,
  type BillingCycle,
} from "@/lib/api";

/** Shared by the public /memberships marketing page and the authenticated
 * /memberships/manage page — same tier cards, same subscribe behavior,
 * so an existing member can browse and upgrade to a higher tier without
 * ever leaving the dashboard shell (previously "Browse all tiers" sent
 * them out to the sidebar-less public page instead). */

export const TIER_ORDER: MembershipTier[] = [
  "RISE",
  "FLOW",
  "PULSE",
  "VAULT",
  "MODE",
  "LEGACY",
];

export const TIER_STYLE: Record<
  MembershipTier,
  { color: string; tagline: string; icon: React.ReactNode }
> = {
  RISE: {
    color: "#4f7cff",
    tagline: "Your first step into the ecosystem.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M4 17 10 11 14 15 20 7" />
        <path d="M14 7h6v6" />
      </svg>
    ),
  },
  FLOW: {
    color: "#22d3ee",
    tagline: "Move faster with priority access.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M3 12c3 0 3-5 6-5s3 5 6 5 3-5 6-5" />
        <path d="M3 17c3 0 3-5 6-5s3 5 6 5 3-5 6-5" />
      </svg>
    ),
  },
  PULSE: {
    color: "#8b5cf6",
    tagline: "Built for people who trade and transact often.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M3 12h4l2.5-7L13 19l2.5-7H21" />
      </svg>
    ),
  },
  VAULT: {
    color: "#e0a83c",
    tagline: "Higher limits, dedicated attention.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="4" y="10.5" width="16" height="9.5" rx="2" />
        <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
        <circle cx="12" cy="15" r="1.6" />
      </svg>
    ),
  },
  MODE: {
    color: "#ec4899",
    tagline: "Business-tier verification and API access.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="3.5" y="5" width="17" height="11.5" rx="1.6" />
        <path d="M2 20h20M9.5 10.2l-1.7 1.7 1.7 1.7M14.5 10.2l1.7 1.7-1.7 1.7" />
      </svg>
    ),
  },
  LEGACY: {
    color: "#d4af5a",
    tagline: "The full NDY identity, white-glove from day one.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M12 2.5 19 5.5v5.5c0 5-3 8.2-7 9.5-4-1.3-7-4.5-7-9.5V5.5Z" />
        <path d="m9 11.5 2 2 4-4.2" />
      </svg>
    ),
  },
};

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
      <path d="m5 12 5 5L20 7" />
    </svg>
  );
}

export function TierGrid({
  tiers,
  currentTier,
  isAuthenticated,
  busyTier,
  onSubscribe,
  ctaLabelForTier,
}: {
  tiers: Record<MembershipTier, TierInfo> | null;
  currentTier: MembershipTier | null;
  isAuthenticated: boolean;
  busyTier: MembershipTier | null;
  onSubscribe: (tier: MembershipTier, billingCycle: BillingCycle) => void;
  /** Lets /memberships/manage say "Upgrade" instead of "Subscribe" for a
   * tier above the current one — optional, defaults to the public page's
   * copy when omitted. */
  ctaLabelForTier?: (tier: MembershipTier, isCurrent: boolean) => string;
}) {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("MONTHLY");

  return (
    <>
      <div className="mem-toggle">
        <div className="mem-toggle-track">
          <button
            onClick={() => setBillingCycle("MONTHLY")}
            className={`mem-toggle-btn ${billingCycle === "MONTHLY" ? "mem-toggle-active" : ""}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle("ANNUAL")}
            className={`mem-toggle-btn ${billingCycle === "ANNUAL" ? "mem-toggle-active" : ""}`}
          >
            Annual <span className="mem-toggle-save">Save ~17%</span>
          </button>
        </div>
      </div>

      <div className="mem-tiers">
        {tiers &&
          TIER_ORDER.map((tier, i) => {
            const info = tiers[tier];
            const style = TIER_STYLE[tier];
            const priceCents =
              billingCycle === "ANNUAL" ? info.annualPriceCents : info.monthlyPriceCents;
            const isCurrent = currentTier === tier;
            const defaultLabel = isCurrent
              ? "Current plan"
              : isAuthenticated
                ? "Subscribe"
                : "Sign up to join";
            return (
              <motion.div
                key={tier}
                className={`mem-tier-card ${isCurrent ? "mem-tier-current" : ""}`}
                style={{ "--tier-c": style.color } as CSSProperties}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: i * 0.06 }}
                whileHover={{ y: -8, scale: 1.015 }}
              >
                {isCurrent && <span className="mem-tier-badge">Current plan</span>}
                <div className="mem-tier-icon">{style.icon}</div>
                <h3>{info.label}</h3>
                <p className="mem-tier-tagline">{style.tagline}</p>
                <div className="mem-tier-price">
                  <span className="mem-price-amount">€{(priceCents / 100).toFixed(0)}</span>
                  <span className="mem-price-period">
                    /{billingCycle === "ANNUAL" ? "yr" : "mo"}
                  </span>
                </div>
                <div className="mem-tier-annual-note">
                  {billingCycle === "ANNUAL" ? "Billed annually" : " "}
                </div>
                <ul className="mem-tier-benefits">
                  {info.benefits.map((b) => (
                    <li key={b}>
                      <span className="mem-tier-check">
                        <CheckIcon />
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => onSubscribe(tier, billingCycle)}
                  disabled={isCurrent || busyTier === tier}
                  className={`mem-tier-cta ${tier === "LEGACY" || tier === "MODE" ? "mem-tier-cta-solid" : ""}`}
                >
                  {busyTier === tier
                    ? "…"
                    : ctaLabelForTier
                      ? ctaLabelForTier(tier, isCurrent)
                      : defaultLabel}
                </button>
              </motion.div>
            );
          })}
      </div>
    </>
  );
}

export function TierCompareTable({
  tiers,
}: {
  tiers: Record<MembershipTier, TierInfo> | null;
}) {
  if (!tiers) return null;
  return (
    <div className="mem-compare">
      {TIER_ORDER.map((tier) => {
        const info = tiers[tier];
        const style = TIER_STYLE[tier];
        return (
          <div
            key={tier}
            className="mem-compare-col"
            style={{ "--tier-c": style.color } as CSSProperties}
          >
            <h4>{info.label}</h4>
            <ul>
              {info.benefits.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
