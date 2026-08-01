import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { put, del } from '@vercel/blob';
import { writeFile, unlink } from 'fs/promises';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import { PROFILE_PHOTOS_DIR } from './upload-dir.util';

const BLOB_PATHNAME_PREFIX = 'profile-photos/';
const LOCAL_URL_MARKER = '/uploads/profile-photos/';

/**
 * Local disk was never durable on Vercel — every serverless invocation can
 * land on a different instance (or the same one with a wiped /tmp), so a
 * photo saved by the upload request was frequently just gone by the time a
 * later request tried to serve it back, rendering as a broken image. Vercel
 * Blob gives a real, permanent public URL instead. Kept local-disk as the
 * dev-mode path (via upload-dir.util.ts's own VERCEL check) since it works
 * fine there and doesn't need a Blob store just to run `npm run dev`.
 */
@Injectable()
export class PhotoStorageService {
  constructor(private readonly config: ConfigService) {}

  async save(file: Express.Multer.File): Promise<string> {
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
      return blob.url;
    }

    await writeFile(join(PROFILE_PHOTOS_DIR, filename), file.buffer);
    const apiUrl =
      this.config.get<string>('API_URL') ??
      `http://localhost:${this.config.get('PORT') ?? 3000}`;
    return `${apiUrl}${LOCAL_URL_MARKER}${filename}`;
  }

  async deleteByUrl(url: string | null): Promise<void> {
    if (!url) return;

    if (url.includes(LOCAL_URL_MARKER)) {
      const filename = url.split(LOCAL_URL_MARKER)[1];
      if (!filename) return;
      await unlink(join(PROFILE_PHOTOS_DIR, filename)).catch(() => {
        /* best-effort — a stray file left on disk is harmless */
      });
      return;
    }

    // Anything else is assumed to be a Blob URL from a previous upload —
    // best-effort here too, a stray blob left behind costs storage but
    // breaks nothing.
    await del(url).catch(() => {});
  }
}
