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
import { MemoryService } from './memory.service';
import { CreateMemoryDto, UpdateMemoryDto } from './dto/memory.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/guards/jwt-auth.guard';

/**
 * NDYHUB's "one clear control centre" for NDYRA memory — view/create/edit/
 * delete, fully owner-scoped. No endpoint here is reachable by anything
 * other than the member's own authenticated session.
 */
@UseGuards(JwtAuthGuard)
@Controller('memory')
export class MemoryController {
  constructor(private readonly memory: MemoryService) {}

  @Post()
  create(
    @Body() dto: CreateMemoryDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.memory.create(user.sub, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.memory.listForUser(user.sub);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMemoryDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.memory.update(user.sub, id, dto);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.memory.remove(user.sub, id);
  }

  @Patch(':id/disable')
  disable(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.memory.setEnabled(user.sub, id, false);
  }

  @Patch(':id/enable')
  enable(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.memory.setEnabled(user.sub, id, true);
  }
}
