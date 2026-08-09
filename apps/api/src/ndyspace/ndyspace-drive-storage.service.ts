import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { put, del } from '@vercel/blob';
import { writeFile, unlink } from 'fs/promises';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import { DRIVE_FILES_DIR } from '../common/upload-dir.util';

const BLOB_PATHNAME_PREFIX = 'drive-files/';
const LOCAL_URL_MARKER = '/uploads/drive-files/';

/**
 * The exact same Vercel Blob (prod) / local-disk (dev) abstraction as
 * PhotoStorageService — reused rather than reinvented, per the NDYSPACE
 * build brief. The only difference is the storage prefix/directory, since
 * Drive files and profile photos shouldn't share a folder.
 */
@Injectable()
export class NdyspaceDriveStorageService {
  constructor(private readonly config: ConfigService) {}

  async save(file: Express.Multer.File): Promise<{ url: string }> {
    const filename = `${randomUUID()}${extname(file.originalname).toLowerCase()}`;

    if (process.env.VERCEL) {
      const blob = await put(
        `${BLOB_PATHNAME_PREFIX}${filename}`,
        file.buffer,
        {
          access: 'public',
          contentType: file.mimetype,
        },
      );
      return { url: blob.url };
    }

    await writeFile(join(DRIVE_FILES_DIR, filename), file.buffer);
    const apiUrl =
      this.config.get<string>('API_URL') ??
      `http://localhost:${this.config.get('PORT') ?? 3000}`;
    return { url: `${apiUrl}${LOCAL_URL_MARKER}${filename}` };
  }

  async deleteByUrl(url: string | null): Promise<void> {
    if (!url) return;

    if (url.includes(LOCAL_URL_MARKER)) {
      const filename = url.split(LOCAL_URL_MARKER)[1];
      if (!filename) return;
      await unlink(join(DRIVE_FILES_DIR, filename)).catch(() => {
        /* best-effort — a stray file left on disk is harmless */
      });
      return;
    }

    await del(url).catch(() => {});
  }
}
