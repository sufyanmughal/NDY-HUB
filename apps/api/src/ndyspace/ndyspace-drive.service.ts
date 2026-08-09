import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NdyspaceDriveStorageService } from './ndyspace-drive-storage.service';
import { CreateDriveFolderDto } from './dto/drive.dto';

const RECENT_FILES_LIMIT = 20;
// Flat per-user quota for this pass — no tiered/paid storage plan exists
// yet (that's a Membership-tier concern for a later phase), so everyone
// gets the same ceiling. 5GB matches nothing in particular except being a
// reasonable, clearly-labeled placeholder — see the Overview response's
// `quotaNote` field, which says as much to the frontend.
const STORAGE_QUOTA_BYTES = 5 * 1024 * 1024 * 1024;

@Injectable()
export class NdyspaceDriveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: NdyspaceDriveStorageService,
  ) {}

  async createFolder(userId: string, dto: CreateDriveFolderDto) {
    return this.prisma.driveFolder.create({ data: { userId, name: dto.name } });
  }

  async listFolders(userId: string) {
    const folders = await this.prisma.driveFolder.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { files: true } } },
    });
    return folders.map((f) => ({
      id: f.id,
      name: f.name,
      createdAt: f.createdAt,
      fileCount: f._count.files,
    }));
  }

  async deleteFolder(userId: string, folderId: string) {
    const folder = await this.prisma.driveFolder.findUnique({
      where: { id: folderId },
    });
    if (!folder || folder.userId !== userId) {
      throw new NotFoundException('No folder with that id.');
    }
    // Files inside fall back to root (folderId SET NULL by the FK) rather
    // than being deleted — deleting a folder shouldn't silently destroy
    // the files in it.
    await this.prisma.driveFolder.delete({ where: { id: folderId } });
    return { id: folderId };
  }

  async uploadFile(
    userId: string,
    file: Express.Multer.File,
    folderId?: string,
  ) {
    if (folderId) {
      const folder = await this.prisma.driveFolder.findUnique({
        where: { id: folderId },
      });
      if (!folder || folder.userId !== userId) {
        throw new NotFoundException('No folder with that id.');
      }
    }
    const { url } = await this.storage.save(file);
    return this.prisma.driveFile.create({
      data: {
        userId,
        folderId: folderId ?? null,
        name: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        url,
      },
    });
  }

  async listFiles(userId: string, folderId?: string) {
    return this.prisma.driveFile.findMany({
      where: { userId, folderId: folderId ?? undefined },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listRecentFiles(userId: string) {
    return this.prisma.driveFile.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: RECENT_FILES_LIMIT,
    });
  }

  async getOne(userId: string, id: string) {
    const file = await this.prisma.driveFile.findUnique({ where: { id } });
    if (!file || file.userId !== userId) {
      throw new NotFoundException('No file with that id.');
    }
    return file;
  }

  async moveFile(
    userId: string,
    id: string,
    folderId: string | null | undefined,
  ) {
    const file = await this.getOne(userId, id);
    if (folderId) {
      const folder = await this.prisma.driveFolder.findUnique({
        where: { id: folderId },
      });
      if (!folder || folder.userId !== userId) {
        throw new NotFoundException('No folder with that id.');
      }
    }
    return this.prisma.driveFile.update({
      where: { id: file.id },
      data: { folderId: folderId ?? null },
    });
  }

  async deleteFile(userId: string, id: string) {
    const file = await this.getOne(userId, id);
    await this.storage.deleteByUrl(file.url);
    await this.prisma.driveFile.delete({ where: { id: file.id } });
    return { id: file.id };
  }

  async getStorageUsage(userId: string) {
    const usage = await this.prisma.driveFile.aggregate({
      where: { userId },
      _sum: { sizeBytes: true },
    });
    const usedBytes = usage._sum.sizeBytes ?? 0;
    return {
      usedBytes,
      totalBytes: STORAGE_QUOTA_BYTES,
      percentUsed: Math.min(
        100,
        Math.round((usedBytes / STORAGE_QUOTA_BYTES) * 1000) / 10,
      ),
      quotaNote:
        'Flat placeholder quota for this pass — tiered storage plans are a later-phase concern.',
    };
  }

  assertWithinQuota(currentUsedBytes: number, incomingBytes: number) {
    if (currentUsedBytes + incomingBytes > STORAGE_QUOTA_BYTES) {
      throw new BadRequestException(
        'This upload would exceed your storage quota.',
      );
    }
  }
}
