import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BusinessWorkspaceRequestStatus,
  Prisma,
  WorkspaceRole,
  WorkspaceType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { generateNdyBusinessId } from './ndy-business-id.util';

export interface WorkspaceActor {
  id: string;
  ndyId: string;
}

/**
 * Business workspace creation, per the client's explicit answer: "creation
 * request goes through the same propose/approve pattern as role changes."
 * Structurally identical to RoleChangeRequestService — propose (PENDING
 * row), a *different* actor with MANAGE_ROLES approves, then and only then
 * does a real BUSINESS Workspace get created and the requester becomes its
 * OWNER. Deliberately designed so a future automated/risk-based approval
 * (via NDY Trust/business verification) is just a different caller of
 * `approve()`, not a schema or flow change — per the client's own explicit
 * instruction.
 */
@Injectable()
export class BusinessWorkspaceService {
  constructor(private readonly prisma: PrismaService) {}

  async createRequest(
    actor: WorkspaceActor,
    businessName: string,
    reason?: string,
  ) {
    const trimmed = businessName.trim();
    if (!trimmed) {
      throw new ConflictException('Business name is required.');
    }

    return this.prisma.businessWorkspaceRequest.create({
      data: {
        requestedByUserId: actor.id,
        requestedByNdyId: actor.ndyId,
        businessName: trimmed,
        requestReason: reason,
      },
    });
  }

  async list(status?: BusinessWorkspaceRequestStatus) {
    return this.prisma.businessWorkspaceRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /**
   * Approves the request and, in the same transaction, creates the real
   * BUSINESS Workspace with the original requester as its OWNER — same
   * "propose creates nothing real yet, approve is what actually applies
   * the change" discipline as RoleChangeRequestService.approve. Self-
   * approval is blocked for the same reason role-change self-review is:
   * an admin-approved gate that the requester can satisfy themselves isn't
   * a real gate.
   */
  async approve(actor: WorkspaceActor, requestId: string, reason?: string) {
    const request = await this.getPendingOrThrow(requestId);
    if (actor.id === request.requestedByUserId) {
      throw new ForbiddenException(
        'You requested this workspace — a different admin has to approve it.',
      );
    }

    // A business id collision is astronomically unlikely (6 chars, 32-char
    // alphabet) but retried defensively anyway, same shape as
    // IdentityService.createUser's NDY ID retry loop.
    let workspace:
      Prisma.PromiseReturnType<typeof this.prisma.workspace.create> | undefined;
    for (let attempt = 0; attempt < 5; attempt++) {
      const ndyBusinessId = generateNdyBusinessId();
      try {
        workspace = await this.prisma.$transaction(async (tx) => {
          const created = await tx.workspace.create({
            data: {
              type: WorkspaceType.BUSINESS,
              name: request.businessName,
              ownerUserId: request.requestedByUserId,
              ndyBusinessId,
            },
          });
          await tx.workspaceMembership.create({
            data: {
              workspaceId: created.id,
              userId: request.requestedByUserId,
              role: WorkspaceRole.OWNER,
            },
          });
          await tx.businessWorkspaceRequest.update({
            where: { id: request.id },
            data: {
              status: BusinessWorkspaceRequestStatus.APPROVED,
              reviewedByUserId: actor.id,
              reviewedByNdyId: actor.ndyId,
              reviewReason: reason,
              resolvedAt: new Date(),
              createdWorkspaceId: created.id,
            },
          });
          return created;
        });
        break;
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          continue; // ndyBusinessId collision — retry with a new one
        }
        throw err;
      }
    }
    if (!workspace) {
      throw new ConflictException(
        'Could not allocate a unique business id — try again.',
      );
    }
    return workspace;
  }

  async reject(actor: WorkspaceActor, requestId: string, reason?: string) {
    const request = await this.getPendingOrThrow(requestId);
    return this.prisma.businessWorkspaceRequest.update({
      where: { id: request.id },
      data: {
        status: BusinessWorkspaceRequestStatus.REJECTED,
        reviewedByUserId: actor.id,
        reviewedByNdyId: actor.ndyId,
        reviewReason: reason,
        resolvedAt: new Date(),
      },
    });
  }

  private async getPendingOrThrow(requestId: string) {
    const request = await this.prisma.businessWorkspaceRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundException(
        'No business workspace request with that id.',
      );
    }
    if (request.status !== BusinessWorkspaceRequestStatus.PENDING) {
      throw new ConflictException('This request has already been resolved.');
    }
    return request;
  }
}
