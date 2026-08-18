// Sentry initialization — must run before any other import in the process
// (imported as the literal first line of main.ts, per Sentry's own NestJS
// setup requirement: it needs to patch Node's module loader before
// anything else is required). Per the client's answer #18 ("pick a
// sensible default"), this is genuinely inert until SENTRY_DSN is set in
// .env.prod — Sentry.init() with dsn: undefined is a documented no-op, not
// a crash, matching the "architecture ready, not activated until
// configured" pattern used for off-server backups (see deploy/backup.sh).
import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? 'production',
  integrations: [nodeProfilingIntegration()],
  // Conservative sampling for a 2vCPU/2GB droplet — full error capture
  // (that's the point), but not full performance-trace/profiling volume,
  // which has real CPU/memory cost on this box. Tune upward once real
  // traffic volume and server headroom are both known.
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1,
});
