"use client";

import type { ReactNode } from "react";

export function TrustStripItem({
  icon,
  title,
  caption,
}: {
  icon: ReactNode;
  title: string;
  caption: string;
}) {
  return (
    <div className="eco-trust-item">
      <span aria-hidden="true">{icon}</span>
      <div>
        <div className="eco-trust-title">{title}</div>
        <div className="eco-trust-sub">{caption}</div>
      </div>
    </div>
  );
}
