import { Controller, Get } from '@nestjs/common';
import { EcosystemService } from './ecosystem.service';

// Fully public, no auth — aggregate, non-sensitive counts (no per-user
// data), shown on both the public landing page and the authenticated
// dashboard home. The landing page in particular needs these numbers
// before anyone has signed in.
@Controller('ecosystem')
export class EcosystemController {
  constructor(private readonly ecosystem: EcosystemService) {}

  @Get('overview')
  getOverview() {
    return this.ecosystem.getOverview();
  }
}
