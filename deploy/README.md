# Deploying NDY HUB

## How it works

Every push to `main` on GitHub triggers `deploy-staging.yml`, which calls
the shared `deploy-reusable.yml` with `environment: staging`:
1. Builds the api and web Docker images and pushes them to GitHub Container
   Registry (`ghcr.io`), tagged `:staging` and `:staging-<commit-sha>`.
2. SSHes into the Staging server, pulls the new images, restarts the
   containers, and runs `prisma migrate deploy`.

The server itself never builds anything — it only pulls and runs
pre-built images, which is why a small (2GB) box is enough even though
`next build` alone needs more than that to run comfortably.

**Adding Production later** is a config change, not a rebuild: create a
second GitHub Environment named `production` with its own
`DROPLET_HOST`/`DROPLET_USER`/`DROPLET_SSH_KEY`/`NEXT_PUBLIC_API_URL`
secrets pointing at a second server, add a `deploy-production.yml` that
calls `deploy-reusable.yml` with `environment: production` (copy
`deploy-staging.yml` and change the trigger — e.g. a manual
`workflow_dispatch` or a push to a `release` branch instead of every push
to `main`). `deploy-reusable.yml` itself doesn't change.

## One-time setup (Staging)

1. **Droplet**: Ubuntu 24.04, created with the deploy SSH key added during
   creation (see `.deploy/ssh/`).
2. **Bootstrap it**: `ssh root@<droplet-ip>` then run
   `bash deploy/server-setup.sh <git-repo-url>`. This installs Docker, the
   firewall, the DigitalOcean monitoring agent, clones the repo, and sets
   up the nightly backup cron job.
3. **Fill in `~/ndy-hub/.env.prod`** on the server (copied from
   `.env.prod.example`) — real secrets, `WEB_APP_URL`/`API_URL` set to the
   Droplet's IP, and `IMAGE_API`/`IMAGE_WEB` set to
   `ghcr.io/<github-owner>/ndy-hub-api:staging` /
   `ghcr.io/<github-owner>/ndy-hub-web:staging`.
4. **GitHub Environment** (Settings → Environments → New environment →
   name it `staging`) with these secrets attached to it (not repo-level —
   keeps a future `production` environment's secrets separate):
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
   — otherwise the server needs `docker login ghcr.io` with a PAT before
   every pull).
6. **DigitalOcean alert policies**: DO dashboard → Monitoring → Alerts →
   Create Alert Policy — set thresholds for CPU, memory, and disk on this
   Droplet (the agent installed by `server-setup.sh` reports the metrics;
   the alert policy is what actually emails you when one crosses a
   threshold — has to be set up once per Droplet in the dashboard).
7. First deploy: push to `main`, or run the commands in
   `docker-compose.prod.yml`'s header comment manually over SSH.

## Day to day

Nothing — push to `main` and the pipeline handles the rest. Watch it run
under the repo's **Actions** tab.

## Manual operations (over SSH, when needed)

- Check logs: `docker compose -f docker-compose.prod.yml logs -f api`
- Roll back: change `IMAGE_API`/`IMAGE_WEB` in `.env.prod` to a specific
  `:staging-<commit-sha>` tag instead of `:staging`, then
  `docker compose ... up -d`.
- Re-run migrations by hand:
  `docker compose -f docker-compose.prod.yml exec -T api npx prisma migrate deploy`

## Disaster recovery

**Backups**: `deploy/backup.sh` runs automatically every night at 03:00 UTC
(installed as a cron job by `server-setup.sh`), dumping the database with
`pg_dump` and keeping 14 days of gzipped backups in `~/ndy-hub-backups/` on
the server itself.

This is a deliberate starting point, not the end state: local-only backups
mean a lost or corrupted server takes its backups down with it. The
standard fix is pushing each dump to off-server object storage
(DigitalOcean Spaces, ~$5/mo) — worth doing before any real user data is on
this server. `backup.sh` is written so that's a small addition (pipe the
gzip output to `s3cmd`/`rclone` instead of just the local file) rather than
a rewrite.

**Restore testing**: run `deploy/restore.sh <backup-file> [db-name]`
against a throwaway database (never the live one — the script defaults to
`ndyhub_restore_test` precisely so it can't collide) to verify a backup is
actually restorable. Do this periodically, not just when something's
already gone wrong — an untested backup is a hope, not a plan. Example:

```bash
ssh root@<droplet-ip>
bash ~/ndy-hub/deploy/restore.sh ~/ndy-hub-backups/ndyhub-20260731-030000.sql.gz
```

**Incident responsibilities**: until the team grows, whoever holds SSH
access to the server is the on-call responder. DigitalOcean alert emails
(CPU/memory/disk) and any future application-level alerting (Sentry or
similar — not yet wired in) are the trigger; `docker compose logs` and this
document are the starting point for triage.

**What's deliberately not built yet**: application-level error tracking
(e.g. Sentry) for catching failed payments and unexpected exceptions in
real time, and off-server backup storage. Both are recommended next steps,
not silently skipped — flagged here so the gap is visible rather than
assumed-covered.
