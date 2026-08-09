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
import { NdyspaceNotesService } from './ndyspace-notes.service';
import { CreateNoteDto, UpdateNoteDto } from './dto/note.dto';

@UseGuards(JwtAuthGuard)
@Controller('ndyspace/notes')
export class NdyspaceNotesController {
  constructor(private readonly notes: NdyspaceNotesService) {}

  @Post()
  create(
    @Body() dto: CreateNoteDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.notes.create(user.sub, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.notes.list(user.sub);
  }

  @Get(':id')
  getOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.notes.getOne(user.sub, id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateNoteDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.notes.update(user.sub, id, dto);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.notes.remove(user.sub, id);
  }
}
