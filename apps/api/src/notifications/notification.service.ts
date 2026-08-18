import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  Notification,
  NotificationCategory,
  NotificationChannel,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../common/mail.service';

const RECENT_LIMIT = 50;

export interface NotifyParams {
  userId: string;
  workspaceId?: string;
  category: NotificationCategory;
  channel: NotificationChannel;
  title: string;
  body: string;
  linkUrl?: string;
  /** Same idempotency contract as NdybitsLedgerEntry.creditNdybits'
   * sourceEventId — set this whenever the caller is reacting to a real
   * event (a reward credit, an approval request) so a retry can never
   * post the same notification twice. */
  sourceEventId?: string;
}

/**
 * The central notification backbone — Phase 2 of the post-vision-
 * documents architecture plan. Replaces "NDYSPACE-only notifications by
 * explicit design" (see NdyspaceNotification's own schema comment) with a
 * real cross-cutting mechanism, so Phase 3's Action Engine (approval
 * alerts) and later Phase 5's Reward Engine (credit notifications) share
 * one write path instead of each inventing an ad hoc one.
 *
 * Deliberately does not touch NdyspaceNotification — that model stays
 * exactly as it is, actively used by NdyspaceMailService and friends.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /**
   * Writes the notification row (idempotent via sourceEventId, same
   * P2002-catch-and-return pattern as NdybitsService.creditNdybits), then
   * fans out to the requested delivery channel. EMAIL uses the real,
   * already-built MailService. SMS is accepted and recorded but not
   * actually dispatched yet — SmsService today only exposes Sinch's
   * verification-code flows (startVerification/checkVerification), not a
   * generic "send this arbitrary message" API, so there's no real SMS
   * transport to fan out to without adding one. Logged clearly rather
   * than silently pretending to send.
   */
  async notify(params: NotifyParams) {
    let notification: Notification;
    try {
      notification = await this.prisma.notification.create({
        data: {
          userId: params.userId,
          workspaceId: params.workspaceId,
          category: params.category,
          channel: params.channel,
          title: params.title,
          body: params.body,
          linkUrl: params.linkUrl,
          sourceEventId: params.sourceEventId,
        },
      });
    } catch (err) {
      if (
        params.sourceEventId &&
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return this.prisma.notification.findUniqueOrThrow({
          where: { sourceEventId: params.sourceEventId },
        });
      }
      throw err;
    }

    await this.deliver(notification, params);
    return notification;
  }

  private async deliver(
    notification: { id: string; userId: string },
    params: NotifyParams,
  ) {
    if (params.channel === NotificationChannel.IN_APP) {
      // The row itself is the delivery — nothing further to do.
      return;
    }

    if (params.channel === NotificationChannel.EMAIL) {
      const user = await this.prisma.user.findUnique({
        where: { id: params.userId },
        select: { email: true },
      });
      if (!user) return;
      await this.mail.send({
        to: user.email,
        subject: params.title,
        html: `<p>${escapeHtml(params.body)}</p>${
          params.linkUrl
            ? `<p><a href="${escapeHtml(params.linkUrl)}">View</a></p>`
            : ''
        }`,
      });
      return;
    }

    if (params.channel === NotificationChannel.SMS) {
      // See the notify() doc comment — no generic SMS-send transport
      // exists yet. Recorded here so this gap is visible in logs/metrics
      // rather than silently dropped.
      this.logger.warn(
        `SMS channel requested for notification ${notification.id} but no generic SMS transport exists yet — not sent.`,
      );
      return;
    }
  }

  async list(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: RECENT_LIMIT,
    });
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  async markRead(userId: string, id: string) {
    const existing = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('No notification with that id.');
    }
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { updatedCount: result.count };
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
