import { Module } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { WorkspaceGuard } from './guards/workspace.guard';

/**
 * Pure infrastructure module — no controller of its own in Phase 1 (no
 * invite flow, no Business workspace creation UI yet; those are Phase 4).
 * Exports WorkspaceService + WorkspaceGuard so other modules (the Action
 * Engine, and eventually Business Center) can depend on this module and
 * use both directly, the same way AdminModule exports RoleChangeRequestService.
 */
@Module({
  providers: [WorkspaceService, WorkspaceGuard],
  exports: [WorkspaceService, WorkspaceGuard],
})
export class WorkspaceModule {}
