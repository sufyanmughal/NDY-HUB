import { Module } from '@nestjs/common';
import { SecurityService } from './security.service';
import { SecurityController } from './security.controller';
import { SecurityEventsController } from './security-events.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  // AuthModule: JwtAuthGuard on both controllers, SecurityEventService for
  // SecurityEventsController.
  imports: [AuthModule],
  controllers: [SecurityController, SecurityEventsController],
  providers: [SecurityService],
})
export class SecurityModule {}
