import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ALL_SCOPES } from './scopes';

// Standard OIDC discovery document — a real OIDC client library (including
// most WordPress OIDC plugins) can be pointed at just this URL and infer
// every other endpoint from it, instead of needing each one hardcoded.
@Controller('.well-known')
export class DiscoveryController {
  constructor(private readonly config: ConfigService) {}

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
      scopes_supported: ALL_SCOPES,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      subject_types_supported: ['public'],
      // HS256 signed with NDY HUB's own app-wide secret, not per-client —
      // see the comment on OAuthTokenService.issueTokenSet. No jwks_uri
      // yet because there's no RSA keypair to publish; that's the real fix.
      id_token_signing_alg_values_supported: ['HS256'],
      token_endpoint_auth_methods_supported: ['client_secret_post'],
    };
  }
}
