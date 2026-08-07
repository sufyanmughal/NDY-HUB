import { Injectable, Logger } from '@nestjs/common';
import { SecurityEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SessionMeta } from './session.service';

export interface SecurityEventSummary {
  id: string;
  type: SecurityEventType;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
}

/**
 * The user-facing "what happened on my account" timeline (client's
 * "security history" spec) — distinct from AuditLogEntry, which only
 * records admin actions taken *on* a user. Never throws: a security event
 * failing to log must never block the login/action that triggered it.
 */
@Injectable()
export class SecurityEventService {
  private readonly logger = new Logger(SecurityEventService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(
    userId: string,
    type: SecurityEventType,
    meta?: SessionMeta,
  ): Promise<void> {
    try {
      await this.prisma.securityEvent.create({
        data: {
          userId,
          type,
          ip: meta?.ip,
          userAgent: meta?.userAgent,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to record security event ${type}: ${err}`);
    }
  }

  /**
   * Called from each real login call site (password, TOTP challenge,
   * passkey, social) right after SessionService.issueSession — never from
   * inside issueSession/rotateSession itself, since rotateSession also
   * runs on every silent refresh-token renewal and would flood the
   * timeline with a "login" every 15 minutes for an active user.
   *
   * mustBeforeSessionCreate: the caller passes whether this account has
   * ever had a session with this userAgent BEFORE the session just issued
   * for this login — checked by the caller ahead of issueSession, since by
   * the time this method runs the new Session row already exists and
   * would make every login look like a repeat device.
   */
  async recordLogin(
    userId: string,
    meta: SessionMeta,
    isNewDevice: boolean,
  ): Promise<void> {
    try {
      await this.prisma.securityEvent.createMany({
        data: isNewDevice
          ? [
              {
                userId,
                type: 'NEW_DEVICE',
                ip: meta.ip,
                userAgent: meta.userAgent,
              },
              {
                userId,
                type: 'LOGIN_SUCCESS',
                ip: meta.ip,
                userAgent: meta.userAgent,
              },
            ]
          : [
              {
                userId,
                type: 'LOGIN_SUCCESS',
                ip: meta.ip,
                userAgent: meta.userAgent,
              },
            ],
      });
    } catch (err) {
      this.logger.warn(`Failed to record login security event: ${err}`);
    }
  }

  /** Must be called BEFORE SessionService.issueSession for this login —
   * see recordLogin's doc for why. */
  async isNewDevice(userId: string, meta: SessionMeta): Promise<boolean> {
    if (!meta.userAgent) return false;
    const priorCount = await this.prisma.session.count({
      where: { userId, userAgent: meta.userAgent },
    });
    return priorCount === 0;
  }

  async listForUser(
    userId: string,
    limit = 50,
  ): Promise<SecurityEventSummary[]> {
    return this.prisma.securityEvent.findMany({
      where: { userId },
      select: {
        id: true,
        type: true,
        ip: true,
        userAgent: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
