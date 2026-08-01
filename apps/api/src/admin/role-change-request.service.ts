import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role, RoleChangeRequestStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AdminActor } from './admin.service';

const FOUNDER_ONLY_ASSIGNABLE: readonly Role[] = [
  Role.FOUNDER,
  Role.SUPER_ADMIN,
];

/**
 * Dual-approval for role changes (the client's explicit "critical actions"
 * requirement) — a role change is no longer instant. One admin with
 * MANAGE_ROLES proposes it here; a *different* admin with MANAGE_ROLES has
 * to approve before AdminService actually touches the user's role. Kept as
 * its own service (not folded into AdminService) since it owns a genuinely
 * different lifecycle — propose/review — not a single mutation.
 */
@Injectable()
export class RoleChangeRequestService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    actor: AdminActor,
    targetUserId: string,
    role: Role,
    reason?: string,
  ) {
    if (FOUNDER_ONLY_ASSIGNABLE.includes(role)) {
      const actorUser = await this.prisma.user.findUnique({
        where: { id: actor.id },
        select: { role: true },
      });
      if (actorUser?.role !== Role.FOUNDER) {
        throw new ForbiddenException(
          `Only a Founder can request assigning the ${role} role.`,
        );
      }
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!target) throw new NotFoundException('No user with that id.');

    const request = await this.prisma.roleChangeRequest.create({
      data: {
        targetUserId: target.id,
        targetNdyId: target.ndyId,
        requestedRole: role,
        previousRole: target.role,
        requestedByUserId: actor.id,
        requestedByNdyId: actor.ndyId,
        requestReason: reason,
      },
    });

    await this.writeAuditLog(actor, {
      action: 'user.role.request',
      targetUserId: target.id,
      targetNdyId: target.ndyId,
      previousValue: { role: target.role },
      newValue: { requestedRole: role, requestId: request.id },
      reason,
    });

    return request;
  }

  async list(status?: RoleChangeRequestStatus) {
    return this.prisma.roleChangeRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async approve(actor: AdminActor, requestId: string, reason?: string) {
    const request = await this.getPendingOrThrow(requestId);
    this.assertNotSelfReview(actor, request);
    await this.assertActorCanDecide(actor, request);

    const target = await this.prisma.user.findUnique({
      where: { id: request.targetUserId },
    });
    if (!target) throw new NotFoundException('No user with that id.');

    const [, updatedRequest] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: request.targetUserId },
        data: { role: request.requestedRole },
      }),
      this.prisma.roleChangeRequest.update({
        where: { id: request.id },
        data: {
          status: RoleChangeRequestStatus.APPROVED,
          reviewedByUserId: actor.id,
          reviewedByNdyId: actor.ndyId,
          reviewReason: reason,
          resolvedAt: new Date(),
        },
      }),
    ]);

    await this.writeAuditLog(actor, {
      action: 'user.role.approve',
      targetUserId: target.id,
      targetNdyId: target.ndyId,
      previousValue: { role: request.previousRole },
      newValue: {
        role: request.requestedRole,
        requestedBy: request.requestedByNdyId,
        approvedBy: actor.ndyId,
      },
      reason,
    });

    return updatedRequest;
  }

  async reject(actor: AdminActor, requestId: string, reason?: string) {
    const request = await this.getPendingOrThrow(requestId);
    this.assertNotSelfReview(actor, request);
    await this.assertActorCanDecide(actor, request);

    const updated = await this.prisma.roleChangeRequest.update({
      where: { id: request.id },
      data: {
        status: RoleChangeRequestStatus.REJECTED,
        reviewedByUserId: actor.id,
        reviewedByNdyId: actor.ndyId,
        reviewReason: reason,
        resolvedAt: new Date(),
      },
    });

    await this.writeAuditLog(actor, {
      action: 'user.role.reject',
      targetUserId: request.targetUserId,
      targetNdyId: request.targetNdyId,
      previousValue: { requestedRole: request.requestedRole },
      newValue: {
        rejectedBy: actor.ndyId,
        requestedBy: request.requestedByNdyId,
      },
      reason,
    });

    return updated;
  }

  private async getPendingOrThrow(requestId: string) {
    const request = await this.prisma.roleChangeRequest.findUnique({
      where: { id: requestId },
    });
    if (!request)
      throw new NotFoundException('No role change request with that id.');
    if (request.status !== RoleChangeRequestStatus.PENDING) {
      throw new ConflictException('This request has already been resolved.');
    }
    return request;
  }

  private assertNotSelfReview(
    actor: AdminActor,
    request: { requestedByUserId: string },
  ) {
    if (actor.id === request.requestedByUserId) {
      throw new ForbiddenException(
        'You requested this change — a different admin has to approve or reject it.',
      );
    }
  }

  private async assertActorCanDecide(
    actor: AdminActor,
    request: { requestedRole: Role },
  ) {
    if (!FOUNDER_ONLY_ASSIGNABLE.includes(request.requestedRole)) return;
    const actorUser = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: { role: true },
    });
    if (actorUser?.role !== Role.FOUNDER) {
      throw new ForbiddenException(
        `Only a Founder can approve or reject a request for the ${request.requestedRole} role.`,
      );
    }
  }

  private async writeAuditLog(
    actor: AdminActor,
    params: {
      action: string;
      targetUserId: string;
      targetNdyId: string;
      previousValue?: unknown;
      newValue?: unknown;
      reason?: string;
    },
  ) {
    await this.prisma.auditLogEntry.create({
      data: {
        adminUserId: actor.id,
        adminNdyId: actor.ndyId,
        action: params.action,
        targetUserId: params.targetUserId,
        targetNdyId: params.targetNdyId,
        previousValue: toJson(params.previousValue),
        newValue: toJson(params.newValue),
        reason: params.reason,
        ip: actor.ip,
      },
    });
  }
}

function toJson(value: unknown) {
  return value === undefined
    ? undefined
    : (JSON.parse(JSON.stringify(value)) as object);
}
