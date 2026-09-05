import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import {
  DeviceApprovalReason,
  DeviceApprovalStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { NotificationCategory, NotificationChannel } from '@prisma/client';

const APPROVAL_TTL_MS = 5 * 60 * 1000; // 5 minutes — long enough to reach for a phone, short enough that a stale request isn't sitting around waiting to be approved by mistake

/**
 * The NDYAPPS Trusted Device / Approval Channel — the client's explicit
 * message-22 architecture ask. See DeviceApprovalRequest's own schema doc
 * comment for why this is a separate model/service from LoginRequest
 * rather than an extension of it.
 *
 * Today's real trigger is exactly the one signal DeviceService.
 * resolveDevice already detects but discards (NEW_DEVICE) — RISKY_ACTION
 * is modeled but nothing creates one yet, same "reserve the shape, wire
 * the trigger later" discipline as Device.alertsEnabled itself.
 *
 * Delivery today is via the existing NotificationService (IN_APP +
 * EMAIL) — NOT a real OS push notification to a phone. No push-token/FCM/
 * APNs infrastructure exists in this codebase yet, so "NDYAPPS immediately
 * vibrates" isn't a real capability to build against; the correct, honest
 * Phase 1 here is the notification landing in NDYAPPS the next time the
 * user opens it, via the same in-app notification list every other
 * category already uses. Upgrading to real push is a delivery-channel
 * change inside NotificationService.deliver(), not a change to this
 * service or the DeviceApprovalRequest model.
 */
@Injectable()
export class DeviceApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => NotificationService))
    private readonly notifications: NotificationService,
  ) {}

  /**
   * Called from DeviceService.resolveDevice the moment it detects a
   * genuinely new device (the upsert's create-vs-update outcome) for a
   * user with alertsEnabled — see that method's own doc comment, which
   * already documents this exact hook point. Silently no-ops for a user
   * who hasn't opted into alerting, same as alertsEnabled's default-false
   * behavior everywhere else.
   */
  async createForNewDevice(params: {
    userId: string;
    deviceId: string | null;
    requestingContext?: string;
  }) {
    const matchCode = generateMatchCode();

    const request = await this.prisma.deviceApprovalRequest.create({
      data: {
        userId: params.userId,
        deviceId: params.deviceId,
        reason: DeviceApprovalReason.NEW_DEVICE,
        matchCode,
        requestingContext: params.requestingContext,
        expiresAt: new Date(Date.now() + APPROVAL_TTL_MS),
      },
    });

    // ACTION_APPROVAL is an existing, reserved NotificationCategory — see
    // schema.prisma's own comment on that enum value. sourceEventId keyed
    // off this request's id so a retry of the same trigger (e.g. a flaky
    // upsert retried by a caller) can never double-notify.
    await this.notifications.notify({
      userId: params.userId,
      category: NotificationCategory.ACTION_APPROVAL,
      channel: NotificationChannel.IN_APP,
      title: 'Approve this new device?',
      body: params.requestingContext
        ? `${params.requestingContext} — confirm the code shown there matches ${matchCode} before approving.`
        : `A new device was used to sign in — confirm the code shown there matches ${matchCode} before approving.`,
      sourceEventId: `device-approval:${request.id}`,
    });

    return request;
  }

  /** What the initiating side polls to know if NDYAPPS has responded, and
   *  to render the matchCode for the user to visually compare. */
  async getStatus(id: string) {
    return this.findActiveOrExpire(id);
  }

  /**
   * Called from NDYAPPS's own authenticated session (JwtAuthGuard on the
   * route) — approval can only ever come from a device already logged in
   * as this user, same guard shape as LoginRequest.approve. The submitted
   * matchCode is the actual anti-MITM check: NDYAPPS shows this value in
   * its own UI and asks the user to confirm it matches what the
   * initiating screen displays before calling this — see
   * DeviceApprovalRequest.matchCode's schema doc comment for why 3 digits
   * is the right size for this job.
   */
  async approve(id: string, userId: string, submittedMatchCode: string) {
    const request = await this.findActiveOrExpire(id);
    if (request.userId !== userId) {
      // Same "don't leak which id belongs to someone else" reasoning as
      // every other cross-user lookup in this codebase.
      throw new NotFoundException('No approval request with that id.');
    }
    if (request.status !== DeviceApprovalStatus.PENDING) {
      throw new BadRequestException(
        `This approval request is already ${request.status.toLowerCase()}.`,
      );
    }
    if (submittedMatchCode !== request.matchCode) {
      // Deliberately the same error whether the code is simply wrong or
      // this is an active MITM attempt — no reason to distinguish those
      // for the caller, and a distinct "wrong code" vs "not found" message
      // would itself leak information.
      throw new ForbiddenException('The confirmation code does not match.');
    }

    const result = await this.prisma.deviceApprovalRequest.updateMany({
      where: { id, status: DeviceApprovalStatus.PENDING },
      data: { status: DeviceApprovalStatus.APPROVED, approvedAt: new Date() },
    });
    if (result.count === 0) {
      throw new ConflictException('This approval request was already handled.');
    }

    return this.prisma.deviceApprovalRequest.findUniqueOrThrow({
      where: { id },
    });
  }

  async deny(id: string, userId: string) {
    const request = await this.findActiveOrExpire(id);
    if (request.userId !== userId) {
      throw new NotFoundException('No approval request with that id.');
    }
    if (request.status !== DeviceApprovalStatus.PENDING) {
      throw new BadRequestException(
        `This approval request is already ${request.status.toLowerCase()}.`,
      );
    }

    await this.prisma.deviceApprovalRequest.updateMany({
      where: { id, status: DeviceApprovalStatus.PENDING },
      data: { status: DeviceApprovalStatus.DENIED, deniedAt: new Date() },
    });

    return this.prisma.deviceApprovalRequest.findUniqueOrThrow({
      where: { id },
    });
  }

  /** Same lazy-expiry pattern as LoginRequest's findActiveOrExpire — a
   *  PENDING row past its expiresAt flips to EXPIRED the moment anything
   *  looks at it, rather than needing a cron sweep. */
  private async findActiveOrExpire(id: string) {
    const request = await this.prisma.deviceApprovalRequest.findUnique({
      where: { id },
    });
    if (!request) {
      throw new NotFoundException('No approval request with that id.');
    }
    if (
      request.status === DeviceApprovalStatus.PENDING &&
      request.expiresAt < new Date()
    ) {
      return this.prisma.deviceApprovalRequest.update({
        where: { id },
        data: { status: DeviceApprovalStatus.EXPIRED },
      });
    }
    return request;
  }
}

function generateMatchCode(): string {
  // 100-999 — always exactly 3 digits, no leading-zero ambiguity when
  // displayed (a leading zero would read fine as a string but risks a
  // caller accidentally treating this as a number somewhere down the
  // line and losing it).
  return String(randomInt(100, 1000));
}
