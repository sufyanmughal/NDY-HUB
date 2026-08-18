// Must be the literal first import — see instrument.ts's own comment for
// why (Sentry has to patch Node's module loader before anything else
// requires the modules it instruments).
import './instrument';

import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SentryGlobalFilter } from '@sentry/nestjs/setup';
import { mkdirSync } from 'fs';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import {
  UPLOADS_ROOT_DIR,
  PROFILE_PHOTOS_DIR,
  DRIVE_FILES_DIR,
} from './common/upload-dir.util';

async function bootstrap() {
  // multer's diskStorage won't create its destination directory itself —
  // needs to exist before the first upload request lands.
  mkdirSync(PROFILE_PHOTOS_DIR, { recursive: true });
  mkdirSync(DRIVE_FILES_DIR, { recursive: true });

  // rawBody: true keeps the exact request bytes around on req.rawBody
  // alongside the parsed body — CryndyWebhookSignatureGuard verifies the
  // HMAC signature against those raw bytes, not the re-serialized JSON,
  // since the two aren't guaranteed to match byte-for-byte.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  // Reports unhandled exceptions to Sentry (a documented no-op if
  // SENTRY_DSN is unset, see instrument.ts) before NestJS's own default
  // exception handling — registered first/globally per Sentry's own
  // NestJS setup requirement, since it needs to see the exception before
  // anything else has a chance to transform or swallow it.
  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new SentryGlobalFilter(httpAdapter));
  // enableCors() has to come before useStaticAssets() — Express runs
  // middleware in registration order, and static-file serving ends the
  // response before anything registered after it ever runs. Registered in
  // the other order (as this originally was), every normal API route got
  // CORS headers but /uploads/* never did — invisible for an <img> tag
  // (which doesn't enforce CORS) and completely broken for a cross-origin
  // fetch() of the same URL, e.g. to embed a photo in a client-generated PDF.
  //
  // A Vercel project answers on several origins at once — the custom alias
  // (WEB_APP_URL), the team-scoped default, and a separately-generated
  // "production" alias — and none of them are derivable from the others, so
  // a single-origin check here rejects real visitors depending on which
  // link they landed on. Explicitly listing the known stable ones (plus
  // local dev) rather than pattern-matching *.vercel.app, which would also
  // accept requests from unrelated Vercel-hosted sites.
  const allowedOrigins = [
    process.env.WEB_APP_URL ?? 'http://localhost:3001',
    'https://ndy-hub-web.vercel.app',
    'https://web-six-eta-15.vercel.app',
    'https://web-ndy-hub.vercel.app',
    // Partner sites integrating directly against this API (see
    // docs/WEBSITE-INTEGRATION.md) — each addition here is a real access
    // grant, not a formality, since credentials: true means this also
    // controls who can receive the httpOnly session cookies.
    'https://cryndy-nextjs.vercel.app',
    'https://ndjoyit-landing.vercel.app',
  ];
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} is not allowed by CORS.`));
      }
    },
    credentials: true,
  });
  // Reads the httpOnly session cookies (see auth/session-cookie.util.ts)
  // into req.cookies — JwtAuthGuard and the refresh endpoint both need
  // this to authenticate a browser request that carries no Bearer header.
  app.use(cookieParser());
  app.useStaticAssets(UPLOADS_ROOT_DIR, { prefix: '/uploads/' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
