"""pygame.mask — pixel-perfect collisions. The bits live in the browser."""
from . import _base
from ._base import host, pair
from .rect import Rect


class Mask:
    def __init__(self, size, fill=False):
        w, h = pair(size, "size")
        self._w, self._h = int(w), int(h)
        self._id = _base.new_id()
        host.m_new(self._id, self._w, self._h, bool(fill))

    @classmethod
    def _wrap(cls, mid, w, h):
        m = cls.__new__(cls)
        m._id, m._w, m._h = mid, w, h
        return m

    def __del__(self):
        try:
            host.m_free(self._id)
        except Exception:
            pass

    def get_size(self):
        return (self._w, self._h)

    def get_rect(self, **kwargs):
        r = Rect(0, 0, self._w, self._h)
        for k, v in kwargs.items():
            setattr(r, k, v)
        return r

    def get_at(self, pos):
        x, y = pair(pos)
        if not (0 <= x < self._w and 0 <= y < self._h):
            raise IndexError("x or y out of bounds")
        return host.m_get_at(self._id, int(x), int(y))

    def set_at(self, pos, value=1):
        x, y = pair(pos)
        host.m_set_at(self._id, int(x), int(y), 1 if value else 0)

    def overlap(self, other, offset):
        ox, oy = pair(offset, "offset")
        v = host.m_overlap(self._id, other._id, int(ox), int(oy))
        return None if v < 0 else (v // 65536, v % 65536)

    def overlap_area(self, other, offset):
        ox, oy = pair(offset, "offset")
        return host.m_overlap_area(self._id, other._id, int(ox), int(oy))

    def overlap_mask(self, other, offset):
        ox, oy = pair(offset, "offset")
        mid = _base.new_id()
        host.m_overlap_mask(mid, self._id, other._id, int(ox), int(oy))
        return Mask._wrap(mid, self._w, self._h)

    def count(self):
        return host.m_count(self._id)

    def fill(self):
        host.m_fill(self._id, 1)

    def clear(self):
        host.m_fill(self._id, 0)

    def invert(self):
        host.m_invert(self._id)

    def copy(self):
        mid = _base.new_id()
        host.m_copy(mid, self._id)
        return Mask._wrap(mid, self._w, self._h)

    __copy__ = copy

    def centroid(self):
        v = host.m_centroid(self._id)
        return (v // 65536, v % 65536)

    def get_bounding_rects(self):
        v = host.m_bounds(self._id)
        if not v:
            return []
        x, y, w, h = _base.split_ints(v)
        return [Rect(x, y, w, h)]

    def to_surface(self, surface=None, setsurface=None, unsetsurface=None, setcolor=(255, 255, 255, 255),
                   unsetcolor=(0, 0, 0, 255), dest=(0, 0)):
        from .surface import Surface
        out = Surface((self._w, self._h), 65536)
        out.fill(unsetcolor)
        host.m_draw(out._id, self._id, _base.css(setcolor))
        if surface is not None:
            surface.blit(out, dest)
            return surface
        return out


def from_surface(surface, threshold=127):
    mid = _base.new_id()
    host.m_from_surface(mid, surface._id, int(threshold))
    return Mask._wrap(mid, surface._w, surface._h)


def from_threshold(surface, color, threshold=(0, 0, 0, 255), othersurface=None, palette_colors=1):
    return from_surface(surface)
