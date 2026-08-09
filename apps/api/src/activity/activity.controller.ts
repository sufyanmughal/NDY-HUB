import { Controller, Get, UseGuards } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/guards/jwt-auth.guard';

@Controller('activity')
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMyActivity(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.activity.getMyActivity(user.sub);
  }
}
