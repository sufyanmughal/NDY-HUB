import { forwardRef, Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { AuthModule } from '../auth/auth.module';

/**
 * Imports AuthModule for JwtAuthGuard (route protection) and MailService
 * (EMAIL channel delivery) — same reuse pattern as every other module that
 * guards its routes with @UseGuards(JwtAuthGuard).
 *
 * forwardRef: AuthModule now also imports NotificationModule back (so
 * DeviceApprovalService can fire an ACTION_APPROVAL notification — see
 * auth.module.ts's matching forwardRef and doc comment), which makes this
 * a real bidirectional cycle. Wrapped on both sides defensively, per this
 * project's own DI-boot-crash history of a one-side-only forwardRef still
 * crashing at boot for a bidirectionally-reachable cycle.
 */
@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
