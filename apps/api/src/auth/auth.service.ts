import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { customAlphabet } from 'nanoid';
import { createHash } from 'crypto';
import { unlink } from 'fs/promises';
import { join } from 'path';
import {
  LoginRequestMethod,
  LoginRequestStatus,
  VerificationLevel,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IdentityService } from '../identity/identity.service';
import { PROFILE_PHOTOS_DIR } from '../common/upload-dir.util';
import { SessionService, SessionMeta, IssuedSession } from './session.service';
import { LoginRequestGateway } from './login-request.gateway';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { CreateLoginRequestDto } from './dto/create-login-request.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ConfirmEmailDto } from './dto/confirm-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const SALT_ROUNDS = 12;
const LOGIN_REQUEST_TTL_MS = 90_000; // 90 seconds, per the desktop-QR / deep-link spec
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour — tighter than email verification on purpose
const generateToken = customAlphabet(
  'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789',
  32,
);

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: IdentityService,
    private readonly sessions: SessionService,
    private readonly gateway: LoginRequestGateway,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto, meta: SessionMeta): Promise<IssuedSession> {
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.identity.createUser({
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
    });
    await this.issueAndSendVerificationEmail(user.id, user.email);
    return this.sessions.issueSession(user.id, user.ndyId, meta);
  }

  async login(dto: LoginDto, meta: SessionMeta): Promise<IssuedSession> {
    const user = await this.identity.findByEmail(dto.email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Incorrect email or password.');
    }
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Incorrect email or password.');
    }
    if (user.suspended) {
      throw new UnauthorizedException('This account has been suspended.');
    }
    return this.sessions.issueSession(user.id, user.ndyId, meta);
  }

  async refresh(
    refreshToken: string,
    meta: SessionMeta,
  ): Promise<IssuedSession> {
    return this.sessions.rotateSession(refreshToken, meta);
  }

  async logout(refreshToken: string): Promise<void> {
    return this.sessions.revokeSession(refreshToken);
  }

  async getMe(userId: string) {
    const user = await this.identity.findById(userId);
    return {
      ndyId: user.ndyId,
      email: user.email,
      fullName: user.fullName,
      profilePhotoUrl: user.profilePhotoUrl,
      verificationLevel: user.verificationLevel,
      ndyappsConnected: user.ndyappsConnected,
      createdAt: user.createdAt,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.identity.updateProfile(userId, dto);
    return {
      ndyId: user.ndyId,
      email: user.email,
      fullName: user.fullName,
      profilePhotoUrl: user.profilePhotoUrl,
    };
  }

  /**
   * The upload endpoint's counterpart to updateProfile's arbitrary-URL
   * path — this one is what the file actually landed on disk as, not a
   * client-supplied string. Deletes whatever photo the user had before
   * (best-effort — a leftover file if this fails is harmless, unlike
   * failing the new upload over it) so re-uploading doesn't pile up
   * orphaned files on disk forever.
   */
  async updateProfilePhoto(
    userId: string,
    filename: string,
  ): Promise<{ profilePhotoUrl: string }> {
    const user = await this.identity.findById(userId);
    const apiUrl =
      this.config.get<string>('API_URL') ??
      `http://localhost:${this.config.get('PORT') ?? 3000}`;
    const profilePhotoUrl = `${apiUrl}/uploads/profile-photos/${filename}`;

    await this.deleteStalePhoto(user.profilePhotoUrl);
    await this.prisma.user.update({
      where: { id: userId },
      data: { profilePhotoUrl },
    });

    return { profilePhotoUrl };
  }

  private async deleteStalePhoto(currentUrl: string | null): Promise<void> {
    const marker = '/uploads/profile-photos/';
    if (!currentUrl?.includes(marker)) return;
    const filename = currentUrl.split(marker)[1];
    if (!filename) return;
    await unlink(join(PROFILE_PHOTOS_DIR, filename)).catch(() => {
      /* best-effort — a stray file left on disk is harmless */
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.identity.findById(userId);
    if (!user.passwordHash) {
      throw new BadRequestException(
        'This account has no password set — it was created through NDYAPPS/Google/Apple.',
      );
    }
    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect.');
    }
    const newHash = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });
  }

  /**
   * Always resolves the same way whether or not the email is registered —
   * the controller returns one generic message either way. Letting a
   * caller tell "unregistered email" apart from "check your inbox" turns
   * this endpoint into an account-enumeration oracle, so there's no early
   * return with a different shape for that case, just silently doing
   * nothing further.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.identity.findByEmail(dto.email);
    // No account, a Google/Apple/NDYAPPS-only account with no password to
    // reset, or a deleted/anonymized account — nothing to email, and the
    // caller can't distinguish this from a real send either way.
    if (!user || !user.passwordHash || user.deletedAt) return;

    const token = generateToken();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: hashToken(token),
        passwordResetExpiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    });
    this.sendPasswordResetEmail(user.email, token);
  }

  /**
   * The click-through from the reset link. Public by design — the token
   * itself is the credential, same reasoning as confirmEmailVerification.
   * Redeeming it also revokes every existing session on the account: a
   * password reset is exactly the moment something might be compromised,
   * so whoever had the old password gets signed out everywhere, not just
   * here — the same "kick everyone out" behavior SecurityService's
   * revoke-all already gives a user who does this deliberately.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const tokenHash = hashToken(dto.token);
    const user = await this.prisma.user.findUnique({
      where: { passwordResetTokenHash: tokenHash },
    });
    if (
      !user ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt < new Date()
    ) {
      throw new BadRequestException(
        'This password reset link is invalid or has expired.',
      );
    }

    const newHash = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);
    const result = await this.prisma.user.updateMany({
      where: { id: user.id, passwordResetTokenHash: tokenHash },
      data: {
        passwordHash: newHash,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      },
    });
    if (result.count === 0) {
      throw new ConflictException('This password reset link was already used.');
    }

    await this.prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private sendPasswordResetEmail(email: string, token: string): void {
    const webAppUrl = this.config.getOrThrow<string>('WEB_APP_URL');
    const link = `${webAppUrl}/reset-password?token=${token}`;
    this.logger.warn(
      `No email provider configured — password reset link for ${email}: ${link}`,
    );
  }

  /** Resend, called from Settings — register() already sends the first one. */
  async requestEmailVerification(userId: string): Promise<void> {
    const user = await this.identity.findById(userId);
    if (user.emailVerifiedAt) {
      throw new BadRequestException('This email address is already verified.');
    }
    await this.issueAndSendVerificationEmail(user.id, user.email);
  }

  /**
   * The click-through from the verification link. Public (no auth) by
   * design — the token itself, not a session, is the credential here, the
   * same way a password-reset link works. Single-use, enforced the same
   * atomic way as every other one-time token in this schema: the update's
   * WHERE clause only matches while the hash is still present, so a
   * double-click or a replayed request updates zero rows the second time.
   */
  async confirmEmailVerification(
    dto: ConfirmEmailDto,
  ): Promise<{ verificationLevel: VerificationLevel }> {
    const tokenHash = hashToken(dto.token);
    const user = await this.prisma.user.findUnique({
      where: { emailVerificationTokenHash: tokenHash },
    });
    if (
      !user ||
      !user.emailVerificationExpiresAt ||
      user.emailVerificationExpiresAt < new Date()
    ) {
      throw new BadRequestException(
        'This verification link is invalid or has expired.',
      );
    }

    const result = await this.prisma.user.updateMany({
      where: { id: user.id, emailVerificationTokenHash: tokenHash },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null,
        // Only ever moves LEVEL_0 -> LEVEL_1 — phone/identity verification
        // (LEVEL_2/LEVEL_3) don't exist yet, but if they ever land first for
        // some user, confirming email afterward shouldn't downgrade them.
        verificationLevel:
          user.verificationLevel === VerificationLevel.LEVEL_0
            ? VerificationLevel.LEVEL_1
            : undefined,
      },
    });
    if (result.count === 0) {
      throw new ConflictException('This verification link was already used.');
    }

    return {
      verificationLevel:
        user.verificationLevel === VerificationLevel.LEVEL_0
          ? VerificationLevel.LEVEL_1
          : user.verificationLevel,
    };
  }

  private async issueAndSendVerificationEmail(
    userId: string,
    email: string,
  ): Promise<void> {
    const token = generateToken();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationTokenHash: hashToken(token),
        emailVerificationExpiresAt: new Date(
          Date.now() + EMAIL_VERIFICATION_TTL_MS,
        ),
      },
    });
    this.sendVerificationEmail(email, token);
  }

  /** No email provider is configured (no SMTP/SendGrid key exists in this
   * environment) — same dev-mode-fallback pattern as MembershipService's
   * Stripe warning. Logs the link a real email would contain instead of
   * silently doing nothing, so the flow is still testable end-to-end
   * locally. Swap this for a real provider call before this goes anywhere
   * near production traffic. */
  private sendVerificationEmail(email: string, token: string): void {
    const webAppUrl = this.config.getOrThrow<string>('WEB_APP_URL');
    const link = `${webAppUrl}/verify-email?token=${token}`;
    this.logger.warn(
      `No email provider configured — verification link for ${email}: ${link}`,
    );
  }

  /**
   * Step 1 of the QR / deep-link flow: a browser or mobile page asks for a
   * fresh, single-use login request. The token goes into the QR code (desktop)
   * or the universal-link URL (mobile) — NDYAPPS calls back with it once the
   * person approves or denies inside the app.
   */
  async createLoginRequest(
    dto: CreateLoginRequestDto,
    meta: { ip?: string; location?: string },
  ) {
    const token = generateToken();
    return this.prisma.loginRequest.create({
      data: {
        token,
        method: dto.method,
        requestingIp: meta.ip,
        requestingDevice: dto.device,
        requestingBrowser: dto.browser,
        requestingLocation: meta.location,
        expiresAt: new Date(Date.now() + LOGIN_REQUEST_TTL_MS),
      },
    });
  }

  async getLoginRequestStatus(token: string) {
    return this.findActiveOrExpire(token);
  }

  /**
   * Step 2: called from inside NDYAPPS once the user taps Approve, using the
   * app's own authenticated session (enforced by JwtAuthGuard on the route) —
   * so this can only ever succeed from a device that's already logged in as
   * that user.
   */
  async approveLoginRequest(token: string, userId: string) {
    const loginRequest = await this.findActiveOrExpire(token);
    if (loginRequest.status !== LoginRequestStatus.PENDING) {
      throw new BadRequestException(
        `This login request is already ${loginRequest.status.toLowerCase()}.`,
      );
    }

    // Single-use enforcement: the WHERE clause only matches while still PENDING,
    // so a double-tap or a replayed call updates zero rows the second time.
    const result = await this.prisma.loginRequest.updateMany({
      where: { token, status: LoginRequestStatus.PENDING },
      data: {
        status: LoginRequestStatus.APPROVED,
        approvedAt: new Date(),
        userId,
      },
    });

    if (result.count === 0) {
      throw new ConflictException('This login request was already handled.');
    }

    // Approving a login request is proof the person has NDYAPPS and is
    // using it — that's exactly the signal ndyappsConnected exists to
    // record. Only flips false -> true, never touches an already-connected
    // user's timestamp.
    await this.prisma.user.updateMany({
      where: { id: userId, ndyappsConnected: false },
      data: { ndyappsConnected: true, ndyappsConnectedAt: new Date() },
    });

    this.gateway.publishStatus(token, LoginRequestStatus.APPROVED);
    return this.prisma.loginRequest.findUniqueOrThrow({ where: { token } });
  }

  async denyLoginRequest(token: string) {
    const loginRequest = await this.findActiveOrExpire(token);
    if (loginRequest.status !== LoginRequestStatus.PENDING) {
      throw new BadRequestException(
        `This login request is already ${loginRequest.status.toLowerCase()}.`,
      );
    }

    await this.prisma.loginRequest.updateMany({
      where: { token, status: LoginRequestStatus.PENDING },
      data: { status: LoginRequestStatus.DENIED, deniedAt: new Date() },
    });

    this.gateway.publishStatus(token, LoginRequestStatus.DENIED);
    return this.prisma.loginRequest.findUniqueOrThrow({ where: { token } });
  }

  /**
   * Step 3: the desktop browser redeems an APPROVED request for a real
   * session — the "exchange a one-time code for a token" half of the
   * OAuth2-style handshake described in the proposal. Single-use, enforced
   * the same atomic way as approve/deny.
   */
  async exchangeLoginRequest(
    token: string,
    meta: SessionMeta,
  ): Promise<IssuedSession> {
    const loginRequest = await this.findActiveOrExpire(token);
    if (
      loginRequest.status !== LoginRequestStatus.APPROVED ||
      !loginRequest.userId
    ) {
      throw new BadRequestException(
        'This login request has not been approved.',
      );
    }
    if (loginRequest.sessionIssuedAt) {
      throw new ConflictException(
        'This login request was already exchanged for a session.',
      );
    }

    const result = await this.prisma.loginRequest.updateMany({
      where: {
        token,
        status: LoginRequestStatus.APPROVED,
        sessionIssuedAt: null,
      },
      data: { sessionIssuedAt: new Date() },
    });
    if (result.count === 0) {
      throw new ConflictException(
        'This login request was already exchanged for a session.',
      );
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: loginRequest.userId },
    });
    return this.sessions.issueSession(user.id, user.ndyId, meta);
  }

  private async findActiveOrExpire(token: string) {
    const loginRequest = await this.prisma.loginRequest.findUnique({
      where: { token },
    });
    if (!loginRequest) {
      throw new BadRequestException('Unknown or expired login request.');
    }
    if (
      loginRequest.status === LoginRequestStatus.PENDING &&
      loginRequest.expiresAt < new Date()
    ) {
      const expired = await this.prisma.loginRequest.update({
        where: { token },
        data: { status: LoginRequestStatus.EXPIRED },
      });
      this.gateway.publishStatus(token, LoginRequestStatus.EXPIRED);
      return expired;
    }
    return loginRequest;
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export { LoginRequestMethod };
