import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { motion } from "framer-motion";
import { AreaSparkline } from "./area-sparkline";
import { BrandMark } from "./logo";

/** Shared between the public landing page (app/page.tsx) and the
 * authenticated dashboard home ((dashboard)/dashboard/page.tsx). Markup
 * and CSS classes (see styles/homepage.css) are transcribed 1:1 from the
 * client's own reference build rather than approximated through Tailwind,
 * so this actually matches instead of just being close. Both consuming
 * pages must render inside a `<div className="ndy-homepage">` wrapper for
 * the scoped classes here to take effect. */

// ---------- CTA arrow (used on every feature card) ----------
function CtaArrow() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

// ---------- feature card icons (exact paths from the reference) ----------
const CARD_ICONS = {
  login: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </svg>
  ),
  passport: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <rect x="3.5" y="5" width="17" height="14" rx="2.2" />
      <circle cx="9.3" cy="11" r="1.9" />
      <path d="M6 16c.7-1.7 2-2.5 3.3-2.5s2.6.8 3.3 2.5M14.5 9.5h4M14.5 12.5h4" />
    </svg>
  ),
  founder: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path d="M12 2.5c2.8 1.6 4.6 4.6 4.6 9 0 3-1.2 5.6-2.3 7l-2.3 3-2.3-3c-1.1-1.4-2.3-4-2.3-7 0-4.4 1.8-7.4 4.6-9Z" />
      <circle cx="12" cy="10.5" r="1.8" />
      <path d="M8 17.5c-1.8.6-3 1.6-3 2.7 0 1.5 3.1 2.3 7 2.3s7-.8 7-2.3c0-1.1-1.2-2.1-3-2.7" />
    </svg>
  ),
  admin: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path d="M12 2.5 19 5.5v5.5c0 5-3 8.2-7 9.5-4-1.3-7-4.5-7-9.5V5.5Z" />
      <circle cx="12" cy="11" r="2.6" />
      <path d="M12 13.2v1.6M12 6.4V8M15.8 11h1.6M6.6 11h1.6" />
    </svg>
  ),
  api: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path d="m9 8-4.5 4L9 16M15 8l4.5 4L15 16" />
    </svg>
  ),
  developer: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <rect x="3.5" y="5" width="17" height="11.5" rx="1.6" />
      <path d="M2 20h20M9.5 10.2l-1.7 1.7 1.7 1.7M14.5 10.2l1.7 1.7-1.7 1.7" />
    </svg>
  ),
  finance: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v9M14.8 9.8c0-1.3-1.3-2.3-2.8-2.3s-2.8.9-2.8 2.1c0 3 5.6 1.5 5.6 4.4 0 1.2-1.3 2.1-2.8 2.1s-2.8-1-2.8-2.3" />
    </svg>
  ),
} as const;

export type CardIconName = keyof typeof CARD_ICONS;

export interface LauncherCard {
  href: string;
  external?: boolean;
  icon: CardIconName;
  color: string; // hex, e.g. "#8b5cf6"
  title: string;
  description: string;
  comingSoon?: boolean;
}

export function LauncherCardView({ card }: { card: LauncherCard }) {
  const inner = (
    <>
      <div className="hp-card-icon">{CARD_ICONS[card.icon]}</div>
      <h3>{card.title}</h3>
      <p>{card.description}</p>
      {card.comingSoon ? (
        <span className="hp-card-cta hp-card-cta-disabled">Coming soon</span>
      ) : (
        <span className="hp-card-cta">
          Go to <CtaArrow />
        </span>
      )}
    </>
  );

  const style = { "--card-c": card.color } as CSSProperties;

  if (card.comingSoon) {
    return (
      <div className="hp-card hp-card-disabled" style={style}>
        {inner}
      </div>
    );
  }
  if (card.external) {
    return (
      <a
        className="hp-card"
        style={style}
        href={card.href}
        target="_blank"
        rel="noreferrer"
      >
        {inner}
      </a>
    );
  }
  return (
    <Link className="hp-card" style={style} href={card.href}>
      {inner}
    </Link>
  );
}

export function FeatureCardGrid({ cards }: { cards: LauncherCard[] }) {
  return (
    <section className="hp-cards">
      {cards.map((card, i) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: i * 0.05 }}
        >
          <LauncherCardView card={card} />
        </motion.div>
      ))}
    </section>
  );
}

// ---------- stats bar ----------
const STAT_ICONS = {
  users: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <circle cx="9" cy="9" r="3.2" />
      <path d="M3.5 19c1-3 3-4.5 5.5-4.5s4.5 1.5 5.5 4.5" />
      <circle cx="17" cy="9.5" r="2.6" />
      <path d="M15.5 14.7c1.9.4 3.3 1.7 4 4" />
    </svg>
  ),
  layers: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </svg>
  ),
  shieldCheck: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path d="M12 2.5 19 5.5v5.5c0 5-3 8.2-7 9.5-4-1.3-7-4.5-7-9.5V5.5Z" />
      <path d="m9 11.5 2 2 4-4.2" />
    </svg>
  ),
  coins: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <circle cx="9" cy="9" r="5.2" />
      <path d="M9.5 15.8a5.2 5.2 0 1 0 0-10.6" />
      <circle cx="15" cy="15" r="5.2" />
    </svg>
  ),
  boxes: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path d="M12 3 4 7v10l8 4 8-4V7Z" />
      <path d="M4 7l8 4 8-4M12 11v10" />
    </svg>
  ),
  activity: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <path d="M5 20V10M12 20V4M19 20v-7" />
    </svg>
  ),
} as const;

export type StatIconName = keyof typeof STAT_ICONS;

export interface StatItem {
  label: string;
  value: number | undefined;
  icon: StatIconName;
  color: string;
}

export function StatsBar({ items }: { items: StatItem[] }) {
  return (
    <section className="hp-stats">
      {items.map((item) => (
        <div
          key={item.label}
          className="hp-stat"
          style={{ "--stat-c": item.color } as CSSProperties}
        >
          <div className="hp-stat-icon">{STAT_ICONS[item.icon]}</div>
          <div>
            <div className="hp-stat-value">
              {item.value === undefined ? "…" : item.value.toLocaleString()}
            </div>
            <div className="hp-stat-label">{item.label}</div>
          </div>
        </div>
      ))}
    </section>
  );
}

// ---------- token cards ----------
export function TokenCard({
  icon,
  color,
  name,
  sub,
  price,
  changePct,
  chartValues,
}: {
  icon: ReactNode;
  color: string;
  name: string;
  sub: string;
  price: string;
  changePct: number | null;
  chartValues: number[] | null;
}) {
  return (
    <div className="hp-token-card">
      <div
        className="hp-token-icon"
        style={{ "--tok-c": color } as CSSProperties}
      >
        {icon}
      </div>
      <div>
        <div className="hp-token-name">{name}</div>
        <div className="hp-token-sub">{sub}</div>
      </div>
      <div className="hp-token-price-block">
        <div className="hp-token-price">{price}</div>
        {changePct !== null && (
          <div
            className={`hp-token-change ${changePct >= 0 ? "hp-up" : "hp-down"}`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              style={{
                transform: changePct >= 0 ? undefined : "rotate(180deg)",
              }}
            >
              <path d="m6 15 6-6 6 6" />
            </svg>
            {Math.abs(changePct).toFixed(2)}%
          </div>
        )}
      </div>
      {chartValues && chartValues.length >= 2 ? (
        <AreaSparkline values={chartValues} color={color} />
      ) : (
        <span style={{ fontSize: 11, color: "var(--hp-fg-muted)" }}>
          No data yet
        </span>
      )}
    </div>
  );
}

// ---------- ecosystem directory ----------
const ECO_ICONS: Record<string, ReactNode> = {
  ndjoyit: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  ),
  ndyapps: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
    >
      <path d="M4 5h16v11H8l-4 4V5Z" />
    </svg>
  ),
  ndystays: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
    >
      <path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9" />
    </svg>
  ),
  ndyxtra: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
    >
      <path d="M4 21V9l8-6 8 6v12" />
      <path d="M9 21v-6h6v6" />
    </svg>
  ),
  ndyquiz: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
    >
      <path d="M6 3h12l3 5-9 12L3 8Z" />
      <path d="M3 8h18M9 3l1 5-3 0M15 3l-1 5 3 0" />
    </svg>
  ),
  cryndy: <span style={{ fontWeight: 800, fontSize: 15 }}>C</span>,
  ndynex: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
    >
      <path d="M12 2.5 19 5.5v5.5c0 5-3 8.2-7 9.5-4-1.3-7-4.5-7-9.5V5.5Z" />
      <path d="m9 11.5 2 2 4-4.2" />
    </svg>
  ),
  ndycollect: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
    >
      <rect x="4" y="4" width="7" height="7" rx="1.3" />
      <rect x="13" y="4" width="7" height="7" rx="1.3" />
      <rect x="4" y="13" width="7" height="7" rx="1.3" />
      <rect x="13" y="13" width="7" height="7" rx="1.3" />
    </svg>
  ),
};

const ECOSYSTEM_ITEMS: {
  key: keyof typeof ECO_ICONS;
  label: string;
  sub: string;
  color: string;
  href?: string;
  comingSoon?: boolean;
}[] = [
  {
    key: "ndjoyit",
    label: "NDJOYIT",
    sub: "Lifestyle Platform",
    color: "#22c55e",
  },
  {
    key: "ndyapps",
    label: "NDYAPPS",
    sub: "Smart Messaging",
    color: "#4f7cff",
    comingSoon: true,
  },
  {
    key: "ndystays",
    label: "NDYSTAYS",
    sub: "Travel & Stays",
    color: "#ec4899",
    comingSoon: true,
  },
  {
    key: "ndyxtra",
    label: "NDYXTRA",
    sub: "AI Marketplace",
    color: "#f97316",
    comingSoon: true,
  },
  {
    key: "ndyquiz",
    label: "NDYQUIZ",
    sub: "Learn · Play · Earn",
    color: "#8b5cf6",
    comingSoon: true,
  },
  {
    key: "cryndy",
    label: "CRYNDY",
    sub: "Community Token",
    color: "#8b5cf6",
    href: "/cryndy",
  },
  {
    key: "ndynex",
    label: "NDYNEX",
    sub: "Crypto & Bitcoin",
    color: "#f97316",
    comingSoon: true,
  },
  {
    key: "ndycollect",
    label: "NDYCOLLECT",
    sub: "Collectibles",
    color: "#4f7cff",
    comingSoon: true,
  },
];

export function EcosystemDirectory() {
  return (
    <>
      <p className="hp-eco-title">NDJOYIT Ecosystem</p>
      <div className="hp-eco-grid">
        {ECOSYSTEM_ITEMS.map((item) => {
          const content = (
            <>
              <div
                className="hp-eco-icon"
                style={{ "--eco-c": item.color } as CSSProperties}
              >
                {ECO_ICONS[item.key]}
              </div>
              <div>
                <div className="hp-eco-name">{item.label}</div>
                <div className="hp-eco-sub">{item.sub}</div>
              </div>
            </>
          );
          if (item.href && !item.comingSoon) {
            return (
              <Link key={item.key} href={item.href} className="hp-eco-item">
                {content}
              </Link>
            );
          }
          return (
            <div
              key={item.key}
              className={`hp-eco-item ${item.comingSoon ? "hp-eco-disabled" : ""}`}
            >
              {content}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ---------- hero ----------
/** idCard is optional and only passed by the authenticated dashboard —
 * the public landing page's hero (app/page.tsx) has no logged-in user's
 * NDY ID to show, so it keeps the original single-column centered
 * layout. Matches the mobile mockup's "glowing ID card beside the
 * headline" treatment. */
export function EcosystemHero({
  eyebrow = "Welcome to NDY HUB",
  idCard,
}: {
  eyebrow?: string;
  idCard?: { ndyId: string; memberSince: string };
}) {
  return (
    <section className={`hp-hero ${idCard ? "hp-hero-split" : ""}`}>
      <div className="hp-earth" />
      <div className="hp-stars" />
      <div className="hp-hero-text">
        <p className="hp-eyebrow">{eyebrow}</p>
        <h1>
          One Identity. One Passport.{" "}
          <span className="hp-grad">One Ecosystem.</span>
        </h1>
        <p>
          NDY HUB is your central gateway to everything in the NDJOYIT ecosystem —
          manage your identity, connect platforms, and help build a global
          ecosystem.
        </p>
      </div>
      {idCard && <NdyIdCard ndyId={idCard.ndyId} memberSince={idCard.memberSince} />}
    </section>
  );
}

function NdyIdCard({ ndyId, memberSince }: { ndyId: string; memberSince: string }) {
  return (
    <div className="hp-idcard">
      <div className="hp-idcard-top">
        <BrandMark size={28} />
        <span className="hp-idcard-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
            <path d="M12 2.5a5 5 0 0 0-5 5v2.3M7 13.5v.8a5 5 0 0 0 10 0v-4a5 5 0 0 0-1.2-3.3" />
            <path d="M12 7.5a3 3 0 0 1 3 3v.8M9.5 21c.3-1.5.5-3.4.5-6.5M14.7 21c-.2-1-.4-2.6-.5-4.5" />
            <path d="M4.5 18.5c1-2.5 1.5-5.3 1.5-8a6 6 0 0 1 1.2-3.6" />
          </svg>
        </span>
      </div>
      <p className="hp-idcard-label">NDY ID</p>
      <p className="hp-idcard-value">{ndyId}</p>
      <p className="hp-idcard-since">
        Member since {new Date(memberSince).toLocaleDateString()}
      </p>
    </div>
  );
}

// ---------- footer ----------
export function HomepageFooter() {
  return (
    <footer className="hp-footer">
      <div style={{ display: "flex", alignItems: "center" }}>
        <div className="hp-footer-brand">
          <BrandMarkSmall />
          <span className="hp-footer-brand-text">
            NDY<span className="hp-hub">HUB</span>
          </span>
        </div>
        <span className="hp-footer-powered">Powered by NDJOYIT</span>
      </div>
      <nav className="hp-footer-links">
        <span>Privacy Policy</span>
        <span>Terms of Service</span>
        <span>Support</span>
        <span>Status</span>
      </nav>
      <div className="hp-footer-right">
        <span className="hp-footer-copy">
          &copy; {new Date().getFullYear()} NDJOYIT. All rights reserved.
        </span>
        <a href="#top" aria-label="Scroll to top" className="hp-to-top">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
          >
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </a>
      </div>
    </footer>
  );
}

function BrandMarkSmall() {
  return <BrandMark size={30} />;
}
