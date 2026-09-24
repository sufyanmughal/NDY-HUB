import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notifications/notification.module';
import { OAuthModule } from '../oauth/oauth.module';
import { SignatureController } from './signature.controller';
import { SignatureService } from './signature.service';

/**
 * NDY Signature (Phase 8, second half).
 *
 * AuthModule provides JwtAuthGuard (route protection) and MailService (the
 * email-invite delivery path) — both are exported from there, same as
 * WorkspaceModule/NotificationModule rely on. NotificationModule provides the
 * in-app alerts. SignatureService is exported so other modules (e.g. a future
 * Document "sign this" action) can create requests without duplicating the
 * lifecycle.
 */
@Module({
  // OAuthModule provides OidcKeysService so a signature can be cryptographically
  // attested with NDY HUB's existing published signing keypair.
  imports: [AuthModule, NotificationModule, OAuthModule],
  controllers: [SignatureController],
  providers: [SignatureService],
  exports: [SignatureService],
})
export class SignatureModule {}
