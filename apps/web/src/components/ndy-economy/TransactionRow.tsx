"use client";

import type { Transaction } from "@/app/(dashboard)/economy/mock-data";
import { ASSET_COLORS } from "@/app/(dashboard)/economy/mock-data";

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

export function TransactionRow({ tx }: { tx: Transaction }) {
  const isPositive = tx.amount >= 0;
  const colorHex = ASSET_COLORS[tx.symbol];
  const glyph = tx.symbol === "NDYX" ? "X" : tx.symbol.charAt(0);

  return (
    <div className="eco-tx-row" style={{ "--card-c": colorHex } as React.CSSProperties}>
      <div className="eco-tx-icon" aria-hidden="true">
        {glyph}
      </div>
      <div className="eco-tx-body">
        <div className={`eco-tx-amount ${isPositive ? "eco-tx-positive" : "eco-tx-negative"}`}>
          {/* Sign is explicit text, not just color, per accessibility requirement. */}
          {isPositive ? "+" : ""}
          {tx.amount.toLocaleString()} {tx.symbol}
        </div>
        <div className="eco-tx-reason">{tx.description}</div>
      </div>
      <span className="eco-tx-time">{relativeTime(tx.timestamp)}</span>
    </div>
  );
}
