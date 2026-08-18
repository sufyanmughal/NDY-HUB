import {
  LayoutDashboard,
  LayoutGrid,
  ShieldCheck,
  Landmark,
  Rocket,
  Settings as SettingsIcon,
  Share2,
  Link2,
  Terminal,
  CircleDollarSign,
  HelpCircle,
  Building2,
  type LucideIcon,
} from "lucide-react";
import { useMe } from "./use-me";
import { roleHasAnyPermission, type Permission } from "./permissions";
import { API_BASE_URL } from "./api";

export interface NavItem {
  href: string;
  label: string;
  /** Small muted line under the label, e.g. "Digital Identity" under "NDY
   * Passport" — matches the reference sidebar's two-line item treatment.
   * Omitted for items that don't have one in the reference (Dashboard). */
  sublabel?: string;
  icon: LucideIcon;
  /** Per-item icon badge tint, sampled from the reference sidebar (each
   * item has its own colored rounded-square icon background, not a
   * shared neutral one). Falls back to the default muted treatment when
   * omitted (e.g. Dashboard, which uses the active-state style instead). */
  iconColor?: string;
  /** External link (not a Next.js route) — renders as a plain <a> with
   * target="_blank" instead of <Link>, same distinction homepage-widgets'
   * LauncherCard already draws between internal/external launcher cards. */
  external?: boolean;
  /** Visually present but not yet a real destination — same "Coming
   * soon" treatment as the Developer Portal launcher card on the
   * dashboard (see homepage-widgets.tsx's comingSoon), not a new pattern. */
  comingSoon?: boolean;
  /** Omitted for items every authenticated user can see. If set, the item
   * only shows for a viewer whose role grants at least one of these —
   * same permission map the pages themselves gate on, so the nav never
   * offers a link that 403s once clicked. */
  anyOfPermissions?: Permission[];
}

// Shared between the desktop Sidebar and the mobile nav drawer — one list,
// so a new destination only ever needs adding here. Order/labels/icons
// match the client's reference sidebar mockup exactly; colors sampled
// directly from that image via pixel extraction, not eyeballed.
const BASE_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    href: "/ndyspace",
    label: "NDYSPACE™",
    sublabel: "Mail, Calendar, Drive & more",
    icon: LayoutGrid,
    iconColor: "#8b5cf6",
  },
  {
    href: "/passport",
    label: "NDY Passport",
    sublabel: "Digital Identity",
    icon: ShieldCheck,
    iconColor: "#4f7cff",
  },
  {
    href: "/economy",
    label: "NDY Economy",
    sublabel: "Rewards, Tokens & Assets",
    icon: Landmark,
    iconColor: "#f6b503",
  },
  {
    href: "/business",
    label: "Business Center",
    sublabel: "Teams & Workspaces",
    icon: Building2,
    iconColor: "#22c58b",
  },
  {
    href: "/founder",
    label: "Founder Mission Control",
    sublabel: "Dashboard for founders",
    icon: Rocket,
    iconColor: "#22c58b",
    anyOfPermissions: ["VIEW_FOUNDER_OVERVIEW"],
  },
  {
    href: "/admin",
    label: "Admin Center",
    sublabel: "Platform Management",
    icon: SettingsIcon,
    iconColor: "#e0a83c",
    anyOfPermissions: [
      "MANAGE_USERS",
      "MANAGE_ROLES",
      "VIEW_AUDIT_LOG",
      "MANAGE_OAUTH_CLIENTS",
      "MANAGE_SUPPORT_TICKETS",
    ],
  },
  {
    href: "/platforms",
    label: "Connected Platforms",
    sublabel: "Manage Integrations",
    icon: Share2,
    iconColor: "#8b5cf6",
  },
  {
    href: `${API_BASE_URL}/.well-known/openid-configuration`,
    label: "API",
    sublabel: "Documentation & Tools",
    icon: Link2,
    iconColor: "#22d3ee",
    external: true,
  },
  {
    href: "#",
    label: "Developer Portal",
    sublabel: "SDK's & Developer Tools",
    icon: Terminal,
    iconColor: "#8b5cf6",
    comingSoon: true,
  },
  {
    href: "/security",
    label: "Security",
    sublabel: "Account & Access",
    icon: ShieldCheck,
    iconColor: "#8b5cf6",
  },
  {
    href: "/finance",
    label: "Financials",
    sublabel: "Revenue, Tokens & Wallets",
    icon: CircleDollarSign,
    iconColor: "#e0a83c",
    anyOfPermissions: ["VIEW_FINANCIALS"],
  },
  {
    href: "/support",
    label: "Help & Support",
    sublabel: "Get Assistance",
    icon: HelpCircle,
    iconColor: "#22d3ee",
  },
];

/** Filters BASE_NAV_ITEMS down to what the current viewer's role can
 * actually reach — UX only, same as every other client-side permission
 * check in this app; the API re-verifies on every request regardless. */
export function useNavItems(): NavItem[] {
  const me = useMe();
  return BASE_NAV_ITEMS.filter(
    (item) =>
      !item.anyOfPermissions ||
      roleHasAnyPermission(me?.role, item.anyOfPermissions),
  );
}

export function isNavItemActive(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
