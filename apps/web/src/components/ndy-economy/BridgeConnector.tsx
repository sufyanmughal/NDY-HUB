"use client";

import { ArrowRight, ArrowDown } from "lucide-react";

function BridgeGlyph() {
  return (
    <svg
      className="eco-bridge-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      aria-hidden="true"
    >
      <path d="M2 18h20M4 18v-4c0-4 3.5-7 8-7s8 3 8 7v4M4 14c1.5-1 3-1.5 4-1.5M20 14c-1.5-1-3-1.5-4-1.5M9 18v-3M15 18v-3" />
    </svg>
  );
}

export function BridgeConnector({
  label,
  rateLines,
  colorHex,
}: {
  label: string;
  rateLines: string[];
  colorHex: string;
}) {
  return (
    <div className="eco-bridge" style={{ "--card-c": colorHex } as React.CSSProperties}>
      <div className="eco-bridge-box">
        <div className="eco-bridge-label">{label}</div>
        <BridgeGlyph />
        <div className="eco-bridge-rate">
          {rateLines.map((line, i) => (
            <span key={i}>
              {line}
              {i < rateLines.length - 1 && <br />}
            </span>
          ))}
        </div>
      </div>
      <ArrowRight className="eco-bridge-arrow eco-bridge-arrow-h" aria-hidden="true" />
      <ArrowDown className="eco-bridge-arrow eco-bridge-arrow-v" aria-hidden="true" />
    </div>
  );
}
