import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { TaskPriority, TaskStatus } from '@prisma/client';

@Injectable()
export class NdyspaceTasksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateTaskDto) {
    return this.prisma.task.create({
      data: {
        userId,
        title: dto.title,
        description: dto.description,
        priority: (dto.priority as TaskPriority) ?? TaskPriority.MEDIUM,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
      },
    });
  }

  async listByStatus(userId: string, status: TaskStatus) {
    return this.prisma.task.findMany({
      where: { userId, status },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async listAll(userId: string) {
    return this.prisma.task.findMany({
      where: { userId },
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getOne(userId: string, id: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task || task.userId !== userId) {
      throw new NotFoundException('No task with that id.');
    }
    return task;
  }

  async update(userId: string, id: string, dto: UpdateTaskDto) {
    await this.getOne(userId, id);
    return this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        status: dto.status,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        completedAt:
          dto.status === 'COMPLETED'
            ? new Date()
            : dto.status === 'OPEN'
              ? null
              : undefined,
      },
    });
  }

  async setComplete(userId: string, id: string, complete: boolean) {
    await this.getOne(userId, id);
    return this.prisma.task.update({
      where: { id },
      data: {
        status: complete ? TaskStatus.COMPLETED : TaskStatus.OPEN,
        completedAt: complete ? new Date() : null,
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.getOne(userId, id);
    await this.prisma.task.delete({ where: { id } });
    return { id };
  }
}
