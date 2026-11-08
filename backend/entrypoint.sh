#!/bin/sh
set -e

# Wait for Postgres
python - <<'PY'
import os, time
from urllib.parse import urlparse
import psycopg
u = urlparse(os.environ["DATABASE_URL"])
for i in range(30):
    try:
        psycopg.connect(host=u.hostname, port=u.port or 5432, user=u.username, password=u.password, dbname=u.path.lstrip("/")).close()
        break
    except Exception:
        time.sleep(2)
else:
    raise SystemExit("Postgres never came up")
PY

python manage.py migrate --noinput
python manage.py collectstatic --noinput

# daphne: HTTP + websockets on one port. --proxy-headers trusts X-Forwarded-* from the tunnel.
exec daphne -b 0.0.0.0 -p 8000 --proxy-headers config.asgi:application
