import { Module } from '@nestjs/common';
import { EcosystemController } from './ecosystem.controller';
import { EcosystemService } from './ecosystem.service';
import { BitcoinPriceService } from './bitcoin-price.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule], // for JwtAuthGuard on EcosystemController
  controllers: [EcosystemController],
  providers: [EcosystemService, BitcoinPriceService],
})
export class EcosystemModule {}
