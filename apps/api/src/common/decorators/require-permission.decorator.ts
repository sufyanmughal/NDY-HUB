import { SetMetadata } from '@nestjs/common';
import type { Permission } from '../permissions';

export const PERMISSION_KEY = 'requiredPermission';

/** Pairs with PermissionGuard — `@UseGuards(JwtAuthGuard, PermissionGuard)`
 * plus `@RequirePermission(Permission.X)` on the controller or a specific
 * method. Method-level wins if both are set. */
export const RequirePermission = (permission: Permission) =>
  SetMetadata(PERMISSION_KEY, permission);
