"""pygame.Surface — an image you can draw on. The pixels live in the
browser (an OffscreenCanvas); this object holds its id and size."""
from . import _base
from ._base import host, css, rgba, error, pair
from .rect import Rect
from .constants import SRCALPHA


def _size(size):
    try:
        w, h = size
        w, h = int(w), int(h)
    except (TypeError, ValueError):
        raise TypeError("Surface size must be (width, height), got %r" % (size,)) from None
    if w < 0 or h < 0:
        raise error("Invalid resolution for Surface")
    return w, h


class Surface:
    def __init__(self, size, flags=0, depth=0, masks=None):
        w, h = _size(size)
        self._id = _base.new_id()
        self._w, self._h = w, h
        self._srcalpha = bool(flags & SRCALPHA) or depth == 32 and masks is not None
        self._alpha = None
        self._colorkey = None
        self._clip = None
        host.s_new(self._id, w, h, self._srcalpha)

    @classmethod
    def _wrap(cls, sid, w, h, srcalpha=True):
        s = cls.__new__(cls)
        s._id, s._w, s._h = sid, w, h
        s._srcalpha = srcalpha
        s._alpha = None
        s._colorkey = None
        s._clip = None
        return s

    def __del__(self):
        try:
            if self._id:
                host.s_free(self._id)
        except Exception:
            pass

    def __repr__(self):
        return "<Surface(%dx%dx32%s)>" % (self._w, self._h, " SW" if not self._srcalpha else "")

    # ── size ───────────────────────────────────────────────────────────
    def get_size(self): return (self._w, self._h)
    def get_width(self): return self._w
    def get_height(self): return self._h

    def get_rect(self, **kwargs):
        r = Rect(0, 0, self._w, self._h)
        for k, v in kwargs.items():
            setattr(r, k, v)
        return r

    get_frect = get_rect

    def get_bounding_rect(self, min_alpha=1):
        return self.get_rect()

    def get_flags(self): return SRCALPHA if self._srcalpha else 0
    def get_bitsize(self): return 32
    def get_bytesize(self): return 4
    def get_pitch(self): return self._w * 4
    def get_abs_offset(self): return (0, 0)
    def get_offset(self): return (0, 0)
    def get_parent(self): return None
    def get_abs_parent(self): return self
    def get_locked(self): return False
    def get_locks(self): return ()
    def lock(self): pass
    def unlock(self): pass
    def mustlock(self): return False
    def get_shifts(self): return (16, 8, 0, 24)
    def get_masks(self): return (0xFF0000, 0xFF00, 0xFF, 0xFF000000 if self._srcalpha else 0)
    def get_losses(self): return (0, 0, 0, 0 if self._srcalpha else 8)

    def get_clip(self):
        return self._clip.copy() if self._clip else self.get_rect()

    def set_clip(self, rect=None):
        self._clip = Rect(rect) if rect is not None else None

    # ── pixels ─────────────────────────────────────────────────────────
    def _area(self, rect):
        full = Rect(0, 0, self._w, self._h)
        if rect is None:
            return full
        r = Rect(rect)
        r.normalize()
        return r.clip(full)

    def fill(self, color, rect=None, special_flags=0):
        area = self._area(rect)
        if area.w and area.h:
            c = rgba(color)
            host.s_fill(self._id, "" if (self._srcalpha and c[3] == 0) else css(color, not self._srcalpha),
                        area.x, area.y, area.w, area.h)
        return area

    def blit(self, source, dest=(0, 0), area=None, special_flags=0):
        if not isinstance(source, Surface):
            raise TypeError("blit() needs a Surface to draw, got %s" % type(source).__name__)
        if isinstance(dest, Rect):
            dx, dy = dest.x, dest.y
        else:
            try:
                if len(dest) == 4:
                    dx, dy = dest[0], dest[1]
                else:
                    dx, dy = dest
            except (TypeError, ValueError):
                raise TypeError("blit() position must be (x, y) or a Rect, got %r" % (dest,)) from None
        dx, dy = int(dx), int(dy)
        if area is not None:
            a = Rect(area)
            src = a.clip(Rect(0, 0, source._w, source._h))
            dx += src.x - a.x
            dy += src.y - a.y
            host.s_blit(self._id, source._id, dx, dy, src.x, src.y, src.w, src.h, int(special_flags))
            w, h = src.w, src.h
        else:
            host.s_blit(self._id, source._id, dx, dy, 0, 0, -1, -1, int(special_flags))
            w, h = source._w, source._h
        return Rect(dx, dy, w, h).clip(Rect(0, 0, self._w, self._h))

    def blits(self, blit_sequence, doreturn=1):
        out = []
        for item in blit_sequence:
            r = self.blit(*item)
            if doreturn:
                out.append(r)
        return out if doreturn else None

    def fblits(self, blit_sequence, special_flags=0):
        for src, dest in blit_sequence:
            self.blit(src, dest, None, special_flags)

    def copy(self):
        sid = _base.new_id()
        host.s_copy(sid, self._id, 0, 0, self._w, self._h)
        s = Surface._wrap(sid, self._w, self._h, self._srcalpha)
        s._alpha, s._colorkey = self._alpha, self._colorkey
        return s

    __copy__ = copy

    def convert(self, *args):
        """Like real pygame: the copy has no per-pixel transparency."""
        s = self.copy()
        s._srcalpha = False
        host.s_flatten(s._id)
        return s

    def convert_alpha(self, *args):
        s = self.copy()
        s._srcalpha = True
        return s

    def premul_alpha(self):
        return self.copy()

    def subsurface(self, *rect):
        r = Rect(*rect)
        if not Rect(0, 0, self._w, self._h).contains(r):
            raise ValueError("subsurface rectangle outside surface area")
        sid = _base.new_id()
        host.s_copy(sid, self._id, r.x, r.y, r.w, r.h)
        s = Surface._wrap(sid, r.w, r.h, self._srcalpha)
        s._alpha, s._colorkey = self._alpha, self._colorkey
        return s

    def scroll(self, dx=0, dy=0):
        host.s_scroll(self._id, int(dx), int(dy))

    def get_at(self, pos):
        from .color import Color
        x, y = pair(pos)
        x, y = int(x), int(y)
        if not (0 <= x < self._w and 0 <= y < self._h):
            raise IndexError("pixel index out of range")
        v = host.s_get_at(self._id, x, y)
        return Color((v >> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255 if self._srcalpha else 255)

    def set_at(self, pos, color):
        x, y = pair(pos)
        x, y = int(x), int(y)
        if 0 <= x < self._w and 0 <= y < self._h:
            host.s_set_at(self._id, x, y, css(color, not self._srcalpha))

    def get_at_mapped(self, pos):
        c = self.get_at(pos)
        return self.map_rgb(c)

    def map_rgb(self, color):
        r, g, b, a = rgba(color)
        return (a << 24 if self._srcalpha else 0) | (r << 16) | (g << 8) | b

    def unmap_rgb(self, value):
        from .color import Color
        return Color((value >> 16) & 255, (value >> 8) & 255, value & 255, (value >> 24) & 255 if self._srcalpha else 255)

    # ── transparency ───────────────────────────────────────────────────
    def set_alpha(self, value=None, flags=0):
        if value is None:
            self._alpha = None
            host.s_alpha(self._id, -1)
        else:
            self._alpha = max(0, min(255, int(value)))
            host.s_alpha(self._id, self._alpha)

    def get_alpha(self):
        if self._alpha is not None:
            return self._alpha
        return 255 if self._srcalpha else None

    def set_colorkey(self, color=None, flags=0):
        if color is None:
            self._colorkey = None
            host.s_colorkey(self._id, -1, 0, 0)
        else:
            r, g, b, _ = rgba(color)
            self._colorkey = (r, g, b, 255)
            host.s_colorkey(self._id, r, g, b)

    def get_colorkey(self):
        return self._colorkey

    # ── not available in the browser ───────────────────────────────────
    def get_view(self, *a):
        raise NotImplementedError("Surface.get_view() isn't available in the HSCT Arcade")

    get_buffer = get_view
