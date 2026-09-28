# Python Arcade — Django backend

`arcade/` is a Django app that stores Python Arcade projects for signed-in
students. It speaks exactly the JSON the `/play` page already uses
(`src/arcade/store/apiStore.js`), so turning accounts on is configuration,
not new frontend code.

Until it's running, `/play` saves projects in each browser (IndexedDB).
Set `VITE_API_BASE` and the page switches to "Saved to your account"
whenever a student is signed in, and offers to move their browser projects
over.

```
backend/
  arcade/                  ← the app: copy this into your real project
    models.py              Project, ProjectFile, Asset (owner FK only — no names)
    serializers.py         the JSON shapes (camelCase, matches the frontend)
    views.py               the API
    rules.py               file-name rules and size limits (same as the frontend)
    tests.py               python manage.py test arcade
  example_project/         ← a throwaway project to try it on your laptop
  requirements.txt
```

## Try it locally (5 minutes)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cd example_project
python manage.py migrate
python manage.py createsuperuser        # your login for testing
python manage.py test arcade            # 17 tests
python manage.py runserver              # http://127.0.0.1:8000
```

Then point the frontend at it — create `.env.local` in the repo root:

```
VITE_API_BASE=http://127.0.0.1:8000/api
VITE_LOGIN_URL=http://127.0.0.1:8000/admin/login/
```

`npm run dev -- --host 127.0.0.1`, open http://127.0.0.1:5173/play (use 127.0.0.1, not
localhost, so the cookies match), press **Sign in**, log in with the
superuser, and you're back on /play saving to the database. The Django admin
at /admin/ shows every project, file and asset.

## Adding it to your real project on Hetzner

1. Copy `arcade/` next to your other apps.
2. Install: `pip install djangorestframework django-cors-headers`
3. `settings.py`:

   ```python
   INSTALLED_APPS += ["corsheaders", "rest_framework", "arcade"]
   MIDDLEWARE.insert(0, "corsheaders.middleware.CorsMiddleware")

   REST_FRAMEWORK = {
       "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework.authentication.SessionAuthentication"],
       "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
       "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.UserRateThrottle",
                                   "rest_framework.throttling.AnonRateThrottle"],
       "DEFAULT_THROTTLE_RATES": {"user": "600/min", "anon": "120/min"},
   }

   # hsct.tech stays on Cloudflare Pages; the API is api.hsct.tech on Hetzner
   CORS_ALLOWED_ORIGINS = ["https://hsct.tech"]
   CORS_ALLOW_CREDENTIALS = True
   CSRF_TRUSTED_ORIGINS = ["https://hsct.tech"]
   SESSION_COOKIE_DOMAIN = CSRF_COOKIE_DOMAIN = ".hsct.tech"   # so hsct.tech can read csrftoken
   SESSION_COOKIE_SECURE = CSRF_COOKIE_SECURE = True
   SESSION_COOKIE_SAMESITE = CSRF_COOKIE_SAMESITE = "Lax"      # same site, so Lax is enough

   MEDIA_ROOT = "/srv/hsct/media"        # uploaded images/sounds — back this up with the database
   SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")   # nginx terminates TLS
   DATA_UPLOAD_MAX_MEMORY_SIZE = FILE_UPLOAD_MAX_MEMORY_SIZE = 6 * 1024 * 1024
   ```

   Using a custom user model? Set `AUTH_USER_MODEL` **before** the first
   `migrate` — the arcade tables point at it.

4. `urls.py`: `path("api/", include("arcade.urls"))`
5. `python manage.py migrate`
6. In Cloudflare Pages → Settings → Environment variables, set
   `VITE_API_BASE=https://api.hsct.tech/api` and `VITE_LOGIN_URL` to your
   login page, then redeploy.

**Don't serve `MEDIA_ROOT` publicly** (no `location /media/` in nginx).
Assets are served through `GET /api/arcade/projects/<id>/assets/<name>/`,
which checks who's asking. A public media folder would leak assets from
private projects.

### Sign-in

The arcade only needs `request.user` from a normal Django session. How
students get one is up to you (Google sign-in through django-allauth, for
example). Whatever you use, `VITE_LOGIN_URL` must be a page that logs the
student in and then redirects to its `?next=` parameter.

Nothing in the arcade tables stores a name or email. A project has an
`owner` foreign key and that's all, so if your user model only keeps an
anonymous id mapped from Google, that's the only link to a person.
`GET /api/arcade/me/` returns `{authenticated, userId, isTeacher}` and never
a name.

## The API

All under `/api/arcade/`. The session cookie plus the `X-CSRFToken` header
on writes (the page takes the token from the `csrftoken` cookie that `me/`
sets).

| | | |
|---|---|---|
| `GET` | `me/` | `{authenticated, userId?, isTeacher?}`; also sets the CSRF cookie |
| `GET` | `projects/` | my projects: `[{id, title, visibility, createdAt, updatedAt, fileCount}]` |
| `POST` | `projects/` | create `{id?, title, entry, files:[{name, content}], remixOf?}` → project |
| `GET` | `projects/<id>/` | one project (mine, or anyone's `unlisted`/`public` one) |
| `PUT` | `projects/<id>/` | save `{title, entry, files, version}`. **409** `{version}` if someone saved since |
| `PATCH` | `projects/<id>/` | `{title?}` / `{visibility: private \| unlisted \| public}` |
| `DELETE` | `projects/<id>/` | also deletes its asset files |
| `POST` | `projects/<id>/remix/` | copy a shared project (with assets) into my account |
| `POST` | `projects/<id>/assets/` | multipart `name`, `file`. Replaces a same-named asset |
| `GET` | `projects/<id>/assets/<name>/` | the bytes |
| `DELETE` | `projects/<id>/assets/<name>/` | |

A project in full:

```json
{
  "id": "0b6f…", "title": "Dodge the Blocks", "entry": "main.py",
  "files": [{"name": "main.py", "content": "import pygame…"}],
  "assets": [{"name": "ship.png", "type": "image/png", "size": 1834, "url": "/api/arcade/projects/0b6f…/assets/ship.png/"}],
  "visibility": "private", "remixOf": null, "version": 3,
  "createdAt": "…", "updatedAt": "…", "isOwner": true
}
```

- **Ids come from the browser**, so a project keeps its id when it moves
  from "this browser" to an account.
- **`version`** goes up on every code save. A save has to say which version
  it started from. Two tabs editing the same project get a "changed
  somewhere else" choice instead of silently overwriting each other.
  Uploading assets doesn't change the version.
- **Limits** (in `rules.py`, same as the frontend): 30 files of 200 KB, 40
  assets of 5 MB, 25 MB per project. Python file names must be importable
  (`my_game.py`, not `my-game.py`) and can't shadow `pygame.py`,
  `random.py` and so on.
- **Assets** can only be images, sounds or fonts. The server picks the
  content type from the extension and checks the file's first bytes
  (a renamed `.exe` is refused). SVG and HTML are never accepted.

## Before students open each other's games

A shared game runs in the browser of whoever opens it. Two things keep
that safe:

1. **The runner page is locked down.** While a program runs, the Python
   worker has no `fetch`, no `XMLHttpRequest`, no WebSockets and no
   IndexedDB. It gets them back only between runs, for loading packages.
2. **Give the runner its own origin.** Right now the game screen
   (`/play/runner.html`) is served from hsct.tech. Before you turn on link
   sharing with accounts:
   - Add `run.hsct.tech` as a second custom domain on the same Cloudflare
     Pages project. `public/_headers` already sends what it needs.
   - Set `VITE_ARCADE_RUNNER_URL=https://run.hsct.tech/play/runner.html`
     and redeploy.

   Student code then runs on an origin that has no cookies, no projects and
   no API access. Keep `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` set
   to just `https://hsct.tech`, so the API only answers the editor, never
   the runner. This setup has been tested: games, keyboard and `input()`
   all work with the runner on a separate origin.

## Serving everything from Hetzner instead (optional)

If you'd rather move the whole site off Cloudflare, build with
`VITE_API_BASE=/api` and let nginx serve `dist/` and proxy the API. The
`/play` pages need the same two headers that `public/_headers` gives them
on Cloudflare:

```nginx
server {
    server_name hsct.tech;
    root /srv/hsct/dist;

    location /api/   { proxy_pass http://127.0.0.1:8000; include proxy_params; client_max_body_size 6m; }
    location /admin/ { proxy_pass http://127.0.0.1:8000; include proxy_params; }

    location /pyodide/ {
        add_header Cross-Origin-Resource-Policy same-origin;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
    location /assets/ {
        add_header Cross-Origin-Embedder-Policy require-corp;
        add_header Cross-Origin-Resource-Policy same-origin;
    }
    location /play {
        add_header Cross-Origin-Opener-Policy same-origin;
        add_header Cross-Origin-Embedder-Policy require-corp;
        add_header Cross-Origin-Resource-Policy cross-origin;
        try_files $uri $uri.html /index.html;
    }
    location / { try_files $uri $uri.html /index.html; }
}
```

In that setup the runner shares an origin with the API, so moving it to its
own subdomain (above) matters even more.

## What's next on this side

- **Classes:** a `Classroom` model (teacher, roster of users), so a teacher
  can list a class's projects. `Project` would get an optional
  `classroom` FK, and a teacher-only endpoint would list those projects.
  The frontend's project list is already the right shape for that.
- **Gallery:** `GET projects/?visibility=public` for a class gallery page.
- **Assignments:** give a project a `starter_of` link, so a teacher's
  starter project hands each student their own copy.
