import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NdyspaceNotificationsService } from './ndyspace-notifications.service';
import {
  SaveDraftDto,
  SendDraftDto,
  SendEmailDto,
  UpdateEmailRecipientDto,
} from './dto/mail.dto';
import { EmailFolder, Prisma } from '@prisma/client';

const INBOX_LIST_LIMIT = 100;

const EMAIL_RECIPIENT_WITH_SENDER =
  Prisma.validator<Prisma.EmailRecipientDefaultArgs>()({
    include: {
      email: {
        include: {
          sender: {
            select: { ndyId: true, fullName: true, profilePhotoUrl: true },
          },
        },
      },
    },
  });

type EmailRecipientWithSender = Prisma.EmailRecipientGetPayload<
  typeof EMAIL_RECIPIENT_WITH_SENDER
>;

// Detail view only (see build notes — Reply All is only offered from the
// open-message reader, so the heavier recipient/attachment joins don't need
// to be paid on every list-folder row).
const EMAIL_RECIPIENT_DETAIL =
  Prisma.validator<Prisma.EmailRecipientDefaultArgs>()({
    include: {
      email: {
        include: {
          sender: {
            select: { ndyId: true, fullName: true, profilePhotoUrl: true },
          },
          recipients: {
            where: { folder: { not: EmailFolder.DRAFTS } },
            include: { user: { select: { ndyId: true, fullName: true } } },
          },
          attachments: { include: { driveFile: true } },
        },
      },
    },
  });

type EmailRecipientDetail = Prisma.EmailRecipientGetPayload<
  typeof EMAIL_RECIPIENT_DETAIL
>;

/**
 * NDYMAIL — internal-only send between NDYSPACE users. There is no SMTP/
 * IMAP transport here: "sending" means writing one Email row plus one
 * EmailRecipient row per resolved recipient, in a single transaction, and
 * that's the entire delivery model for this pass. External email
 * federation is explicitly out of scope (see NDYSPACE build notes).
 */
@Injectable()
export class NdyspaceMailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NdyspaceNotificationsService,
  ) {}

  private async resolveRecipients(ndyIds: string[]) {
    const uniqueNdyIds = Array.from(new Set(ndyIds));
    if (uniqueNdyIds.length === 0) return [];
    const recipients = await this.prisma.user.findMany({
      where: { ndyId: { in: uniqueNdyIds } },
      select: { id: true, ndyId: true },
    });
    if (recipients.length !== uniqueNdyIds.length) {
      const found = new Set(recipients.map((r) => r.ndyId));
      const missing = uniqueNdyIds.filter((id) => !found.has(id));
      throw new NotFoundException(
        `No NDYSPACE user found for NDY ID(s): ${missing.join(', ')}`,
      );
    }
    return recipients;
  }

  private async validateAttachments(senderId: string, driveFileIds: string[]) {
    if (driveFileIds.length === 0) return;
    const files = await this.prisma.driveFile.findMany({
      where: { id: { in: driveFileIds } },
      select: { id: true, userId: true },
    });
    if (
      files.length !== driveFileIds.length ||
      files.some((f) => f.userId !== senderId)
    ) {
      throw new BadRequestException(
        'One or more attachments are invalid or not yours.',
      );
    }
  }

  async send(senderId: string, dto: SendEmailDto) {
    const toNdyIds = Array.from(new Set(dto.recipientNdyIds));
    if (toNdyIds.length === 0) {
      throw new BadRequestException('At least one recipient is required.');
    }
    const ccNdyIds = Array.from(new Set(dto.ccNdyIds ?? [])).filter(
      (id) => !toNdyIds.includes(id),
    );
    const attachmentIds = Array.from(new Set(dto.attachmentDriveFileIds ?? []));

    const toRecipients = await this.resolveRecipients(toNdyIds);
    const ccRecipients = await this.resolveRecipients(ccNdyIds);
    await this.validateAttachments(senderId, attachmentIds);

    const email = await this.deliver(senderId, {
      subject: dto.subject,
      body: dto.body,
      toRecipients,
      ccRecipients,
      attachmentIds,
    });

    return email;
  }

  private async deliver(
    senderId: string,
    params: {
      subject: string;
      body: string;
      toRecipients: { id: string; ndyId: string }[];
      ccRecipients: { id: string; ndyId: string }[];
      attachmentIds: string[];
    },
  ) {
    const { subject, body, toRecipients, ccRecipients, attachmentIds } = params;

    const email = await this.prisma.$transaction(async (tx) => {
      const created = await tx.email.create({
        data: { senderId, subject, body },
      });

      await tx.emailRecipient.create({
        data: {
          emailId: created.id,
          userId: senderId,
          folder: EmailFolder.SENT,
          isRead: true,
        },
      });

      const allRecipients = [
        ...toRecipients.map((r) => ({ ...r, isCc: false })),
        ...ccRecipients.map((r) => ({ ...r, isCc: true })),
      ].filter((r) => r.id !== senderId); // sending to yourself doesn't need a second inbox copy

      if (allRecipients.length > 0) {
        await tx.emailRecipient.createMany({
          data: allRecipients.map((r) => ({
            emailId: created.id,
            userId: r.id,
            folder: EmailFolder.INBOX,
            isCc: r.isCc,
          })),
        });
      }

      if (attachmentIds.length > 0) {
        await tx.emailAttachment.createMany({
          data: attachmentIds.map((driveFileId) => ({
            emailId: created.id,
            driveFileId,
          })),
        });
      }

      return created;
    });

    const notifyTargets = [...toRecipients, ...ccRecipients].filter(
      (r) => r.id !== senderId,
    );
    await Promise.all(
      notifyTargets.map((r) =>
        this.notifications.create(r.id, 'MAIL', `New message: "${subject}"`),
      ),
    );

    return email;
  }

  async listFolder(userId: string, folder: EmailFolder) {
    const rows = await this.prisma.emailRecipient.findMany({
      where: { userId, folder },
      orderBy: { createdAt: 'desc' },
      take: INBOX_LIST_LIMIT,
      ...EMAIL_RECIPIENT_WITH_SENDER,
    });
    return rows.map(toEmailListItem);
  }

  async getOne(userId: string, recipientRowId: string) {
    const row = await this.prisma.emailRecipient.findUnique({
      where: { id: recipientRowId },
      ...EMAIL_RECIPIENT_DETAIL,
    });
    if (!row || row.userId !== userId) {
      throw new NotFoundException('No message with that id.');
    }
    return toEmailDetail(row);
  }

  async update(
    userId: string,
    recipientRowId: string,
    dto: UpdateEmailRecipientDto,
  ) {
    const row = await this.prisma.emailRecipient.findUnique({
      where: { id: recipientRowId },
    });
    if (!row || row.userId !== userId) {
      throw new NotFoundException('No message with that id.');
    }
    const updated = await this.prisma.emailRecipient.update({
      where: { id: recipientRowId },
      data: {
        folder: dto.folder,
        isRead: dto.isRead,
        isStarred: dto.isStarred,
      },
      ...EMAIL_RECIPIENT_WITH_SENDER,
    });
    return toEmailListItem(updated);
  }

  async remove(userId: string, recipientRowId: string) {
    const row = await this.prisma.emailRecipient.findUnique({
      where: { id: recipientRowId },
    });
    if (!row || row.userId !== userId) {
      throw new NotFoundException('No message with that id.');
    }
    // Only this recipient's own mailbox row is deleted — never the shared
    // Email row or any other recipient's/the sender's copy of it.
    await this.prisma.emailRecipient.delete({ where: { id: recipientRowId } });
    return { id: recipientRowId };
  }

  async emptyTrash(userId: string) {
    const result = await this.prisma.emailRecipient.deleteMany({
      where: { userId, folder: EmailFolder.TRASH },
    });
    return { deletedCount: result.count };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.emailRecipient.count({
      where: { userId, folder: EmailFolder.INBOX, isRead: false },
    });
  }

  async saveDraft(userId: string, dto: SaveDraftDto) {
    const toNdyIds = Array.from(new Set(dto.recipientNdyIds ?? []));
    const ccNdyIds = Array.from(new Set(dto.ccNdyIds ?? [])).filter(
      (id) => !toNdyIds.includes(id),
    );
    const attachmentIds = Array.from(new Set(dto.attachmentDriveFileIds ?? []));
    await this.validateAttachments(userId, attachmentIds);

    if (dto.draftId) {
      const existing = await this.prisma.emailRecipient.findUnique({
        where: { id: dto.draftId },
      });
      if (
        !existing ||
        existing.userId !== userId ||
        existing.folder !== EmailFolder.DRAFTS
      ) {
        throw new NotFoundException('No draft with that id.');
      }

      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.email.update({
          where: { id: existing.emailId },
          data: {
            subject: dto.subject ?? '',
            body: dto.body ?? '',
          },
        });
        await tx.emailAttachment.deleteMany({
          where: { emailId: existing.emailId },
        });
        if (attachmentIds.length > 0) {
          await tx.emailAttachment.createMany({
            data: attachmentIds.map((driveFileId) => ({
              emailId: existing.emailId,
              driveFileId,
            })),
          });
        }
        return tx.emailRecipient.update({
          where: { id: existing.id },
          data: { draftToNdyIds: toNdyIds, draftCcNdyIds: ccNdyIds },
          ...EMAIL_RECIPIENT_WITH_SENDER,
        });
      });
      return toEmailListItem(updated);
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const email = await tx.email.create({
        data: {
          senderId: userId,
          subject: dto.subject ?? '',
          body: dto.body ?? '',
        },
      });
      if (attachmentIds.length > 0) {
        await tx.emailAttachment.createMany({
          data: attachmentIds.map((driveFileId) => ({
            emailId: email.id,
            driveFileId,
          })),
        });
      }
      return tx.emailRecipient.create({
        data: {
          emailId: email.id,
          userId,
          folder: EmailFolder.DRAFTS,
          isRead: true,
          draftToNdyIds: toNdyIds,
          draftCcNdyIds: ccNdyIds,
        },
        ...EMAIL_RECIPIENT_WITH_SENDER,
      });
    });
    return toEmailListItem(created);
  }

  async sendDraft(userId: string, draftRowId: string, dto: SendDraftDto) {
    const existing = await this.prisma.emailRecipient.findUnique({
      where: { id: draftRowId },
      include: { email: true },
    });
    if (
      !existing ||
      existing.userId !== userId ||
      existing.folder !== EmailFolder.DRAFTS
    ) {
      throw new NotFoundException('No draft with that id.');
    }

    const toNdyIds = Array.from(
      new Set(dto.recipientNdyIds ?? existing.draftToNdyIds),
    );
    if (toNdyIds.length === 0) {
      throw new BadRequestException('At least one recipient is required.');
    }
    const ccNdyIds = Array.from(
      new Set(dto.ccNdyIds ?? existing.draftCcNdyIds),
    ).filter((id) => !toNdyIds.includes(id));
    const subject = dto.subject ?? existing.email.subject;
    const body = dto.body ?? existing.email.body;

    const toRecipients = await this.resolveRecipients(toNdyIds);
    const ccRecipients = await this.resolveRecipients(ccNdyIds);

    let attachmentIds: string[];
    if (dto.attachmentDriveFileIds) {
      attachmentIds = Array.from(new Set(dto.attachmentDriveFileIds));
      await this.validateAttachments(userId, attachmentIds);
    } else {
      const existingAttachments = await this.prisma.emailAttachment.findMany({
        where: { emailId: existing.emailId },
        select: { driveFileId: true },
      });
      attachmentIds = existingAttachments.map((a) => a.driveFileId);
    }

    // Deletes the draft row first so the send below creates a fresh
    // Email + SENT/INBOX rows rather than repurposing the draft's Email
    // (keeps the "one Email row = one delivered message" invariant simple).
    await this.prisma.$transaction(async (tx) => {
      await tx.emailAttachment.deleteMany({
        where: { emailId: existing.emailId },
      });
      await tx.email.delete({ where: { id: existing.emailId } });
    });

    return this.deliver(userId, {
      subject,
      body,
      toRecipients,
      ccRecipients,
      attachmentIds,
    });
  }
}

function toEmailListItem(row: EmailRecipientWithSender) {
  return {
    id: row.id,
    emailId: row.emailId,
    subject: row.email.subject,
    body: row.email.body,
    category: row.email.category,
    folder: row.folder,
    isRead: row.isRead,
    isStarred: row.isStarred,
    isCc: row.isCc,
    createdAt: row.createdAt,
    sender: {
      ndyId: row.email.sender.ndyId,
      fullName: row.email.sender.fullName,
      profilePhotoUrl: row.email.sender.profilePhotoUrl,
    },
    draftTo: row.draftToNdyIds,
    draftCc: row.draftCcNdyIds,
  };
}

function toEmailDetail(row: EmailRecipientDetail) {
  return {
    ...toEmailListItem(row),
    recipients: row.email.recipients
      .filter((r) => r.folder !== EmailFolder.SENT)
      .map((r) => ({
        ndyId: r.user.ndyId,
        fullName: r.user.fullName,
        isCc: r.isCc,
      })),
    attachments: row.email.attachments.map((a) => ({
      id: a.id,
      driveFileId: a.driveFileId,
      name: a.driveFile.name,
      mimeType: a.driveFile.mimeType,
      sizeBytes: a.driveFile.sizeBytes,
      url: a.driveFile.url,
    })),
  };
}
