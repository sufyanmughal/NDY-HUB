import { Role } from '@prisma/client';
import {
  ASSIGNABLE_BY_SUPER_ADMIN,
  Permission,
  roleHasPermission,
} from './permissions';

describe('roleHasPermission', () => {
  it('FOUNDER holds every permission that exists', () => {
    for (const permission of Object.values(Permission)) {
      expect(roleHasPermission(Role.FOUNDER, permission)).toBe(true);
    }
  });

  it('USER holds no permissions', () => {
    for (const permission of Object.values(Permission)) {
      expect(roleHasPermission(Role.USER, permission)).toBe(false);
    }
  });

  it('CONTENT and PARTNERS hold no permissions — no feature exists to gate yet', () => {
    for (const permission of Object.values(Permission)) {
      expect(roleHasPermission(Role.CONTENT, permission)).toBe(false);
      expect(roleHasPermission(Role.PARTNERS, permission)).toBe(false);
    }
  });

  it('SUPER_ADMIN does not hold VIEW_FINANCIALS or VIEW_FOUNDER_OVERVIEW', () => {
    expect(
      roleHasPermission(Role.SUPER_ADMIN, Permission.VIEW_FINANCIALS),
    ).toBe(false);
    expect(
      roleHasPermission(Role.SUPER_ADMIN, Permission.VIEW_FOUNDER_OVERVIEW),
    ).toBe(false);
  });

  it('SUPER_ADMIN holds every admin-management permission', () => {
    expect(roleHasPermission(Role.SUPER_ADMIN, Permission.MANAGE_USERS)).toBe(
      true,
    );
    expect(roleHasPermission(Role.SUPER_ADMIN, Permission.MANAGE_ROLES)).toBe(
      true,
    );
    expect(
      roleHasPermission(Role.SUPER_ADMIN, Permission.MANAGE_OAUTH_CLIENTS),
    ).toBe(true);
    expect(
      roleHasPermission(Role.SUPER_ADMIN, Permission.MANAGE_SUPPORT_TICKETS),
    ).toBe(true);
    expect(roleHasPermission(Role.SUPER_ADMIN, Permission.VIEW_AUDIT_LOG)).toBe(
      true,
    );
  });

  it('FINANCE holds exactly VIEW_FINANCIALS, nothing else', () => {
    expect(roleHasPermission(Role.FINANCE, Permission.VIEW_FINANCIALS)).toBe(
      true,
    );
    for (const permission of Object.values(Permission)) {
      if (permission === Permission.VIEW_FINANCIALS) continue;
      expect(roleHasPermission(Role.FINANCE, permission)).toBe(false);
    }
  });

  it('DEVELOPER holds exactly MANAGE_OAUTH_CLIENTS, nothing else', () => {
    expect(
      roleHasPermission(Role.DEVELOPER, Permission.MANAGE_OAUTH_CLIENTS),
    ).toBe(true);
    for (const permission of Object.values(Permission)) {
      if (permission === Permission.MANAGE_OAUTH_CLIENTS) continue;
      expect(roleHasPermission(Role.DEVELOPER, permission)).toBe(false);
    }
  });

  it('SUPPORT holds exactly MANAGE_SUPPORT_TICKETS, nothing else', () => {
    expect(
      roleHasPermission(Role.SUPPORT, Permission.MANAGE_SUPPORT_TICKETS),
    ).toBe(true);
    for (const permission of Object.values(Permission)) {
      if (permission === Permission.MANAGE_SUPPORT_TICKETS) continue;
      expect(roleHasPermission(Role.SUPPORT, permission)).toBe(false);
    }
  });

  it('AUDITOR holds exactly VIEW_AUDIT_LOG, nothing else', () => {
    expect(roleHasPermission(Role.AUDITOR, Permission.VIEW_AUDIT_LOG)).toBe(
      true,
    );
    for (const permission of Object.values(Permission)) {
      if (permission === Permission.VIEW_AUDIT_LOG) continue;
      expect(roleHasPermission(Role.AUDITOR, permission)).toBe(false);
    }
  });
});

describe('ASSIGNABLE_BY_SUPER_ADMIN', () => {
  it('excludes FOUNDER and SUPER_ADMIN — a Super Admin can never mint a peer or superior', () => {
    expect(ASSIGNABLE_BY_SUPER_ADMIN).not.toContain(Role.FOUNDER);
    expect(ASSIGNABLE_BY_SUPER_ADMIN).not.toContain(Role.SUPER_ADMIN);
  });

  it('covers every other real role', () => {
    const allRoles = Object.values(Role);
    const expected = allRoles.filter(
      (role) => role !== Role.FOUNDER && role !== Role.SUPER_ADMIN,
    );
    expect([...ASSIGNABLE_BY_SUPER_ADMIN].sort()).toEqual(expected.sort());
  });
});
