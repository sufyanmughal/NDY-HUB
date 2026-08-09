"use client";

import { usePathname } from "next/navigation";
import { useNavItems, isNavItemActive } from "@/lib/nav-items";
import { NavItemLink } from "@/components/nav-item-link";
import { Logo } from "@/components/logo";

// Sampled directly from the client's reference sidebar mockup (pixel
// extraction, not eyeballed) — deliberately scoped to this component
// rather than promoted into globals.css's shared --surface token, since
// that token backs cards on every other page in the app and the
// reference mockup's darker tone is specific to the sidebar chrome.
const SIDEBAR_BG = "#050b1b";

export function Sidebar() {
  const pathname = usePathname();
  const navItems = useNavItems();

  return (
    <aside
      className="hidden md:flex w-64 shrink-0 flex-col border-r border-border"
      style={{ backgroundColor: SIDEBAR_BG }}
    >
      <div className="px-6 py-6">
        <Logo />
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {navItems.map((item) => (
          <NavItemLink
            key={item.href}
            item={item}
            active={isNavItemActive(item.href, pathname)}
          />
        ))}
      </nav>
      <MobileAppCard />
    </aside>
  );
}

/** Static placeholder — no mobile app distribution link exists yet, same
 * "visually present, honestly inert" treatment as the Developer Portal
 * nav item and the dashboard's own comingSoon launcher cards. */
function MobileAppCard() {
  return (
    <div className="mx-3 mb-4 rounded-lg bg-gradient-to-br from-accent-2 to-accent p-4 text-white">
      <p className="text-sm font-semibold">NDY Mobile App</p>
      <p className="mt-0.5 text-xs text-white/80">Your ecosystem. Anywhere.</p>
      <button
        type="button"
        disabled
        title="Coming soon"
        className="mt-3 w-full cursor-default rounded-md bg-white/15 px-3 py-1.5 text-xs font-medium"
      >
        Download Now
      </button>
    </div>
  );
}
