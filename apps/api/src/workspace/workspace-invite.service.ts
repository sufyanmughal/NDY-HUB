import * as crypto from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationCategory,
  NotificationChannel,
  WorkspaceInviteStatus,
  WorkspaceRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../common/mail.service';
import { NotificationService } from '../notifications/notification.service';
import type { WorkspaceActor } from './business-workspace.service';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Team invite lifecycle for a Business Workspace — propose (create a
 * PENDING invite, email the token), accept (token redemption creates a
 * WorkspaceMembership). Unlike RoleChangeRequest/BusinessWorkspaceRequest,
 * this has no dual-actor approval step: inviting yourself into a workspace
 * you already control makes no sense, so a single inviter (any OWNER/ADMIN
 * of the workspace) plus token-based accept by the invitee is the whole
 * loop — simpler by design, not a missed safeguard.
 */
@Injectable()
export class WorkspaceInviteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly notifications: NotificationService,
  ) {}

  async invite(
    actor: WorkspaceActor,
    workspaceId: string,
    invitedEmail: string,
    invitedRole: WorkspaceRole,
    invitedDepartment?: string,
  ) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });
    if (!workspace) throw new NotFoundException('No workspace with that id.');

    const existingMember = await this.prisma.workspaceMembership.findFirst({
      where: { workspaceId, user: { email: invitedEmail } },
    });
    if (existingMember) {
      throw new ConflictException(
        'This person is already a member of the workspace.',
      );
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const invite = await this.prisma.workspaceInvite.create({
      data: {
        workspaceId,
        invitedEmail,
        invitedRole,
        invitedDepartment,
        invitedByUserId: actor.id,
        invitedByNdyId: actor.ndyId,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    });

    await this.mail.send({
      to: invitedEmail,
      subject: `You've been invited to join ${workspace.name} on NDY HUB`,
      html: `<p>${escapeHtml(actor.ndyId)} invited you to join <strong>${escapeHtml(
        workspace.name,
      )}</strong> on NDY HUB as ${escapeHtml(invitedRole)}.</p><p>This invite expires in 7 days.</p><p>Token: ${escapeHtml(
        rawToken,
      )}</p>`,
    });

    return invite;
  }

  async accept(userId: string, rawToken: string) {
    const invite = await this.prisma.workspaceInvite.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      include: { workspace: true },
    });
    if (!invite) throw new NotFoundException('Invalid invite token.');
    if (invite.status !== WorkspaceInviteStatus.PENDING) {
      throw new ConflictException('This invite has already been resolved.');
    }
    if (invite.expiresAt < new Date()) {
      await this.prisma.workspaceInvite.update({
        where: { id: invite.id },
        data: { status: WorkspaceInviteStatus.EXPIRED, resolvedAt: new Date() },
      });
      throw new ConflictException('This invite has expired.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('No user with that id.');
    if (user.email !== invite.invitedEmail) {
      throw new ForbiddenException(
        'This invite was sent to a different email address.',
      );
    }

    const [, membership] = await this.prisma.$transaction([
      this.prisma.workspaceInvite.update({
        where: { id: invite.id },
        data: {
          status: WorkspaceInviteStatus.ACCEPTED,
          resolvedAt: new Date(),
        },
      }),
      this.prisma.workspaceMembership.create({
        data: {
          workspaceId: invite.workspaceId,
          userId,
          role: invite.invitedRole,
          department: invite.invitedDepartment,
        },
      }),
    ]);

    // Best-effort — tell the inviter their invite was accepted. Not part
    // of the transaction above: a notification failure should never roll
    // back a membership that already, correctly, exists.
    await this.notifications.notify({
      userId: invite.invitedByUserId,
      workspaceId: invite.workspaceId,
      category: NotificationCategory.SYSTEM,
      channel: NotificationChannel.IN_APP,
      title: 'Invite accepted',
      body: `${user.ndyId} accepted your invite to ${invite.workspace.name}.`,
      sourceEventId: `workspace-invite-accepted:${invite.id}`,
    });

    return membership;
  }

  async revoke(actor: WorkspaceActor, inviteId: string) {
    const invite = await this.prisma.workspaceInvite.findUnique({
      where: { id: inviteId },
    });
    if (!invite) throw new NotFoundException('No invite with that id.');
    if (invite.status !== WorkspaceInviteStatus.PENDING) {
      throw new ConflictException('This invite has already been resolved.');
    }
    return this.prisma.workspaceInvite.update({
      where: { id: inviteId },
      data: { status: WorkspaceInviteStatus.REVOKED, resolvedAt: new Date() },
    });
  }

  async listForWorkspace(workspaceId: string) {
    return this.prisma.workspaceInvite.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
