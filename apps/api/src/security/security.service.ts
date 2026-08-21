import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DeviceService } from '../auth/device.service';

@Injectable()
export class SecurityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly devices: DeviceService,
  ) {}

  async listActiveSessions(userId: string, currentSessionId: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    return sessions.map((session) => ({
      id: session.id,
      userAgent: session.userAgent,
      ip: session.ip,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      isCurrent: session.id === currentSessionId,
    }));
  }

  async revokeSession(userId: string, sessionId: string) {
    const result = await this.prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundException(
        'No active session with that id for this user.',
      );
    }
  }

  /**
   * "Log out all devices" — including the one making this call. The
   * caller's own access token stays valid until it naturally expires (it's
   * a stateless JWT, nothing to revoke there), but the refresh token behind
   * it is dead, so nothing can extend that session further.
   *
   * Per the client's explicit "Sign Out All Devices must work
   * ecosystem-wide" requirement (Phase D, identity-architecture-hardening-
   * plan.md): also revokes every Device (and therefore every connected
   * NDY product's OAuthRefreshToken tied to one) via DeviceService, not
   * just NDY HUB's own dashboard Session rows. Sessions with no Device at
   * all (older clients, or ones that never send x-device-id) still get
   * caught by the Session updateMany below — nothing is left half-revoked
   * either way.
   */
  async revokeAllSessions(userId: string): Promise<{ revokedCount: number }> {
    const [sessionResult] = await Promise.all([
      this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.devices.revokeAllDevices(userId),
    ]);
    return { revokedCount: sessionResult.count };
  }

  async listDevices(userId: string) {
    return this.devices.listForUser(userId);
  }

  async revokeDevice(userId: string, deviceId: string) {
    return this.devices.revokeDevice(userId, deviceId);
  }
}
