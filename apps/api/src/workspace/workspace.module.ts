import { Module } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { WorkspaceGuard } from './guards/workspace.guard';
import { BusinessWorkspaceService } from './business-workspace.service';
import { BusinessWorkspaceController } from './business-workspace.controller';
import { WorkspaceInviteService } from './workspace-invite.service';
import {
  WorkspaceTeamController,
  WorkspaceInviteAcceptController,
} from './workspace-team.controller';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notifications/notification.module';

/**
 * Phase 1 was pure infrastructure (no controller). Phase 4 (Business
 * Center v1) is its first user-visible consumer, added here rather than as
 * a separate module — Business Workspace creation and Team/invites are
 * both fundamentally workspace operations, not a distinct domain, so they
 * live alongside WorkspaceService/WorkspaceGuard instead of forking into
 * their own top-level module.
 *
 * Imports AuthModule for JwtAuthGuard on every controller here (same
 * lesson as the Phase 3 ActionEngineModule DI crash — a module using
 * @UseGuards(JwtAuthGuard) anywhere must import AuthModule itself, guards
 * don't inherit imports transitively) and NotificationModule so
 * WorkspaceInviteService can notify an inviter when their invite is
 * accepted.
 */
@Module({
  imports: [AuthModule, NotificationModule],
  controllers: [
    BusinessWorkspaceController,
    WorkspaceTeamController,
    WorkspaceInviteAcceptController,
  ],
  providers: [
    WorkspaceService,
    WorkspaceGuard,
    BusinessWorkspaceService,
    WorkspaceInviteService,
  ],
  exports: [WorkspaceService, WorkspaceGuard, BusinessWorkspaceService],
})
export class WorkspaceModule {}
