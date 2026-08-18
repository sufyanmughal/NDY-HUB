import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WorkspaceRole, WorkspaceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Owns the workspace/tenancy foundation — Phase 1 of the post-vision-
 * documents architecture plan. Every existing NDY HUB feature is
 * per-user-owned today; this service is what lets a future feature ask
 * "which workspace is this happening inside" without every caller
 * reimplementing that lookup.
 *
 * Two axes stay deliberately separate: `Role` (FOUNDER, SUPER_ADMIN, ...)
 * on User is platform-wide and unrelated to `WorkspaceRole` (OWNER, ADMIN,
 * MEMBER) here — a platform SUPER_ADMIN is not automatically a workspace
 * OWNER, and a workspace OWNER gets no platform-wide permissions from that
 * alone. PermissionGuard checks the former; WorkspaceGuard (this module)
 * checks the latter.
 */
@Injectable()
export class WorkspaceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Every user has exactly one personal workspace. Returns the existing
   * one if already created (via `User.defaultWorkspaceId`, or via a
   * membership row even if the pointer field is somehow out of sync);
   * creates one otherwise. Idempotent by design — safe to call on every
   * login if a caller wants to be defensive, though in practice this only
   * needs to run once per user (at signup, or once via the backfill
   * script for pre-existing accounts).
   */
  async getOrCreatePersonalWorkspace(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        ndyId: true,
        defaultWorkspaceId: true,
      },
    });
    if (!user) throw new NotFoundException('No user with that id.');

    if (user.defaultWorkspaceId) {
      const existing = await this.prisma.workspace.findUnique({
        where: { id: user.defaultWorkspaceId },
      });
      if (existing) return existing;
      // defaultWorkspaceId pointed at a workspace that no longer exists
      // (shouldn't happen in practice — nothing deletes a PERSONAL
      // workspace today — but fall through to create rather than throw).
    }

    // Guard against a duplicate create if this is somehow called twice
    // concurrently for the same user — look for an existing OWNER
    // membership on a PERSONAL workspace before minting a new one.
    const existingMembership = await this.prisma.workspaceMembership.findFirst({
      where: {
        userId,
        role: WorkspaceRole.OWNER,
        workspace: { type: WorkspaceType.PERSONAL },
      },
      include: { workspace: true },
    });
    if (existingMembership) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { defaultWorkspaceId: existingMembership.workspaceId },
      });
      return existingMembership.workspace;
    }

    const workspace = await this.prisma.$transaction(async (tx) => {
      const created = await tx.workspace.create({
        data: {
          type: WorkspaceType.PERSONAL,
          name: user.fullName ?? user.ndyId,
          ownerUserId: user.id,
        },
      });
      await tx.workspaceMembership.create({
        data: {
          workspaceId: created.id,
          userId: user.id,
          role: WorkspaceRole.OWNER,
        },
      });
      await tx.user.update({
        where: { id: user.id },
        data: { defaultWorkspaceId: created.id },
      });
      return created;
    });

    return workspace;
  }

  async getMembership(userId: string, workspaceId: string) {
    return this.prisma.workspaceMembership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
  }

  /**
   * Throws if the user isn't a member of the workspace at all — this is
   * the check `docs/action-engine-design.md`'s Authorize step names but,
   * until this module existed, had nothing real to call.
   */
  async assertMember(userId: string, workspaceId: string) {
    const membership = await this.getMembership(userId, workspaceId);
    if (!membership) {
      throw new ForbiddenException('You are not a member of this workspace.');
    }
    return membership;
  }

  /** Throws unless the user's role in the workspace is one of `allowed`. */
  async assertRole(
    userId: string,
    workspaceId: string,
    allowed: WorkspaceRole[],
  ) {
    const membership = await this.assertMember(userId, workspaceId);
    if (!allowed.includes(membership.role)) {
      throw new ForbiddenException(
        `Requires workspace role ${allowed.join(' or ')}, you have ${membership.role}.`,
      );
    }
    return membership;
  }

  async listMembers(workspaceId: string) {
    return this.prisma.workspaceMembership.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
