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

  /** The control centre's own view — shows disabled memories too, so a
   * member can find and re-enable one. Never the shape a consumer (e.g.
   * NDYCORE) should read; see activeForUser() for that. */
  async listForUser(userId: string): Promise<UserMemory[]> {
    return this.prisma.userMemory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** What a consumer reading on the member's behalf should use — disabled
   * memories are withheld, not just hidden in a UI. No route calls this
   * yet (NDYCORE has no server-to-server memory-read endpoint today —
   * see context-broker-ndycore-router-design.md §6), but the method
   * exists now so that endpoint, when built, can't accidentally reuse
   * listForUser() and leak disabled memories into a model prompt. */
  async activeForUser(userId: string): Promise<UserMemory[]> {
    return this.prisma.userMemory.findMany({
      where: { userId, enabled: true },
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

  async setEnabled(
    userId: string,
    id: string,
    enabled: boolean,
  ): Promise<UserMemory> {
    await this.getOwned(userId, id);
    return this.prisma.userMemory.update({
      where: { id },
      data: { enabled },
    });
  }
}
