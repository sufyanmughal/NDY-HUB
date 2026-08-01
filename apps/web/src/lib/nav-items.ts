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
  type LucideIcon,
} from "lucide-react";

// Shared between the desktop Sidebar and the mobile nav drawer — one list,
// so a new destination only ever needs adding here.
export const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
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
];

export function isNavItemActive(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
