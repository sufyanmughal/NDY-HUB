import {
  Body,
  Controller,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { NotificationCategory, NotificationChannel } from '@prisma/client';
import { InternalSecretGuard } from './guards/internal-secret.guard';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';

class InternalNotifyDto {
  // NDYMAIL (and any other external product) only ever knows a user's
  // public, permanent ndyId — never NDYHUB's internal User.id (that's
  // deliberately never exposed outside this codebase, see User.ndyCoreId's
  // own schema comment). This route resolves ndyId -> User.id itself.
  @IsString()
  @IsNotEmpty()
  ndyId!: string;

  @IsEnum(NotificationCategory)
  category!: NotificationCategory;

  // Only IN_APP and EMAIL make sense from an external caller today — SMS
  // has no generic transport yet (see NotificationService.deliver's doc
  // comment), so it's rejected here rather than silently accepted and
  // dropped.
  @IsIn([NotificationChannel.IN_APP, NotificationChannel.EMAIL])
  channel!: NotificationChannel;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsOptional()
  @IsString()
  linkUrl?: string;

  @IsOptional()
  @IsString()
  sourceEventId?: string;
}

/**
 * The external side of NotificationService.notify() — lets a trusted
 * external product (currently just NDYMAIL, standalone since the split,
 * own DB, no access to this one) push a real notification into a user's
 * NDYHUB Notification Center. Same InternalSecretGuard/x-internal-secret
 * pattern as POST /internal/backup-alert — this is also a
 * server-to-server call with no logged-in user session, so JwtAuthGuard
 * doesn't apply here either.
 */
@UseGuards(InternalSecretGuard)
@Controller('internal')
export class NotifyController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  @Post('notify')
  async notify(@Body() dto: InternalNotifyDto) {
    const user = await this.prisma.user.findUnique({
      where: { ndyId: dto.ndyId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('No user with that ndyId.');
    }

    const notification = await this.notifications.notify({
      userId: user.id,
      category: dto.category,
      channel: dto.channel,
      title: dto.title,
      body: dto.body,
      linkUrl: dto.linkUrl,
      sourceEventId: dto.sourceEventId,
    });
    return { delivered: true, id: notification.id };
  }
}
