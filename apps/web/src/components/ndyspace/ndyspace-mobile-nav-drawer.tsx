"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { NDYSPACE_NAV_ITEMS, isNdyspaceNavItemActive } from "@/lib/ndyspace-nav-items";
import { useNdyspaceMobileNav } from "@/lib/ndyspace-mobile-nav-context";
import { BrandMark } from "@/components/logo";

export function NdyspaceMobileNavDrawer() {
  const { isOpen, close } = useNdyspaceMobileNav();
  const pathname = usePathname();

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
        className={`ndyspace-sidebar absolute inset-y-0 left-0 flex w-64 flex-col shadow-xl transition-transform duration-200 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-6">
          <div>
            <BrandMark size={30} />
            <p className="mt-2 text-sm font-semibold tracking-tight text-foreground">NDYSPACE™</p>
            <p className="ndyspace-sidebar-brand-sub text-[11px]">Your Digital Space</p>
          </div>
          <button
            onClick={close}
            aria-label="Close menu"
            className="ndyspace-icon-btn rounded-md p-1.5"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {NDYSPACE_NAV_ITEMS.map((item) => {
            const active = !item.external && isNdyspaceNavItemActive(item.href, pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className={`ndyspace-nav-item flex items-center gap-3 px-3 py-2 text-sm ${active ? "is-active" : ""}`}
              >
                <Icon
                  size={17}
                  strokeWidth={2}
                  className={`ndyspace-nav-icon ${active ? "text-accent" : "text-foreground-muted"}`}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </div>
  );
}
