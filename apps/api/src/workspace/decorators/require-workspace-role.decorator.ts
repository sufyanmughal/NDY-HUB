import { SetMetadata } from '@nestjs/common';
import type { WorkspaceRole } from '@prisma/client';

export const WORKSPACE_ROLE_KEY = 'requiredWorkspaceRole';

/**
 * Pairs with WorkspaceGuard — `@UseGuards(JwtAuthGuard, WorkspaceGuard)`
 * plus `@RequireWorkspaceRole(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)`
 * on the controller or a specific method. The route must also supply a
 * `workspaceId` — via a `:workspaceId` route param by default (see
 * WorkspaceGuard for how it's resolved). Same shape as
 * common/decorators/require-permission.decorator.ts, one level down (a
 * workspace-scoped role rather than a platform-wide permission).
 */
export const RequireWorkspaceRole = (...roles: WorkspaceRole[]) =>
  SetMetadata(WORKSPACE_ROLE_KEY, roles);
