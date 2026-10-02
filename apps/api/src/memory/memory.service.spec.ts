import { NotFoundException } from '@nestjs/common';
import { UserMemoryType } from '@prisma/client';
import { MemoryService } from './memory.service';
import { PrismaService } from '../prisma/prisma.service';

function makePrisma() {
  return {
    userMemory: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
}

describe('MemoryService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: MemoryService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new MemoryService(prisma as unknown as PrismaService);
  });

  it('creates a memory scoped to the caller', async () => {
    prisma.userMemory.create.mockResolvedValue({ id: 'm1' });
    await service.create('user-1', {
      type: UserMemoryType.PREFERENCE,
      content: 'prefers window seats',
    });
    expect(prisma.userMemory.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        type: UserMemoryType.PREFERENCE,
        content: 'prefers window seats',
        source: undefined,
      },
    });
  });

  it('lists only the caller\'s own memories, newest first', async () => {
    prisma.userMemory.findMany.mockResolvedValue([]);
    await service.listForUser('user-1');
    expect(prisma.userMemory.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('getOwned 404s on a memory belonging to another user', async () => {
    prisma.userMemory.findUnique.mockResolvedValue({
      id: 'm1',
      userId: 'someone-else',
    });
    await expect(service.getOwned('user-1', 'm1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('getOwned 404s on a nonexistent memory', async () => {
    prisma.userMemory.findUnique.mockResolvedValue(null);
    await expect(service.getOwned('user-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('update rejects editing another user\'s memory before touching the row', async () => {
    prisma.userMemory.findUnique.mockResolvedValue({
      id: 'm1',
      userId: 'someone-else',
    });
    await expect(
      service.update('user-1', 'm1', { content: 'new content' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.userMemory.update).not.toHaveBeenCalled();
  });

  it('remove rejects deleting another user\'s memory', async () => {
    prisma.userMemory.findUnique.mockResolvedValue({
      id: 'm1',
      userId: 'someone-else',
    });
    await expect(service.remove('user-1', 'm1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.userMemory.delete).not.toHaveBeenCalled();
  });

  it('update succeeds for the owner', async () => {
    prisma.userMemory.findUnique.mockResolvedValue({
      id: 'm1',
      userId: 'user-1',
    });
    prisma.userMemory.update.mockResolvedValue({ id: 'm1' });
    await service.update('user-1', 'm1', { content: 'updated' });
    expect(prisma.userMemory.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { content: 'updated' },
    });
  });
});
