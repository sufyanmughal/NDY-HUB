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
  app.useStaticAssets(UPLOADS_ROOT_DIR, { prefix: '/uploads/' });
  app.enableCors({
    origin: process.env.WEB_APP_URL ?? 'http://localhost:3001',
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
