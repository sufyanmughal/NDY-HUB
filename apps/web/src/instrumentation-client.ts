// Browser-side Sentry init — Next.js App Router auto-loads this file (the
// `instrumentation-client.ts` filename is a Next.js convention, not
// Sentry-specific) before any client code runs. NEXT_PUBLIC_ prefix is
// required since this executes in the browser bundle — see
// deploy/README.md/.env.prod.example for where the real DSN goes once a
// Sentry project exists. Inert (no-op) until then, same as
// src/instrumentation.ts.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? "production",
  tracesSampleRate: 0.1,
  // Session Replay is opt-in and not enabled here — it captures DOM
  // snapshots on error, which is a meaningfully different privacy/cost
  // trade-off than plain error reporting and deserves its own explicit
  // decision later, not a default-on setting bundled into this pass.
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
