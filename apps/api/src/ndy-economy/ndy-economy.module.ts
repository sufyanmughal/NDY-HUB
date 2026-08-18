import { Module } from '@nestjs/common';
import { NdyEconomyController } from './ndy-economy.controller';
import { NdyEconomyEventsController } from './ndy-economy-events.controller';
import { BridgeEligibilityService } from './bridge-eligibility.service';
import { BridgeRequestService } from './bridge-request.service';
import { EconomyClientGuard } from './guards/economy-client.guard';
import { AuthModule } from '../auth/auth.module';
import { OAuthModule } from '../oauth/oauth.module';
import { NdybitsModule } from '../ndybits/ndybits.module';

/**
 * Imports AuthModule for JwtAuthGuard (user-facing bridge endpoints) and
 * OAuthModule for OAuthClientService (EconomyClientGuard's server-to-
 * server auth). Imports NdybitsModule for RewardEngineService, which
 * lives there (extends the existing ndybits domain) rather than here.
 */
@Module({
  imports: [AuthModule, OAuthModule, NdybitsModule],
  controllers: [NdyEconomyController, NdyEconomyEventsController],
  providers: [
    BridgeEligibilityService,
    BridgeRequestService,
    EconomyClientGuard,
  ],
  exports: [BridgeEligibilityService, BridgeRequestService],
})
export class NdyEconomyModule {}
