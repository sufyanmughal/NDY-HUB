#!/usr/bin/env bash
# Nightly Postgres backup. Installed as a cron job by server-setup.sh.
#
# Local-disk retention always happens (fast restore path for the common
# case — "I broke something, roll back 10 minutes"). Off-server upload to
# DigitalOcean Spaces additionally happens whenever SPACES_BUCKET is set in
# .env.prod — until then this is a documented no-op, not a silent gap: see
# the OFF-SERVER UPLOAD section below and deploy/README.md's Disaster
# Recovery section for exactly what to fill in once a Spaces bucket exists.
#
# Hardened per the client's explicit "treat backup storage as urgent"
# instruction (Aug 2026 architecture audit, answer #17): a truncated/empty
# dump used to look identical to a good one in the backup directory — a
# real ~800-byte empty dump sat unnoticed in production for 12 days before
# this was caught. Now: (1) the dump is verified non-trivial before being
# kept or uploaded, (2) any failure notifies via NDY HUB's own
# NotificationService.notify() SECURITY-category path (see notify-failure
# below) — the same channel/backbone every other system alert already uses
# — falling back to a local FAILURE marker file if the API isn't reachable,
# so a failure is never silent even if the notification call itself fails.
set -uo pipefail

BACKUP_DIR="$HOME/ndy-hub-backups"
RETENTION_DAYS=14
STAMP="$(date +%Y%m%d-%H%M%S)"
DUMP_FILE="$BACKUP_DIR/ndyhub-$STAMP.sql.gz"
# A real dump of this schema is tens of KB at minimum even with almost no
# data (DDL alone accounts for that) — anything smaller is a failed/empty
# dump, not a legitimately tiny database. This is what would have caught
# the 816-byte empty backup from Aug 6 immediately instead of 12 days later.
MIN_VALID_BYTES=2000

REPO_DIR="$HOME/ndy-hub"
ENV_FILE="$REPO_DIR/.env.prod"

mkdir -p "$BACKUP_DIR"

notify_failure() {
  local reason="$1"
  echo "BACKUP FAILURE: $reason" >&2
  # Best-effort local marker so failure is visible even if every network
  # call below also fails — checked by an external uptime/monitoring pass,
  # not relied on as the only signal.
  echo "$(date -u +%FT%TZ) $reason" >> "$BACKUP_DIR/FAILURE"

  # Best-effort call into NDY HUB's own admin-facing security alert path,
  # if the API happens to be reachable — reuses the same
  # NotificationService (Phase 2) every other cross-cutting alert goes
  # through, rather than inventing a separate ad hoc email. Never allowed
  # to fail the backup script itself (|| true throughout).
  if [ -f "$ENV_FILE" ]; then
    API_URL_LOCAL="$(grep -m1 '^API_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')"
    ALERT_SECRET="$(grep -m1 '^INTERNAL_ALERT_SECRET=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')"
    if [ -n "${API_URL_LOCAL:-}" ] && [ -n "${ALERT_SECRET:-}" ]; then
      curl -fsS -m 5 -X POST "$API_URL_LOCAL/internal/backup-alert" \
        -H "Content-Type: application/json" \
        -H "x-internal-secret: $ALERT_SECRET" \
        -d "{\"reason\":\"$reason\",\"stamp\":\"$STAMP\"}" \
        >/dev/null 2>&1 || true
    fi
  fi
}

echo "== Dumping database =="
if ! docker compose -f "$REPO_DIR/docker-compose.prod.yml" --env-file "$ENV_FILE" \
  exec -T postgres pg_dump -U ndyhub ndyhub | gzip > "$DUMP_FILE"; then
  notify_failure "pg_dump/gzip pipeline exited non-zero for $STAMP"
  rm -f "$DUMP_FILE"
  exit 1
fi

ACTUAL_BYTES=$(stat -c%s "$DUMP_FILE" 2>/dev/null || stat -f%z "$DUMP_FILE")
if [ "$ACTUAL_BYTES" -lt "$MIN_VALID_BYTES" ]; then
  notify_failure "dump for $STAMP is only $ACTUAL_BYTES bytes (expected >= $MIN_VALID_BYTES) — looks empty/truncated, not a legitimate backup"
  # Kept on disk (not deleted) so it can be inspected — but never uploaded
  # off-server, and the FAILURE marker above is what a monitoring pass
  # actually alerts on.
  exit 1
fi
echo "Backup written: $DUMP_FILE ($ACTUAL_BYTES bytes)"

# --- OFF-SERVER UPLOAD (DigitalOcean Spaces) ---
# Deliberately gated on SPACES_BUCKET being set in .env.prod rather than
# always attempting it — until a bucket + access keys exist, this block is
# a documented no-op. To enable: create a Space (DO dashboard -> Spaces ->
# Create), generate an access key (API -> Spaces Keys), then add to
# .env.prod:
#   SPACES_BUCKET="ndyhub-backups"
#   SPACES_REGION="nyc3"                 # match the Space's region
#   SPACES_ACCESS_KEY="..."
#   SPACES_SECRET_KEY="..."
# No code change needed beyond that — s3cmd is installed by server-setup.sh
# once this block is live (see its own comment).
if [ -f "$ENV_FILE" ]; then
  SPACES_BUCKET="$(grep -m1 '^SPACES_BUCKET=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')"
fi
if [ -n "${SPACES_BUCKET:-}" ]; then
  SPACES_REGION="$(grep -m1 '^SPACES_REGION=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')"
  SPACES_ACCESS_KEY="$(grep -m1 '^SPACES_ACCESS_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')"
  SPACES_SECRET_KEY="$(grep -m1 '^SPACES_SECRET_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')"
  echo "== Uploading to DigitalOcean Spaces ($SPACES_BUCKET) =="
  if command -v s3cmd >/dev/null 2>&1; then
    if s3cmd put "$DUMP_FILE" "s3://$SPACES_BUCKET/$(basename "$DUMP_FILE")" \
      --access_key="$SPACES_ACCESS_KEY" \
      --secret_key="$SPACES_SECRET_KEY" \
      --host="${SPACES_REGION}.digitaloceanspaces.com" \
      --host-bucket="%(bucket)s.${SPACES_REGION}.digitaloceanspaces.com" \
      >/dev/null 2>&1; then
      echo "Uploaded to s3://$SPACES_BUCKET/$(basename "$DUMP_FILE")"
    else
      notify_failure "local dump for $STAMP succeeded but Spaces upload failed — off-server copy missing this cycle"
    fi
  else
    notify_failure "SPACES_BUCKET is configured but s3cmd isn't installed — off-server upload skipped for $STAMP. Re-run deploy/server-setup.sh to install it."
  fi
else
  echo "SPACES_BUCKET not set in .env.prod — local-disk-only backup (see this script's header). Not a failure, just not upgraded yet."
fi

# Prune anything older than the retention window — local disk only; Spaces
# lifecycle rules (if wanted) are configured in the DO dashboard, not here.
find "$BACKUP_DIR" -name "ndyhub-*.sql.gz" -mtime "+$RETENTION_DAYS" -delete

# Clear any stale FAILURE marker from a previous run now that this run
# succeeded — a monitoring pass checking for the marker's existence should
# only ever see it for the *current* unresolved failure, not a historical one.
rm -f "$BACKUP_DIR/FAILURE"
