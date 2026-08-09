import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookmarkDto } from './dto/bookmark.dto';

@Injectable()
export class NdyspaceBookmarksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateBookmarkDto) {
    return this.prisma.bookmark.create({ data: { userId, ...dto } });
  }

  async list(userId: string) {
    return this.prisma.bookmark.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(userId: string, id: string) {
    const bookmark = await this.prisma.bookmark.findUnique({ where: { id } });
    if (!bookmark || bookmark.userId !== userId) {
      throw new NotFoundException('No bookmark with that id.');
    }
    await this.prisma.bookmark.delete({ where: { id } });
    return { id };
  }
}
