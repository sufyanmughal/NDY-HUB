"use client";

import { useState } from "react";
import {
  Eye,
  ArrowRight,
  ArrowDown,
  RefreshCw,
  ArrowLeftRight,
  Send,
  Download,
  ShieldCheck,
  Eye as EyeTransparent,
  Lock,
  BadgeCheck,
  Rocket,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useCryndySummary } from "@/lib/use-cryndy";
import { useNdybitsSummary } from "@/lib/use-ndybits";
import "@/styles/economy.css";

// Reference values from the client's NDY Economy specification — internal
// planning/display constants only, never presented as a guaranteed market
// price (see docs/ndy-economy-implementation-plan.md §1's legal gate).
const NDYBITS_REF_VALUE_EUR = 0.25;
const CRYNDY_REF_VALUE_EUR = 2.5;
const NDYX_REF_VALUE_EUR = 250;
const NDYBITS_PER_CRYNDY = 10;
const CRYNDY_PER_NDYX = 100;

function BridgeGlyph() {
  return (
    <svg
      className="eco-bridge-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
    >
      <path d="M2 18h20M4 18v-4c0-4 3.5-7 8-7s8 3 8 7v4M4 14c1.5-1 3-1.5 4-1.5M20 14c-1.5-1-3-1.5-4-1.5M9 18v-3M15 18v-3" />
    </svg>
  );
}

function formatEuro(amount: number): string {
  return `€${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export default function EconomyPage() {
  const { auth } = useAuth();
  const cryndy = useCryndySummary();
  const ndybits = useNdybitsSummary();
  const [valueHidden, setValueHidden] = useState(false);

  if (auth.status !== "authenticated") return null;

  const ndybitsBalance = ndybits?.balance ?? 0;
  const cryndyBalance = cryndy?.availableBalance ?? 0;
  // NDYX doesn't exist yet (see docs/ndy-economy-implementation-plan.md —
  // Phase 2, gated behind allocation sign-off and eventually legal review).
  // Held at 0 rather than fabricated so this page never shows a made-up
  // balance for an asset nobody can actually hold yet.
  const ndyxBalance = 0;

  const ndybitsValue = ndybitsBalance * NDYBITS_REF_VALUE_EUR;
  const cryndyValue = cryndyBalance * CRYNDY_REF_VALUE_EUR;
  const ndyxValue = ndyxBalance * NDYX_REF_VALUE_EUR;
  const totalValue = ndybitsValue + cryndyValue + ndyxValue;

  // Progression toward the next milestone in the reward -> utility -> asset
  // ladder — NDYBITS "Earned" reads as 100% of itself; CRYNDY's bar tracks
  // progress toward the 100-CRYNDY bridge threshold (capped display at a
  // sensible max so a large balance doesn't render a mile-long bar); NDYX
  // has no real supply yet, so its bar is an honest 0%, not a guess.
  const cryndyProgressPct = Math.min(
    100,
    Math.round((cryndyBalance / CRYNDY_PER_NDYX) * 100),
  );

  const recentTx = [
    ...(ndybits?.recentEntries.slice(0, 5).map((e) => ({
      id: e.id,
      asset: "N" as const,
      amount: e.amount,
      unit: "NDYBITS",
      reason: e.reason.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      createdAt: e.createdAt,
    })) ?? []),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  return (
    <div className="ndy-economy -mx-6 -mt-6">
      <div className="eco-page">
        <div className="eco-header">
          <h1>NDY ECONOMY</h1>
          <p>Your journey. Your rewards. Your future.</p>
        </div>

        <div className="eco-portfolio">
          <div className="eco-portfolio-value">
            <div className="eco-portfolio-label">
              TOTAL NDY PORTFOLIO VALUE
              <button
                type="button"
                onClick={() => setValueHidden((v) => !v)}
                aria-label={valueHidden ? "Show value" : "Hide value"}
                style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", display: "flex" }}
              >
                <Eye size={14} strokeWidth={2} />
              </button>
            </div>
            <div className="eco-portfolio-amount">
              {valueHidden ? "••••••" : formatEuro(totalValue)}
            </div>
            <div className="eco-portfolio-sub">Total Reference Value</div>
          </div>

          <div className="eco-portfolio-asset">
            <div className="eco-asset-icon" style={{ background: "radial-gradient(circle at 35% 30%, #ffd75e, #f6b503)", color: "#0a0d16" }}>
              N
            </div>
            <div>
              <div className="eco-portfolio-asset-name">NDYBITS</div>
              <div className="eco-portfolio-asset-value">
                {ndybits ? ndybitsBalance.toLocaleString() : "…"}
              </div>
              <div className="eco-portfolio-asset-sub">{formatEuro(ndybitsValue)}</div>
            </div>
          </div>

          <div className="eco-portfolio-asset">
            <div className="eco-asset-icon" style={{ background: "radial-gradient(circle at 35% 30%, #8bf5a4, #3ecf6a)", color: "#0a0d16" }}>
              C
            </div>
            <div>
              <div className="eco-portfolio-asset-name">CRYNDY</div>
              <div className="eco-portfolio-asset-value">
                {cryndy ? cryndyBalance.toLocaleString() : "…"}
              </div>
              <div className="eco-portfolio-asset-sub">{formatEuro(cryndyValue)}</div>
            </div>
          </div>

          <div className="eco-portfolio-asset">
            <div className="eco-asset-icon" style={{ background: "radial-gradient(circle at 35% 30%, #b98bf7, #7e34e9)", color: "#0a0d16" }}>
              X
            </div>
            <div>
              <div className="eco-portfolio-asset-name">NDYX</div>
              <div className="eco-portfolio-asset-value">{ndyxBalance.toFixed(2)}</div>
              <div className="eco-portfolio-asset-sub">{formatEuro(ndyxValue)}</div>
            </div>
          </div>
        </div>

        <div className="eco-grid">
          <div>
            <div className="eco-journey-panel">
              <p className="eco-journey-title">YOUR ECONOMIC JOURNEY</p>
              <div className="eco-journey-row">
                <div className="eco-token-card" style={{ "--card-c": "#f6b503" } as React.CSSProperties}>
                  <p className="eco-token-name">NDYBITS</p>
                  <p className="eco-token-layer">Reward Layer</p>
                  <div className="eco-token-icon">N</div>
                  <div className="eco-token-amount">
                    {ndybits ? ndybitsBalance.toLocaleString() : "…"}
                  </div>
                  <div className="eco-token-ref">≈ {formatEuro(ndybitsValue)}</div>
                  <div className="eco-token-actions">
                    <button type="button" className="eco-token-btn eco-token-btn-solid">
                      Earn More
                    </button>
                  </div>
                </div>

                <div className="eco-bridge" style={{ "--card-c": "#f6b503" } as React.CSSProperties}>
                  <div className="eco-bridge-box">
                    <div className="eco-bridge-label">Bridge 1</div>
                    <BridgeGlyph />
                    <div className="eco-bridge-rate">
                      {NDYBITS_PER_CRYNDY} NDYBITS
                      <br />=<br />1 CRYNDY
                    </div>
                  </div>
                  <ArrowRight className="eco-bridge-arrow" />
                </div>

                <div className="eco-token-card" style={{ "--card-c": "#3ecf6a" } as React.CSSProperties}>
                  <p className="eco-token-name">CRYNDY</p>
                  <p className="eco-token-layer">Utility Layer</p>
                  <div className="eco-token-icon">C</div>
                  <div className="eco-token-amount">
                    {cryndy ? cryndyBalance.toLocaleString() : "…"}
                  </div>
                  <div className="eco-token-ref">≈ {formatEuro(cryndyValue)}</div>
                  <div className="eco-token-actions">
                    <div className="eco-token-actions-row">
                      <button type="button" className="eco-token-btn">Buy</button>
                      <button type="button" className="eco-token-btn">Use</button>
                    </div>
                    <button
                      type="button"
                      className="eco-token-btn"
                      disabled
                      title="NDYX isn't live yet — see NDY Economy implementation plan"
                    >
                      Bridge to NDYX
                    </button>
                  </div>
                </div>

                <div className="eco-bridge" style={{ "--card-c": "#7e34e9" } as React.CSSProperties}>
                  <div className="eco-bridge-box">
                    <div className="eco-bridge-label">Bridge 2</div>
                    <BridgeGlyph />
                    <div className="eco-bridge-rate">
                      {CRYNDY_PER_NDYX} CRYNDY
                      <br />=<br />1 NDYX
                    </div>
                  </div>
                  <ArrowRight className="eco-bridge-arrow" />
                </div>

                <div className="eco-token-card" style={{ "--card-c": "#7e34e9" } as React.CSSProperties}>
                  <p className="eco-token-name">NDYX</p>
                  <p className="eco-token-layer">Strategic Asset</p>
                  <div className="eco-token-icon">X</div>
                  <div className="eco-token-amount">{ndyxBalance.toFixed(2)}</div>
                  <div className="eco-token-ref">≈ {formatEuro(ndyxValue)}</div>
                  <div className="eco-token-actions">
                    <button
                      type="button"
                      className="eco-token-btn eco-token-btn-solid"
                      disabled
                      title="NDYX isn't live yet — see NDY Economy implementation plan"
                    >
                      View Asset
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="eco-how">
              <p className="eco-how-title">HOW IT WORKS</p>
              <div className="eco-how-grid">
                <div className="eco-how-col" style={{ "--card-c": "#f6b503" } as React.CSSProperties}>
                  <h3>Earn NDYBITS</h3>
                  <ul>
                    <li>NDYQUIZ</li>
                    <li>NDJOYITSTEPS</li>
                    <li>Referrals</li>
                    <li>Purchases</li>
                    <li>Events &amp; Challenges</li>
                    <li>And more…</li>
                  </ul>
                </div>
                <div className="eco-how-col" style={{ "--card-c": "#3ecf6a" } as React.CSSProperties}>
                  <h3>Convert to CRYNDY</h3>
                  <p>
                    Use NDYBITS to convert to CRYNDY via Bridge 1 or buy
                    CRYNDY directly.
                  </p>
                </div>
                <div className="eco-how-col" style={{ "--card-c": "#7e34e9" } as React.CSSProperties}>
                  <h3>Upgrade to NDYX</h3>
                  <p>
                    Convert your CRYNDY to NDYX via Bridge 2 and hold a piece
                    of the future.
                  </p>
                </div>
              </div>
            </div>

            <div className="eco-actions">
              <button type="button" className="eco-action-card" style={{ "--card-c": "#3ecf6a" } as React.CSSProperties}>
                <div className="eco-action-icon">
                  <RefreshCw />
                </div>
                <div>
                  <div className="eco-action-title">Buy CRYNDY</div>
                  <div className="eco-action-sub">Purchase CRYNDY with secure payment</div>
                </div>
              </button>
              <button type="button" className="eco-action-card" style={{ "--card-c": "#f6b503" } as React.CSSProperties}>
                <div className="eco-action-icon">
                  <ArrowLeftRight />
                </div>
                <div>
                  <div className="eco-action-title">Convert</div>
                  <div className="eco-action-sub">Use NDYBITS to get CRYNDY</div>
                </div>
              </button>
              <button
                type="button"
                className="eco-action-card"
                style={{ "--card-c": "#8891a8" } as React.CSSProperties}
                disabled
                title="NDYX isn't live yet — see NDY Economy implementation plan"
              >
                <div className="eco-action-icon">
                  <ArrowDown />
                </div>
                <div>
                  <div className="eco-action-title">Bridge to NDYX</div>
                  <div className="eco-action-sub">Upgrade CRYNDY to NDYX</div>
                </div>
              </button>
              <button type="button" className="eco-action-card" style={{ "--card-c": "#3ecf6a" } as React.CSSProperties}>
                <div className="eco-action-icon">
                  <Send />
                </div>
                <div>
                  <div className="eco-action-title">Send</div>
                  <div className="eco-action-sub">Send CRYNDY or NDYX</div>
                </div>
              </button>
              <button type="button" className="eco-action-card" style={{ "--card-c": "#7e34e9" } as React.CSSProperties}>
                <div className="eco-action-icon">
                  <Download />
                </div>
                <div>
                  <div className="eco-action-title">Receive</div>
                  <div className="eco-action-sub">Receive CRYNDY or NDYX</div>
                </div>
              </button>
            </div>

            <div className="eco-trust">
              <div className="eco-trust-item">
                <ShieldCheck />
                <div>
                  <div className="eco-trust-title">Secure</div>
                  <div className="eco-trust-sub">Bank-level security</div>
                </div>
              </div>
              <div className="eco-trust-item">
                <EyeTransparent />
                <div>
                  <div className="eco-trust-title">Transparent</div>
                  <div className="eco-trust-sub">Full on-chain &amp; system logs</div>
                </div>
              </div>
              <div className="eco-trust-item">
                <Lock />
                <div>
                  <div className="eco-trust-title">Controlled</div>
                  <div className="eco-trust-sub">Bridge limits &amp; protection</div>
                </div>
              </div>
              <div className="eco-trust-item">
                <BadgeCheck />
                <div>
                  <div className="eco-trust-title">Compliant</div>
                  <div className="eco-trust-sub">KYC &amp; AML protected</div>
                </div>
              </div>
              <div className="eco-trust-item">
                <Rocket />
                <div>
                  <div className="eco-trust-title">Future Ready</div>
                  <div className="eco-trust-sub">Built for millions</div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="eco-panel">
              <p className="eco-panel-title">YOUR PROGRESSION</p>

              <div className="eco-progress-row" style={{ "--card-c": "#f6b503" } as React.CSSProperties}>
                <div className="eco-progress-icon">N</div>
                <div className="eco-progress-body">
                  <div className="eco-progress-name">NDYBITS</div>
                  <div className="eco-progress-value">
                    {ndybits ? ndybitsBalance.toLocaleString() : "…"}
                  </div>
                  <div className="eco-progress-caption">Earned</div>
                  <div className="eco-progress-track">
                    <div className="eco-progress-fill" style={{ width: "100%" }} />
                  </div>
                </div>
                <span className="eco-progress-pct">100%</span>
              </div>
              <ArrowDown className="eco-progress-connector" />

              <div className="eco-progress-row" style={{ "--card-c": "#3ecf6a" } as React.CSSProperties}>
                <div className="eco-progress-icon">C</div>
                <div className="eco-progress-body">
                  <div className="eco-progress-name">CRYNDY</div>
                  <div className="eco-progress-value">
                    {cryndy ? `${cryndyBalance.toLocaleString()} / ${CRYNDY_PER_NDYX}` : "…"}
                  </div>
                  <div className="eco-progress-caption">Collected</div>
                  <div className="eco-progress-track">
                    <div
                      className="eco-progress-fill"
                      style={{ width: `${Math.min(100, cryndyProgressPct)}%` }}
                    />
                  </div>
                </div>
                <span className="eco-progress-pct">{cryndyProgressPct}%</span>
              </div>
              <ArrowDown className="eco-progress-connector" />

              <div className="eco-progress-row" style={{ "--card-c": "#7e34e9" } as React.CSSProperties}>
                <div className="eco-progress-icon">X</div>
                <div className="eco-progress-body">
                  <div className="eco-progress-name">NDYX</div>
                  <div className="eco-progress-value">{ndyxBalance.toFixed(2)}</div>
                  <div className="eco-progress-caption">Strategic Asset</div>
                  <div className="eco-progress-track">
                    <div className="eco-progress-fill" style={{ width: "0%" }} />
                  </div>
                </div>
                <span className="eco-progress-pct">0%</span>
              </div>

              <p className="eco-progress-cta">Keep going, your future is building! 🚀</p>
            </div>

            <div className="eco-panel">
              <div className="eco-tx-header">
                <p className="eco-panel-title" style={{ margin: 0 }}>
                  RECENT TRANSACTIONS
                </p>
                <button type="button" className="eco-tx-viewall">
                  View all
                </button>
              </div>

              {ndybits === null && cryndy === null ? (
                <p className="eco-tx-empty">Loading…</p>
              ) : recentTx.length === 0 ? (
                <p className="eco-tx-empty">
                  No transactions yet — earning and spending NDYBITS and
                  CRYNDY will show up here.
                </p>
              ) : (
                recentTx.map((tx) => (
                  <div key={tx.id} className="eco-tx-row" style={{ "--card-c": "#f6b503" } as React.CSSProperties}>
                    <div className="eco-tx-icon">{tx.asset}</div>
                    <div className="eco-tx-body">
                      <div
                        className={`eco-tx-amount ${tx.amount >= 0 ? "eco-tx-positive" : "eco-tx-negative"}`}
                      >
                        {tx.amount >= 0 ? "+" : ""}
                        {tx.amount.toLocaleString()} {tx.unit}
                      </div>
                      <div className="eco-tx-reason">{tx.reason}</div>
                    </div>
                    <span className="eco-tx-time">{relativeTime(tx.createdAt)}</span>
                  </div>
                ))
              )}
            </div>

            <div className="eco-panel">
              <p className="eco-panel-title">REFERENCES</p>
              <p style={{ marginTop: -10, marginBottom: 14, fontSize: 12, color: "var(--eco-fg-muted)" }}>
                Learn more about each asset
              </p>
              <div className="eco-ref-row" style={{ "--card-c": "#f6b503" } as React.CSSProperties}>
                <div>
                  <div className="eco-ref-name">NDYBITS</div>
                  <div className="eco-ref-sub">Reference Value</div>
                </div>
                <div className="eco-ref-value">{formatEuro(NDYBITS_REF_VALUE_EUR)}</div>
              </div>
              <div className="eco-ref-row" style={{ "--card-c": "#3ecf6a" } as React.CSSProperties}>
                <div>
                  <div className="eco-ref-name">CRYNDY</div>
                  <div className="eco-ref-sub">Reference Value</div>
                </div>
                <div className="eco-ref-value">{formatEuro(CRYNDY_REF_VALUE_EUR)}</div>
              </div>
              <div className="eco-ref-row" style={{ "--card-c": "#7e34e9" } as React.CSSProperties}>
                <div>
                  <div className="eco-ref-name">NDYX</div>
                  <div className="eco-ref-sub">Initial Reference Value</div>
                </div>
                <div className="eco-ref-value">{formatEuro(NDYX_REF_VALUE_EUR)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
