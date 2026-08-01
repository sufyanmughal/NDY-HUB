#!/usr/bin/env bash
# Nightly Postgres backup. Installed as a cron job by server-setup.sh.
# Local-disk retention for now (see deploy/README.md's Disaster Recovery
# section for why, and what upgrading to off-server storage looks like).
set -euo pipefail

BACKUP_DIR="$HOME/ndy-hub-backups"
RETENTION_DAYS=14
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"

docker compose -f "$HOME/ndy-hub/docker-compose.prod.yml" --env-file "$HOME/ndy-hub/.env.prod" \
  exec -T postgres pg_dump -U ndyhub ndyhub | gzip > "$BACKUP_DIR/ndyhub-$STAMP.sql.gz"

# Prune anything older than the retention window.
find "$BACKUP_DIR" -name "ndyhub-*.sql.gz" -mtime "+$RETENTION_DAYS" -delete

echo "Backup written: $BACKUP_DIR/ndyhub-$STAMP.sql.gz"
