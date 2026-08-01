#!/usr/bin/env bash
# Restore a backup produced by backup.sh. Run this periodically against a
# throwaway database (not the live one) as the "restore test" the client
# asked for — see deploy/README.md's Disaster Recovery section.
#
# Usage: restore.sh <path-to-ndyhub-*.sql.gz> [target-db-name]
set -euo pipefail

BACKUP_FILE="${1:?Usage: restore.sh <backup-file.sql.gz> [target-db-name]}"
TARGET_DB="${2:-ndyhub_restore_test}"

COMPOSE="docker compose -f $HOME/ndy-hub/docker-compose.prod.yml --env-file $HOME/ndy-hub/.env.prod"

echo "== Creating $TARGET_DB (dropping it first if it already exists) =="
$COMPOSE exec -T postgres psql -U ndyhub -d postgres -c "DROP DATABASE IF EXISTS $TARGET_DB;"
$COMPOSE exec -T postgres psql -U ndyhub -d postgres -c "CREATE DATABASE $TARGET_DB;"

echo "== Restoring $BACKUP_FILE into $TARGET_DB =="
gunzip -c "$BACKUP_FILE" | $COMPOSE exec -T postgres psql -U ndyhub -d "$TARGET_DB"

echo "== Row counts (sanity check) =="
$COMPOSE exec -T postgres psql -U ndyhub -d "$TARGET_DB" -c "\
SELECT relname AS table, n_live_tup AS approx_rows \
FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 15;"

echo
echo "Restore test complete. $TARGET_DB is a throwaway database — drop it when done:"
echo "  $COMPOSE exec -T postgres psql -U ndyhub -d postgres -c \"DROP DATABASE $TARGET_DB;\""
