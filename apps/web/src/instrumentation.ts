// Next.js App Router's server-side instrumentation entrypoint — runs once
// per server/edge runtime at boot, before any request handling. Per the
// client's answer #18 ("pick a sensible default"), this is genuinely inert
// until NEXT_PUBLIC_SENTRY_DSN is set: Sentry.init() with dsn: undefined is
// a documented no-op, matching the same "architecture ready, not activated
// until configured" pattern used for the API (see apps/api/src/instrument.ts)
// and off-server backups (see deploy/backup.sh).
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT ?? "production",
      tracesSampleRate: 0.1,
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT ?? "production",
      tracesSampleRate: 0.1,
    });
  }
}

// Reports errors from React Server Components / server actions that Next's
// own error boundary machinery would otherwise only log locally.
export const onRequestError = Sentry.captureRequestError;
