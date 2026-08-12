"use client";

import { RefreshCw, ArrowLeftRight, ArrowDown, Send, Download, ShieldCheck, Eye, Lock, BadgeCheck, Rocket } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useCryndySummary } from "@/lib/use-cryndy";
import { useNdybitsSummary } from "@/lib/use-ndybits";
import { PortfolioSummaryCard } from "@/components/ndy-economy/PortfolioSummaryCard";
import { AssetStageCard } from "@/components/ndy-economy/AssetStageCard";
import { BridgeConnector } from "@/components/ndy-economy/BridgeConnector";
import { HowItWorksPanel } from "@/components/ndy-economy/HowItWorksPanel";
import { ActionTile } from "@/components/ndy-economy/ActionTile";
import { ProgressionStep } from "@/components/ndy-economy/ProgressionStep";
import { TransactionRow } from "@/components/ndy-economy/TransactionRow";
import { ReferenceRow } from "@/components/ndy-economy/ReferenceRow";
import { TrustStripItem } from "@/components/ndy-economy/TrustStripItem";
import {
  ASSET_COLORS,
  NDYBITS_REF_VALUE_EUR,
  CRYNDY_REF_VALUE_EUR,
  NDYX_REF_VALUE_EUR,
  NDYBITS_PER_CRYNDY,
  CRYNDY_PER_NDYX,
  type AssetBalance,
  type Transaction,
} from "./mock-data";
import "@/styles/economy.css";

// NDYX has no backend model yet (see mock-data.ts's TODO / docs/ndy-
// economy-implementation-plan.md's Phase 2) — this is a visual-only
// placeholder for the progression bar, not derived from real holdings.
const NDYX_PLACEHOLDER_PROGRESS_PCT = 50;

function formatEuro(amount: number): string {
  return `€${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function EconomyPage() {
  const { auth } = useAuth();
  const cryndy = useCryndySummary();
  const ndybits = useNdybitsSummary();

  if (auth.status !== "authenticated") return null;

  const ndybitsBalance = ndybits?.balance ?? 0;
  const cryndyBalance = cryndy?.availableBalance ?? 0;
  // NDYX doesn't exist in the backend yet (see docs/ndy-economy-
  // implementation-plan.md, Phase 2 — gated behind allocation sign-off and
  // eventually legal review). Held at 0 rather than fabricated so this
  // page never shows a made-up balance for an asset nobody can hold yet.
  const ndyxBalance = 0;

  const assets: AssetBalance[] = [
    {
      symbol: "NDYBITS",
      name: "NDYBITS",
      amount: ndybitsBalance,
      euroValue: ndybitsBalance * NDYBITS_REF_VALUE_EUR,
      colorHex: ASSET_COLORS.NDYBITS,
    },
    {
      symbol: "CRYNDY",
      name: "CRYNDY",
      amount: cryndyBalance,
      euroValue: cryndyBalance * CRYNDY_REF_VALUE_EUR,
      colorHex: ASSET_COLORS.CRYNDY,
    },
    {
      symbol: "NDYX",
      name: "NDYX",
      amount: ndyxBalance,
      euroValue: ndyxBalance * NDYX_REF_VALUE_EUR,
      colorHex: ASSET_COLORS.NDYX,
    },
  ];

  const cryndyProgressPct = Math.round((cryndyBalance / CRYNDY_PER_NDYX) * 100);

  const transactions: Transaction[] = (ndybits?.recentEntries ?? [])
    .slice(0, 8)
    .map((e) => ({
      id: e.id,
      symbol: "NDYBITS" as const,
      amount: e.amount,
      description: e.reason.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      timestamp: e.createdAt,
    }));

  const loading = ndybits === null && cryndy === null;

  return (
    <div className="ndy-economy -mx-6 -mt-6">
      <div className="eco-page">
        <div className="eco-header">
          <h1>NDY ECONOMY</h1>
          <p>Your journey. Your rewards. Your future.</p>
        </div>

        <PortfolioSummaryCard assets={assets} />

        <div className="eco-grid">
          <div>
            <div className="eco-journey-panel">
              <p className="eco-journey-title">YOUR ECONOMIC JOURNEY</p>
              <div className="eco-journey-row">
                <AssetStageCard
                  colorHex={ASSET_COLORS.NDYBITS}
                  symbol="NDYBITS"
                  layerLabel="Reward Layer"
                  glyph="N"
                  amount={ndybits ? ndybitsBalance.toLocaleString() : "…"}
                  euroValue={formatEuro(ndybitsBalance * NDYBITS_REF_VALUE_EUR)}
                  actions={[[{ label: "Earn More", variant: "solid" }]]}
                />

                <BridgeConnector
                  label="Bridge 1"
                  rateLines={[`${NDYBITS_PER_CRYNDY} NDYBITS`, "=", "1 CRYNDY"]}
                  colorHex={ASSET_COLORS.NDYBITS}
                />

                <AssetStageCard
                  colorHex={ASSET_COLORS.CRYNDY}
                  symbol="CRYNDY"
                  layerLabel="Utility Layer"
                  glyph="C"
                  amount={cryndy ? cryndyBalance.toLocaleString() : "…"}
                  euroValue={formatEuro(cryndyBalance * CRYNDY_REF_VALUE_EUR)}
                  actions={[
                    [{ label: "Buy" }, { label: "Use" }],
                    [
                      {
                        label: "Bridge to NDYX",
                        disabled: true,
                        title: "NDYX isn't live yet — see NDY Economy implementation plan",
                      },
                    ],
                  ]}
                />

                <BridgeConnector
                  label="Bridge 2"
                  rateLines={[`${CRYNDY_PER_NDYX} CRYNDY`, "=", "1 NDYX"]}
                  colorHex={ASSET_COLORS.NDYX}
                />

                <AssetStageCard
                  colorHex={ASSET_COLORS.NDYX}
                  symbol="NDYX"
                  layerLabel="Strategic Asset"
                  glyph="X"
                  amount={ndyxBalance.toFixed(2)}
                  euroValue={formatEuro(ndyxBalance * NDYX_REF_VALUE_EUR)}
                  actions={[
                    [
                      {
                        label: "View Asset",
                        variant: "solid",
                        disabled: true,
                        title: "NDYX isn't live yet — see NDY Economy implementation plan",
                      },
                    ],
                  ]}
                />
              </div>
            </div>

            <HowItWorksPanel
              columns={[
                {
                  title: "Earn NDYBITS",
                  colorHex: ASSET_COLORS.NDYBITS,
                  glyph: "N",
                  bullets: [
                    "NDYQUIZ",
                    "NDJOYITSTEPS",
                    "Referrals",
                    "Purchases",
                    "Events & Challenges",
                    "And more…",
                  ],
                },
                {
                  title: "Convert to CRYNDY",
                  colorHex: ASSET_COLORS.CRYNDY,
                  glyph: "C",
                  paragraph: "Use NDYBITS to convert to CRYNDY via Bridge 1 or buy CRYNDY directly.",
                },
                {
                  title: "Upgrade to NDYX",
                  colorHex: ASSET_COLORS.NDYX,
                  glyph: "X",
                  paragraph: "Convert your CRYNDY to NDYX via Bridge 2 and hold a piece of the future.",
                },
              ]}
            />

            <div className="eco-actions">
              <ActionTile
                colorHex={ASSET_COLORS.CRYNDY}
                icon={<RefreshCw />}
                title="Buy CRYNDY"
                description="Purchase CRYNDY with secure payment"
              />
              <ActionTile
                colorHex={ASSET_COLORS.NDYBITS}
                icon={<ArrowLeftRight />}
                title="Convert"
                description="Use NDYBITS to get CRYNDY"
              />
              <ActionTile
                colorHex="#8891a8"
                icon={<ArrowDown />}
                title="Bridge to NDYX"
                description="Upgrade CRYNDY to NDYX"
                disabled
                disabledReason="NDYX isn't live yet"
              />
              <ActionTile
                colorHex={ASSET_COLORS.CRYNDY}
                icon={<Send />}
                title="Send"
                description="Send CRYNDY or NDYX"
              />
              <ActionTile
                colorHex={ASSET_COLORS.NDYX}
                icon={<Download />}
                title="Receive"
                description="Receive CRYNDY or NDYX"
              />
            </div>

            <div className="eco-trust">
              <TrustStripItem icon={<ShieldCheck />} title="Secure" caption="Bank-level security" />
              <TrustStripItem icon={<Eye />} title="Transparent" caption="Full on-chain & system logs" />
              <TrustStripItem icon={<Lock />} title="Controlled" caption="Bridge limits & protection" />
              <TrustStripItem icon={<BadgeCheck />} title="Compliant" caption="KYC & AML protected" />
              <TrustStripItem icon={<Rocket />} title="Future Ready" caption="Built for millions" />
            </div>
          </div>

          <div>
            <div className="eco-panel">
              <p className="eco-panel-title">YOUR PROGRESSION</p>

              <ProgressionStep
                data={{
                  symbol: "NDYBITS",
                  label: "Earned",
                  current: ndybitsBalance,
                  target: 0,
                  percent: 100,
                }}
                glyph="N"
                colorHex={ASSET_COLORS.NDYBITS}
              />
              <ProgressionStep
                data={{
                  symbol: "CRYNDY",
                  label: "Collected",
                  current: cryndyBalance,
                  target: CRYNDY_PER_NDYX,
                  percent: cryndyProgressPct,
                }}
                glyph="C"
                colorHex={ASSET_COLORS.CRYNDY}
              />
              <ProgressionStep
                data={{
                  symbol: "NDYX",
                  label: "Strategic Asset",
                  current: ndyxBalance,
                  target: 0,
                  // NDYX has no backend yet (see mock-data.ts's TODO) — this
                  // 50% is a visual placeholder only, not derived from real
                  // holdings, unlike CRYNDY's percent above.
                  percent: NDYX_PLACEHOLDER_PROGRESS_PCT,
                }}
                glyph="X"
                colorHex={ASSET_COLORS.NDYX}
                isLast
              />

              <p className="eco-progress-cta">Keep going, your future is building! 🚀</p>
            </div>

            <div className="eco-panel">
              <div className="eco-tx-header">
                <p className="eco-panel-title" style={{ margin: 0 }}>
                  RECENT TRANSACTIONS
                </p>
                <button type="button" className="eco-tx-viewall" aria-label="View all transactions">
                  View all
                </button>
              </div>

              {loading ? (
                <p className="eco-tx-empty">Loading…</p>
              ) : transactions.length === 0 ? (
                <p className="eco-tx-empty">
                  No transactions yet — earning and spending NDYBITS and
                  CRYNDY will show up here.
                </p>
              ) : (
                transactions.map((tx) => <TransactionRow key={tx.id} tx={tx} />)
              )}
            </div>

            <div className="eco-panel">
              <p className="eco-panel-title">REFERENCES</p>
              <p style={{ marginTop: -10, marginBottom: 14, fontSize: 12, color: "var(--eco-fg-muted)" }}>
                Learn more about each asset
              </p>
              <ReferenceRow
                colorHex={ASSET_COLORS.NDYBITS}
                name="NDYBITS"
                label="Reference Value"
                valueEur={formatEuro(NDYBITS_REF_VALUE_EUR)}
              />
              <ReferenceRow
                colorHex={ASSET_COLORS.CRYNDY}
                name="CRYNDY"
                label="Reference Value"
                valueEur={formatEuro(CRYNDY_REF_VALUE_EUR)}
              />
              <ReferenceRow
                colorHex={ASSET_COLORS.NDYX}
                name="NDYX"
                label="Initial Reference Value"
                valueEur={formatEuro(NDYX_REF_VALUE_EUR)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
