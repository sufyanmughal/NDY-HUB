import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  type KeyObject,
} from 'crypto';

/**
 * The RSA keypair id_tokens are signed with. Holding this here — rather
 * than inline in OAuthTokenService — is what lets DiscoveryController
 * publish the public half via JWKS without also depending on the token
 * service itself.
 *
 * If OIDC_RSA_PRIVATE_KEY isn't configured, this generates an ephemeral
 * in-memory keypair instead of refusing to boot — same dev-mode-fallback
 * pattern as the Stripe/S3/email-provider gaps elsewhere in this codebase.
 * The real cost of the fallback: every restart invalidates every
 * previously-issued id_token and rotates what JWKS publishes, which is
 * fine for local dev and not okay anywhere a relying party keeps its own
 * cache of this server's public key across restarts.
 */
@Injectable()
export class OidcKeysService {
  private readonly logger = new Logger(OidcKeysService.name);

  readonly privateKey: KeyObject;
  readonly keyId: string;
  readonly publicJwk: Record<string, unknown>;

  constructor(config: ConfigService) {
    const pem = config.get<string>('OIDC_RSA_PRIVATE_KEY');

    if (pem) {
      this.keyId = config.getOrThrow<string>('OIDC_RSA_KEY_ID');
      // .env stores real newlines as the literal two characters `\n` —
      // the standard, portable way to fit a multi-line PEM into one
      // env var line — so they need converting back before parsing.
      this.privateKey = createPrivateKey(pem.replace(/\\n/g, '\n'));
    } else {
      this.logger.warn(
        'OIDC_RSA_PRIVATE_KEY not set — generating an ephemeral RSA keypair ' +
          'for id_token signing. Fine for local dev; every restart invalidates ' +
          'previously-issued id_tokens and whatever a relying party cached from ' +
          'JWKS. Set OIDC_RSA_PRIVATE_KEY + OIDC_RSA_KEY_ID before this goes ' +
          'anywhere near production.',
      );
      const { privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
      });
      this.privateKey = privateKey;
      this.keyId = 'dev-ephemeral';
    }

    const publicKey = createPublicKey(this.privateKey);
    this.publicJwk = {
      ...(publicKey.export({ format: 'jwk' }) as Record<string, unknown>),
      kid: this.keyId,
      use: 'sig',
      alg: 'RS256',
    };
  }
}
