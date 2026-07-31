#!/usr/bin/env bash
# One-time bootstrap for a fresh Ubuntu 24.04 droplet. Run once, as root,
# over SSH: installs Docker, clones the repo, and gets .env.prod in place.
# Re-running is safe (each step checks before acting).
set -euo pipefail

REPO_URL="${1:?Usage: server-setup.sh <git-repo-url>}"

if ! command -v docker >/dev/null 2>&1; then
  echo "== Installing Docker =="
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

echo "== Firewall =="
apt-get install -y ufw
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 3000/tcp
ufw --force enable

echo "== Cloning repo =="
if [ ! -d ~/ndy-hub/.git ]; then
  git clone "$REPO_URL" ~/ndy-hub
fi
cd ~/ndy-hub

if [ ! -f .env.prod ]; then
  cp .env.prod.example .env.prod
  echo
  echo "== .env.prod created from the template — edit it now with real secrets: =="
  echo "   nano ~/ndy-hub/.env.prod"
  echo
fi

echo "== Done. Next steps: =="
echo "1. Fill in ~/ndy-hub/.env.prod (secrets, IMAGE_API/IMAGE_WEB tags, WEB_APP_URL/API_URL with this server's IP)."
echo "2. If the GitHub Container Registry images are private, run: docker login ghcr.io"
echo "3. docker compose -f docker-compose.prod.yml --env-file .env.prod pull"
echo "4. docker compose -f docker-compose.prod.yml --env-file .env.prod up -d"
echo "5. docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T api npx prisma migrate deploy"
