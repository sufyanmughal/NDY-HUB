import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/guards/jwt-auth.guard';
import { NdyspaceMailService } from './ndyspace-mail.service';
import { SendEmailDto, UpdateEmailRecipientDto } from './dto/mail.dto';
import { EmailFolder } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('ndyspace/mail')
export class NdyspaceMailController {
  constructor(private readonly mail: NdyspaceMailService) {}

  @Post()
  send(
    @Body() dto: SendEmailDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.mail.send(user.sub, dto);
  }

  @Get()
  list(
    @Query('folder') folder: string | undefined,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    const validFolder = isEmailFolder(folder) ? folder : EmailFolder.INBOX;
    return this.mail.listFolder(user.sub, validFolder);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.mail.unreadCount(user.sub).then((count) => ({ count }));
  }

  @Get(':id')
  getOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.mail.getOne(user.sub, id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEmailRecipientDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.mail.update(user.sub, id, dto);
  }
}

function isEmailFolder(value: string | undefined): value is EmailFolder {
  return !!value && Object.values(EmailFolder).includes(value as EmailFolder);
}
