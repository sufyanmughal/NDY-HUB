import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityEventService } from './security-event.service';

export interface DeviceContext {
  /** The client-generated, locally-persisted value sent via the
   * x-device-id header — never invented server-side. Absent for older
   * clients that haven't adopted this yet (see Device's schema doc
   * comment) — every method here degrades gracefully to a no-op when
   * this is undefined, exactly like every optional field in this schema. */
  deviceId?: string;
  userAgent?: string;
}

/**
 * Central, ecosystem-wide device management — Phase D of
 * identity-architecture-hardening-plan.md, per the client's explicit
 * sign-off on all three of the recommended defaults (client-generated
 * persistent device ID, passive device list for now, extending the
 * existing /security page rather than a new one) plus his explicit
 * requirement that revoking a device or "Sign Out All Devices" must
 * propagate across every connected NDY product, not just the dashboard.
 *
 * Deliberately built passive (alertsEnabled defaults false, nothing here
 * ever sets it true, no new-device prompt exists) but with the schema and
 * this service's own shape ready for that later — see resolveDevice's
 * doc comment for exactly where an active-alerting phase would hook in
 * without a rebuild, per the client's explicit "design so we can add this
 * later" instruction.
 */
@Injectable()
export class DeviceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly securityEvents: SecurityEventService,
  ) {}

  /**
   * Called from every login/token-issue call site (SessionService.
   * issueSession, OAuthTokenService.issueTokenSet) right before the
   * Session/OAuthRefreshToken row is created, so that row can be tagged
   * with the resulting Device.id. Upserts by (userId, deviceId) — the
   * same device logging in again just updates lastSeenAt rather than
   * creating a duplicate row.
   *
   * Returns null when no deviceId was sent — callers just leave their
   * own deviceId column null in that case (see Session.deviceId /
   * OAuthRefreshToken.deviceId's own doc comments).
   *
   * Where a future active-alerting phase hooks in: this method already
   * knows, via the upsert's "was this a create or an update" outcome,
   * whether it just saw a genuinely new device for this user — that's
   * the exact signal a "new device, was this you?" prompt would need.
   * Today that signal is simply discarded (this method returns the same
   * shape either way); wiring in an alert there is a small, additive
   * change to this one method, not a schema or architecture change.
   */
  async resolveDevice(
    userId: string,
    context: DeviceContext,
  ): Promise<string | null> {
    if (!context.deviceId) return null;

    const label = deriveLabel(context.userAgent);

    const device = await this.prisma.device.upsert({
      where: { userId_deviceId: { userId, deviceId: context.deviceId } },
      create: { userId, deviceId: context.deviceId, label },
      update: { lastSeenAt: new Date() },
    });

    // A device that was previously revoked and comes back (the user
    // reconnected an app after signing it out) becomes active again —
    // revokedAt only ever means "not currently trusted," not "gone
    // forever," matching how every other soft-revoke in this schema
    // (Session.revokedAt, OAuthRefreshToken.revokedAt) already behaves.
    if (device.revokedAt) {
      await this.prisma.device.update({
        where: { id: device.id },
        data: { revokedAt: null },
      });
    }

    return device.id;
  }

  async listForUser(userId: string) {
    return this.prisma.device.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  /**
   * The actual "Sign Out All Devices" propagation, per the client's
   * explicit requirement: revokes the Device row itself, then every
   * Session AND every OAuthRefreshToken tagged with it — the dashboard
   * and every connected NDY product, in one call, not two separate
   * revoke paths a caller could forget to run together.
   */
  async revokeDevice(userId: string, deviceId: string) {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, userId, revokedAt: null },
    });
    if (!device) {
      throw new NotFoundException('No active device with that id.');
    }

    await this.prisma.$transaction([
      this.prisma.device.update({
        where: { id: device.id },
        data: { revokedAt: new Date() },
      }),
      this.prisma.session.updateMany({
        where: { deviceId: device.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.oAuthRefreshToken.updateMany({
        where: { deviceId: device.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.securityEvents.record(userId, 'DEVICE_REVOKED');
  }

  /** Revokes every device this user has — the ecosystem-wide version of
   * "Sign Out All Devices" the client explicitly asked for, called
   * alongside SecurityService.revokeAllSessions rather than replacing it
   * (that method still needs to exist for sessions with no deviceId at
   * all, from before this phase or from clients that never adopt it). */
  async revokeAllDevices(userId: string): Promise<{ revokedCount: number }> {
    const devices = await this.prisma.device.findMany({
      where: { userId, revokedAt: null },
      select: { id: true },
    });
    if (devices.length === 0) return { revokedCount: 0 };

    const deviceIds = devices.map((d) => d.id);
    await this.prisma.$transaction([
      this.prisma.device.updateMany({
        where: { id: { in: deviceIds } },
        data: { revokedAt: new Date() },
      }),
      this.prisma.session.updateMany({
        where: { deviceId: { in: deviceIds }, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.oAuthRefreshToken.updateMany({
        where: { deviceId: { in: deviceIds }, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.securityEvents.record(userId, 'DEVICE_REVOKED');
    return { revokedCount: devices.length };
  }
}

function deriveLabel(userAgent: string | undefined): string {
  if (!userAgent) return 'Unknown device';
  // Deliberately simple — a full user-agent parser is real dependency
  // weight for a "good enough at a glance" label; the raw string itself
  // stays visible in the Session/audit rows for anyone who needs the
  // precise value.
  if (/iphone/i.test(userAgent)) return 'iPhone';
  if (/ipad/i.test(userAgent)) return 'iPad';
  if (/android/i.test(userAgent)) return 'Android device';
  if (/macintosh/i.test(userAgent)) return 'Mac';
  if (/windows/i.test(userAgent)) return 'Windows PC';
  if (/linux/i.test(userAgent)) return 'Linux device';
  return 'Unknown device';
}
