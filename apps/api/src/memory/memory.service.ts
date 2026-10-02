import { Injectable, NotFoundException } from '@nestjs/common';
import { UserMemory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMemoryDto, UpdateMemoryDto } from './dto/memory.dto';

/**
 * NDYRA personal memory — user-controlled preferences/goals, explicitly
 * separate from PassportClaim (verified facts) and from anything
 * conversational/ephemeral. A plain CRUD service, same owner-scoped
 * getOwned()-then-404 shape as every other owned resource in this codebase
 * (e.g. NdyqrService) — a memory belongs to exactly one user, never shared,
 * never readable by another user's session.
 *
 * NDYCORE (once built) reads this service the same way any other consumer
 * would — through the API, with the member's own consent, never a direct
 * database read. No AI/NDYCORE-specific method exists here on purpose.
 */
@Injectable()
export class MemoryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateMemoryDto): Promise<UserMemory> {
    return this.prisma.userMemory.create({
      data: {
        userId,
        type: dto.type,
        content: dto.content,
        source: dto.source,
      },
    });
  }

  async listForUser(userId: string): Promise<UserMemory[]> {
    return this.prisma.userMemory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOwned(userId: string, id: string): Promise<UserMemory> {
    const memory = await this.prisma.userMemory.findUnique({ where: { id } });
    if (!memory || memory.userId !== userId) {
      throw new NotFoundException('No memory with that id.');
    }
    return memory;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateMemoryDto,
  ): Promise<UserMemory> {
    await this.getOwned(userId, id);
    return this.prisma.userMemory.update({
      where: { id },
      data: { content: dto.content },
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.getOwned(userId, id);
    await this.prisma.userMemory.delete({ where: { id } });
  }
}
