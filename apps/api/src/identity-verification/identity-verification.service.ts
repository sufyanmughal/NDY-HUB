import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ClaimProvenance,
  IdentityVerificationRequestStatus,
  NotificationCategory,
  NotificationChannel,
  VerificationLevel,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';

export interface ReviewerActor {
  id: string;
  ndyId: string;
}

/**
 * The LEVEL_3 (identity document) manual review flow — Phase 7, per the
 * client's explicit answer: a new dedicated reviewer permission
 * (REVIEW_IDENTITY_VERIFICATION, not folded into MANAGE_USERS), and the
 * follow-up clarification that NDY HUB owns request/status/approval/audit
 * trail but does NOT store the identity document itself. There is
 * deliberately no document/file field anywhere in this service —
 * evidenceNote is a free-text pointer to wherever the real evidence was
 * actually handled (support ticket, email), never the document bytes.
 * Architecture-ready for a future dedicated secure KYC/document-handling
 * layer to attach to the same request row without a schema rewrite, per
 * the client's explicit instruction.
 *
 * Same propose -> separate-actor-resolves shape as RoleChangeRequestService
 * and BusinessWorkspaceService, minus the self-review block — a user
 * requesting their own identity verification isn't a conflict-of-interest
 * risk the way an admin approving their own role change is.
 */
@Injectable()
export class IdentityVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  async createRequest(userId: string, evidenceNote?: string) {
    const existingPending =
      await this.prisma.identityVerificationRequest.findFirst({
        where: { userId, status: IdentityVerificationRequestStatus.PENDING },
      });
    if (existingPending) {
      throw new ConflictException(
        'You already have a pending identity verification request.',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('No user with that id.');
    if (user.verificationLevel === VerificationLevel.LEVEL_3) {
      throw new ConflictException('Your identity is already verified.');
    }

    return this.prisma.identityVerificationRequest.create({
      data: { userId, evidenceNote },
    });
  }

  async listMine(userId: string) {
    return this.prisma.identityVerificationRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async list(status?: IdentityVerificationRequestStatus) {
    return this.prisma.identityVerificationRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /**
   * Approves the request, sets User.identityVerifiedAt, bumps
   * VerificationLevel to LEVEL_3 (only ever moving forward — same
   * never-downgrade discipline as the existing LEVEL_1/LEVEL_2
   * transitions in auth.service.ts/sms-2fa.service.ts), and writes a
   * PassportClaim row formalizing "identity_document" as NDY_VERIFIED —
   * the first real use of that table.
   */
  async approve(actor: ReviewerActor, requestId: string, reason?: string) {
    const request = await this.getPendingOrThrow(requestId);

    const [, , , updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: request.userId },
        data: {
          identityVerifiedAt: new Date(),
          verificationLevel: VerificationLevel.LEVEL_3,
        },
      }),
      this.prisma.passportClaim.upsert({
        where: {
          userId_claimKey: {
            userId: request.userId,
            claimKey: 'identity_document',
          },
        },
        create: {
          userId: request.userId,
          claimKey: 'identity_document',
          provenance: ClaimProvenance.NDY_VERIFIED,
          verifiedAt: new Date(),
        },
        update: {
          provenance: ClaimProvenance.NDY_VERIFIED,
          verifiedAt: new Date(),
        },
      }),
      this.prisma.identityVerificationRequest.update({
        where: { id: request.id },
        data: {
          status: IdentityVerificationRequestStatus.APPROVED,
          reviewedByUserId: actor.id,
          reviewedByNdyId: actor.ndyId,
          reviewReason: reason,
          resolvedAt: new Date(),
        },
      }),
      this.prisma.identityVerificationRequest.findUniqueOrThrow({
        where: { id: request.id },
      }),
    ]);

    await this.notifications.notify({
      userId: request.userId,
      category: NotificationCategory.SECURITY,
      channel: NotificationChannel.EMAIL,
      title: 'Identity verification approved',
      body: 'Your NDY HUB identity verification (LEVEL_3) has been approved.',
      sourceEventId: `identity-verification-approved:${request.id}`,
    });

    return updated;
  }

  async reject(actor: ReviewerActor, requestId: string, reason?: string) {
    const request = await this.getPendingOrThrow(requestId);

    const updated = await this.prisma.identityVerificationRequest.update({
      where: { id: request.id },
      data: {
        status: IdentityVerificationRequestStatus.REJECTED,
        reviewedByUserId: actor.id,
        reviewedByNdyId: actor.ndyId,
        reviewReason: reason,
        resolvedAt: new Date(),
      },
    });

    await this.notifications.notify({
      userId: request.userId,
      category: NotificationCategory.SECURITY,
      channel: NotificationChannel.EMAIL,
      title: 'Identity verification request rejected',
      body: reason
        ? `Your NDY HUB identity verification request was not approved: ${reason}`
        : 'Your NDY HUB identity verification request was not approved.',
      sourceEventId: `identity-verification-rejected:${request.id}`,
    });

    return updated;
  }

  private async getPendingOrThrow(requestId: string) {
    const request = await this.prisma.identityVerificationRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundException(
        'No identity verification request with that id.',
      );
    }
    if (request.status !== IdentityVerificationRequestStatus.PENDING) {
      throw new ConflictException('This request has already been resolved.');
    }
    return request;
  }
}
