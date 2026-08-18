import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/guards/jwt-auth.guard';
import { ActionEngineService } from './action-engine.service';
import { SubmitActionDto } from './dto/submit-action.dto';
import { ResolveApprovalDto } from './dto/resolve-approval.dto';

/**
 * Minimal Approval Center surface per docs/action-engine-design.md §7
 * item 4 — enough to submit an action and resolve a pending approval, not
 * a full UI. No separate approver role exists yet (that's Phase 4/
 * Business Center territory, once a workspace can have more than one
 * member with authority over it) — resolveApproval only checks that the
 * caller is a member of the workspace the approval belongs to, which in
 * v1's all-personal-workspace world always means the same person who
 * requested it. Self-approval isn't a meaningful attack surface yet for
 * that reason, but it's a real gap worth naming rather than silently
 * treating as fine forever — Phase 4 should revisit this the same way
 * RoleChangeRequestService already refuses self-review.
 */
@UseGuards(JwtAuthGuard)
@Controller('action-engine')
export class ActionEngineController {
  constructor(private readonly actionEngine: ActionEngineService) {}

  @Post('actions')
  submit(
    @Body() dto: SubmitActionDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.actionEngine.submit({
      actionKey: dto.actionKey,
      workspaceId: dto.workspaceId,
      requestedByUserId: user.sub,
      requestedByNdyId: user.ndyId,
      origin: dto.origin,
      params: dto.params,
      idempotencyKey: dto.idempotencyKey || randomUUID(),
      intentToken: dto.intentToken,
    });
  }

  @Get('approvals')
  listPendingApprovals(@Query('workspaceId') workspaceId: string) {
    return this.actionEngine.listPendingApprovals(workspaceId);
  }

  @Post('approvals/:id/resolve')
  resolveApproval(
    @Param('id') id: string,
    @Body() dto: ResolveApprovalDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.actionEngine.resolveApproval(id, user.sub, dto.approve);
  }
}
