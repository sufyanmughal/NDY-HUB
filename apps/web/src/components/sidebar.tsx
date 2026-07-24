"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/passport", label: "NDY Passport" },
  { href: "/memberships", label: "Memberships" },
  { href: "/cryndy", label: "CRYNDY" },
  { href: "/ndybits", label: "NDYBITS" },
  { href: "/platforms", label: "Connected Platforms" },
  { href: "/transactions", label: "Transactions" },
  { href: "/documents", label: "Documents" },
  { href: "/security", label: "Security" },
  { href: "/settings", label: "Settings" },
  { href: "/support", label: "Support" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-surface">
      <div className="px-6 py-6">
        <span className="font-semibold tracking-tight text-lg">
          NDY <span className="text-accent">HUB</span>
          <sup className="text-[10px] align-super text-foreground-muted">™</sup>
        </span>
      </div>
      <nav className="flex-1 px-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-accent/15 text-foreground font-medium"
                  : "text-foreground-muted hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
