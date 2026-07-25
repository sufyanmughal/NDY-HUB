import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ALL_SCOPES } from './scopes';
import { OidcKeysService } from './oidc-keys.service';

// Standard OIDC discovery document — a real OIDC client library (including
// most WordPress OIDC plugins) can be pointed at just this URL and infer
// every other endpoint from it, instead of needing each one hardcoded.
@Controller('.well-known')
export class DiscoveryController {
  constructor(
    private readonly config: ConfigService,
    private readonly keys: OidcKeysService,
  ) {}

  @Get('openid-configuration')
  discover() {
    const apiUrl =
      this.config.get<string>('API_URL') ??
      `http://localhost:${this.config.get('PORT') ?? 3000}`;

    return {
      issuer: this.config.getOrThrow<string>('WEB_APP_URL'),
      authorization_endpoint: `${apiUrl}/oauth/authorize`,
      token_endpoint: `${apiUrl}/oauth/token`,
      userinfo_endpoint: `${apiUrl}/oauth/userinfo`,
      jwks_uri: `${apiUrl}/.well-known/jwks.json`,
      scopes_supported: ALL_SCOPES,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      subject_types_supported: ['public'],
      // RS256, verifiable by any relying party via jwks_uri above — see
      // OAuthTokenService.issueTokenSet and OidcKeysService for the key
      // management this replaced the old HS256-shared-secret approach with.
      id_token_signing_alg_values_supported: ['RS256'],
      token_endpoint_auth_methods_supported: ['client_secret_post'],
      code_challenge_methods_supported: ['S256'],
    };
  }

  // Publishes only the public half of OidcKeysService's keypair — the
  // standard JWKS shape any OIDC client library already knows how to fetch
  // and cache, keyed by `kid` so key rotation (publish the new key here,
  // keep signing with the old one briefly, then retire it) doesn't break
  // in-flight verification the way swapping a single shared secret would.
  @Get('jwks.json')
  jwks() {
    return { keys: [this.keys.publicJwk] };
  }
}
