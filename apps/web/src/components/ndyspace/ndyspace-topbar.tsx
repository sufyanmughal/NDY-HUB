"use client";

import Link from "next/link";
import { Search, Bell, Menu, Grid3x3, ChevronDown, Sun } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { usePassport } from "@/lib/use-passport";
import { useNdyspaceMobileNav } from "@/lib/ndyspace-mobile-nav-context";
import { Avatar } from "@/components/avatar";
import { useNdyspaceOverview } from "@/lib/ndyspace-hooks";

export function NdyspaceTopbar() {
  const { auth, logout } = useAuth();
  const passport = usePassport();
  const { toggle } = useNdyspaceMobileNav();
  const { data: overview } = useNdyspaceOverview();
  const [menuOpen, setMenuOpen] = useState(false);

  if (auth.status !== "authenticated") return null;

  const displayName = passport?.fullName ?? auth.ndyId;
  const unreadNotifications = overview?.notifications.unreadCount ?? 0;

  return (
    <header className="ndyspace-topbar flex items-center gap-3 px-4 py-4 md:justify-between md:px-6">
      <button
        onClick={toggle}
        aria-label="Open menu"
        className="ndyspace-icon-btn rounded-md p-1.5 md:hidden"
      >
        <Menu size={20} strokeWidth={2} />
      </button>

      <div className="relative hidden w-full max-w-sm md:block">
        <Search
          size={16}
          strokeWidth={2}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted"
        />
        <input
          type="search"
          placeholder="Search in NDYSPACE…"
          disabled
          title="Global search — planned follow-up, not built in this pass"
          className="ndyspace-search w-full rounded-md py-1.5 pl-9 pr-14 text-sm placeholder:text-foreground-muted disabled:cursor-not-allowed"
        />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] text-foreground-muted">
          ⌘K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-1.5 text-sm text-foreground-muted md:ml-0">
        <button
          type="button"
          disabled
          aria-label="Theme toggle"
          title="Light mode — planned follow-up, not built in this pass (NDY HUB runs one committed dark theme)"
          className="ndyspace-icon-btn p-1.5 disabled:cursor-not-allowed"
        >
          <Sun size={17} strokeWidth={2} />
        </button>

        <Link
          href="/ndyspace/notifications"
          aria-label="Notifications"
          className="ndyspace-icon-btn relative p-1.5"
        >
          <Bell size={17} strokeWidth={2} />
          {unreadNotifications > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[10px] font-semibold text-white">
              {unreadNotifications > 99 ? "99+" : unreadNotifications}
            </span>
          )}
        </Link>

        <Link
          href="/dashboard"
          aria-label="Back to NDY HUB"
          title="Back to NDY HUB"
          className="ndyspace-icon-btn p-1.5"
        >
          <Grid3x3 size={17} strokeWidth={2} />
        </Link>

        <div className="relative ml-1">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="ndyspace-profile-chip flex items-center gap-2 rounded-md p-1"
          >
            <Avatar photoUrl={passport?.profilePhotoUrl} name={displayName} size={32} />
            <span className="hidden flex-col items-start leading-tight sm:flex">
              <span className="text-xs font-medium text-foreground">{displayName}</span>
              <span className="font-mono text-[10px] text-foreground-muted">{auth.ndyId}</span>
            </span>
            <ChevronDown size={14} strokeWidth={2} className="hidden sm:block" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="ndyspace-card absolute right-0 z-20 mt-2 w-48 py-1 shadow-xl">
                <Link
                  href="/passport"
                  className="block px-3 py-2 text-sm hover:bg-surface-2"
                  onClick={() => setMenuOpen(false)}
                >
                  NDY Passport
                </Link>
                <Link
                  href="/settings"
                  className="block px-3 py-2 text-sm hover:bg-surface-2"
                  onClick={() => setMenuOpen(false)}
                >
                  Settings
                </Link>
                <Link
                  href="/dashboard"
                  className="block px-3 py-2 text-sm hover:bg-surface-2"
                  onClick={() => setMenuOpen(false)}
                >
                  NDY HUB Dashboard
                </Link>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-2"
                >
                  Log out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
