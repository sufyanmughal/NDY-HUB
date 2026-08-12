"use client";

import type { ProgressionData } from "@/app/(dashboard)/economy/mock-data";

export function ProgressionStep({
  data,
  glyph,
  colorHex,
  isLast,
}: {
  data: ProgressionData;
  glyph: string;
  colorHex: string;
  isLast?: boolean;
}) {
  // Handles values that legitimately exceed 100% (e.g. someone holding
  // more CRYNDY than the next bridge threshold) — the bar itself caps
  // visually at 100% width, but the printed percentage stays true.
  const fillPct = Math.min(100, Math.max(0, data.percent));

  return (
    <>
      <div className="eco-progress-row" style={{ "--card-c": colorHex } as React.CSSProperties}>
        <div className="eco-progress-icon" aria-hidden="true">
          {glyph}
        </div>
        <div className="eco-progress-body">
          <div className="eco-progress-name">{data.symbol}</div>
          <div className="eco-progress-value">
            {data.target > 0
              ? `${data.current.toLocaleString()} / ${data.target.toLocaleString()}`
              : data.current.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <div className="eco-progress-caption">{data.label}</div>
          <div
            className="eco-progress-track"
            role="progressbar"
            aria-valuenow={Math.round(data.percent)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${data.symbol} progress: ${Math.round(data.percent)}%`}
          >
            <div className="eco-progress-fill" style={{ width: `${fillPct}%` }} />
          </div>
        </div>
        <span className="eco-progress-pct">{Math.round(data.percent)}%</span>
      </div>
      {!isLast && (
        <svg
          className="eco-progress-connector"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path d="M12 4v14M6 13l6 6 6-6" />
        </svg>
      )}
    </>
  );
}
