import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequestUser } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { Permission } from '../common/permissions';
import { NdyqrService } from './ndyqr.service';
import { CreateNdyQrDto, UpdateNdyQrDto } from './dto/ndyqr.dto';

/**
 * NDYQR™ management API. Every authenticated member can create and manage
 * their own codes (the client's "users or businesses could create a QR code"
 * requirement) — ownership is enforced in the service, so a code id from
 * someone else's account resolves to a plain 404, same as every other
 * owned-resource route in this app (e.g. notifications, sessions).
 *
 * The platform-wide listing is the one admin action and is gated behind
 * MANAGE_QR_CODES via the same PermissionGuard pattern as the admin console.
 */
@UseGuards(JwtAuthGuard)
@Controller('ndyqr')
export class NdyqrController {
  constructor(private readonly ndyqr: NdyqrService) {}

  @Post()
  create(
    @Body() dto: CreateNdyQrDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.ndyqr.create(user.sub, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.ndyqr.listForUser(user.sub);
  }

  /** Brand defaults for the renderer (gradient stops + style key) — read by
   * the web UI so the NDY standard is defined once, server-side. Declared
   * before `:id` so it isn't swallowed by the param route. */
  @Get('brand')
  brand() {
    return this.ndyqr.getBrandDefaults();
  }

  /** Every code in the ecosystem — the "central" admin view. Declared before
   * `:id` for the same routing reason. */
  @UseGuards(PermissionGuard)
  @RequirePermission(Permission.MANAGE_QR_CODES)
  @Get('admin/all')
  listAll() {
    return this.ndyqr.listAll();
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.ndyqr.getOwned(user.sub, id);
  }

  @Get(':id/analytics')
  analytics(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.ndyqr.analytics(user.sub, id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateNdyQrDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.ndyqr.update(user.sub, id, dto);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.ndyqr.remove(user.sub, id);
  }
}
