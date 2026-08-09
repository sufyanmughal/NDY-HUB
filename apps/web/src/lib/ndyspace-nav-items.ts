import {
  LayoutDashboard,
  Mail,
  Calendar,
  HardDrive,
  Users,
  CheckSquare,
  StickyNote,
  Bookmark,
  Bell,
  IdCard,
  ShieldCheck,
  Settings as SettingsIcon,
  type LucideIcon,
} from "lucide-react";

export interface NdyspaceNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** NDY HUB routes reused as-is (§2.2 of the spec: "link to the EXISTING
   * page, not a new one") — rendered the same as any other item but never
   * highlighted active while inside /ndyspace/*. */
  external?: boolean;
}

// Sidebar order matches the reference screenshot's inventory (§2.2):
// Overview, then each module, then Notifications, then the three links
// back into the main NDY HUB app.
export const NDYSPACE_NAV_ITEMS: NdyspaceNavItem[] = [
  { href: "/ndyspace", label: "Overview", icon: LayoutDashboard },
  { href: "/ndyspace/mail", label: "NDYMAIL", icon: Mail },
  { href: "/ndyspace/calendar", label: "Calendar", icon: Calendar },
  { href: "/ndyspace/drive", label: "Drive", icon: HardDrive },
  { href: "/ndyspace/contacts", label: "Contacts", icon: Users },
  { href: "/ndyspace/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/ndyspace/notes", label: "Notes", icon: StickyNote },
  { href: "/ndyspace/bookmarks", label: "Bookmarks", icon: Bookmark },
  { href: "/ndyspace/notifications", label: "Notifications", icon: Bell },
  { href: "/passport", label: "NDY Passport", icon: IdCard, external: true },
  { href: "/security", label: "Security", icon: ShieldCheck, external: true },
  { href: "/settings", label: "Settings", icon: SettingsIcon, external: true },
];

export function isNdyspaceNavItemActive(href: string, pathname: string): boolean {
  if (href === "/ndyspace") return pathname === "/ndyspace";
  return pathname === href || pathname.startsWith(`${href}/`);
}
