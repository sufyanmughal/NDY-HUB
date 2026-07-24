import { Module } from '@nestjs/common';
import { NdybitsService } from './ndybits.service';
import { NdybitsController } from './ndybits.controller';

@Module({
  controllers: [NdybitsController],
  providers: [NdybitsService],
  exports: [NdybitsService],
})
export class NdybitsModule {}
