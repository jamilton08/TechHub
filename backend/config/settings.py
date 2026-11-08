"""
HSCT TechHub backend — api.hsct.tech

Everything that differs between your laptop and the Hetzner box comes from
environment variables (deploy/.env on the server; nothing set = dev defaults).

Apps:
  core         teacher login, healthz
  lessons      the lesson catalog + the lesson HTML files (kept in R2)
  assignments  assignments, teams (join codes), live events, submissions
  arcade       Python Arcade projects (see backend/README.md)
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def env(name, default=None):
    v = os.environ.get(name)
    return default if v is None or v == "" else v


def env_bool(name, default=False):
    return str(env(name, "1" if default else "0")).lower() in ("1", "true", "yes", "on")


def env_list(name, default=""):
    return [x.strip() for x in str(env(name, default)).split(",") if x.strip()]


SECRET_KEY = env("DJANGO_SECRET_KEY", "dev-only-not-secret")
DEBUG = env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

INSTALLED_APPS = [
    "daphne",  # must come before staticfiles so `runserver` speaks ASGI (websockets in dev)
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "channels",
    "core",
    "lessons",
    "assignments",
    "arcade",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [],
    "APP_DIRS": True,
    "OPTIONS": {"context_processors": [
        "django.template.context_processors.request",
        "django.contrib.auth.context_processors.auth",
        "django.contrib.messages.context_processors.messages",
    ]},
}]
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# ── database ──────────────────────────────────────────────────────────
# DATABASE_URL=postgres://user:pass@db:5432/hsct on the server; sqlite in dev.
_db_url = env("DATABASE_URL")
if _db_url:
    from urllib.parse import urlparse
    _u = urlparse(_db_url)
    DATABASES = {"default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": _u.path.lstrip("/"),
        "USER": _u.username, "PASSWORD": _u.password,
        "HOST": _u.hostname, "PORT": _u.port or 5432,
        "CONN_MAX_AGE": 60,
    }}
else:
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

USE_TZ = True
TIME_ZONE = "America/New_York"
LANGUAGE_CODE = "en-us"

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Arcade assets (images/sounds) stay on local disk, served through the API — see arcade/README.
MEDIA_ROOT = Path(env("MEDIA_ROOT", BASE_DIR / "media"))
MEDIA_URL = "media/"

# ── channels (websockets) ─────────────────────────────────────────────
_redis = env("REDIS_URL")
if _redis:
    CHANNEL_LAYERS = {"default": {"BACKEND": "channels_redis.core.RedisChannelLayer", "CONFIG": {"hosts": [_redis]}}}
else:
    CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}

# ── lesson files in object storage (Cloudflare R2, S3 API) ────────────
# Unset in dev: files go to MEDIA_ROOT/lesson-files and are served by Django at /lesson-files/.
R2_BUCKET = env("R2_BUCKET")
LESSON_FILES_BASE = env("LESSON_FILES_BASE", "")  # e.g. https://lessons.hsct.tech (the bucket's custom domain)
if R2_BUCKET:
    STORAGES = {
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
        "lessons": {
            "BACKEND": "storages.backends.s3.S3Storage",
            "OPTIONS": {
                "bucket_name": R2_BUCKET,
                "endpoint_url": env("R2_ENDPOINT"),  # https://<account id>.r2.cloudflarestorage.com
                "access_key": env("R2_ACCESS_KEY_ID"),
                "secret_key": env("R2_SECRET_ACCESS_KEY"),
                "region_name": "auto",
                "signature_version": "s3v4",
                "file_overwrite": True,
                "default_acl": None,
                "querystring_auth": False,
                "custom_domain": LESSON_FILES_BASE.replace("https://", "").replace("http://", "") or None,
                "object_parameters": {"CacheControl": "public, max-age=300"},
            },
        },
    }
else:
    STORAGES = {
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
        "lessons": {
            "BACKEND": "lessons.storage.OverwritingFileSystemStorage",
            "OPTIONS": {"location": str(MEDIA_ROOT / "lesson-files"), "base_url": "/lesson-files/"},
        },
    }

# ── API ───────────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework.authentication.SessionAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.UserRateThrottle", "rest_framework.throttling.AnonRateThrottle"],
    "DEFAULT_THROTTLE_RATES": {"user": "600/min", "anon": "300/min"},
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
}

# The site (hsct.tech on Cloudflare Pages) and the lesson files' domain, which
# is where the lesson kit runs — both call this API.
FRONTEND_ORIGINS = env_list("FRONTEND_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:8788,http://127.0.0.1:8000,http://localhost:8000")
CORS_ALLOWED_ORIGINS = FRONTEND_ORIGINS
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = FRONTEND_ORIGINS
WS_ALLOWED_ORIGINS = FRONTEND_ORIGINS

# On hsct.tech + api.hsct.tech, COOKIE_DOMAIN=.hsct.tech so the site can read the CSRF cookie.
SESSION_COOKIE_DOMAIN = env("COOKIE_DOMAIN") or None
CSRF_COOKIE_DOMAIN = env("COOKIE_DOMAIN") or None
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = CSRF_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_AGE = 60 * 60 * 24 * 30  # a month: the teacher's login
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
DATA_UPLOAD_MAX_MEMORY_SIZE = 8 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 8 * 1024 * 1024

# Teams
TEAM_MAX_MEMBERS_DEFAULT = 4
TEAM_EVENT_CAP = 5000  # events kept per team, server side

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}
