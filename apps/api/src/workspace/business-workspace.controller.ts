import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BusinessWorkspaceRequestStatus } from '@prisma/client';
import { BusinessWorkspaceService } from './business-workspace.service';
import { CreateBusinessWorkspaceRequestDto } from './dto/create-business-workspace-request.dto';
import { ReviewBusinessWorkspaceRequestDto } from './dto/review-business-workspace-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { Permission } from '../common/permissions';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/guards/jwt-auth.guard';

/**
 * Any authenticated user may *request* a Business Workspace (creating a
 * PENDING row costs nothing and isn't itself a privileged action) —
 * approving/rejecting/listing is gated the same way role-change review is,
 * since granting a Business Workspace and granting a role are both "create
 * a new scope of authority" decisions.
 */
@Controller('business-workspaces/requests')
export class BusinessWorkspaceController {
  constructor(private readonly businessWorkspaces: BusinessWorkspaceService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Body() dto: CreateBusinessWorkspaceRequestDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.businessWorkspaces.createRequest(
      { id: user.sub, ndyId: user.ndyId },
      dto.businessName,
      dto.reason,
    );
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(Permission.MANAGE_ROLES)
  @Get()
  list(@Query('status') status?: BusinessWorkspaceRequestStatus) {
    return this.businessWorkspaces.list(status);
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(Permission.MANAGE_ROLES)
  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @Body() dto: ReviewBusinessWorkspaceRequestDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.businessWorkspaces.approve(
      { id: user.sub, ndyId: user.ndyId },
      id,
      dto.reason,
    );
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(Permission.MANAGE_ROLES)
  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: ReviewBusinessWorkspaceRequestDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.businessWorkspaces.reject(
      { id: user.sub, ndyId: user.ndyId },
      id,
      dto.reason,
    );
  }
}
