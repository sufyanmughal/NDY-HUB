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
import { NdyspaceTasksService } from './ndyspace-tasks.service';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';

@UseGuards(JwtAuthGuard)
@Controller('ndyspace/tasks')
export class NdyspaceTasksController {
  constructor(private readonly tasks: NdyspaceTasksService) {}

  @Post()
  create(
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.tasks.create(user.sub, dto);
  }

  // status=OPEN|COMPLETED filters to one tab (§2.10's My Tasks/Completed);
  // omitted returns everything, grouped OPEN-first.
  @Get()
  list(
    @Query('status') status: string | undefined,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    if (status === 'OPEN' || status === 'COMPLETED') {
      return this.tasks.listByStatus(user.sub, status);
    }
    return this.tasks.listAll(user.sub);
  }

  @Get(':id')
  getOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.tasks.getOne(user.sub, id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.tasks.update(user.sub, id, dto);
  }

  @Patch(':id/complete')
  complete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.tasks.setComplete(user.sub, id, true);
  }

  @Patch(':id/reopen')
  reopen(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.tasks.setComplete(user.sub, id, false);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.tasks.remove(user.sub, id);
  }
}
