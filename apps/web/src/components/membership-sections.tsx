"use client";

import { type CSSProperties } from "react";
import { motion } from "framer-motion";

/** Shared by the public /memberships marketing page and the authenticated
 * /memberships/manage page — "why membership" tiles, trust/security row,
 * and the closing CTA band all previously only existed on the public page,
 * so an authenticated member browsing tiers from inside the dashboard
 * never saw them. */

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

export function WhyMembershipSection() {
  return (
    <>
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
    </>
  );
}

export function TrustSecuritySection() {
  return (
    <>
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
    </>
  );
}

export function MembershipClosingCta({ ctaHref = "#tiers" }: { ctaHref?: string }) {
  return (
    <div className="mem-cta-band">
      <h2>Ready to claim your identity?</h2>
      <p>
        Join the NDJOYIT ecosystem with one identity, one passport, and a
        membership that grows with everything we build next.
      </p>
      <a href={ctaHref} className="mem-cta-primary">
        Become a Member
      </a>
    </div>
  );
}
