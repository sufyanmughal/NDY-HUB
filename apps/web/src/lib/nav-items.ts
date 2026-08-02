import {
  LayoutDashboard,
  IdCard,
  Users,
  Coins,
  Boxes,
  Link2,
  ArrowLeftRight,
  FileText,
  ShieldCheck,
  Settings as SettingsIcon,
  LifeBuoy,
  Crown,
  Wallet,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { useMe } from "./use-me";
import { roleHasAnyPermission, type Permission } from "./permissions";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Omitted for items every authenticated user can see. If set, the item
   * only shows for a viewer whose role grants at least one of these —
   * same permission map the pages themselves gate on, so the nav never
   * offers a link that 403s once clicked. */
  anyOfPermissions?: Permission[];
}

// Shared between the desktop Sidebar and the mobile nav drawer — one list,
// so a new destination only ever needs adding here.
const BASE_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/passport", label: "NDY Passport", icon: IdCard },
  { href: "/memberships", label: "Memberships", icon: Users },
  { href: "/cryndy", label: "CRYNDY", icon: Coins },
  { href: "/ndybits", label: "NDYBITS", icon: Boxes },
  { href: "/platforms", label: "Connected Platforms", icon: Link2 },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/security", label: "Security", icon: ShieldCheck },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
  { href: "/support", label: "Support", icon: LifeBuoy },
  {
    href: "/founder",
    label: "Founder Mission Control",
    icon: Crown,
    anyOfPermissions: ["VIEW_FOUNDER_OVERVIEW"],
  },
  {
    href: "/finance",
    label: "Financials",
    icon: Wallet,
    anyOfPermissions: ["VIEW_FINANCIALS"],
  },
  {
    href: "/admin",
    label: "Admin",
    icon: ShieldAlert,
    anyOfPermissions: [
      "MANAGE_USERS",
      "MANAGE_ROLES",
      "VIEW_AUDIT_LOG",
      "MANAGE_OAUTH_CLIENTS",
      "MANAGE_SUPPORT_TICKETS",
    ],
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
