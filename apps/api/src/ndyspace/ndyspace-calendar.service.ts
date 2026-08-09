import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCalendarEventDto,
  UpdateCalendarEventDto,
} from './dto/calendar.dto';

@Injectable()
export class NdyspaceCalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateCalendarEventDto) {
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    if (endAt < startAt) {
      throw new BadRequestException('endAt must not be before startAt.');
    }
    return this.prisma.calendarEvent.create({
      data: {
        userId,
        title: dto.title,
        description: dto.description,
        startAt,
        endAt,
        color: dto.color ?? '#4f7cff',
        attendeeEmails: dto.attendeeEmails ?? [],
      },
    });
  }

  /** Month-view grid data — [from, to) is the calling page's own concern
   * (typically the full weeks spanning the visible month), not fixed here. */
  async listInRange(userId: string, from: Date, to: Date) {
    return this.prisma.calendarEvent.findMany({
      where: { userId, startAt: { gte: from, lt: to } },
      orderBy: { startAt: 'asc' },
    });
  }

  /** Upcoming events from now — backs the Overview summary subtext
   * ("N upcoming events") and the dashboard Calendar widget's timed list. */
  async listUpcoming(userId: string, take: number) {
    return this.prisma.calendarEvent.findMany({
      where: { userId, startAt: { gte: new Date() } },
      orderBy: { startAt: 'asc' },
      take,
    });
  }

  async getOne(userId: string, id: string) {
    const event = await this.prisma.calendarEvent.findUnique({ where: { id } });
    if (!event || event.userId !== userId) {
      throw new NotFoundException('No event with that id.');
    }
    return event;
  }

  async update(userId: string, id: string, dto: UpdateCalendarEventDto) {
    await this.getOne(userId, id);
    const startAt = dto.startAt ? new Date(dto.startAt) : undefined;
    const endAt = dto.endAt ? new Date(dto.endAt) : undefined;
    if (startAt && endAt && endAt < startAt) {
      throw new BadRequestException('endAt must not be before startAt.');
    }
    return this.prisma.calendarEvent.update({
      where: { id },
      data: { ...dto, startAt, endAt },
    });
  }

  async remove(userId: string, id: string) {
    await this.getOne(userId, id);
    await this.prisma.calendarEvent.delete({ where: { id } });
    return { id };
  }
}
