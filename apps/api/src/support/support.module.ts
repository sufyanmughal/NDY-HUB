import { Module } from '@nestjs/common';
import { SupportService } from './support.service';
import { SupportController } from './support.controller';
import { SupportAdminController } from './support-admin.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule], // for JwtAuthGuard — PermissionGuard resolves via the global PrismaModule, same as OAuthClientAdminController
  controllers: [SupportController, SupportAdminController],
  providers: [SupportService],
})
export class SupportModule {}
