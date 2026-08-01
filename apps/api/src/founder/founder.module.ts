import { Module } from '@nestjs/common';
import { FounderController } from './founder.controller';
import { FounderService } from './founder.service';
import { FounderGuard } from './guards/founder.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule], // for JwtAuthGuard on FounderController
  controllers: [FounderController],
  providers: [FounderService, FounderGuard],
})
export class FounderModule {}
