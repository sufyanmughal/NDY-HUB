import { Module } from '@nestjs/common';
import { EcosystemEventService } from './ecosystem-event.service';
import {
  EcosystemEventsController,
  EcosystemEventsMeController,
} from './ecosystem-event.controller';
import { EcosystemEventClientGuard } from './guards/ecosystem-event-client.guard';
import { AuthModule } from '../auth/auth.module';
import { OAuthModule } from '../oauth/oauth.module';
import { NdybitsModule } from '../ndybits/ndybits.module';

/**
 * Phase B of identity-architecture-hardening-plan.md — the general
 * Ecosystem Event Contract. Imports AuthModule (JwtAuthGuard for the
 * user-facing "mine" endpoint), OAuthModule (OAuthClientService, same
 * reuse pattern NdyEconomyModule already established for the
 * registered-client check), and NdybitsModule (RewardEngineService, the
 * "shared front door" forward described in ecosystem-event.service.ts).
 * No cycle risk: none of these three import anything that imports this
 * module — checked before wiring in, per the lesson from the
 * AuthModule/IdentityModule/WorkspaceModule cycle this project hit twice.
 */
@Module({
  imports: [AuthModule, OAuthModule, NdybitsModule],
  controllers: [EcosystemEventsController, EcosystemEventsMeController],
  providers: [EcosystemEventService, EcosystemEventClientGuard],
})
export class EcosystemEventModule {}
