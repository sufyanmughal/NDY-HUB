import { Module } from '@nestjs/common';
import { EcosystemController } from './ecosystem.controller';
import { EcosystemService } from './ecosystem.service';
import { BitcoinPriceService } from './bitcoin-price.service';

@Module({
  controllers: [EcosystemController],
  providers: [EcosystemService, BitcoinPriceService],
})
export class EcosystemModule {}
