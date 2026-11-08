#!/usr/bin/env bash
# Nightly Postgres dump, kept 14 days. (Hetzner server backups cover the whole disk on top of this.)
# Install (as deploy):  crontab -e  ->  25 3 * * * /opt/hsct/deploy/backup.sh >> /opt/hsct-backups/backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p /opt/hsct-backups
STAMP=$(date +%Y-%m-%d_%H%M)
OUT=/opt/hsct-backups/db-$STAMP.sql.gz
docker compose exec -T db pg_dump -U hsct -d hsct --no-owner | gzip > "$OUT"
find /opt/hsct-backups -name 'db-*.sql.gz' -mtime +14 -delete
echo "$(date -Is) backup ok: $OUT ($(du -h "$OUT" | cut -f1))"
