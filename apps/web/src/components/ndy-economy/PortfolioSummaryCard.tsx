"use client";

import { Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { ASSET_LOGOS, type AssetBalance } from "@/app/(dashboard)/economy/mock-data";

function formatEuro(amount: number): string {
  return `€${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PortfolioSummaryCard({ assets }: { assets: AssetBalance[] }) {
  const [hidden, setHidden] = useState(false);
  const total = assets.reduce((sum, a) => sum + a.euroValue, 0);

  return (
    <div className="eco-portfolio">
      <div className="eco-portfolio-value">
        <div className="eco-portfolio-label">
          TOTAL NDY PORTFOLIO VALUE
          <button
            type="button"
            onClick={() => setHidden((v) => !v)}
            aria-label={hidden ? "Show portfolio value" : "Hide portfolio value"}
            className="eco-eye-toggle"
          >
            {hidden ? <EyeOff size={14} strokeWidth={2} /> : <Eye size={14} strokeWidth={2} />}
          </button>
        </div>
        <div className="eco-portfolio-amount">{hidden ? "••••••" : formatEuro(total)}</div>
        <div className="eco-portfolio-sub">Total Reference Value</div>
      </div>

      {assets.map((asset) => (
        <div key={asset.symbol} className="eco-portfolio-asset">
          <div
            className="eco-asset-icon"
            style={{ "--card-c": asset.colorHex } as React.CSSProperties}
            aria-hidden="true"
          >
            <Image src={ASSET_LOGOS[asset.symbol]} alt="" width={40} height={40} />
          </div>
          <div>
            <div className="eco-portfolio-asset-name">{asset.name}</div>
            <div className="eco-portfolio-asset-value">
              {asset.amount.toLocaleString(undefined, {
                maximumFractionDigits: asset.symbol === "NDYX" ? 2 : 0,
              })}
            </div>
            <div className="eco-portfolio-asset-sub">{formatEuro(asset.euroValue)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
