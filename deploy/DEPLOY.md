# Deploying the TechHub backend

What runs where, after this:

| | |
|---|---|
| `hsct.tech` | the site — React on Cloudflare Pages, as before |
| `api.hsct.tech` | **this backend** — Django + Channels in Docker on the Hetzner box (`cruzstats`, 65.109.234.48), reached through a Cloudflare Tunnel. Assignments, teams, live websockets, submissions, the lesson catalog, the Python Arcade API. |
| `lessons.hsct.tech` | the lesson HTML files — a Cloudflare R2 bucket with a custom domain. Cloudflare caches them; uploading a lesson on `/teach` puts it here. |

It sits next to Cruz Stats as a second, independent stack: `/opt/hsct` with its own Postgres, Redis and tunnel. Nothing is shared with `/opt/cruzstats`, so the two can't break each other. The CAX11 (2 vCPU / 4 GB) has room for both.

Everything below is done once. Day-to-day, adding a lesson or posting an assignment happens on `/teach`, not here.

---

## 1. Cloudflare (dashboard, ~15 minutes)

### R2 bucket for lesson files
1. R2 → **Create bucket** → name `hsct-lessons`, location hint Eastern North America (or leave automatic).
2. Bucket → Settings → **Custom Domains** → Connect `lessons.hsct.tech`. (Same Cloudflare account as the `hsct.tech` zone, so DNS is automatic.) Wait until it says Active.
3. Bucket → Settings → **CORS policy** — not needed: the site loads lessons in an iframe, not with fetch.
4. R2 → **Manage R2 API tokens** → Create API token: name `hsct-backend`, permission **Object Read & Write**, *Specify buckets* → `hsct-lessons` only. Copy the Access Key ID, Secret Access Key, and the S3 endpoint (`https://<account id>.r2.cloudflarestorage.com`). This token cannot touch the `cruzstats` bucket or Zinara's.

### Tunnel for the API
1. Zero Trust → Networks → Tunnels → **Create a tunnel** → Cloudflared → name `hsct`. Copy the token from the install command (the long string after `--token`). You don't run that command; the compose file runs cloudflared.
2. Public Hostnames → Add: subdomain `api`, domain `hsct.tech`, service **HTTP** `api:8000`. Save. (This creates the `api.hsct.tech` DNS record.)
3. Optional but good: Additional application settings → HTTP Settings → **Disable Chunked Encoding** off (default), **WebSocket** is on by default — the live boards need it.

### Pages variables (the site)
Workers & Pages → the TechHub project → Settings → Environment variables (Production):

```
VITE_API_BASE = https://api.hsct.tech/api
```

Don't redeploy yet — do it after the API is up (step 4), so the site never points at a dead API.

---

## 2. The server (once, ~10 minutes)

```bash
ssh deploy@65.109.234.48          # same user as Cruz Stats
sudo install -d -o deploy -g deploy /opt/hsct /opt/hsct-backups
cd /opt/hsct
git clone git@github.com:jamilton08/TechHub.git .      # the server's deploy key works if it's a user-level key;
                                                        # for a repo deploy key: ssh-keygen -t ed25519 -f ~/.ssh/hsct -N "" and add ~/.ssh/hsct.pub under TechHub → Settings → Deploy keys,
                                                        # then: GIT_SSH_COMMAND="ssh -i ~/.ssh/hsct" git clone ...
cd deploy
cp .env.example .env
nano .env                          # fill every line (section 3)
docker compose up -d --build       # first build takes a few minutes on the ARM box
docker compose ps                  # db healthy, redis, api, tunnel all Up
docker compose logs --tail 50 api  # should end with "Listening on TCP address 0.0.0.0:8000"
docker compose exec api python manage.py createsuperuser   # your /teach and /admin/ login
curl https://api.hsct.tech/api/healthz/                    # {"ok": true}
```

Firewall: nothing to change. The stack publishes no ports; the tunnel dials out.

Nightly database dump (plus Hetzner's daily server backup):
```bash
crontab -e
25 3 * * * /opt/hsct/deploy/backup.sh >> /opt/hsct-backups/backup.log 2>&1
```
(Cruz Stats runs at 3:15; this runs at 3:25.)

---

## 3. `.env` — every line

| Variable | Value |
|---|---|
| `DJANGO_SECRET_KEY` | `openssl rand -base64 48` |
| `DJANGO_DEBUG` | `0` |
| `DJANGO_ALLOWED_HOSTS` | `api.hsct.tech` |
| `FRONTEND_ORIGINS` | `https://hsct.tech,https://lessons.hsct.tech` — the site and the lesson files' domain (the kit inside a lesson calls the API and opens the websocket from there). Add a preview URL if you ever test a Pages preview branch. |
| `COOKIE_DOMAIN` | `.hsct.tech` |
| `POSTGRES_PASSWORD` | `openssl rand -hex 24` |
| `R2_BUCKET` | `hsct-lessons` |
| `R2_ENDPOINT` | the S3 endpoint from the token screen |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | from the token |
| `LESSON_FILES_BASE` | `https://lessons.hsct.tech` |
| `CLOUDFLARE_TUNNEL_TOKEN` | from the tunnel |

Changed something? `docker compose up -d` recreates what needs it.

---

## 4. Move the lessons in (once)

On your Mac, in the TechHub repo:

```bash
node scripts/export-catalog.mjs > catalog.json
```

Copy `catalog.json` and `public/lesson-files/` to the server, then import (the API container has the R2 credentials):

```bash
scp catalog.json deploy@65.109.234.48:/opt/hsct/
scp -r public/lesson-files deploy@65.109.234.48:/opt/hsct/
ssh deploy@65.109.234.48
cd /opt/hsct/deploy
docker compose cp ../catalog.json api:/tmp/catalog.json
docker compose cp ../lesson-files api:/tmp/lesson-files
docker compose exec api python manage.py import_lessons /tmp/catalog.json /tmp/lesson-files
curl -s https://api.hsct.tech/api/lessons/ | head -c 400      # the catalog
curl -sI https://lessons.hsct.tech/computer-science/data-vault-json-database.html | head -1   # 200
```

Then on the site:
1. Pages → set `VITE_API_BASE` (section 1) → **Retry deployment** on the latest build.
2. Open `hsct.tech/lessons` — same catalog, now from the API. Open a lesson — the iframe loads from `lessons.hsct.tech`.
3. `hsct.tech/teach` → sign in with the superuser → post an assignment on any lesson → open it from the student link in two browser windows → team up.

Once that works, `public/lesson-files/` and the entries in `src/site/lessons.js` are only a fallback. Keep them for a while (the site uses them if the API is down and nothing is cached), then trim `lessons.js` down whenever you like; `git rm -r public/lesson-files` shrinks the Pages build.

The lessons already deployed carry kit v1.1 (no teams). To upgrade them all at once:

```bash
node scripts/update-kit.mjs            # swaps the kit block in every file under public/lesson-files/
```
then re-upload each lesson on `/teach` (pick the file — the form fills itself from the file), or re-run the import above with the updated folder. New lessons start from `lesson-template/lesson-starter.html`, which already has v1.2.

---

## 5. Everyday commands

All from `/opt/hsct/deploy` on the server:

| Task | Command |
|---|---|
| Are things running? | `docker compose ps` |
| API logs (live) | `docker compose logs -f api` |
| Tunnel logs | `docker compose logs --tail 100 tunnel` |
| Restart the API | `docker compose restart api` |
| Deploy new backend code | `./deploy.sh` (git pull + rebuild) |
| Django shell | `docker compose exec api python manage.py shell` |
| Postgres shell | `docker compose exec db psql -U hsct -d hsct` |
| Another teacher login | `docker compose exec api python manage.py createsuperuser` — or make a user in `/admin/` with **Staff status** |
| Backup now | `./backup.sh` |
| Disk | `df -h /` and `docker system df` |

`https://api.hsct.tech/admin/` is the Django admin: every course, lesson, assignment, team, member, event and submission.

Restore a dump (replaces the database; back up first):
```bash
docker compose stop api
docker compose exec -T db psql -U hsct -d postgres -c "DROP DATABASE hsct;" -c "CREATE DATABASE hsct OWNER hsct;"
gunzip -c /opt/hsct-backups/db-2026-11-20_0325.sql.gz | docker compose exec -T db psql -U hsct -d hsct
docker compose start api
```

Lesson files in R2 aren't in these dumps — R2 is durable on its own, and every lesson also exists in the repo / on your Mac.

---

## 6. How the pieces talk

```
student's browser ──── hsct.tech (Pages) ── iframe ──► lessons.hsct.tech (R2)
        │                                                  │ the lesson's kit:
        │  /api/lessons/ (catalog)                         │  POST /api/teams/…  wss://api.hsct.tech/ws/team/<CODE>/
        ▼                                                  ▼
   api.hsct.tech  ◄── Cloudflare Tunnel ──  docker: tunnel → api:8000 (daphne) → db, redis
        ▲
teacher's browser ── hsct.tech/teach ── session cookie (.hsct.tech) ── wss://api.hsct.tech/ws/assignment/<id>/
```

- Students have no accounts. A team member is a name + a secret token the lesson keeps in `sessionStorage`; a refresh or a new computer rejoins with the code and the same name.
- Teachers are Django users with staff status; the site keeps the session cookie on `.hsct.tech`.
- The `.hsct` result files are still encrypted to your public key in the browser. The server stores the sealed envelope (it can't read the score) plus the clear summary the kit sends for the leaderboard — the verify page is where the real number comes from.
- Redis is only the websocket channel layer (nothing persistent). Postgres holds everything.

---

## 7. When something breaks

| Symptom | Check | Usual fix |
|---|---|---|
| `api.hsct.tech` doesn't load | `docker compose ps`; tunnel status in Zero Trust | `docker compose up -d`; tunnel Down → `logs tunnel` (bad token?) |
| Site shows the old catalog / "no backend" on /teach | `VITE_API_BASE` on Pages, then Retry deployment | Variables are baked in at build time |
| Lesson iframe is blank | `curl -I https://lessons.hsct.tech/<course>/<slug>.html` | Custom domain not Active yet, or the import didn't run |
| "Work as a team" card doesn't appear in a lesson | the lesson's kit version (`var KIT = '1.2'` in the file); an assignment is posted and open for that slug | `node scripts/update-kit.mjs` + re-upload; post the assignment |
| Teams join but nothing syncs | API logs for `WebSocket` lines; browser console | `FRONTEND_ORIGINS` must include `https://lessons.hsct.tech` (the origin the websocket comes from) |
| Teacher board says "reconnecting — polling" | the websocket to `wss://api.hsct.tech/ws/assignment/…` | Same origins list; the board still polls every 15 s |
| CSRF errors on /teach | cookie domain | `COOKIE_DOMAIN=.hsct.tech`, `FRONTEND_ORIGINS` has `https://hsct.tech` |
| Out of memory on the box | `free -m`, `docker stats` | Both stacks idle around 400–500 MB total; if Postgres is hungry, it's the Cruz Stats one — same fix as there |
