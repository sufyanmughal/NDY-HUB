import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { AuthModule } from '../auth/auth.module';

/**
 * Imports AuthModule for JwtAuthGuard (route protection) and MailService
 * (EMAIL channel delivery) — same reuse pattern as every other module that
 * guards its routes with @UseGuards(JwtAuthGuard).
 */
@Module({
  imports: [AuthModule],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
