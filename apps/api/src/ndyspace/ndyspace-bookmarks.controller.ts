import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/guards/jwt-auth.guard';
import { NdyspaceBookmarksService } from './ndyspace-bookmarks.service';
import { CreateBookmarkDto } from './dto/bookmark.dto';

@UseGuards(JwtAuthGuard)
@Controller('ndyspace/bookmarks')
export class NdyspaceBookmarksController {
  constructor(private readonly bookmarks: NdyspaceBookmarksService) {}

  @Post()
  create(
    @Body() dto: CreateBookmarkDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.bookmarks.create(user.sub, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.bookmarks.list(user.sub);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.bookmarks.remove(user.sub, id);
  }
}
