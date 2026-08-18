#!/usr/bin/env bash
# Automated weekly restore test — installed as a cron job by
# server-setup.sh. Closes the "an untested backup is a hope, not a plan"
# gap deploy/README.md's Disaster Recovery section already named as a
# manual-only step: this makes it actually run on a schedule, unattended,
# and alert (via the same POST /internal/backup-alert path deploy/
# backup.sh uses) if a restore ever fails.
#
# Unlike deploy/restore.sh (which is for a human doing a real DR drill and
# deliberately leaves the throwaway DB around to inspect), this wraps it,
# targets the most recent local backup, verifies it actually restores, and
# drops the throwaway DB itself — cron doesn't need a database sitting
# around, it needs a pass/fail signal.
set -uo pipefail

BACKUP_DIR="$HOME/ndy-hub-backups"
REPO_DIR="$HOME/ndy-hub"
ENV_FILE="$REPO_DIR/.env.prod"
TARGET_DB="ndyhub_restore_test"
COMPOSE="docker compose -f $REPO_DIR/docker-compose.prod.yml --env-file $ENV_FILE"

notify_failure() {
  local reason="$1"
  echo "RESTORE TEST FAILURE: $reason" >&2
  echo "$(date -u +%FT%TZ) $reason" >> "$BACKUP_DIR/RESTORE_TEST_FAILURE"
  if [ -f "$ENV_FILE" ]; then
    API_URL_LOCAL="$(grep -m1 '^API_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')"
    ALERT_SECRET="$(grep -m1 '^INTERNAL_ALERT_SECRET=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')"
    if [ -n "${API_URL_LOCAL:-}" ] && [ -n "${ALERT_SECRET:-}" ]; then
      curl -fsS -m 5 -X POST "$API_URL_LOCAL/internal/backup-alert" \
        -H "Content-Type: application/json" \
        -H "x-internal-secret: $ALERT_SECRET" \
        -d "{\"reason\":\"restore test: $reason\",\"stamp\":\"$(date +%Y%m%d-%H%M%S)\"}" \
        >/dev/null 2>&1 || true
    fi
  fi
}

LATEST_BACKUP="$(find "$BACKUP_DIR" -name 'ndyhub-*.sql.gz' -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)"
if [ -z "$LATEST_BACKUP" ]; then
  notify_failure "no backup file found in $BACKUP_DIR to test"
  exit 1
fi

echo "== Restore-testing $LATEST_BACKUP =="

$COMPOSE exec -T postgres psql -U ndyhub -d postgres -c "DROP DATABASE IF EXISTS $TARGET_DB;" >/dev/null 2>&1
if ! $COMPOSE exec -T postgres psql -U ndyhub -d postgres -c "CREATE DATABASE $TARGET_DB;" >/dev/null 2>&1; then
  notify_failure "could not create throwaway database $TARGET_DB"
  exit 1
fi

if ! gunzip -c "$LATEST_BACKUP" | $COMPOSE exec -T postgres psql -U ndyhub -d "$TARGET_DB" >/dev/null 2>&1; then
  notify_failure "restoring $LATEST_BACKUP into $TARGET_DB failed — this backup is not actually usable for recovery"
  $COMPOSE exec -T postgres psql -U ndyhub -d postgres -c "DROP DATABASE IF EXISTS $TARGET_DB;" >/dev/null 2>&1 || true
  exit 1
fi

# Sanity check: the restored database should have a plausible number of
# rows in a table that's always populated in production (User) — an empty
# restore that didn't error is just as much a failure as one that did.
USER_COUNT="$($COMPOSE exec -T postgres psql -U ndyhub -d "$TARGET_DB" -tAc "SELECT count(*) FROM \"User\";" 2>/dev/null || echo "")"
$COMPOSE exec -T postgres psql -U ndyhub -d postgres -c "DROP DATABASE IF EXISTS $TARGET_DB;" >/dev/null 2>&1 || true

if [ -z "$USER_COUNT" ] || [ "$USER_COUNT" -eq 0 ]; then
  notify_failure "restored $LATEST_BACKUP but the User table came back empty (got: '$USER_COUNT') — restore may be silently incomplete"
  exit 1
fi

echo "Restore test passed: $LATEST_BACKUP restores cleanly ($USER_COUNT users)."
rm -f "$BACKUP_DIR/RESTORE_TEST_FAILURE"
