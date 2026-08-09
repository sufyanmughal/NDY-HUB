import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/guards/jwt-auth.guard';
import { NdyspaceDriveService } from './ndyspace-drive.service';
import { CreateDriveFolderDto, MoveDriveFileDto } from './dto/drive.dto';

// Deliberately generous (100MB) compared to the 5MB profile-photo limit —
// Drive is meant to hold general documents, not just images. Still well
// under the flat 5GB per-user quota enforced in NdyspaceDriveService.
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;

@UseGuards(JwtAuthGuard)
@Controller('ndyspace/drive')
export class NdyspaceDriveController {
  constructor(private readonly drive: NdyspaceDriveService) {}

  @Post('folders')
  createFolder(
    @Body() dto: CreateDriveFolderDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.drive.createFolder(user.sub, dto);
  }

  @Get('folders')
  listFolders(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.drive.listFolders(user.sub);
  }

  @Delete('folders/:id')
  deleteFolder(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.drive.deleteFolder(user.sub, id);
  }

  @Post('files')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('folderId') folderId: string | undefined,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    if (!file) {
      throw new BadRequestException('No file was uploaded.');
    }
    const usage = await this.drive.getStorageUsage(user.sub);
    this.drive.assertWithinQuota(usage.usedBytes, file.size);
    return this.drive.uploadFile(user.sub, file, folderId);
  }

  @Get('files')
  listFiles(
    @Query('folderId') folderId: string | undefined,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.drive.listFiles(user.sub, folderId);
  }

  @Get('files/recent')
  listRecent(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.drive.listRecentFiles(user.sub);
  }

  @Get('files/:id')
  getFile(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.drive.getOne(user.sub, id);
  }

  @Patch('files/:id/move')
  moveFile(
    @Param('id') id: string,
    @Body() dto: MoveDriveFileDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.drive.moveFile(user.sub, id, dto.folderId);
  }

  @Delete('files/:id')
  deleteFile(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.drive.deleteFile(user.sub, id);
  }

  @Get('storage')
  getStorage(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.drive.getStorageUsage(user.sub);
  }
}
