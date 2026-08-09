"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HardDrive } from "lucide-react";
import { NDYSPACE_NAV_ITEMS, isNdyspaceNavItemActive } from "@/lib/ndyspace-nav-items";
import { Logo } from "@/components/logo";
import { useDriveStorage } from "@/lib/ndyspace-hooks";

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

// Storage widget (§2.2: used/total, progress bar, %, "Go to Drive" CTA) —
// its own small component so both the desktop sidebar and mobile drawer can
// render the exact same thing without duplicating the fetch/format logic.
function StorageWidget() {
  const usage = useDriveStorage();

  return (
    <div className="mx-3 mb-3 rounded-lg border border-border bg-surface-2 p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-foreground-muted">
        <HardDrive size={14} strokeWidth={2} />
        Storage
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-background">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${Math.min(100, usage?.percentUsed ?? 0)}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-foreground-muted">
        <span>
          {usage ? `${formatBytes(usage.usedBytes)} of ${formatBytes(usage.totalBytes)}` : "…"}
        </span>
        <span>{usage ? `${usage.percentUsed}%` : ""}</span>
      </div>
      <Link
        href="/ndyspace/drive"
        className="mt-2 block text-center text-[11px] font-medium text-accent hover:underline"
      >
        Go to Drive
      </Link>
    </div>
  );
}

export function NdyspaceSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-surface">
      <div className="px-6 py-6">
        <Logo />
        <p className="mt-1 text-[11px] uppercase tracking-wide text-foreground-muted">
          NDYSPACE™ — Your Digital Space
        </p>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {NDYSPACE_NAV_ITEMS.map((item) => {
          const active = !item.external && isNdyspaceNavItemActive(item.href, pathname);
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
      <StorageWidget />
      <div className="border-t border-border px-6 py-4 text-[11px] text-foreground-muted">
        NDY HUB — Powered by NDJOYIT
        <br />
        NDYSPACE v0.1.0 (Phase 0/1)
      </div>
    </aside>
  );
}
