import { forwardRef, Module } from '@nestjs/common';
import { TrustService } from './trust.service';
import { TrustController } from './trust.controller';
import { AuthModule } from '../auth/auth.module';

/**
 * Phase 8 — NDY Trust tier computation. Its own module, same reasoning as
 * IdentityVerificationModule's doc comment: no reason to add a module to
 * the AuthModule/IdentityModule/WorkspaceModule cycle that doesn't need to
 * be in it. Imports AuthModule for JwtAuthGuard. Exports TrustService so
 * IdentityVerificationModule (and AuthModule's own Sms2faService, for
 * LEVEL_2/phone verification) can call recompute() without a duplicate
 * service or a database write they shouldn't own directly.
 *
 * forwardRef: AuthModule now also imports TrustModule back (Sms2faService
 * needs TrustService), making this a real bidirectional cycle — wrapped on
 * both sides defensively, same as NotificationModule's matching forwardRef,
 * per this project's own DI-boot-crash history of a one-side-only
 * forwardRef still crashing at boot for a bidirectionally-reachable cycle.
 */
@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [TrustController],
  providers: [TrustService],
  exports: [TrustService],
})
export class TrustModule {}
