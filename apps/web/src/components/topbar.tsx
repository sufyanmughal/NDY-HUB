import { mockUser } from "@/lib/mock-data";

export function Topbar() {
  const initial = mockUser.fullName.charAt(0);
  return (
    <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-4">
      <div />
      <div className="flex items-center gap-4 text-sm text-foreground-muted">
        <span className="font-mono text-xs tracking-wide">{mockUser.ndyId}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-2 text-xs font-semibold text-white">
          {initial}
        </div>
      </div>
    </header>
  );
}
