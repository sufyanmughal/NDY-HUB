import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { VerificationLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IdentityService } from '../identity/identity.service';
import { SmsService } from '../common/sms.service';
import { SecurityEventService } from './security-event.service';
import { Sms2faSetupDto } from './dto/sms-2fa-setup.dto';
import { ConfirmSms2faDto } from './dto/confirm-sms-2fa.dto';
import { DisableSms2faDto } from './dto/disable-sms-2fa.dto';

/**
 * SMS-based 2FA via Sinch's Verification API — a second, independent
 * factor alongside TotpService's authenticator-app 2FA (a user can enable
 * either, both, or neither; both count toward `enabledTwoFactorMethods`).
 * Sinch owns the OTP itself: unlike TOTP, there's no local secret to
 * generate, encrypt, or store — startVerification()/checkVerification()
 * are the entire mechanism, so this service is mostly orchestration
 * around SmsService plus the User row's smsPhoneE164/smsEnabledAt flags.
 */
@Injectable()
export class Sms2faService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: IdentityService,
    private readonly sms: SmsService,
    private readonly securityEvents: SecurityEventService,
  ) {}

  /**
   * Step 1 of setup — sends a real SMS code to the submitted number. No
   * secret to store server-side yet (unlike TotpService.beginSetup);
   * confirmSetup re-checks the same number against Sinch directly.
   */
  async beginSetup(userId: string, dto: Sms2faSetupDto): Promise<void> {
    const user = await this.identity.findById(userId);
    if (user.smsEnabledAt) {
      throw new BadRequestException(
        'SMS two-factor authentication is already enabled.',
      );
    }

    const existing = await this.prisma.user.findUnique({
      where: { smsPhoneE164: dto.phoneE164 },
      select: { id: true },
    });
    if (existing && existing.id !== userId) {
      throw new ConflictException(
        'This phone number is already used for SMS verification on another account.',
      );
    }

    const sent = await this.sms.startVerification(dto.phoneE164);
    if (!sent) {
      throw new BadRequestException(
        'Could not send a verification code to that number — check it and try again.',
      );
    }
  }

  /**
   * Step 2 — confirms setup with the code just texted to the number
   * submitted in beginSetup, then flips smsEnabledAt on. Also the first
   * time a phone number is ever actually verified on this account:
   * phoneVerifiedAt and verificationLevel move the same one-way way
   * emailVerifiedAt/LEVEL_1 already do for email.
   */
  async confirmSetup(userId: string, dto: ConfirmSms2faDto): Promise<void> {
    const user = await this.identity.findById(userId);
    if (user.smsEnabledAt) {
      throw new BadRequestException(
        'SMS two-factor authentication is already enabled.',
      );
    }

    const valid = await this.sms.checkVerification(dto.phoneE164, dto.code);
    if (!valid) {
      throw new UnauthorizedException(
        'Incorrect code — check your messages and try again.',
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        smsPhoneE164: dto.phoneE164,
        smsEnabledAt: new Date(),
        phoneVerifiedAt: user.phoneVerifiedAt ?? new Date(),
        // Only ever moves LEVEL_0/LEVEL_1 -> LEVEL_2 — never downgrades a
        // user already at LEVEL_3, same one-way pattern as email's
        // LEVEL_0 -> LEVEL_1 move.
        verificationLevel:
          user.verificationLevel === VerificationLevel.LEVEL_0 ||
          user.verificationLevel === VerificationLevel.LEVEL_1
            ? VerificationLevel.LEVEL_2
            : undefined,
      },
    });
    void this.securityEvents.record(userId, 'SMS_2FA_ENABLED');
  }

  /**
   * Requires the current password — matching TOTP disable's friction,
   * though lighter (no code re-entry) since there's no local secret to
   * prove possession of the way a TOTP secret or backup code is.
   */
  async disable(userId: string, dto: DisableSms2faDto): Promise<void> {
    const user = await this.identity.findById(userId);
    if (!user.smsEnabledAt) {
      throw new BadRequestException(
        'SMS two-factor authentication is not enabled.',
      );
    }
    if (
      !user.passwordHash ||
      !(await bcrypt.compare(dto.currentPassword, user.passwordHash))
    ) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { smsPhoneE164: null, smsEnabledAt: null },
    });
    void this.securityEvents.record(userId, 'SMS_2FA_DISABLED');
  }

  /** Login-time "text me a code" step — always sends to the account's
   * already-verified number, never a user-supplied one. */
  async sendChallengeCode(userId: string): Promise<void> {
    const user = await this.identity.findById(userId);
    if (!user.smsEnabledAt || !user.smsPhoneE164) {
      throw new BadRequestException(
        'SMS two-factor authentication is not enabled on this account.',
      );
    }
    await this.sms.startVerification(user.smsPhoneE164);
  }

  /** Checks a login-time code against the account's verified number —
   * called by TotpService.verifyChallenge once it's determined the
   * challenge should be redeemed via SMS rather than TOTP/backup code. */
  async checkChallengeCode(
    smsPhoneE164: string,
    code: string,
  ): Promise<boolean> {
    return this.sms.checkVerification(smsPhoneE164, code);
  }
}
