"use client";

import { useAuth } from "@/lib/auth-context";
import { usePassport } from "@/lib/use-passport";

export function Topbar() {
  const { auth, logout } = useAuth();
  const passport = usePassport();

  if (auth.status !== "authenticated") return null;

  const displayName = passport?.fullName ?? auth.ndyId;
  const initial = displayName.charAt(0);

  return (
    <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-4">
      <div />
      <div className="flex items-center gap-4 text-sm text-foreground-muted">
        <span className="font-mono text-xs tracking-wide">{auth.ndyId}</span>
        <button
          onClick={logout}
          className="rounded-md px-2 py-1 text-xs hover:bg-surface-2 hover:text-foreground"
        >
          Log out
        </button>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-2 text-xs font-semibold text-white">
          {initial}
        </div>
      </div>
    </header>
  );
}
