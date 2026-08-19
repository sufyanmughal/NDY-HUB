import { Module } from '@nestjs/common';
import { IdentityVerificationService } from './identity-verification.service';
import { IdentityVerificationController } from './identity-verification.controller';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notifications/notification.module';

/**
 * Phase 7's LEVEL_3 review flow — deliberately its own module rather than
 * folded into IdentityModule (which is public-Passport-view only, see
 * identity.controller.ts's own doc comment, and already sits in a real
 * module cycle with AuthModule/WorkspaceModule — no reason to add a fourth
 * module to that cycle when this one doesn't need to be in it at all).
 * Imports AuthModule for JwtAuthGuard/PermissionGuard and NotificationModule
 * so IdentityVerificationService can notify the requester on decision.
 */
@Module({
  imports: [AuthModule, NotificationModule],
  controllers: [IdentityVerificationController],
  providers: [IdentityVerificationService],
})
export class IdentityVerificationModule {}
