import { Module } from '@nestjs/common';
import { NdybitsService } from './ndybits.service';
import { NdybitsController } from './ndybits.controller';
import { RewardEngineService } from './reward-engine.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule], // for JwtAuthGuard on NdybitsController
  controllers: [NdybitsController],
  providers: [NdybitsService, RewardEngineService],
  // RewardEngineService exported so NdyEconomyModule's server-to-server
  // event-intake controller can call it — the Reward Engine extends this
  // module (it's the only thing that decides *when and how much* to call
  // NdybitsService.creditNdybits), so it belongs here, not duplicated
  // into ndy-economy.
  exports: [NdybitsService, RewardEngineService],
})
export class NdybitsModule {}
