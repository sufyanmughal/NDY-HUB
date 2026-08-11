#!/usr/bin/env bash
# One-command deploy: sync -> build -> restart -> verify. Run from the repo
# root on the droplet (or invoke via ssh from a local machine — see below).
# Replaces the ad-hoc "build in background, poll pgrep, forget --env-file"
# sequence that has repeatedly cost real time — every step here always
# passes --env-file, and the script blocks synchronously on the build
# instead of relying on fragile background polling.
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=".env.prod"
COMPOSE="docker compose -f docker-compose.prod.yml -f docker-compose.build.yml --env-file $ENV_FILE"

echo "== Building (env file: $ENV_FILE) =="
time $COMPOSE build api web

echo "== Restarting containers =="
$COMPOSE up -d api web

echo "== Waiting for containers to report healthy/running =="
sleep 3
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep ndy-hub

echo "== Verifying API is actually reachable through the web proxy =="
STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X POST https://ndyhub.com/api/auth/login-request \
  -H 'Content-Type: application/json' -d '{}')
if [ "$STATUS" != "400" ] && [ "$STATUS" != "401" ]; then
  echo "FAIL: /api/auth/login-request returned $STATUS (expected 400/401 — a real API response, not a 404 from Next's own catch-all)."
  echo "This usually means NEXT_PUBLIC_API_URL was blank at build time. Check docker-compose.prod.yml's web service environment: block and .env.prod's API_URL."
  exit 1
fi
echo "OK: API proxy responding correctly ($STATUS)."

echo "== Deploy complete =="
