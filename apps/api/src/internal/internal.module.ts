import { Module } from '@nestjs/common';
import { BackupAlertController } from './backup-alert.controller';
import { BackupAlertService } from './backup-alert.service';
import { InternalSecretGuard } from './guards/internal-secret.guard';
import { NotificationModule } from '../notifications/notification.module';

/**
 * Server-to-server internal endpoints — currently just the backup-failure
 * alert deploy/backup.sh calls. Imports NotificationModule for
 * NotificationService (Phase 2). No AuthModule import: InternalSecretGuard
 * only needs ConfigService (global ConfigModule), not JwtService, so this
 * module doesn't touch the AuthModule/IdentityModule/WorkspaceModule cycle
 * documented on WorkspaceModule — deliberately checked before wiring this
 * in, per that incident's lesson.
 */
@Module({
  imports: [NotificationModule],
  controllers: [BackupAlertController],
  providers: [BackupAlertService, InternalSecretGuard],
})
export class InternalModule {}
