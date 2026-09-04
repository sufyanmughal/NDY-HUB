import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto';

@Injectable()
export class NdyspaceContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateContactDto) {
    return this.prisma.contact.create({ data: { userId, ...dto } });
  }

  async list(userId: string) {
    return this.prisma.contact.findMany({
      where: { userId },
      orderBy: { fullName: 'asc' },
    });
  }

  async listRecent(userId: string, take: number) {
    return this.prisma.contact.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  /** Contact.email-or-fullName match for a recipient autocomplete —
   * called by NDYMAIL's compose recipient picker over the shared
   * NDYHUB Contacts API (no separate contacts silo, per Teun's confirmed
   * direction). NDYMAIL calls this with the signed-in user's own
   * access_token, same as every other route on this controller — no new
   * auth needed. */
  async search(userId: string, query: string, take = 10) {
    if (!query.trim()) return [];
    return this.prisma.contact.findMany({
      where: {
        userId,
        OR: [
          { fullName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { fullName: 'asc' },
      take,
    });
  }

  async getOne(userId: string, id: string) {
    const contact = await this.prisma.contact.findUnique({ where: { id } });
    if (!contact || contact.userId !== userId) {
      throw new NotFoundException('No contact with that id.');
    }
    return contact;
  }

  async update(userId: string, id: string, dto: UpdateContactDto) {
    await this.getOne(userId, id);
    return this.prisma.contact.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    await this.getOne(userId, id);
    await this.prisma.contact.delete({ where: { id } });
    return { id };
  }
}
