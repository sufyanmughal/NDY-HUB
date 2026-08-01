import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminService, type AdminActor } from './admin.service';
import { UpdateRoleDto } from './dto/update-role.dto';
import { SuspendUserDto } from './dto/suspend-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { Permission } from '../common/permissions';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @RequirePermission(Permission.MANAGE_USERS)
  @Get('users')
  searchUsers(
    @Query('q') q?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.admin.searchUsers(q, clampTake(take), parseSkip(skip));
  }

  @RequirePermission(Permission.MANAGE_USERS)
  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.admin.getUserDetail(id);
  }

  @RequirePermission(Permission.MANAGE_ROLES)
  @Patch('users/:id/role')
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: Request,
  ) {
    return this.admin.updateRole(
      actorFrom(user, req),
      id,
      dto.role,
      dto.reason,
    );
  }

  @RequirePermission(Permission.MANAGE_USERS)
  @Post('users/:id/suspend')
  suspend(
    @Param('id') id: string,
    @Body() dto: SuspendUserDto,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: Request,
  ) {
    return this.admin.setSuspended(actorFrom(user, req), id, true, dto.reason);
  }

  @RequirePermission(Permission.MANAGE_USERS)
  @Post('users/:id/unsuspend')
  unsuspend(
    @Param('id') id: string,
    @Body() dto: SuspendUserDto,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: Request,
  ) {
    return this.admin.setSuspended(actorFrom(user, req), id, false, dto.reason);
  }

  @RequirePermission(Permission.VIEW_AUDIT_LOG)
  @Get('audit-log')
  getAuditLog(@Query('take') take?: string, @Query('skip') skip?: string) {
    return this.admin.getAuditLog(clampTake(take), parseSkip(skip));
  }
}

function actorFrom(user: AuthenticatedRequestUser, req: Request): AdminActor {
  return { id: user.sub, ndyId: user.ndyId, ip: req.ip };
}

function clampTake(raw?: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 25;
  return Math.min(n, 100);
}

function parseSkip(raw?: string): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
