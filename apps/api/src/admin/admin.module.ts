import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule], // for JwtAuthGuard on AdminController — PermissionGuard resolves via the global PrismaModule (+ Nest's own global Reflector), same as OAuthClientAdminController
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
