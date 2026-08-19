import type { UserRole } from "./api";

/** Mirrors apps/api/src/common/permissions.ts exactly — kept in sync by
 * hand since it's a small, stable map. This is UX only (which sections to
 * show); the API is the real authority and re-checks on every request. */
export type Permission =
  | "MANAGE_USERS"
  | "MANAGE_ROLES"
  | "MANAGE_OAUTH_CLIENTS"
  | "MANAGE_SUPPORT_TICKETS"
  | "VIEW_AUDIT_LOG"
  | "VIEW_FOUNDER_OVERVIEW"
  | "VIEW_FINANCIALS"
  | "REVIEW_IDENTITY_VERIFICATION";

const ALL_PERMISSIONS: Permission[] = [
  "MANAGE_USERS",
  "MANAGE_ROLES",
  "MANAGE_OAUTH_CLIENTS",
  "MANAGE_SUPPORT_TICKETS",
  "VIEW_AUDIT_LOG",
  "VIEW_FOUNDER_OVERVIEW",
  "VIEW_FINANCIALS",
  "REVIEW_IDENTITY_VERIFICATION",
];

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  USER: [],
  FOUNDER: ALL_PERMISSIONS,
  SUPER_ADMIN: [
    "MANAGE_USERS",
    "MANAGE_ROLES",
    "MANAGE_OAUTH_CLIENTS",
    "MANAGE_SUPPORT_TICKETS",
    "VIEW_AUDIT_LOG",
    "REVIEW_IDENTITY_VERIFICATION",
  ],
  DEVELOPER: ["MANAGE_OAUTH_CLIENTS"],
  FINANCE: ["VIEW_FINANCIALS"],
  SUPPORT: ["MANAGE_SUPPORT_TICKETS"],
  CONTENT: [],
  PARTNERS: [],
  AUDITOR: ["VIEW_AUDIT_LOG"],
};

export function roleHasPermission(
  role: UserRole | undefined,
  permission: Permission,
): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function roleHasAnyPermission(
  role: UserRole | undefined,
  permissions: Permission[],
): boolean {
  return permissions.some((p) => roleHasPermission(role, p));
}
