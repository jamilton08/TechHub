"""pygame.transform — scale, rotate, flip. Always returns a new Surface."""
import math
from . import _base
from ._base import host, pair
from .surface import Surface


def _new(src, sid, w, h):
    s = Surface._wrap(sid, w, h, True)
    s._alpha = src._alpha
    s._colorkey = src._colorkey
    return s


def _size(size):
    w, h = pair(size, "size")
    w, h = int(w), int(h)
    if w < 0 or h < 0:
        raise ValueError("Cannot scale to negative size")
    return w, h


def scale(surface, size, dest_surface=None):
    w, h = _size(size)
    sid = _base.new_id()
    host.t_scale(sid, surface._id, w, h, False)
    return _new(surface, sid, w, h)


def smoothscale(surface, size, dest_surface=None):
    w, h = _size(size)
    sid = _base.new_id()
    host.t_scale(sid, surface._id, w, h, True)
    return _new(surface, sid, w, h)


def scale_by(surface, factor, dest_surface=None):
    try:
        fx, fy = factor
    except TypeError:
        fx = fy = factor
    return scale(surface, (surface._w * fx, surface._h * fy))


def smoothscale_by(surface, factor, dest_surface=None):
    try:
        fx, fy = factor
    except TypeError:
        fx = fy = factor
    return smoothscale(surface, (surface._w * fx, surface._h * fy))


def scale2x(surface, dest_surface=None):
    return scale(surface, (surface._w * 2, surface._h * 2))


def _rotated(surface, angle, zoom, smooth):
    rad = math.radians(float(angle))
    c, s = abs(math.cos(rad)), abs(math.sin(rad))
    if abs(float(angle)) % 90 == 0:
        c, s = round(c), round(s)
    w = int(math.ceil((surface._w * c + surface._h * s) * zoom - 1e-9))
    h = int(math.ceil((surface._w * s + surface._h * c) * zoom - 1e-9))
    sid = _base.new_id()
    host.t_rotate(sid, surface._id, max(w, 0), max(h, 0), rad, float(zoom), bool(smooth))
    out = Surface._wrap(sid, max(w, 0), max(h, 0), True)
    out._alpha = surface._alpha
    return out


def rotate(surface, angle):
    return _rotated(surface, angle, 1.0, False)


def rotozoom(surface, angle, scale):
    return _rotated(surface, angle, float(scale), True)


def flip(surface, flip_x, flip_y):
    sid = _base.new_id()
    host.t_flip(sid, surface._id, bool(flip_x), bool(flip_y))
    return _new(surface, sid, surface._w, surface._h)


def chop(surface, rect):
    return surface.copy()


def grayscale(surface, dest_surface=None):
    return surface.copy()


def average_color(surface, rect=None, consider_alpha=False):
    return surface.get_at((surface._w // 2, surface._h // 2))
