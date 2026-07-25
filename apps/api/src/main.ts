import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { mkdirSync } from 'fs';
import { AppModule } from './app.module';
import { UPLOADS_ROOT_DIR, PROFILE_PHOTOS_DIR } from './common/upload-dir.util';

async function bootstrap() {
  // multer's diskStorage won't create its destination directory itself —
  // needs to exist before the first upload request lands.
  mkdirSync(PROFILE_PHOTOS_DIR, { recursive: true });

  // rawBody: true keeps the exact request bytes around on req.rawBody
  // alongside the parsed body — CryndyWebhookSignatureGuard verifies the
  // HMAC signature against those raw bytes, not the re-serialized JSON,
  // since the two aren't guaranteed to match byte-for-byte.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  // enableCors() has to come before useStaticAssets() — Express runs
  // middleware in registration order, and static-file serving ends the
  // response before anything registered after it ever runs. Registered in
  // the other order (as this originally was), every normal API route got
  // CORS headers but /uploads/* never did — invisible for an <img> tag
  // (which doesn't enforce CORS) and completely broken for a cross-origin
  // fetch() of the same URL, e.g. to embed a photo in a client-generated PDF.
  app.enableCors({
    origin: process.env.WEB_APP_URL ?? 'http://localhost:3001',
    credentials: true,
  });
  app.useStaticAssets(UPLOADS_ROOT_DIR, { prefix: '/uploads/' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
