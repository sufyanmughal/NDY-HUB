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
import { IdentityModule } from '../identity/identity.module';
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
  exports: [
    JwtModule,
    JwtAuthGuard,
    SecurityEventService,
    MailService,
    DeviceService,
  ],
})
export class AuthModule {}
