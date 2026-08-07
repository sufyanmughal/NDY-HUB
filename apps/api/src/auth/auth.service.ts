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
import {
  LoginRequestMethod,
  LoginRequestStatus,
  VerificationLevel,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IdentityService } from '../identity/identity.service';
import { GeoIpService } from '../common/geo-ip.service';
import { PhotoStorageService } from '../common/photo-storage.service';
import { MailService } from '../common/mail.service';
import {
  verificationEmail,
  passwordResetEmail,
} from '../common/mail-templates';
import { isPassportVerified } from '../common/passport-verification.util';
import { SessionService, SessionMeta, IssuedSession } from './session.service';
import { TotpService } from './totp.service';
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
// The QR-login card's dev-only shortcut (apps/web/.../qr-login-card.tsx)
// needs a real session back immediately on a fresh database, with no
// browser/inbox available to click a verification link from — this one
// hardcoded account is exempted from the email-verification gate so that
// local testing without a phone still works. Never matches a real user's
// address.
const DEV_SHORTCUT_EMAIL = 'dev-test@ndyhub.local';
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
    private readonly totp: TotpService,
    private readonly gateway: LoginRequestGateway,
    private readonly config: ConfigService,
    private readonly geoIp: GeoIpService,
    private readonly photoStorage: PhotoStorageService,
    private readonly mail: MailService,
  ) {}

  /**
   * No session is issued here anymore — an account only becomes usable
   * once its email is confirmed (see confirmEmailVerification, which is
   * where the first real session now gets minted). Returning
   * requiresEmailVerification instead of throwing keeps this the same
   * "successful request, different next step" shape login() already uses
   * for requires2fa, rather than treating a brand-new, expected state as
   * an error.
   */
  async register(
    dto: RegisterDto,
    meta: SessionMeta,
  ): Promise<
    IssuedSession | { requiresEmailVerification: true; email: string }
  > {
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const isDevShortcut = dto.email === DEV_SHORTCUT_EMAIL;
    const user = await this.identity.createUser({
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      bio: dto.bio,
      country: dto.country,
      website: dto.website,
      linkedinUrl: dto.linkedinUrl,
      instagramUrl: dto.instagramUrl,
      xUrl: dto.xUrl,
      businessName: dto.businessName,
      businessRole: dto.businessRole,
      phone: dto.phone,
      bioIsPublic: dto.bioIsPublic,
      countryIsPublic: dto.countryIsPublic,
      websiteIsPublic: dto.websiteIsPublic,
      socialsIsPublic: dto.socialsIsPublic,
      businessIsPublic: dto.businessIsPublic,
      phoneIsPublic: dto.phoneIsPublic,
    });

    if (isDevShortcut) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
      });
      return this.sessions.issueSession(user.id, user.ndyId, meta);
    }

    await this.issueAndSendVerificationEmail(
      user.id,
      user.email,
      user.fullName,
    );
    return { requiresEmailVerification: true, email: user.email };
  }

  /**
   * Returns a real session directly for accounts without 2FA — unchanged
   * from before. For a 2FA-enabled account, password success alone isn't
   * enough: this returns a short-lived challenge token instead, and the
   * caller has to complete TotpService.verifyChallenge with a TOTP or
   * backup code before a session actually gets issued. Same reasoning now
   * applies to an unverified email: login() reports it instead of issuing
   * a session, same "successful login, extra step required" shape as
   * requires2fa rather than a thrown error — a correct password on an
   * unverified account isn't really "incorrect email or password."
   */
  async login(
    dto: LoginDto,
    meta: SessionMeta,
  ): Promise<
    | IssuedSession
    | { requires2fa: true; challengeToken: string }
    | { requiresEmailVerification: true; email: string }
  > {
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
    if (!user.emailVerifiedAt) {
      return { requiresEmailVerification: true, email: user.email };
    }
    if (user.totpEnabledAt) {
      const challengeToken = await this.totp.issueChallenge(user.id);
      return { requires2fa: true, challengeToken };
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
      id: user.id,
      ndyId: user.ndyId,
      email: user.email,
      fullName: user.fullName,
      profilePhotoUrl: user.profilePhotoUrl,
      verificationLevel: user.verificationLevel,
      ndyappsConnected: user.ndyappsConnected,
      twoFactorEnabled: Boolean(user.totpEnabledAt),
      role: user.role,
      createdAt: user.createdAt,
      bio: user.bio,
      country: user.country,
      website: user.website,
      linkedinUrl: user.linkedinUrl,
      instagramUrl: user.instagramUrl,
      xUrl: user.xUrl,
      businessName: user.businessName,
      businessRole: user.businessRole,
      phone: user.phone,
      bioIsPublic: user.bioIsPublic,
      countryIsPublic: user.countryIsPublic,
      websiteIsPublic: user.websiteIsPublic,
      socialsIsPublic: user.socialsIsPublic,
      businessIsPublic: user.businessIsPublic,
      phoneIsPublic: user.phoneIsPublic,
      // fullName, country, and a photo are the required Passport fields
      // (see DashboardGate) — bio/website/socials/business stay optional
      // and skippable. Widened from fullName-only per the user's explicit
      // "these details must be required" direction.
      passportComplete: isPassportComplete(user),
      isVerified: isPassportVerified(user),
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.identity.updateProfile(userId, dto);
    return {
      ndyId: user.ndyId,
      email: user.email,
      fullName: user.fullName,
      profilePhotoUrl: user.profilePhotoUrl,
      bio: user.bio,
      country: user.country,
      website: user.website,
      linkedinUrl: user.linkedinUrl,
      instagramUrl: user.instagramUrl,
      xUrl: user.xUrl,
      businessName: user.businessName,
      businessRole: user.businessRole,
      phone: user.phone,
      bioIsPublic: user.bioIsPublic,
      countryIsPublic: user.countryIsPublic,
      websiteIsPublic: user.websiteIsPublic,
      socialsIsPublic: user.socialsIsPublic,
      businessIsPublic: user.businessIsPublic,
      phoneIsPublic: user.phoneIsPublic,
      passportComplete: isPassportComplete(user),
      isVerified: isPassportVerified(user),
    };
  }

  /**
   * The upload endpoint's counterpart to updateProfile's arbitrary-URL
   * path — this one is a real uploaded file, stored via PhotoStorageService
   * (Vercel Blob in production, local disk in dev) rather than a
   * client-supplied string. Deletes whatever photo the user had before
   * (best-effort — a leftover file if this fails is harmless, unlike
   * failing the new upload over it) so re-uploading doesn't pile up
   * orphaned files forever.
   */
  async updateProfilePhoto(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ profilePhotoUrl: string }> {
    const user = await this.identity.findById(userId);
    const profilePhotoUrl = await this.photoStorage.save(file);

    await this.photoStorage.deleteByUrl(user.profilePhotoUrl);
    await this.prisma.user.update({
      where: { id: userId },
      data: { profilePhotoUrl },
    });

    return { profilePhotoUrl };
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
    this.sendPasswordResetEmail(user.email, user.fullName, token);
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

  private sendPasswordResetEmail(
    email: string,
    fullName: string | null,
    token: string,
  ): void {
    const webAppUrl = this.config.getOrThrow<string>('WEB_APP_URL');
    const link = `${webAppUrl}/reset-password?token=${token}`;
    const { subject, html } = passwordResetEmail({
      fullName,
      resetUrl: link,
      logoUrl: `${webAppUrl}/logo-mark.png`,
    });
    // Fire-and-forget: a slow/failed email provider shouldn't hold up the
    // response to a request that already succeeded server-side (the token
    // is persisted regardless) — same reasoning MailService itself
    // documents for why send() never throws.
    void this.mail.send({ to: email, subject, html });
  }

  /** Resend, called from Settings by an already-signed-in user whose email
   * somehow still isn't verified (edge case, not the main path anymore —
   * see requestEmailVerificationByEmail for the pre-login case, which is
   * the one an unverified account actually hits after register()). */
  async requestEmailVerification(userId: string): Promise<void> {
    const user = await this.identity.findById(userId);
    if (user.emailVerifiedAt) {
      throw new BadRequestException('This email address is already verified.');
    }
    await this.issueAndSendVerificationEmail(
      user.id,
      user.email,
      user.fullName,
    );
  }

  /**
   * Resend for the pre-login case: a freshly registered account has no
   * session yet (register() no longer issues one), so it can't hit the
   * JwtAuthGuard-protected /verify-email/resend above. Same
   * account-enumeration-safe shape as forgotPassword — resolves the same
   * way whether or not the email exists/is already verified, so a caller
   * can't use this to probe which emails are registered.
   */
  async requestEmailVerificationByEmail(email: string): Promise<void> {
    const user = await this.identity.findByEmail(email);
    if (!user || user.emailVerifiedAt || user.deletedAt) return;
    await this.issueAndSendVerificationEmail(
      user.id,
      user.email,
      user.fullName,
    );
  }

  /**
   * The click-through from the verification link. Public (no auth) by
   * design — the token itself, not a session, is the credential here, the
   * same way a password-reset link works. Single-use, enforced the same
   * atomic way as every other one-time token in this schema: the update's
   * WHERE clause only matches while the hash is still present, so a
   * double-click or a replayed request updates zero rows the second time.
   * Now also the moment a brand-new account gets its first real session —
   * register() no longer issues one, so this is where that finally
   * happens, the same way TotpService.verifyChallenge is where a 2FA
   * login's session finally gets issued.
   */
  async confirmEmailVerification(
    dto: ConfirmEmailDto,
    meta: SessionMeta,
  ): Promise<IssuedSession> {
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

    return this.sessions.issueSession(user.id, user.ndyId, meta);
  }

  private async issueAndSendVerificationEmail(
    userId: string,
    email: string,
    fullName: string | null,
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
    this.sendVerificationEmail(email, fullName, token);
  }

  private sendVerificationEmail(
    email: string,
    fullName: string | null,
    token: string,
  ): void {
    const webAppUrl = this.config.getOrThrow<string>('WEB_APP_URL');
    const link = `${webAppUrl}/verify-email?token=${token}`;
    const { subject, html } = verificationEmail({
      fullName,
      verifyUrl: link,
      logoUrl: `${webAppUrl}/logo-mark.png`,
    });
    // Fire-and-forget — see sendPasswordResetEmail's comment for why.
    void this.mail.send({ to: email, subject, html });
  }

  /**
   * Step 1 of the QR / deep-link flow: a browser or mobile page asks for a
   * fresh, single-use login request. The token goes into the QR code (desktop)
   * or the universal-link URL (mobile) — NDYAPPS calls back with it once the
   * person approves or denies inside the app.
   */
  async createLoginRequest(dto: CreateLoginRequestDto, meta: { ip?: string }) {
    const token = generateToken();
    const location = await this.geoIp.lookupLocation(meta.ip);
    return this.prisma.loginRequest.create({
      data: {
        token,
        method: dto.method,
        requestingIp: meta.ip,
        requestingDevice: dto.device,
        requestingBrowser: dto.browser,
        requestingLocation: location,
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

/**
 * Full name, country, and a profile photo are the required Passport
 * fields — DashboardGate routes anyone missing one of these to
 * /passport/complete. Bio, website, socials, and business info stay
 * optional/skippable. A single source of truth so getMe/updateProfile
 * can't drift on what "complete" means.
 */
function isPassportComplete(user: {
  fullName: string | null;
  country: string | null;
  profilePhotoUrl: string | null;
}): boolean {
  return Boolean(user.fullName && user.country && user.profilePhotoUrl);
}

export { LoginRequestMethod };
