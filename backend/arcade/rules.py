"""Limits and file-name rules. Keep these in step with
src/arcade/store/model.js on the frontend."""
import re

MAX_FILES = 30
MAX_FILE_CHARS = 200_000
MAX_ASSETS = 40
MAX_ASSET_BYTES = 5 * 1024 * 1024
MAX_PROJECT_ASSET_BYTES = 25 * 1024 * 1024
MAX_TITLE = 80
MAX_NAME = 60

CODE_NAME = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*\.py$")
TEXT_NAME = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_. -]*\.(txt|json|csv|md)$", re.IGNORECASE)
ASSET_NAME = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_. -]*\.([A-Za-z0-9]+)$")

# Only these, served with these types. No SVG or HTML: those can carry scripts.
ASSET_TYPES = {
    "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "gif": "image/gif",
    "webp": "image/webp", "bmp": "image/bmp",
    "wav": "audio/wav", "mp3": "audio/mpeg", "ogg": "audio/ogg", "m4a": "audio/mp4",
    "ttf": "font/ttf", "otf": "font/otf", "woff": "font/woff", "woff2": "font/woff2",
}

SHADOWING = {"pygame.py", "random.py", "math.py", "time.py", "json.py", "sys.py", "os.py"}


def file_name_problem(name):
    if not isinstance(name, str) or not name:
        return "File name is required."
    if len(name) > MAX_NAME:
        return "File name is too long."
    if name.lower() in SHADOWING:
        return f"{name} would hide Python's own module of that name."
    if name.endswith(".py"):
        return None if CODE_NAME.match(name) else "Python file names use letters, numbers and _ only."
    return None if TEXT_NAME.match(name) else "Only .py, .txt, .json, .csv and .md files can hold code or text."


def asset_type(name):
    """The content type to store/serve for an asset name, or None if not allowed."""
    if not isinstance(name, str) or len(name) > MAX_NAME:
        return None
    m = ASSET_NAME.match(name)
    return ASSET_TYPES.get(m.group(1).lower()) if m else None


# A few bytes at the start of each kind of file, to catch a renamed .exe.
_MAGIC = {
    "image/png": [b"\x89PNG"],
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/gif": [b"GIF87a", b"GIF89a"],
    "image/webp": [b"RIFF"],
    "image/bmp": [b"BM"],
    "audio/wav": [b"RIFF"],
    "audio/ogg": [b"OggS"],
    "audio/mpeg": [b"ID3", b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"],
    "font/woff": [b"wOFF"],
    "font/woff2": [b"wOF2"],
    "font/ttf": [b"\x00\x01\x00\x00", b"true"],
    "font/otf": [b"OTTO"],
}


def looks_like(content_type, head):
    options = _MAGIC.get(content_type)
    if not options:  # m4a and friends: no simple signature check
        return True
    return any(head.startswith(sig) for sig in options)
