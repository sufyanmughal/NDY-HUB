import { Controller, Get, UseGuards } from '@nestjs/common';
import { FounderService } from './founder.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FounderGuard } from './guards/founder.guard';

@UseGuards(JwtAuthGuard, FounderGuard)
@Controller('founder')
export class FounderController {
  constructor(private readonly founder: FounderService) {}

  @Get('overview')
  getOverview() {
    return this.founder.getEcosystemOverview();
  }
}
