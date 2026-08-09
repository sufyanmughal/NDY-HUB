import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NdyspaceNotificationsService } from './ndyspace-notifications.service';
import { SendEmailDto, UpdateEmailRecipientDto } from './dto/mail.dto';
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

  async send(senderId: string, dto: SendEmailDto) {
    const uniqueNdyIds = Array.from(new Set(dto.recipientNdyIds));
    if (uniqueNdyIds.length === 0) {
      throw new BadRequestException('At least one recipient is required.');
    }

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

    const email = await this.prisma.$transaction(async (tx) => {
      const created = await tx.email.create({
        data: {
          senderId,
          subject: dto.subject,
          body: dto.body,
        },
      });

      await tx.emailRecipient.create({
        data: {
          emailId: created.id,
          userId: senderId,
          folder: EmailFolder.SENT,
          isRead: true,
        },
      });

      await tx.emailRecipient.createMany({
        data: recipients
          .filter((r) => r.id !== senderId) // sending to yourself doesn't need a second inbox copy
          .map((r) => ({
            emailId: created.id,
            userId: r.id,
            folder: EmailFolder.INBOX,
          })),
      });

      return created;
    });

    await Promise.all(
      recipients
        .filter((r) => r.id !== senderId)
        .map((r) =>
          this.notifications.create(
            r.id,
            'MAIL',
            `New message: "${dto.subject}"`,
          ),
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
      ...EMAIL_RECIPIENT_WITH_SENDER,
    });
    if (!row || row.userId !== userId) {
      throw new NotFoundException('No message with that id.');
    }
    return toEmailListItem(row);
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

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.emailRecipient.count({
      where: { userId, folder: EmailFolder.INBOX, isRead: false },
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
    createdAt: row.createdAt,
    sender: {
      ndyId: row.email.sender.ndyId,
      fullName: row.email.sender.fullName,
      profilePhotoUrl: row.email.sender.profilePhotoUrl,
    },
  };
}
