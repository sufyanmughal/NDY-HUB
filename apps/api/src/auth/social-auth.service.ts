import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from 'jose';
import { PrismaService } from '../prisma/prisma.service';
import { IdentityService } from '../identity/identity.service';
import { SessionService, SessionMeta, IssuedSession } from './session.service';
import { TotpService } from './totp.service';
import type { AppleCallbackDto } from './dto/apple-callback.dto';

export type SocialProvider = 'GOOGLE' | 'APPLE';

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes — long enough for a slow consent screen
const EXCHANGE_TTL_MS = 60 * 1000; // 60 seconds — redeemed by the very next request the frontend makes

// Created once at module load, not per-request — createRemoteJWKSet caches
// the fetched key set internally and re-fetches only on a kid it doesn't
// recognize, so this is meant to be long-lived.
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs'),
);
const APPLE_JWKS = createRemoteJWKSet(
  new URL('https://appleid.apple.com/auth/keys'),
);

interface VerifiedIdentity {
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  fullName?: string;
}

/**
 * "Sign in with Google/Apple" — this app acting as an OAuth *client*
 * against those providers. Distinct from apps/api/src/oauth, which is the
 * opposite direction (NDY HUB acting as an OIDC *provider* for third-party
 * NDJOYIT sites); nothing in here talks to that module.
 *
 * Both providers require real developer credentials (a Google Cloud OAuth
 * client, a paid Apple Developer account) to actually redirect anywhere —
 * isConfigured()/getProviderStatus() let the rest of the app behave
 * sensibly without them: the frontend hides the buttons, and hitting the
 * endpoints directly gets a clear 400 instead of a crash deep in a fetch
 * to a provider with no client_id.
 */
@Injectable()
export class SocialAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: IdentityService,
    private readonly sessions: SessionService,
    private readonly totp: TotpService,
    private readonly config: ConfigService,
  ) {}

  getProviderStatus(): { google: boolean; apple: boolean } {
    return {
      google: this.isConfigured('GOOGLE'),
      apple: this.isConfigured('APPLE'),
    };
  }

  private isConfigured(provider: SocialProvider): boolean {
    if (provider === 'GOOGLE') {
      return Boolean(
        this.config.get<string>('GOOGLE_CLIENT_ID') &&
        this.config.get<string>('GOOGLE_CLIENT_SECRET'),
      );
    }
    return Boolean(
      this.config.get<string>('APPLE_CLIENT_ID') &&
      this.config.get<string>('APPLE_TEAM_ID') &&
      this.config.get<string>('APPLE_KEY_ID') &&
      this.config.get<string>('APPLE_PRIVATE_KEY'),
    );
  }

  private redirectUriFor(provider: SocialProvider): string {
    const apiUrl = this.config.getOrThrow<string>('API_URL');
    return `${apiUrl}/auth/oauth/${provider.toLowerCase()}/callback`;
  }

  async beginAuth(
    provider: SocialProvider,
    next: string | undefined,
  ): Promise<string> {
    if (!this.isConfigured(provider)) {
      throw new BadRequestException(
        `${provider === 'GOOGLE' ? 'Google' : 'Apple'} sign-in isn't configured on this server yet.`,
      );
    }

    const redirectPath = sanitizeRedirectPath(next);
    const nonce = randomBytes(24).toString('base64url');
    const { id: state } = await this.prisma.externalAuthState.create({
      data: {
        provider,
        nonce,
        redirectPath,
        expiresAt: new Date(Date.now() + STATE_TTL_MS),
      },
    });

    const redirectUri = this.redirectUriFor(provider);

    if (provider === 'GOOGLE') {
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.searchParams.set(
        'client_id',
        this.config.getOrThrow('GOOGLE_CLIENT_ID'),
      );
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', 'openid email profile');
      url.searchParams.set('state', state);
      url.searchParams.set('nonce', nonce);
      return url.toString();
    }

    const url = new URL('https://appleid.apple.com/auth/authorize');
    url.searchParams.set(
      'client_id',
      this.config.getOrThrow('APPLE_CLIENT_ID'),
    );
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    // Apple only ever hands over name/email on the *first* authorization —
    // form_post is mandatory whenever these scopes are requested, since
    // Apple sends that first-time data as an extra form field alongside
    // the code rather than folding it into the id_token.
    url.searchParams.set('scope', 'name email');
    url.searchParams.set('response_mode', 'form_post');
    url.searchParams.set('state', state);
    url.searchParams.set('nonce', nonce);
    return url.toString();
  }

  async handleGoogleCallback(
    code: string | undefined,
    state: string | undefined,
    error: string | undefined,
  ): Promise<{ redirectUrl: string }> {
    const authState = await this.consumeState(state, 'GOOGLE');
    if (!authState) {
      return { redirectUrl: this.errorRedirect('/', 'invalid_request') };
    }
    if (error || !code) {
      return {
        redirectUrl: this.errorRedirect(
          authState.redirectPath,
          error ?? 'access_denied',
        ),
      };
    }

    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.config.getOrThrow('GOOGLE_CLIENT_ID'),
          client_secret: this.config.getOrThrow('GOOGLE_CLIENT_SECRET'),
          code,
          redirect_uri: this.redirectUriFor('GOOGLE'),
          grant_type: 'authorization_code',
        }),
      });
      if (!tokenRes.ok)
        throw new Error(`token exchange failed: ${tokenRes.status}`);
      const tokens = (await tokenRes.json()) as { id_token?: string };
      if (!tokens.id_token) throw new Error('no id_token in token response');

      const { payload } = await jwtVerify(tokens.id_token, GOOGLE_JWKS, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: this.config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      });
      if (payload.nonce !== authState.nonce) throw new Error('nonce mismatch');
      if (!payload.email)
        throw new Error('Google did not return an email address');

      const identity: VerifiedIdentity = {
        providerUserId: payload.sub as string,
        email: payload.email as string,
        emailVerified: payload.email_verified === true,
        fullName: (payload.name as string | undefined) ?? undefined,
      };
      const user = await this.resolveOrCreateUser('GOOGLE', identity);
      return {
        redirectUrl: await this.buildSuccessRedirect(
          user,
          authState.redirectPath,
        ),
      };
    } catch {
      return {
        redirectUrl: this.errorRedirect(
          authState.redirectPath,
          'google_sign_in_failed',
        ),
      };
    }
  }

  async handleAppleCallback(
    dto: AppleCallbackDto,
  ): Promise<{ redirectUrl: string }> {
    const authState = await this.consumeState(dto.state, 'APPLE');
    if (!authState) {
      return { redirectUrl: this.errorRedirect('/', 'invalid_request') };
    }
    if (dto.error || !dto.code) {
      return {
        redirectUrl: this.errorRedirect(
          authState.redirectPath,
          dto.error ?? 'access_denied',
        ),
      };
    }

    try {
      const clientSecret = await this.buildAppleClientSecret();
      const tokenRes = await fetch('https://appleid.apple.com/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.config.getOrThrow('APPLE_CLIENT_ID'),
          client_secret: clientSecret,
          code: dto.code,
          redirect_uri: this.redirectUriFor('APPLE'),
          grant_type: 'authorization_code',
        }),
      });
      if (!tokenRes.ok)
        throw new Error(`token exchange failed: ${tokenRes.status}`);
      const tokens = (await tokenRes.json()) as { id_token?: string };
      if (!tokens.id_token) throw new Error('no id_token in token response');

      const { payload } = await jwtVerify(tokens.id_token, APPLE_JWKS, {
        issuer: 'https://appleid.apple.com',
        audience: this.config.getOrThrow<string>('APPLE_CLIENT_ID'),
      });
      if (payload.nonce !== authState.nonce) throw new Error('nonce mismatch');
      if (!payload.email)
        throw new Error('Apple did not return an email address');

      // Only present on the first authorization — Apple never repeats it,
      // so an app that doesn't capture it here has to fall back to asking
      // the user for their name directly (same as any password signup).
      const firstTimeName = parseAppleUserField(dto.user);

      const identity: VerifiedIdentity = {
        providerUserId: payload.sub as string,
        email: payload.email as string,
        emailVerified:
          payload.email_verified === true || payload.email_verified === 'true',
        fullName: firstTimeName,
      };
      const user = await this.resolveOrCreateUser('APPLE', identity);
      return {
        redirectUrl: await this.buildSuccessRedirect(
          user,
          authState.redirectPath,
        ),
      };
    } catch {
      return {
        redirectUrl: this.errorRedirect(
          authState.redirectPath,
          'apple_sign_in_failed',
        ),
      };
    }
  }

  /**
   * Apple's token endpoint doesn't take a static client secret — it wants
   * a freshly signed ES256 JWT proving control of the private key
   * registered for this Services ID, regenerated per request rather than
   * cached (cheap to build, and avoids reasoning about a cached token's
   * remaining lifetime).
   */
  private async buildAppleClientSecret(): Promise<string> {
    const pem = this.config
      .getOrThrow<string>('APPLE_PRIVATE_KEY')
      .replace(/\\n/g, '\n');
    const key = await importPKCS8(pem, 'ES256');
    return new SignJWT({})
      .setProtectedHeader({
        alg: 'ES256',
        kid: this.config.getOrThrow('APPLE_KEY_ID'),
      })
      .setIssuer(this.config.getOrThrow('APPLE_TEAM_ID'))
      .setIssuedAt()
      .setExpirationTime('5m')
      .setAudience('https://appleid.apple.com')
      .setSubject(this.config.getOrThrow('APPLE_CLIENT_ID'))
      .sign(key);
  }

  /**
   * The identity provider lookup first (stable across an email change on
   * the provider's side), then falls back to matching by email — linking
   * a new provider onto an existing password-based account instead of
   * minting a duplicate one — before finally creating a brand new account.
   * This is the actual duplicate-account prevention the dormant
   * AuthIdentity table used to only imply.
   */
  private async resolveOrCreateUser(
    provider: SocialProvider,
    identity: VerifiedIdentity,
  ) {
    const existingIdentity = await this.prisma.authIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider,
          providerUserId: identity.providerUserId,
        },
      },
    });
    if (existingIdentity) {
      return this.identity.findById(existingIdentity.userId);
    }

    const existingUser = await this.identity.findByEmail(identity.email);
    if (existingUser) {
      await this.prisma.authIdentity.create({
        data: {
          userId: existingUser.id,
          provider,
          providerUserId: identity.providerUserId,
          email: identity.email,
        },
      });
      return existingUser;
    }

    const created = await this.identity.createUser({
      email: identity.email,
      fullName: identity.fullName,
    });
    await this.prisma.authIdentity.create({
      data: {
        userId: created.id,
        provider,
        providerUserId: identity.providerUserId,
        email: identity.email,
      },
    });
    // The provider already verified this address — a brand new account
    // created through it shouldn't also need to click a confirmation
    // email, unlike a fresh password signup.
    if (identity.emailVerified) {
      await this.prisma.user.update({
        where: { id: created.id },
        data: { emailVerifiedAt: new Date() },
      });
    }
    return created;
  }

  /**
   * The callback is a real browser navigation, not a fetch this app's
   * frontend controls — there's nothing to hand a JSON response to. So
   * this resolves to a redirect URL: either straight into the existing
   * 2FA challenge flow (reusing TotpService.issueChallenge exactly as
   * password login does), or a one-time OAuthLoginExchange code the
   * frontend trades for a real session via POST /auth/oauth/exchange —
   * keeping actual bearer tokens out of the URL/browser history/Referer.
   */
  private async buildSuccessRedirect(
    user: {
      id: string;
      ndyId: string;
      totpEnabledAt: Date | null;
      suspended: boolean;
    },
    redirectPath: string,
  ): Promise<string> {
    if (user.suspended) {
      return this.errorRedirect(redirectPath, 'account_suspended');
    }
    if (user.totpEnabledAt) {
      const challengeToken = await this.totp.issueChallenge(user.id);
      return this.callbackUrl(redirectPath, {
        requires2fa: '1',
        challengeToken,
      });
    }
    const { id: code } = await this.prisma.oAuthLoginExchange.create({
      data: {
        userId: user.id,
        expiresAt: new Date(Date.now() + EXCHANGE_TTL_MS),
      },
    });
    return this.callbackUrl(redirectPath, { code });
  }

  async exchangeLoginCode(
    code: string,
    meta: SessionMeta,
  ): Promise<IssuedSession> {
    const expired = new UnauthorizedException(
      'This sign-in attempt has expired — try again.',
    );
    const row = await this.prisma.oAuthLoginExchange.findUnique({
      where: { id: code },
    });
    if (!row || row.expiresAt < new Date()) throw expired;

    const deleted = await this.prisma.oAuthLoginExchange.deleteMany({
      where: { id: code },
    });
    if (deleted.count === 0) throw expired;

    const user = await this.identity.findById(row.userId);
    return this.sessions.issueSession(user.id, user.ndyId, meta);
  }

  private async consumeState(
    state: string | undefined,
    provider: SocialProvider,
  ): Promise<{ nonce: string; redirectPath: string } | null> {
    if (!state) return null;
    const row = await this.prisma.externalAuthState.findUnique({
      where: { id: state },
    });
    if (!row || row.provider !== provider || row.expiresAt < new Date())
      return null;

    const deleted = await this.prisma.externalAuthState.deleteMany({
      where: { id: state },
    });
    if (deleted.count === 0) return null;

    return row;
  }

  private callbackUrl(
    redirectPath: string,
    params: Record<string, string>,
  ): string {
    const webAppUrl = this.config.getOrThrow<string>('WEB_APP_URL');
    const url = new URL(`${webAppUrl}/oauth/callback`);
    url.searchParams.set('next', redirectPath);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  }

  private errorRedirect(redirectPath: string, error: string): string {
    return this.callbackUrl(redirectPath, { error });
  }
}

function sanitizeRedirectPath(raw: string | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

function parseAppleUserField(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as {
      name?: { firstName?: string; lastName?: string };
    };
    const parts = [parsed.name?.firstName, parsed.name?.lastName].filter(
      Boolean,
    );
    return parts.length > 0 ? parts.join(' ') : undefined;
  } catch {
    return undefined;
  }
}
