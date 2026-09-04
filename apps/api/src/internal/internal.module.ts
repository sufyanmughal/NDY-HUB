import { Module } from '@nestjs/common';
import { BackupAlertController } from './backup-alert.controller';
import { BackupAlertService } from './backup-alert.service';
import { NotifyController } from './notify.controller';
import { InternalSecretGuard } from './guards/internal-secret.guard';
import { NotificationModule } from '../notifications/notification.module';

/**
 * Server-to-server internal endpoints — the backup-failure alert
 * deploy/backup.sh calls, and (since the NDYMAIL split) POST
 * /internal/notify for external products to push into a user's real
 * Notification Center. Imports NotificationModule for NotificationService
 * (Phase 2). No AuthModule import: InternalSecretGuard only needs
 * ConfigService (global ConfigModule), not JwtService, so this module
 * doesn't touch the AuthModule/IdentityModule/WorkspaceModule cycle
 * documented on WorkspaceModule — deliberately checked before wiring this
 * in, per that incident's lesson. PrismaService (NotifyController's
 * ndyId -> User.id lookup) comes from the @Global() PrismaModule, no
 * explicit import needed.
 */
@Module({
  imports: [NotificationModule],
  controllers: [BackupAlertController, NotifyController],
  providers: [BackupAlertService, InternalSecretGuard],
})
export class InternalModule {}
