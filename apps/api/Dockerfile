# Build context is the repo root (npm workspaces need every package.json
# present to resolve correctly) — see docker-compose.prod.yml.

FROM node:20-alpine AS builder
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
# apps/api's postinstall runs `prisma generate`, which needs the schema
# file present — copied ahead of `npm ci` (not just apps/api's full
# source) so this layer still only invalidates on schema/package changes,
# not on every source edit.
COPY apps/api/prisma apps/api/prisma
RUN npm ci

COPY apps/api apps/api
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN npm run build --workspace apps/api

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /repo/apps/api/dist ./dist
COPY --from=builder /repo/apps/api/prisma ./prisma
COPY --from=builder /repo/apps/api/package.json ./package.json
COPY --from=builder /repo/node_modules ./node_modules

RUN mkdir -p /app/uploads
EXPOSE 3000
CMD ["node", "dist/main"]
