import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/guards/jwt-auth.guard';
import { NdyspaceContactsService } from './ndyspace-contacts.service';
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto';

@UseGuards(JwtAuthGuard)
@Controller('ndyspace/contacts')
export class NdyspaceContactsController {
  constructor(private readonly contacts: NdyspaceContactsService) {}

  @Post()
  create(
    @Body() dto: CreateContactDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.contacts.create(user.sub, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.contacts.list(user.sub);
  }

  @Get(':id')
  getOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.contacts.getOne(user.sub, id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.contacts.update(user.sub, id, dto);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.contacts.remove(user.sub, id);
  }
}
