"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HardDrive } from "lucide-react";
import { NDYSPACE_NAV_ITEMS, isNdyspaceNavItemActive } from "@/lib/ndyspace-nav-items";
import { BrandMark } from "@/components/logo";
import { useDriveStorage, useNdyspaceOverview } from "@/lib/ndyspace-hooks";

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
  const percent = Math.min(100, usage?.percentUsed ?? 0);

  return (
    <div className="ndyspace-storage-widget mx-3 mb-3 p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-foreground-muted">
        <HardDrive size={14} strokeWidth={2} />
        Storage
      </div>
      <div className="mt-2 text-xs font-medium text-foreground">
        {usage ? `${formatBytes(usage.usedBytes)} / ${formatBytes(usage.totalBytes)}` : "…"}
      </div>
      <div className="ndyspace-storage-track mt-2 h-1.5 w-full">
        <div className="ndyspace-storage-fill h-full" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-1.5 text-[11px] text-foreground-muted">{usage ? `${percent}%` : ""}</div>
      <Link href="/ndyspace/drive" className="ndyspace-storage-cta mt-2 px-3 py-1.5 text-xs">
        Go to Drive
      </Link>
    </div>
  );
}

export function NdyspaceSidebar() {
  const pathname = usePathname();
  const { data: overview } = useNdyspaceOverview();
  const mailBadge = overview?.unreadMailCount ?? 0;
  const notificationsBadge = overview?.notifications.unreadCount ?? 0;

  return (
    <aside className="ndyspace-sidebar hidden md:flex w-[230px] shrink-0 flex-col">
      <div className="px-5 py-6">
        <BrandMark size={30} />
        <p className="mt-2 text-sm font-semibold tracking-tight text-foreground">NDYSPACE™</p>
        <p className="ndyspace-sidebar-brand-sub text-[11px]">Your Digital Space</p>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {NDYSPACE_NAV_ITEMS.map((item) => {
          const active = !item.external && isNdyspaceNavItemActive(item.href, pathname);
          const Icon = item.icon;
          const badge =
            item.href === "/ndyspace/mail"
              ? mailBadge
              : item.href === "/ndyspace/notifications"
                ? notificationsBadge
                : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`ndyspace-nav-item flex items-center gap-3 px-3 py-2 text-sm ${active ? "is-active" : ""}`}
            >
              <Icon
                size={17}
                strokeWidth={2}
                className={`ndyspace-nav-icon ${active ? "text-accent" : "text-foreground-muted"}`}
              />
              <span className="flex-1">{item.label}</span>
              {badge > 0 && <span className="ndyspace-nav-badge">{badge}</span>}
            </Link>
          );
        })}
      </nav>
      <StorageWidget />
      <div className="ndyspace-sidebar-footer flex items-center gap-2 px-5 py-4 text-[11px]">
        <BrandMark size={14} />
        <span>
          NDYSPACE™
          <br />
          <span className="ndyspace-footer-sub">v1.0.0</span>
        </span>
      </div>
    </aside>
  );
}
