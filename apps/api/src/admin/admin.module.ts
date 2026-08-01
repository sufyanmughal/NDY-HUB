import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { RoleChangeRequestService } from './role-change-request.service';
import { RoleChangeRequestController } from './role-change-request.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule], // for JwtAuthGuard on both controllers — PermissionGuard resolves via the global PrismaModule (+ Nest's own global Reflector), same as OAuthClientAdminController
  controllers: [AdminController, RoleChangeRequestController],
  providers: [AdminService, RoleChangeRequestService],
})
export class AdminModule {}
