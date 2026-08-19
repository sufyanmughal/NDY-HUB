import { Role } from '@prisma/client';

/**
 * What an admin-ish action actually requires, independent of which role
 * happens to grant it. A flat "is this role X" check doesn't scale once
 * there are 8 roles with different, overlapping responsibilities — this is
 * the layer that lets a controller ask "can this user manage support
 * tickets" without knowing or caring which roles that includes.
 */
export enum Permission {
  MANAGE_USERS = 'MANAGE_USERS',
  MANAGE_ROLES = 'MANAGE_ROLES',
  MANAGE_OAUTH_CLIENTS = 'MANAGE_OAUTH_CLIENTS',
  MANAGE_SUPPORT_TICKETS = 'MANAGE_SUPPORT_TICKETS',
  VIEW_AUDIT_LOG = 'VIEW_AUDIT_LOG',
  VIEW_FOUNDER_OVERVIEW = 'VIEW_FOUNDER_OVERVIEW',
  VIEW_FINANCIALS = 'VIEW_FINANCIALS',
  // LEVEL_3 (identity document) manual review — the client's explicit
  // answer #10: "new dedicated reviewer permission," not folded into the
  // existing MANAGE_USERS (which already means something narrower —
  // search/suspend). Deliberately its own permission so a future distinct
  // reviewer role can be introduced without touching MANAGE_USERS' scope.
  REVIEW_IDENTITY_VERIFICATION = 'REVIEW_IDENTITY_VERIFICATION',
}

/**
 * Deliberately explicit (no wildcard "admin roles get everything" shortcut
 * except for FOUNDER) so adding a new role never silently grants more than
 * intended. CONTENT and PARTNERS are real, assignable roles (see
 * schema.prisma) but grant nothing here — there's no content or partner
 * management feature yet for either to gate. Wiring permissions for those
 * two means inventing the feature surface first, not something to guess at
 * here.
 */
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  USER: [],
  FOUNDER: Object.values(Permission), // superset — founder can do everything
  SUPER_ADMIN: [
    Permission.MANAGE_USERS,
    Permission.MANAGE_ROLES,
    Permission.MANAGE_OAUTH_CLIENTS,
    Permission.MANAGE_SUPPORT_TICKETS,
    Permission.VIEW_AUDIT_LOG,
    // Default holder until a distinct reviewer role is worth carving out
    // — matches this codebase's existing "ship the simple default, revisit
    // if real usage demands more" pattern for every other minimal-viable
    // role decision.
    Permission.REVIEW_IDENTITY_VERIFICATION,
  ],
  DEVELOPER: [Permission.MANAGE_OAUTH_CLIENTS],
  FINANCE: [Permission.VIEW_FINANCIALS],
  SUPPORT: [Permission.MANAGE_SUPPORT_TICKETS],
  CONTENT: [],
  PARTNERS: [],
  AUDITOR: [Permission.VIEW_AUDIT_LOG],
};

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Roles a caller with MANAGE_ROLES may assign — deliberately excludes
 * FOUNDER and SUPER_ADMIN so a Super Admin can't mint a peer or superior.
 * Only an existing FOUNDER can assign those two (checked separately in
 * AdminService.updateRole). */
export const ASSIGNABLE_BY_SUPER_ADMIN: readonly Role[] = [
  Role.USER,
  Role.DEVELOPER,
  Role.FINANCE,
  Role.SUPPORT,
  Role.CONTENT,
  Role.PARTNERS,
  Role.AUDITOR,
];
