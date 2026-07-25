"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  IdCard,
  Users,
  Coins,
  Boxes,
  Link2,
  ArrowLeftRight,
  FileText,
  ShieldCheck,
  Settings as SettingsIcon,
  LifeBuoy,
  type LucideIcon,
} from "lucide-react";

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/passport", label: "NDY Passport", icon: IdCard },
  { href: "/memberships", label: "Memberships", icon: Users },
  { href: "/cryndy", label: "CRYNDY", icon: Coins },
  { href: "/ndybits", label: "NDYBITS", icon: Boxes },
  { href: "/platforms", label: "Connected Platforms", icon: Link2 },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/security", label: "Security", icon: ShieldCheck },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
  { href: "/support", label: "Support", icon: LifeBuoy },
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
