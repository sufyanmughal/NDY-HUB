import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SessionService } from './session.service';
import { SecurityEventService } from './security-event.service';
import { DeviceService } from './device.service';
import { TotpService } from './totp.service';
import { Sms2faService } from './sms-2fa.service';
import { PasskeyService } from './passkey.service';
import { SocialAuthService } from './social-auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoginRequestGateway } from './login-request.gateway';
import { DeviceApprovalService } from './device-approval.service';
import { IdentityModule } from '../identity/identity.module';
import { NotificationModule } from '../notifications/notification.module';
import { GeoIpService } from '../common/geo-ip.service';
import { PhotoStorageService } from '../common/photo-storage.service';
import { MailService } from '../common/mail.service';
import { SmsService } from '../common/sms.service';

@Module({
  imports: [
    // forwardRef: IdentityModule -> WorkspaceModule -> AuthModule (this
    // edge) is a real cycle since Phase 4 added WorkspaceModule's own
    // AuthModule import — see workspace.module.ts's doc comment for the
    // full chain.
    forwardRef(() => IdentityModule),
    // forwardRef: NotificationModule already imports AuthModule (for
    // JwtAuthGuard/MailService, see notification.module.ts). This edge
    // (AuthModule -> NotificationModule, so DeviceApprovalService can fire
    // an ACTION_APPROVAL notification) completes that cycle. Wrapped on
    // BOTH sides (see notification.module.ts's matching forwardRef) —
    // this project has hit a cycle bug before where wrapping only one
    // side of a bidirectionally-reachable cycle still crashed at boot
    // (see project's own DI-boot-crash history), so both edges are
    // wrapped defensively rather than assuming one side suffices.
    forwardRef(() => NotificationModule),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionService,
    SecurityEventService,
    DeviceService,
    TotpService,
    Sms2faService,
    PasskeyService,
    SocialAuthService,
    JwtAuthGuard,
    LoginRequestGateway,
    DeviceApprovalService,
    GeoIpService,
    PhotoStorageService,
    MailService,
    SmsService,
  ],
  // JwtModule (for JwtService) and JwtAuthGuard itself need to be visible to
  // any other module that guards a route with @UseGuards(JwtAuthGuard) —
  // without this, Nest can resolve JwtAuthGuard's class but not its
  // JwtService constructor dependency, and refuses to boot. MailService is
  // exported so NotificationModule (Phase 2) can reuse the same Resend
  // wrapper rather than a second instance — it's stateless, so this is
  // just visibility, not shared state. DeviceService lives here (not
  // SecurityModule, where its endpoints actually are) specifically to
  // avoid a cycle: SessionService (this module) needs to call it on every
  // login, and SecurityModule already imports AuthModule — putting
  // DeviceService in SecurityModule instead would require AuthModule to
  // import SecurityModule right back, the same class of cycle this
  // project has hit twice before (see workspace.module.ts's doc comment).
  // AuthService is exported so OAuthModule's TokenController can reuse its
  // login() (bcrypt compare, suspended/email-verified/2FA checks) for the
  // OAuth password grant instead of a second, drifted copy of that logic —
  // this is a provider export, not a controller/route change, so it's the
  // same class of easy-to-miss DI wiring that has caused a boot crash
  // before in this codebase (a provider that compiles fine under tsc but
  // Nest can't actually resolve at runtime because the owning module never
  // exported it) — always re-check both directions (this module's exports,
  // the consuming module's imports) when wiring a new cross-module
  // dependency, not just one side. PasskeyService is exported for the same
  // reason: OAuthModule's CrossProductPasskeyController (NDYMAIL's Face
  // ID/Touch ID/Passkey ceremonies) reuses it directly rather than
  // duplicating the WebAuthn options/verify logic.
  exports: [
    JwtModule,
    JwtAuthGuard,
    SecurityEventService,
    MailService,
    DeviceService,
    AuthService,
    PasskeyService,
  ],
})
export class AuthModule {}
