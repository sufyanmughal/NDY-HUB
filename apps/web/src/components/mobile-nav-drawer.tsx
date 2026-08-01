"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { NAV_ITEMS, isNavItemActive } from "@/lib/nav-items";
import { useMobileNav } from "@/lib/mobile-nav-context";
import { Logo } from "@/components/logo";

/**
 * Mobile-only counterpart to the desktop Sidebar (which is `hidden` below
 * the md breakpoint) — same nav items, same active-link styling, opened by
 * the hamburger button in Topbar via MobileNavContext.
 */
export function MobileNavDrawer() {
  const { isOpen, close } = useMobileNav();
  const pathname = usePathname();

  // Locks background scroll while the drawer is open, and lets Escape
  // close it the same way clicking the backdrop does.
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, close]);

  return (
    <div
      className={`fixed inset-0 z-50 md:hidden ${isOpen ? "" : "pointer-events-none"}`}
      aria-hidden={!isOpen}
    >
      <div
        onClick={close}
        className={`absolute inset-0 bg-black/50 transition-opacity ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
      />
      <aside
        className={`absolute inset-y-0 left-0 flex w-64 flex-col border-r border-border bg-surface shadow-xl transition-transform duration-200 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-6 py-6">
          <Logo />
          <button
            onClick={close}
            aria-label="Close menu"
            className="rounded-md p-1.5 text-foreground-muted hover:bg-surface-2 hover:text-foreground"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {NAV_ITEMS.map((item) => {
            const active = isNavItemActive(item.href, pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-accent/15 text-foreground font-medium"
                    : "text-foreground-muted hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                <Icon size={17} strokeWidth={2} className={active ? "text-accent" : "text-foreground-muted"} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </div>
  );
}
