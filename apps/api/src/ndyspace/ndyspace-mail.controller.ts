import {
  Body,
  Controller,
  Delete,
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
import {
  SaveDraftDto,
  SendDraftDto,
  SendEmailDto,
  UpdateEmailRecipientDto,
} from './dto/mail.dto';
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

  @Post('drafts')
  saveDraft(
    @Body() dto: SaveDraftDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.mail.saveDraft(user.sub, dto);
  }

  @Post('drafts/:id/send')
  sendDraft(
    @Param('id') id: string,
    @Body() dto: SendDraftDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.mail.sendDraft(user.sub, id, dto);
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

  @Post('trash/empty')
  emptyTrash(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.mail.emptyTrash(user.sub);
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

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.mail.remove(user.sub, id);
  }
}

function isEmailFolder(value: string | undefined): value is EmailFolder {
  return !!value && Object.values(EmailFolder).includes(value as EmailFolder);
}
