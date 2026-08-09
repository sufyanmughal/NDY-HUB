import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNoteDto, UpdateNoteDto } from './dto/note.dto';

@Injectable()
export class NdyspaceNotesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateNoteDto) {
    return this.prisma.note.create({
      data: { userId, title: dto.title, body: dto.body ?? '' },
    });
  }

  async list(userId: string) {
    return this.prisma.note.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getOne(userId: string, id: string) {
    const note = await this.prisma.note.findUnique({ where: { id } });
    if (!note || note.userId !== userId) {
      throw new NotFoundException('No note with that id.');
    }
    return note;
  }

  async update(userId: string, id: string, dto: UpdateNoteDto) {
    await this.getOne(userId, id);
    return this.prisma.note.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    await this.getOne(userId, id);
    await this.prisma.note.delete({ where: { id } });
    return { id };
  }
}
