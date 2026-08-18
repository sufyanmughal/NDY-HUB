# Build context is the repo root — see docker-compose.prod.yml.

FROM node:20-alpine AS builder
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
# npm workspaces runs every workspace's postinstall on a root `npm ci`,
# including apps/api's `prisma generate` — needs its schema present even
# though this image only builds apps/web. See apps/api/Dockerfile's own
# copy of this comment for the matching fix there.
COPY apps/api/prisma apps/api/prisma
RUN npm ci

COPY apps/web apps/web
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
# NEXT_PUBLIC_SENTRY_DSN/ENVIRONMENT get inlined into the client bundle at
# build time (same as NEXT_PUBLIC_API_URL above) — genuinely inert if
# unset, see src/instrumentation-client.ts. SENTRY_ORG/PROJECT/AUTH_TOKEN
# are build-only (withSentryConfig's source-map upload step) and
# deliberately never ENV'd — no reason for them to persist as environment
# variables in the final image layers once the build step that needs them
# is done.
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ARG SENTRY_AUTH_TOKEN
ENV NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN}
ENV NEXT_PUBLIC_SENTRY_ENVIRONMENT=${NEXT_PUBLIC_SENTRY_ENVIRONMENT}
RUN npm run build --workspace apps/web

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

# next.config.ts sets output:"standalone" — .next/standalone is a
# self-contained server with only the node_modules it actually needs, so
# the runtime image doesn't carry the full workspace node_modules.
COPY --from=builder /repo/apps/web/.next/standalone ./
COPY --from=builder /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /repo/apps/web/public ./apps/web/public

EXPOSE 3001
CMD ["node", "apps/web/server.js"]
