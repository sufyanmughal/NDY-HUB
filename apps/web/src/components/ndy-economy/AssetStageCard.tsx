"use client";

import type { ReactNode } from "react";

export interface AssetStageAction {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  variant?: "solid" | "outline";
}

export function AssetStageCard({
  colorHex,
  symbol,
  layerLabel,
  glyph,
  amount,
  euroValue,
  actions,
}: {
  colorHex: string;
  symbol: string;
  layerLabel: string;
  glyph: ReactNode;
  amount: string;
  euroValue: string;
  actions: AssetStageAction[][];
}) {
  return (
    <div className="eco-token-card" style={{ "--card-c": colorHex } as React.CSSProperties}>
      <p className="eco-token-name">{symbol}</p>
      <p className="eco-token-layer">{layerLabel}</p>
      <div className="eco-token-icon" aria-hidden="true">
        {glyph}
      </div>
      <div className="eco-token-amount">{amount}</div>
      <div className="eco-token-ref">≈ {euroValue}</div>
      <div className="eco-token-actions">
        {actions.map((row, i) => (
          <div key={i} className="eco-token-actions-row">
            {row.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled}
                title={action.title}
                className={`eco-token-btn ${action.variant === "solid" ? "eco-token-btn-solid" : ""}`}
              >
                {action.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
