"use client";

import Link from "next/link";
import type { NavItem } from "@/lib/nav-items";

/** Shared between the desktop Sidebar and the mobile nav drawer, so the
 * external/comingSoon/sublabel/iconColor behavior added for the mockup
 * rebuild only has one implementation instead of drifting between two
 * copy-pasted versions. */
export function NavItemLink({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;

  const content = (
    <>
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={
          item.iconColor
            ? { backgroundColor: `${item.iconColor}26`, color: item.iconColor }
            : undefined
        }
      >
        <Icon
          size={18}
          strokeWidth={2}
          className={item.iconColor ? undefined : "text-foreground-muted"}
        />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{item.label}</span>
        {item.sublabel && (
          <span className="block truncate text-xs text-foreground-muted">
            {item.sublabel}
          </span>
        )}
      </span>
    </>
  );

  const className = `flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
    active ? "text-[#0a0d16]" : "text-foreground hover:bg-white/5"
  }`;
  const style = active ? { backgroundColor: "#d3d7fd" } : undefined;

  if (item.comingSoon) {
    return (
      <div className={`${className} cursor-default opacity-50`} title="Coming soon">
        {content}
      </div>
    );
  }
  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noreferrer"
        className={className}
        style={style}
        onClick={onClick}
      >
        {content}
      </a>
    );
  }
  return (
    <Link href={item.href} className={className} style={style} onClick={onClick}>
      {content}
    </Link>
  );
}
