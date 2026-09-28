"""pygame — HSCT Arcade web edition.

A browser version of the pygame API (the parts classes actually use).
Code written against it runs unchanged on a real computer with
`pip install pygame-ce`. What's here: display, draw, Surface, Rect,
Color, event, key, mouse, time, font, image, transform, mixer, sprite,
math, mask, gfxdraw.
"""
from ._base import error
from .constants import *  # noqa: F401,F403
from .rect import Rect, FRect
from .color import Color
from .surface import Surface
from .math import Vector2, Vector3
from . import (display, draw, event, key, mouse, time, font, image, transform, mixer, sprite,
               math, mask, gfxdraw, joystick, version, locals)
from . import _base

SurfaceType = Surface
BufferProxy = None
IS_CE = True
HAVE_NEWBUF = False
__version__ = version.ver

_initialized = False


def init():
    global _initialized
    _initialized = True
    display.init()
    font.init()
    mixer.init()
    return (5, 0)


def quit():
    global _initialized
    _initialized = False
    try:
        mixer.quit()
    finally:
        display.quit()
        font.quit()


def get_init():
    return _initialized


def get_error():
    return ""


def set_error(message):
    pass


def get_sdl_version(linked=True):
    return (2, 30, 0)


def get_sdl_byteorder():
    return 1234


def register_quit(callable):
    pass


def encode_string(obj, encoding="unicode_escape", errors="backslashreplace", etype=None):
    return obj.encode(encoding, errors) if isinstance(obj, str) else obj


def encode_file_path(obj, etype=None):
    return encode_string(obj, "utf-8", "strict")


def _reset():
    global _initialized
    _initialized = False
    _base.reset()
