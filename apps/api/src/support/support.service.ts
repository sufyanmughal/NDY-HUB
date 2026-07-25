import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { ReplySupportTicketDto } from './dto/reply-support-ticket.dto';

export interface SupportActor {
  id: string;
  ndyId: string;
  ip?: string;
}

/**
 * Deliberately one message in, one admin reply back — see the schema
 * comment on SupportTicket for why this isn't a full threaded ticketing
 * system yet.
 */
@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  async createTicket(userId: string, dto: CreateSupportTicketDto) {
    return this.prisma.supportTicket.create({
      data: { userId, subject: dto.subject, message: dto.message },
    });
  }

  async listMyTickets(userId: string) {
    return this.prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 'OPEN' sorts before 'RESOLVED' alphabetically, which conveniently
  // means status-ascending puts what actually needs attention first
  // without needing a raw-SQL CASE expression for it.
  async adminListTickets() {
    return this.prisma.supportTicket.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: { user: { select: { ndyId: true, email: true } } },
    });
  }

  async replyToTicket(
    actor: SupportActor,
    ticketId: string,
    dto: ReplySupportTicketDto,
  ) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) throw new NotFoundException('No support ticket with that id.');

    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        adminReply: dto.reply,
        status: 'RESOLVED',
        repliedAt: new Date(),
      },
    });

    // Same audit shape AdminService writes for every other privileged
    // action — support replies are a real action taken on a user's behalf,
    // not exempt just because they're not user/role management.
    await this.prisma.auditLogEntry.create({
      data: {
        adminUserId: actor.id,
        adminNdyId: actor.ndyId,
        action: 'support.ticket.reply',
        targetUserId: ticket.userId,
        newValue: { ticketId, subject: ticket.subject },
        ip: actor.ip,
      },
    });

    return updated;
  }
}
