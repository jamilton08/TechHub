#!/usr/bin/env bash
# Pull the latest code and restart the API. Run on the server from /opt/hsct/deploy.
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
cd deploy
docker compose up -d --build
docker compose ps
docker image prune -f >/dev/null
