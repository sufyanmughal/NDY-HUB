"use client";

import { Search, Bell } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { usePassport } from "@/lib/use-passport";
import { Avatar } from "@/components/avatar";

export function Topbar() {
  const { auth, logout } = useAuth();
  const passport = usePassport();

  if (auth.status !== "authenticated") return null;

  const displayName = passport?.fullName ?? auth.ndyId;

  return (
    <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-4">
      <div className="relative w-full max-w-xs">
        <Search
          size={16}
          strokeWidth={2}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted"
        />
        <input
          type="search"
          placeholder="Search…"
          disabled
          className="w-full rounded-md border border-border bg-background py-1.5 pl-9 pr-3 text-sm text-foreground-muted placeholder:text-foreground-muted disabled:cursor-not-allowed"
        />
      </div>
      <div className="flex items-center gap-4 text-sm text-foreground-muted">
        <span className="font-mono text-xs tracking-wide">{auth.ndyId}</span>
        <button
          type="button"
          title="Notifications — not built yet"
          className="relative rounded-md p-1.5 hover:bg-surface-2 hover:text-foreground"
        >
          <Bell size={17} strokeWidth={2} />
        </button>
        <button
          onClick={logout}
          className="rounded-md px-2 py-1 text-xs hover:bg-surface-2 hover:text-foreground"
        >
          Log out
        </button>
        <Avatar photoUrl={passport?.profilePhotoUrl} name={displayName} size={32} />
      </div>
    </header>
  );
}
