# TechHub backend + teams — what's in this drop

> Nov 8 follow-up: lesson kit **1.3** + world kit **0.4** — multiplayer worlds. Teammates are drawn as live
> sprites with name tags (positions relayed over the websocket, never stored); team state in a world
> shares the work and merges it additively, never the player's position/look. Backend: one relay-only
> `pos` message in `assignments/consumers.py`. All 30 lessons re-swapped by `scripts/update-kit.mjs`.

Unzip over the repo root. Every path below is new or replaced; nothing else in the
repo is touched (the Arcade, the Studio, the landing page, teachers.js, pages.js
are as they were).

## New

| Path | What |
|---|---|
| `backend/config/` | the real Django project: settings from env vars, ASGI with Channels, urls |
| `backend/core/` | teacher sign-in (`/api/auth/…`), `/api/healthz/` |
| `backend/lessons/` | the catalog (Course → Topic → Lesson) with the HTML in R2 (`/api/lessons/`, `/api/lessons/upload/`), `manage.py import_lessons` |
| `backend/assignments/` | assignments, teams, members, events, submissions — REST (`views.py`) + websockets (`consumers.py`, the wire protocol is in its docstring) |
| `backend/manage.py`, `Dockerfile`, `entrypoint.sh`, `.dockerignore` | the project runs on its own now (the old `example_project/` is gone) |
| `deploy/` | `docker-compose.yml` (db, redis, api, tunnel), `.env.example`, `deploy.sh`, `backup.sh`, **`DEPLOY.md`** — start there |
| `scripts/update-kit.mjs` | re-copies the kit into every lesson (`--check` lists versions) |
| `scripts/export-catalog.mjs` | `lessons.js` → `catalog.json` for the one-time import |
| `src/site/api.js` | API base, fetch with cookies/CSRF, `useAuth()` |
| `src/site/routes.jsx` | the site's pages, loaded after the catalog |
| `src/site/TeachPage.jsx` | `/teach`: sign in, post assignments, live board per assignment, who-did-what log, submissions, lesson upload |

## Replaced

| Path | Change |
|---|---|
| `backend/requirements.txt` | + channels[daphne], channels-redis, django-storages[s3], psycopg |
| `backend/README.md` | rewritten for the full backend; the Arcade section is kept below it |
| `lesson-template/hsct-lesson.js` | **kit v1.2**: teams (join/create card, live shared state, per-member event stream, floating status board with leaderboard, one team result file). Every v1.1 call is unchanged. |
| `lesson-template/README.md` | "Teams (v1.2)" section, checklist items |
| `lesson-template/lesson-starter.html`, `lesson-world-starter.html` | kit 1.2 inlined, `<div id="hsct-team">` under the resume card; the starter's `renderQuestion()` now renders an already-answered question (so a teammate's answer shows) |
| `public/lesson-files/**` (28 files) | kit block swapped to 1.2 by `scripts/update-kit.mjs`; the lessons' own code is untouched. `black-box-team-plan.html` has no kit and was skipped. |
| `src/main.jsx` | loads the catalog from the API before the site renders; `/teach` route |
| `src/site/lessons.js` | the list is now the fallback + seed; `loadCatalog()` swaps the API's catalog in place; `lessonSrc()` passes `?team=`/`?assignment=` through |
| `src/site/LessonPage.jsx` | open-assignment banner; query pass-through to the iframe |
| `src/site/VerifyPage.jsx`, `hsctVerify.js` | team panel on a team result (members, per-member counts, server log when signed in); files handed over from `/teach`; team columns in the CSV |
| `src/site/navData.js` | "Teach" under Lessons |
| `src/site/site.css` | styles for the above (appended at the end) |

## Not included on purpose

- `lesson-template/teacher-private-key.jwk` — it's in your `.gitignore`; nothing here changes the keys.
- `node_modules`, a Vite build. The frontend was syntax- and bundle-checked with esbuild and run in a browser against the backend, but do a normal `npm run build` before deploying.

## Add to `.gitignore`

```
backend/db.sqlite3
backend/media/
backend/staticfiles/
backend/.venv/
deploy/.env
catalog.json
```

## Order of operations

1. `cd backend && pip install -r requirements.txt && python manage.py test` (≈50 tests).
2. `npm run dev` + `python manage.py runserver` → `/teach` → upload the starter, post it, open it in two windows.
3. `deploy/DEPLOY.md` sections 1–4 for the server, R2 and Pages.
