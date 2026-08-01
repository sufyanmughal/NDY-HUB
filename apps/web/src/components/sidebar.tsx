"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isNavItemActive } from "@/lib/nav-items";
import { Logo } from "@/components/logo";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-surface">
      <div className="px-6 py-6">
        <Logo />
      </div>
      <nav className="flex-1 px-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active = isNavItemActive(item.href, pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-accent/15 text-foreground font-medium"
                  : "text-foreground-muted hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              <Icon
                size={17}
                strokeWidth={2}
                className={active ? "text-accent" : "text-foreground-muted"}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
