import { Module } from '@nestjs/common';
import { NdybitsService } from './ndybits.service';
import { NdybitsController } from './ndybits.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule], // for JwtAuthGuard on NdybitsController
  controllers: [NdybitsController],
  providers: [NdybitsService],
  exports: [NdybitsService],
})
export class NdybitsModule {}
