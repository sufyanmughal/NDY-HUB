"use client";

import type { ReactNode } from "react";

export interface HowItWorksColumn {
  title: string;
  colorHex: string;
  glyph: ReactNode;
  bullets?: string[];
  paragraph?: string;
}

// The ring + sparkle treatment around each column's coin glyph is
// transcribed from the reference mockup's "How It Works" section (pixel-
// sampled) — a thin dashed ring plus two small 4-point sparkle accents
// offset from its top-right, not just the bare coin used elsewhere on
// this page.
function BadgeWithRing({ colorHex, glyph }: { colorHex: string; glyph: ReactNode }) {
  return (
    <div className="eco-how-badge" style={{ "--card-c": colorHex } as React.CSSProperties} aria-hidden="true">
      <div className="eco-how-badge-ring" />
      <div className="eco-how-badge-coin">{glyph}</div>
      <svg className="eco-how-sparkle eco-how-sparkle-1" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" />
      </svg>
      <svg className="eco-how-sparkle eco-how-sparkle-2" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" />
      </svg>
    </div>
  );
}

export function HowItWorksPanel({ columns }: { columns: HowItWorksColumn[] }) {
  return (
    <div className="eco-how">
      <p className="eco-how-title">HOW IT WORKS</p>
      <div className="eco-how-grid">
        {columns.map((col) => (
          <div
            key={col.title}
            className="eco-how-col"
            style={{ "--card-c": col.colorHex } as React.CSSProperties}
          >
            <div className="eco-how-col-text">
              <h3>{col.title}</h3>
              {col.bullets && (
                <ul>
                  {col.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
              {col.paragraph && <p>{col.paragraph}</p>}
            </div>
            <BadgeWithRing colorHex={col.colorHex} glyph={col.glyph} />
          </div>
        ))}
      </div>
    </div>
  );
}
