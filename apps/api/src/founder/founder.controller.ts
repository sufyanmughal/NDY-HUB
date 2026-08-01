import { Controller, Get, UseGuards } from '@nestjs/common';
import { FounderService } from './founder.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { Permission } from '../common/permissions';

@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission(Permission.VIEW_FOUNDER_OVERVIEW)
@Controller('founder')
export class FounderController {
  constructor(private readonly founder: FounderService) {}

  @Get('overview')
  getOverview() {
    return this.founder.getEcosystemOverview();
  }
}
