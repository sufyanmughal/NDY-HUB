import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Redirect,
  Req,
  UnsupportedMediaTypeException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { TotpService } from './totp.service';
import { PasskeyService } from './passkey.service';
import { SocialAuthService, type SocialProvider } from './social-auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { CreateLoginRequestDto } from './dto/create-login-request.dto';
import { RefreshDto } from './dto/refresh.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ConfirmEmailDto } from './dto/confirm-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ConfirmTotpDto } from './dto/confirm-totp.dto';
import { DisableTotpDto } from './dto/disable-totp.dto';
import { Verify2faDto } from './dto/verify-2fa.dto';
import { PasskeyRegisterVerifyDto } from './dto/passkey-register-verify.dto';
import { PasskeyLoginVerifyDto } from './dto/passkey-login-verify.dto';
import { AppleCallbackDto } from './dto/apple-callback.dto';
import { OAuthExchangeDto } from './dto/oauth-exchange.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from './guards/jwt-auth.guard';
import type { SessionMeta } from './session.service';
import { PROFILE_PHOTOS_DIR } from '../common/upload-dir.util';

// 5 attempts/minute/IP — the actual credential-guessing targets. Tighter
// than the app-wide default (100/min, set in AppModule) on purpose: these
// three are exactly what §21 of the brief meant by "protection against
// brute-force attacks," and until now nothing enforced it at all.
const BRUTE_FORCE_GUARD = { default: { limit: 5, ttl: 60_000 } };

const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
// SVG deliberately excluded — an uploaded SVG can carry inline <script>,
// making "profile photo" an XSS vector if it's ever served or embedded
// without sanitization. JPEG/PNG/WebP can't do that.
const ALLOWED_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly totp: TotpService,
    private readonly passkeys: PasskeyService,
    private readonly social: SocialAuthService,
  ) {}

  @Throttle(BRUTE_FORCE_GUARD)
  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto, sessionMeta(req));
  }

  @Throttle(BRUTE_FORCE_GUARD)
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, sessionMeta(req));
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, sessionMeta(req));
  }

  @Post('logout')
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @Post('login-request')
  createLoginRequest(@Body() dto: CreateLoginRequestDto, @Req() req: Request) {
    // TODO: resolve requestingLocation from IP via a geo-IP lookup once one is wired in.
    return this.auth.createLoginRequest(dto, { ip: req.ip });
  }

  @Get('login-request/:token')
  getLoginRequestStatus(@Param('token') token: string) {
    // Desktop can poll this as a fallback, but should prefer subscribing to
    // the "login-request:status" WebSocket event for the same token.
    return this.auth.getLoginRequestStatus(token);
  }

  @UseGuards(JwtAuthGuard)
  @Post('login-request/:token/approve')
  approveLoginRequest(
    @Param('token') token: string,
    @CurrentUser() user: { sub: string },
  ) {
    // Requires a valid NDYAPPS access token — this is the piece the
    // NDYAPPS developer's build authenticates against before calling here.
    return this.auth.approveLoginRequest(token, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('login-request/:token/deny')
  denyLoginRequest(@Param('token') token: string) {
    return this.auth.denyLoginRequest(token);
  }

  @Post('login-request/:token/exchange')
  exchangeLoginRequest(@Param('token') token: string, @Req() req: Request) {
    // Called by the desktop browser once it sees the request go APPROVED —
    // trades the one-time approval for a real access/refresh session pair.
    return this.auth.exchangeLoginRequest(token, sessionMeta(req));
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.auth.getMe(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMe(
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.auth.updateProfile(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/photo')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: diskStorage({
        destination: PROFILE_PHOTOS_DIR,
        // A random filename, not the original — the original is
        // attacker-controlled input and never trusted for a path, and a
        // random name also means re-uploading always produces a fresh URL
        // (no browser/CDN cache serving a stale image back).
        filename: (_req, file, cb) => {
          cb(
            null,
            `${randomUUID()}${extname(file.originalname).toLowerCase()}`,
          );
        },
      }),
      limits: { fileSize: MAX_PHOTO_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_PHOTO_MIME_TYPES.includes(file.mimetype)) {
          cb(
            new UnsupportedMediaTypeException(
              'Only JPEG, PNG, and WebP images are allowed.',
            ),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  uploadPhoto(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    if (!file) {
      throw new BadRequestException('No photo file was uploaded.');
    }
    return this.auth.updateProfilePhoto(user.sub, file.filename);
  }

  @Throttle(BRUTE_FORCE_GUARD)
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.auth.changePassword(user.sub, dto);
  }

  // Public: the token itself is the credential, same as a password-reset
  // link — there's no session to require yet if this is opened in a fresh
  // browser tab from the verification email.
  @Post('verify-email/confirm')
  confirmEmailVerification(@Body() dto: ConfirmEmailDto) {
    return this.auth.confirmEmailVerification(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify-email/resend')
  resendEmailVerification(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.auth.requestEmailVerification(user.sub);
  }

  // Same brute-force tier as login/register — this is public and takes an
  // arbitrary email, exactly the kind of endpoint that gets hammered for
  // account enumeration or spam if left unthrottled.
  @Throttle(BRUTE_FORCE_GUARD)
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  // Public: the token itself is the credential, same as email verification.
  @Throttle(BRUTE_FORCE_GUARD)
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/setup')
  begin2faSetup(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.totp.beginSetup(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/enable')
  confirm2faSetup(
    @Body() dto: ConfirmTotpDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.totp.confirmSetup(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/disable')
  disable2fa(
    @Body() dto: DisableTotpDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.totp.disable(user.sub, dto);
  }

  // Public: step 2 of a 2FA login. The challenge token (issued by
  // AuthService.login once the password already checked out) is the
  // proof of factor 1 — there's no session yet for a guard to check.
  @Throttle(BRUTE_FORCE_GUARD)
  @Post('2fa/verify')
  verify2fa(@Body() dto: Verify2faDto, @Req() req: Request) {
    return this.totp.verifyChallenge(dto, sessionMeta(req));
  }

  @UseGuards(JwtAuthGuard)
  @Get('passkeys')
  listPasskeys(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.passkeys.listPasskeys(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('passkeys/:id')
  removePasskey(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.passkeys.removePasskey(user.sub, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('passkeys/register/options')
  beginPasskeyRegistration(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.passkeys.beginRegistration(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('passkeys/register/verify')
  verifyPasskeyRegistration(
    @Body() dto: PasskeyRegisterVerifyDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.passkeys.verifyRegistration(user.sub, dto);
  }

  // Public: usernameless sign-in — there's no account context yet until
  // the credential response itself resolves one, same reasoning as every
  // other pre-session endpoint in this controller.
  @Post('passkeys/login/options')
  beginPasskeyLogin() {
    return this.passkeys.beginAuthentication();
  }

  @Throttle(BRUTE_FORCE_GUARD)
  @Post('passkeys/login/verify')
  verifyPasskeyLogin(@Body() dto: PasskeyLoginVerifyDto, @Req() req: Request) {
    return this.passkeys.verifyAuthentication(dto, sessionMeta(req));
  }

  // Public: lets the frontend decide whether to render the Google/Apple
  // buttons at all, rather than showing one that 400s the moment it's
  // clicked because no credentials are configured on this server.
  @Get('oauth/providers')
  getOAuthProviders() {
    return this.social.getProviderStatus();
  }

  // A real browser navigation (an <a href>, not a fetch call), so this
  // redirects rather than returning JSON — same reasoning applies to every
  // handler below through the callbacks.
  @Get('oauth/:provider/start')
  @Redirect('', 302)
  async beginOAuth(
    @Param('provider') provider: string,
    @Query('next') next?: string,
  ) {
    const url = await this.social.beginAuth(normalizeProvider(provider), next);
    return { url };
  }

  @Get('oauth/google/callback')
  @Redirect('', 302)
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
  ) {
    const { redirectUrl } = await this.social.handleGoogleCallback(
      code,
      state,
      error,
    );
    return { url: redirectUrl };
  }

  // Apple posts here (response_mode=form_post), not GET — required
  // whenever the authorize request asks for name/email scopes.
  @Post('oauth/apple/callback')
  @Redirect('', 302)
  async appleCallback(@Body() dto: AppleCallbackDto) {
    const { redirectUrl } = await this.social.handleAppleCallback(dto);
    return { url: redirectUrl };
  }

  // Public: trades the one-time code from the callback redirect for a real
  // session — the actual bearer tokens never appear in a URL this way.
  @Throttle(BRUTE_FORCE_GUARD)
  @Post('oauth/exchange')
  exchangeOAuthLogin(@Body() dto: OAuthExchangeDto, @Req() req: Request) {
    return this.social.exchangeLoginCode(dto.code, sessionMeta(req));
  }

  // Settings' "Connect Google/Apple" — unlike beginOAuth above, this needs
  // the bearer token to know which account to link to, so it can't be a
  // plain <a href>. Returns the authorize URL as JSON; the frontend
  // navigates the browser there itself.
  @UseGuards(JwtAuthGuard)
  @Post('oauth/:provider/connect')
  async connectOAuthProvider(
    @Param('provider') provider: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Query('next') next?: string,
  ) {
    const url = await this.social.beginLink(
      user.sub,
      normalizeProvider(provider),
      next,
    );
    return { url };
  }

  @UseGuards(JwtAuthGuard)
  @Get('connected-accounts')
  listConnectedAccounts(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.social.listConnectedAccounts(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('connected-accounts/:id')
  unlinkConnectedAccount(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.social.unlinkAccount(user.sub, id);
  }
}

function normalizeProvider(raw: string): SocialProvider {
  const upper = raw.toUpperCase();
  if (upper !== 'GOOGLE' && upper !== 'APPLE') {
    throw new BadRequestException('Unknown sign-in provider.');
  }
  return upper;
}

function sessionMeta(req: Request): SessionMeta {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}
