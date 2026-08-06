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
# npm workspaces nests a dependency under apps/api/node_modules instead of
# hoisting it to root whenever a conflicting version exists elsewhere in
# the tree (e.g. apps/web wants a different nanoid range) — root
# node_modules alone isn't guaranteed to have everything apps/api needs,
# so merge the nested one on top (COPY can't merge directories itself,
# hence landing it at a temp path first). Alpine's `cp` is busybox, not
# GNU coreutils: `cp -rn src/. dest/` silently skips the ENTIRE copy the
# moment any single top-level entry already exists at the destination —
# it doesn't merge per-file like GNU cp does — so this loops one
# top-level entry at a time instead, letting -n's no-clobber behavior
# apply per-package (new packages get added, already-hoisted ones are
# correctly left alone).
COPY --from=builder /repo/apps/api/node_modules /tmp/api_node_modules
RUN for item in /tmp/api_node_modules/*/ /tmp/api_node_modules/.[!.]*/; do \
      [ -e "$item" ] && cp -rn "$item" ./node_modules/ 2>/dev/null; \
    done; \
    rm -rf /tmp/api_node_modules

RUN mkdir -p /app/uploads
EXPOSE 3000
CMD ["node", "dist/main"]
