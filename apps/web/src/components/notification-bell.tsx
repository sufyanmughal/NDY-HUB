"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  ShieldCheck,
  Landmark,
  CheckCircle2,
  LayoutGrid,
  Settings as SettingsIcon,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  listNotifications,
  getNotificationUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  type AppNotification,
  type NotificationCategory,
} from "@/lib/api";

// The general-purpose bell — Phase 2's cross-cutting Notification backbone
// finally gets a UI. Same polling convention as ndyspace-hooks.ts's
// useAuthedPoll (30s interval), reimplemented narrowly here rather than
// imported since that hook lives in a NDYSPACE-scoped file and this bell
// renders in the shared Topbar, outside NDYSPACE entirely.
const POLL_INTERVAL_MS = 30_000;

const CATEGORY_ICON: Record<NotificationCategory, LucideIcon> = {
  SECURITY: ShieldCheck,
  ECONOMY: Landmark,
  ACTION_APPROVAL: CheckCircle2,
  NDYSPACE: LayoutGrid,
  SYSTEM: SettingsIcon,
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell() {
  const { auth } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  function refetchUnreadCount() {
    getNotificationUnreadCount()
      .then(({ count }) => setUnreadCount(count))
      .catch(() => {
        /* best-effort — a failed unread-count poll shouldn't show an error
           toast for something this low-stakes; it just retries next tick */
      });
  }

  // Poll the unread count in the background regardless of whether the
  // dropdown is open, so the badge stays live.
  useEffect(() => {
    if (auth.status !== "authenticated") return;
    refetchUnreadCount();
    const id = setInterval(refetchUnreadCount, POLL_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status]);

  // Load the actual list only when the dropdown opens — no reason to fetch
  // 50 rows on every page load when most visits never open the bell.
  useEffect(() => {
    if (!open) return;
    listNotifications()
      .then(setNotifications)
      .catch(() => setNotifications([]));
  }, [open]);

  // Close on outside click — standard dropdown behavior, no existing
  // shared primitive for this in the codebase to reuse, so handled inline.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function handleMarkRead(n: AppNotification) {
    if (n.isRead) return;
    try {
      await markNotificationRead(n.id);
      setNotifications((prev) =>
        prev ? prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)) : prev,
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      /* non-fatal — the click still navigates via linkUrl if present */
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev?.map((x) => ({ ...x, isRead: true })) ?? prev);
      setUnreadCount(0);
    } catch {
      /* non-fatal */
    }
  }

  if (auth.status !== "authenticated") return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        className="relative rounded-md p-1.5 hover:bg-surface-2 hover:text-foreground"
      >
        <Bell size={17} strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-border bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-accent hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications === null && (
              <div className="px-4 py-6 text-center text-xs text-foreground-muted">
                Loading…
              </div>
            )}
            {notifications?.length === 0 && (
              <div className="px-4 py-6 text-center text-xs text-foreground-muted">
                You&apos;re all caught up.
              </div>
            )}
            {notifications?.map((n) => {
              const Icon = CATEGORY_ICON[n.category] ?? Bell;
              const content = (
                <div
                  className={`flex gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-surface-2 ${
                    n.isRead ? "" : "bg-surface-2/50"
                  }`}
                >
                  <div className="mt-0.5 shrink-0 text-foreground-muted">
                    <Icon size={16} strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`text-xs ${n.isRead ? "text-foreground-muted" : "font-semibold text-foreground"}`}
                      >
                        {n.title}
                      </span>
                      {!n.isRead && (
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-foreground-muted">
                      {n.body}
                    </p>
                    <span className="mt-1 block text-[10px] text-foreground-muted">
                      {relativeTime(n.createdAt)}
                    </span>
                  </div>
                </div>
              );

              return n.linkUrl ? (
                <Link
                  key={n.id}
                  href={n.linkUrl}
                  onClick={() => {
                    handleMarkRead(n);
                    setOpen(false);
                  }}
                >
                  {content}
                </Link>
              ) : (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleMarkRead(n)}
                  className="block w-full text-left"
                >
                  {content}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
