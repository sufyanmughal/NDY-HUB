import { join } from 'path';

/**
 * Local-disk uploads — there's no real object storage (S3) configured in
 * this environment, same gap as documented on DocumentsService. Unlike
 * documents (which can be regenerated on demand and don't need to be
 * "stored" at all), an uploaded photo genuinely has nothing to regenerate
 * from, so this is the minimal real implementation rather than a stub:
 * files actually land on disk and are actually served back. Swap this for
 * S3 (or equivalent) before this runs anywhere with more than one server
 * instance or an ephemeral filesystem — resolved via process.cwd() rather
 * than __dirname so it agrees with the app whether run via `nest start`
 * or `node dist/main`, both of which run with apps/api as the working
 * directory.
 */
export const UPLOADS_ROOT_DIR = join(process.cwd(), 'uploads');
export const PROFILE_PHOTOS_DIR = join(UPLOADS_ROOT_DIR, 'profile-photos');
