import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { RoleChangeRequestStatus } from '@prisma/client';
import { RoleChangeRequestService } from './role-change-request.service';
import { CreateRoleChangeRequestDto } from './dto/create-role-change-request.dto';
import { ReviewRoleChangeRequestDto } from './dto/review-role-change-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { Permission } from '../common/permissions';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/guards/jwt-auth.guard';
import { actorFrom } from './admin.controller';

@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission(Permission.MANAGE_ROLES)
@Controller('admin/role-requests')
export class RoleChangeRequestController {
  constructor(private readonly requests: RoleChangeRequestService) {}

  @Post()
  create(
    @Body() dto: CreateRoleChangeRequestDto,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: Request,
  ) {
    return this.requests.create(
      actorFrom(user, req),
      dto.targetUserId,
      dto.role,
      dto.reason,
    );
  }

  @Get()
  list(@Query('status') status?: RoleChangeRequestStatus) {
    return this.requests.list(status);
  }

  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @Body() dto: ReviewRoleChangeRequestDto,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: Request,
  ) {
    return this.requests.approve(actorFrom(user, req), id, dto.reason);
  }

  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: ReviewRoleChangeRequestDto,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: Request,
  ) {
    return this.requests.reject(actorFrom(user, req), id, dto.reason);
  }
}
