"use client";

import type { ReactNode } from "react";

export function ActionTile({
  colorHex,
  icon,
  title,
  description,
  onClick,
  disabled,
  disabledReason,
}: {
  colorHex: string;
  icon: ReactNode;
  title: string;
  description: string;
  onClick?: () => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <button
      type="button"
      className="eco-action-card"
      style={{ "--card-c": colorHex } as React.CSSProperties}
      onClick={onClick}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      aria-label={disabled && disabledReason ? `${title} — ${disabledReason}` : title}
    >
      <div className="eco-action-icon" aria-hidden="true">
        {icon}
      </div>
      <div>
        <div className="eco-action-title">{title}</div>
        <div className="eco-action-sub">{description}</div>
      </div>
    </button>
  );
}
