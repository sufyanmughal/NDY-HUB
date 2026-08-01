import { Module } from '@nestjs/common';
import { OAuthClientService } from './oauth-client.service';
import { OAuthClientAdminController } from './oauth-client-admin.controller';
import { AuthorizationCodeService } from './authorization-code.service';
import { GrantService } from './grant.service';
import { OAuthTokenService } from './oauth-token.service';
import { OidcKeysService } from './oidc-keys.service';
import { OAuthAccessTokenGuard } from './guards/oauth-access-token.guard';
import { AuthorizeController } from './authorize.controller';
import { TokenController } from './token.controller';
import { UserInfoController } from './userinfo.controller';
import { DiscoveryController } from './discovery.controller';
import { GrantsController } from './grants.controller';
import { AuthModule } from '../auth/auth.module';
import { IdentityModule } from '../identity/identity.module';

@Module({
  // AuthModule: JwtAuthGuard (consent/status/grants endpoints), and the
  // shared JwtModule (OAuthTokenService signs with the same JwtService).
  // PermissionGuard resolves via the global PrismaModule. IdentityModule:
  // user lookups the token/userinfo endpoints both need.
  imports: [AuthModule, IdentityModule],
  controllers: [
    OAuthClientAdminController,
    AuthorizeController,
    TokenController,
    UserInfoController,
    DiscoveryController,
    GrantsController,
  ],
  providers: [
    OAuthClientService,
    AuthorizationCodeService,
    GrantService,
    OidcKeysService,
    OAuthTokenService,
    OAuthAccessTokenGuard,
  ],
  exports: [GrantService],
})
export class OAuthModule {}
