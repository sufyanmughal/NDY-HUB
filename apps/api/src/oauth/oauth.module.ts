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
import { NotificationModule } from '../notifications/notification.module';

@Module({
  // AuthModule: JwtAuthGuard (consent/status/grants endpoints), the
  // shared JwtModule (OAuthTokenService signs with the same JwtService),
  // and SecurityEventService (refresh-token reuse detection, Phase A of
  // identity-architecture-hardening-plan.md). PermissionGuard resolves via
  // the global PrismaModule. IdentityModule: user lookups the
  // token/userinfo endpoints both need. NotificationModule: alerting the
  // user by email when reuse is detected — no cycle risk, NotificationModule
  // only imports AuthModule itself (see workspace.module.ts's doc comment
  // for the cycle this project has hit twice before; checked here first).
  imports: [AuthModule, IdentityModule, NotificationModule],
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
  // OAuthClientService exported so NdyEconomyModule's client-credentials
  // guard (event-intake endpoint) can reuse the same registered-client
  // verification NDY HUB already trusts, rather than a second client
  // registry — an ecosystem app reporting a verified economy event
  // authenticates the same way it would for any other server-to-server
  // NDY HUB call.
  exports: [GrantService, OAuthClientService],
})
export class OAuthModule {}
