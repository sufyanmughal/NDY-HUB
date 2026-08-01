import { Controller, Get, UseGuards } from '@nestjs/common';
import { EcosystemService } from './ecosystem.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// Any signed-in user, not admin/founder-gated — these are aggregate,
// non-sensitive counts (no per-user data), shown on the homepage.
@UseGuards(JwtAuthGuard)
@Controller('ecosystem')
export class EcosystemController {
  constructor(private readonly ecosystem: EcosystemService) {}

  @Get('overview')
  getOverview() {
    return this.ecosystem.getOverview();
  }
}
