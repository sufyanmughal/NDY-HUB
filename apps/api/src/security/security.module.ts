import { Module } from '@nestjs/common';
import { SecurityService } from './security.service';
import {
  SecurityController,
  SecurityDevicesController,
} from './security.controller';
import { SecurityEventsController } from './security-events.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  // AuthModule: JwtAuthGuard on every controller here, SecurityEventService
  // for SecurityEventsController, and DeviceService (Phase D) for
  // SecurityService's device list/revoke methods.
  imports: [AuthModule],
  controllers: [
    SecurityController,
    SecurityDevicesController,
    SecurityEventsController,
  ],
  providers: [SecurityService],
})
export class SecurityModule {}
