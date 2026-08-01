import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
// Imported from @otplib/totp directly rather than the top-level `otplib`
// package: otplib's own barrel module eagerly requires its noble/scure
// plugin packages (for default crypto/base32 fallbacks), and those are
// pure ESM with no CJS build — merely importing anything from `otplib`
// pulls them in and crashes under Vercel's per-file CJS transpilation.
// @otplib/totp has no such fallback logic and no plugin dependencies at all.
import { TOTP } from '@otplib/totp';
import {
  NodeCryptoPlugin,
  NodeBase32Plugin,
} from '../common/otplib-node-plugins';
import { customAlphabet } from 'nanoid';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { IdentityService } from '../identity/identity.service';
import { SessionService, SessionMeta, IssuedSession } from './session.service';
import {
  encryptTotpSecret,
  decryptTotpSecret,
} from '../common/totp-crypto.util';
import { ConfirmTotpDto } from './dto/confirm-totp.dto';
import { DisableTotpDto } from './dto/disable-totp.dto';
import { Verify2faDto } from './dto/verify-2fa.dto';

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes — meant to be redeemed within the same login attempt
const BACKUP_CODE_COUNT = 8;
const generateBackupCode = customAlphabet(
  'ABCDEFGHJKMNPQRSTUVWXYZ23456789', // no 0/O/1/I — same reasoning as NDY ID generation
  10,
);
const generateChallengeToken = customAlphabet(
  'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789',
  32,
);

/**
 * TOTP-based 2FA, plus the backup-code fallback for "I lost my phone."
 * Kept separate from AuthService (already large) — login() there calls
 * into issueChallenge/verifyChallenge here rather than owning any TOTP
 * logic itself.
 */
@Injectable()
export class TotpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: IdentityService,
    private readonly sessions: SessionService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Step 1 of setup — generates a secret, stores it encrypted but not yet
   * active, and returns the otpauth:// URI for a QR code plus the raw
   * secret as a manual-entry fallback. Calling this again before
   * confirming just overwrites the pending secret — nothing depends on
   * the old one until confirmSetup verifies a real code against it.
   */
  async beginSetup(
    userId: string,
  ): Promise<{ secret: string; otpauthUri: string }> {
    const user = await this.identity.findById(userId);
    if (user.totpEnabledAt) {
      throw new BadRequestException(
        'Two-factor authentication is already enabled.',
      );
    }

    const secret = new TOTP({
      crypto: new NodeCryptoPlugin(),
      base32: new NodeBase32Plugin(),
    }).generateSecret();

    const encryptionKey = this.config.getOrThrow<string>('TOTP_ENCRYPTION_KEY');
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecretEncrypted: encryptTotpSecret(secret, encryptionKey) },
    });

    const otpauthUri = new TOTP({
      secret,
      issuer: 'NDY HUB',
      label: user.email,
      crypto: new NodeCryptoPlugin(),
      base32: new NodeBase32Plugin(),
    }).toURI();

    return { secret, otpauthUri };
  }

  /**
   * Step 2 — confirms setup with a real code from the authenticator app,
   * flips totpEnabledAt on, and issues backup codes. The codes are
   * returned exactly once, here — only their hashes are ever stored,
   * same pattern as OAuthClient's client_secret.
   */
  async confirmSetup(
    userId: string,
    dto: ConfirmTotpDto,
  ): Promise<{ backupCodes: string[] }> {
    const user = await this.identity.findById(userId);
    if (user.totpEnabledAt) {
      throw new BadRequestException(
        'Two-factor authentication is already enabled.',
      );
    }
    if (!user.totpSecretEncrypted) {
      throw new BadRequestException('Start setup before confirming it.');
    }

    const valid = await this.verifyTotpCode(user.totpSecretEncrypted, dto.code);
    if (!valid) {
      throw new UnauthorizedException(
        'Incorrect code — check your authenticator app and try again.',
      );
    }

    const backupCodes = Array.from({ length: BACKUP_CODE_COUNT }, () =>
      generateBackupCode(),
    );
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { totpEnabledAt: new Date() },
      }),
      this.prisma.totpBackupCode.createMany({
        data: backupCodes.map((code) => ({
          userId,
          codeHash: hashBackupCode(code),
        })),
      }),
    ]);

    return { backupCodes };
  }

  /**
   * Requires both the current password and a valid 2FA code — high
   * friction on purpose for a security-downgrading action. Deletes every
   * backup code along with the secret; re-enabling later starts fresh.
   */
  async disable(userId: string, dto: DisableTotpDto): Promise<void> {
    const user = await this.identity.findById(userId);
    if (!user.totpEnabledAt || !user.totpSecretEncrypted) {
      throw new BadRequestException(
        'Two-factor authentication is not enabled.',
      );
    }
    if (
      !user.passwordHash ||
      !(await bcrypt.compare(dto.currentPassword, user.passwordHash))
    ) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    const valid = await this.verifyCodeOrBackupCode(
      userId,
      user.totpSecretEncrypted,
      dto.code,
    );
    if (!valid) {
      throw new UnauthorizedException('Incorrect code.');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { totpSecretEncrypted: null, totpEnabledAt: null },
      }),
      this.prisma.totpBackupCode.deleteMany({ where: { userId } }),
    ]);
  }

  /** Called from AuthService.login() once the password checks out. */
  async issueChallenge(userId: string): Promise<string> {
    const token = generateChallengeToken();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorChallengeTokenHash: hashChallengeToken(token),
        twoFactorChallengeExpiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      },
    });
    return token;
  }

  /**
   * Step 2 of a 2FA login — trades the challenge token plus a TOTP or
   * backup code for a real session. Single-use, enforced the same
   * atomic way as every other one-time token in this schema.
   */
  async verifyChallenge(
    dto: Verify2faDto,
    meta: SessionMeta,
  ): Promise<IssuedSession> {
    const tokenHash = hashChallengeToken(dto.challengeToken);
    const user = await this.prisma.user.findUnique({
      where: { twoFactorChallengeTokenHash: tokenHash },
    });
    if (
      !user ||
      !user.twoFactorChallengeExpiresAt ||
      user.twoFactorChallengeExpiresAt < new Date() ||
      !user.totpSecretEncrypted
    ) {
      throw new UnauthorizedException(
        'This login attempt has expired — sign in again.',
      );
    }

    const valid = await this.verifyCodeOrBackupCode(
      user.id,
      user.totpSecretEncrypted,
      dto.code,
    );
    if (!valid) {
      throw new UnauthorizedException('Incorrect code.');
    }

    const result = await this.prisma.user.updateMany({
      where: { id: user.id, twoFactorChallengeTokenHash: tokenHash },
      data: {
        twoFactorChallengeTokenHash: null,
        twoFactorChallengeExpiresAt: null,
      },
    });
    if (result.count === 0) {
      throw new ConflictException('This login attempt was already completed.');
    }

    return this.sessions.issueSession(user.id, user.ndyId, meta);
  }

  private async verifyTotpCode(
    encryptedSecret: string,
    code: string,
  ): Promise<boolean> {
    const encryptionKey = this.config.getOrThrow<string>('TOTP_ENCRYPTION_KEY');
    const secret = decryptTotpSecret(encryptedSecret, encryptionKey);
    const totp = new TOTP({
      secret,
      crypto: new NodeCryptoPlugin(),
      base32: new NodeBase32Plugin(),
    });
    // ±30s tolerance for clock drift between the server and the user's
    // phone — RFC 6238's own transmission-delay rationale, just widened a
    // little for a friendlier default than "exactly this 30-second window."
    try {
      const result = await totp.verify(code, { epochTolerance: 30 });
      return result.valid;
    } catch {
      // otplib throws (TokenLengthError etc.) instead of returning
      // { valid: false } when the input isn't a well-formed 6-digit code —
      // e.g. a 10-char backup code falling through from
      // verifyCodeOrBackupCode. Any malformed input just isn't a valid
      // TOTP code.
      return false;
    }
  }

  private async verifyCodeOrBackupCode(
    userId: string,
    encryptedSecret: string,
    code: string,
  ): Promise<boolean> {
    if (await this.verifyTotpCode(encryptedSecret, code)) return true;

    // Falls back to a backup code — single-use, enforced the same
    // updateMany-then-check-count way as every other one-time credential
    // in this schema.
    const result = await this.prisma.totpBackupCode.updateMany({
      where: { userId, codeHash: hashBackupCode(code), usedAt: null },
      data: { usedAt: new Date() },
    });
    return result.count > 0;
  }
}

function hashBackupCode(code: string): string {
  return createHash('sha256').update(code.toUpperCase()).digest('hex');
}

function hashChallengeToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
