"use client";

// App Router's root-level error boundary — only this file can catch an
// error thrown by the root layout itself (a normal error.tsx can't, since
// it renders *inside* the layout it would need to replace). Reports to
// Sentry (a no-op until NEXT_PUBLIC_SENTRY_DSN is configured, see
// src/instrumentation-client.ts) and gives visitors something better than
// Next's unstyled default crash page.
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-100">
        <div className="max-w-md text-center px-6">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm text-neutral-400">
            NDY HUB hit an unexpected error. It&apos;s been reported and
            we&apos;re looking into it — try reloading the page.
          </p>
        </div>
      </body>
    </html>
  );
}
