import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationCategory,
  NotificationChannel,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';

/**
 * Fans a backup-failure report out to every FOUNDER/SUPER_ADMIN via the
 * existing cross-cutting NotificationService (Phase 2) — reused rather
 * than a bespoke alert path, since "a SECURITY-category event every admin
 * should see" is exactly what that backbone exists for. EMAIL, not
 * IN_APP: a backup failure needs to reach someone even if nobody happens
 * to be looking at the dashboard, same reasoning as SECURITY category
 * defaulting to email in NotificationService's own channel-mapping notes.
 */
@Injectable()
export class BackupAlertService {
  private readonly logger = new Logger(BackupAlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  async notifyAdmins(reason: string, stamp: string) {
    const admins = await this.prisma.user.findMany({
      where: {
        role: { in: [Role.FOUNDER, Role.SUPER_ADMIN] },
        deletedAt: null,
      },
      select: { id: true },
    });

    if (admins.length === 0) {
      this.logger.error(
        `Backup failure reported (${stamp}) but no FOUNDER/SUPER_ADMIN exists to notify: ${reason}`,
      );
      return;
    }

    await Promise.all(
      admins.map((admin) =>
        this.notifications.notify({
          userId: admin.id,
          category: NotificationCategory.SECURITY,
          channel: NotificationChannel.EMAIL,
          title: 'NDY HUB backup failure',
          body: `The nightly database backup for ${stamp} failed: ${reason}`,
          // Idempotent per stamp+admin — a retried/duplicated cron
          // invocation can't double-alert the same admin for the same
          // failed backup.
          sourceEventId: `backup-alert:${stamp}:${admin.id}`,
        }),
      ),
    );
  }
}
