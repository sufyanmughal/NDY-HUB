import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IdentityVerificationRequestStatus } from '@prisma/client';
import { IdentityVerificationService } from './identity-verification.service';
import { CreateIdentityVerificationRequestDto } from './dto/create-identity-verification-request.dto';
import { ReviewIdentityVerificationRequestDto } from './dto/review-identity-verification-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { Permission } from '../common/permissions';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('identity-verification')
export class IdentityVerificationController {
  constructor(
    private readonly identityVerification: IdentityVerificationService,
  ) {}

  @Post('requests')
  createRequest(
    @Body() dto: CreateIdentityVerificationRequestDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.identityVerification.createRequest(user.sub, dto.evidenceNote);
  }

  @Get('requests/mine')
  listMine(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.identityVerification.listMine(user.sub);
  }

  @UseGuards(PermissionGuard)
  @RequirePermission(Permission.REVIEW_IDENTITY_VERIFICATION)
  @Get('requests')
  list(@Query('status') status?: IdentityVerificationRequestStatus) {
    return this.identityVerification.list(status);
  }

  @UseGuards(PermissionGuard)
  @RequirePermission(Permission.REVIEW_IDENTITY_VERIFICATION)
  @Post('requests/:id/approve')
  approve(
    @Param('id') id: string,
    @Body() dto: ReviewIdentityVerificationRequestDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.identityVerification.approve(
      { id: user.sub, ndyId: user.ndyId },
      id,
      dto.reason,
    );
  }

  @UseGuards(PermissionGuard)
  @RequirePermission(Permission.REVIEW_IDENTITY_VERIFICATION)
  @Post('requests/:id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: ReviewIdentityVerificationRequestDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.identityVerification.reject(
      { id: user.sub, ndyId: user.ndyId },
      id,
      dto.reason,
    );
  }
}
