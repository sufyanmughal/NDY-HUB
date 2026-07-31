# Deploying NDY HUB

## How it works

Every push to `main` on GitHub triggers `.github/workflows/deploy.yml`:
1. Builds the api and web Docker images and pushes them to GitHub Container
   Registry (`ghcr.io`).
2. SSHes into the Droplet, pulls the new images, restarts the containers,
   and runs `prisma migrate deploy`.

The Droplet itself never builds anything — it only pulls and runs
pre-built images, which is why a 4GB box is plenty even though `next
build` alone needs more than that to run comfortably.

## One-time setup

1. **Droplet**: Ubuntu 24.04, created with the deploy SSH key added during
   creation (see `.deploy/ssh/`).
2. **Bootstrap it**: `ssh root@<droplet-ip>` then run
   `bash deploy/server-setup.sh <git-repo-url>`.
3. **Fill in `~/ndy-hub/.env.prod`** on the server (copied from
   `.env.prod.example`) — real secrets, `WEB_APP_URL`/`API_URL` set to the
   Droplet's IP, and `IMAGE_API`/`IMAGE_WEB` set to
   `ghcr.io/<github-owner>/ndy-hub-api:latest` /
   `ghcr.io/<github-owner>/ndy-hub-web:latest`.
4. **GitHub repo secrets** (Settings → Secrets and variables → Actions):
   - `DROPLET_HOST` — the Droplet's IP
   - `DROPLET_USER` — `root`
   - `DROPLET_SSH_KEY` — contents of `.deploy/ssh/ndyhub_deploy` (the
     private key — never commit this file)
   - `NEXT_PUBLIC_API_URL` — `http://<droplet-ip>:3000` (baked into the
     web build at build time, so it must be a secret here, not just in
     `.env.prod`)
5. **GHCR package visibility**: after the first successful build, go to
   the new `ndy-hub-api` / `ndy-hub-web` packages under your GitHub
   profile → Package settings → change visibility to **Public** (simplest
   — otherwise the Droplet needs `docker login ghcr.io` with a PAT before
   every pull).
6. First deploy: push to `main`, or run the commands in
   `docker-compose.prod.yml`'s header comment manually over SSH.

## Day to day

Nothing — push to `main` and the pipeline handles the rest. Watch it run
under the repo's **Actions** tab.

## Manual operations (over SSH, when needed)

- Check logs: `docker compose -f docker-compose.prod.yml logs -f api`
- Roll back: change `IMAGE_API`/`IMAGE_WEB` in `.env.prod` to a specific
  `:<git-sha>` tag instead of `:latest`, then `docker compose ... up -d`.
- Re-run migrations by hand:
  `docker compose -f docker-compose.prod.yml exec -T api npx prisma migrate deploy`
