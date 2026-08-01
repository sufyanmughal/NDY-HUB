import { Module } from '@nestjs/common';
import { FounderController } from './founder.controller';
import { FounderService } from './founder.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule], // for JwtAuthGuard on FounderController — PermissionGuard resolves via the global PrismaModule
  controllers: [FounderController],
  providers: [FounderService],
})
export class FounderModule {}
