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
