import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NdyspaceNotificationType } from '@prisma/client';

const RECENT_LIMIT = 20;

/**
 * A general per-user notification feed — see the NdyspaceNotification
 * schema comment for why this is deliberately separate from SecurityEvent
 * (that's a fixed security-audit trail with no read state; this is a
 * general, typed, mark-as-read feed). Written to by other NDYSPACE
 * services (e.g. NdyspaceMailService.send) rather than any cross-cutting
 * event bus — there isn't one in this codebase yet.
 */
@Injectable()
export class NdyspaceNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    type: NdyspaceNotificationType,
    message: string,
  ) {
    return this.prisma.ndyspaceNotification.create({
      data: { userId, type, message },
    });
  }

  async list(userId: string) {
    return this.prisma.ndyspaceNotification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: RECENT_LIMIT,
    });
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.ndyspaceNotification.count({
      where: { userId, isRead: false },
    });
  }

  async markRead(userId: string, id: string) {
    const existing = await this.prisma.ndyspaceNotification.findUnique({
      where: { id },
    });
    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('No notification with that id.');
    }
    return this.prisma.ndyspaceNotification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.ndyspaceNotification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { updatedCount: result.count };
  }
}
