import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import { WorkspaceInviteService } from './workspace-invite.service';
import { WorkspaceService } from './workspace.service';
import { CreateWorkspaceInviteDto } from './dto/create-workspace-invite.dto';
import { AcceptWorkspaceInviteDto } from './dto/accept-workspace-invite.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceGuard } from './guards/workspace.guard';
import { RequireWorkspaceRole } from './decorators/require-workspace-role.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/guards/jwt-auth.guard';

/**
 * Team management for a single Business Workspace — member list and
 * invites. Scoped by :workspaceId, guarded by WorkspaceGuard (see Phase 1)
 * rather than the platform-wide PermissionGuard: whether you can manage a
 * workspace's team depends on your WorkspaceRole in *that* workspace, not
 * your global Role.
 */
@UseGuards(JwtAuthGuard)
@Controller('business-workspaces/:workspaceId')
export class WorkspaceTeamController {
  constructor(
    private readonly invites: WorkspaceInviteService,
    private readonly workspaces: WorkspaceService,
  ) {}

  @Get('members')
  @UseGuards(WorkspaceGuard)
  @RequireWorkspaceRole(
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
  )
  listMembers(@Param('workspaceId') workspaceId: string) {
    return this.workspaces.listMembers(workspaceId);
  }

  @Get('invites')
  @UseGuards(WorkspaceGuard)
  @RequireWorkspaceRole(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  listInvites(@Param('workspaceId') workspaceId: string) {
    return this.invites.listForWorkspace(workspaceId);
  }

  @Post('invites')
  @UseGuards(WorkspaceGuard)
  @RequireWorkspaceRole(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  createInvite(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateWorkspaceInviteDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.invites.invite(
      { id: user.sub, ndyId: user.ndyId },
      workspaceId,
      dto.invitedEmail,
      dto.invitedRole,
      dto.invitedDepartment,
    );
  }

  @Delete('invites/:inviteId')
  @UseGuards(WorkspaceGuard)
  @RequireWorkspaceRole(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  revokeInvite(
    @Param('inviteId') inviteId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.invites.revoke({ id: user.sub, ndyId: user.ndyId }, inviteId);
  }
}

/**
 * Accepting an invite doesn't happen "inside" a workspace the caller is
 * already a member of — that's the whole point — so it can't sit behind
 * WorkspaceGuard (which requires an existing membership to check a role
 * against). Plain JwtAuthGuard; WorkspaceInviteService.accept does its own
 * email-match check against the invite.
 */
@UseGuards(JwtAuthGuard)
@Controller('workspace-invites')
export class WorkspaceInviteAcceptController {
  constructor(private readonly invites: WorkspaceInviteService) {}

  @Post('accept')
  accept(
    @Body() dto: AcceptWorkspaceInviteDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.invites.accept(user.sub, dto.token);
  }
}
