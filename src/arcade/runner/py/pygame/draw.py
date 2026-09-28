"""pygame.draw — shapes onto a Surface."""
import math
from pyodide.ffi import to_js
from ._base import host, css, pair
from .rect import Rect


def _c(surface, color):
    return css(color, not surface._srcalpha)


def _bounds(surface, x, y, w, h):
    return Rect(x, y, w, h).clip(Rect(0, 0, surface._w, surface._h)) if w and h else Rect(x, y, 0, 0)


def _pts(points):
    flat = []
    for p in points:
        x, y = pair(p, "point")
        flat.append(float(x))
        flat.append(float(y))
    return flat


def rect(surface, color, rect, width=0, border_radius=0, border_top_left_radius=-1,
         border_top_right_radius=-1, border_bottom_left_radius=-1, border_bottom_right_radius=-1):
    r = Rect(rect)
    r.normalize()
    width = int(width)
    if width < 0:
        return Rect(r.x, r.y, 0, 0)
    host.d_rect(surface._id, _c(surface, color), r.x, r.y, r.w, r.h, width, max(0, int(border_radius)))
    return _bounds(surface, r.x, r.y, r.w, r.h)


def circle(surface, color, center, radius, width=0, draw_top_right=None, draw_top_left=None,
           draw_bottom_left=None, draw_bottom_right=None):
    cx, cy = pair(center, "center")
    radius = int(radius)
    width = int(width)
    if radius < 1 or width < 0:
        return Rect(int(cx), int(cy), 0, 0)
    host.d_circle(surface._id, _c(surface, color), float(cx), float(cy), radius, width)
    return _bounds(surface, int(cx) - radius, int(cy) - radius, radius * 2, radius * 2)


def ellipse(surface, color, rect, width=0):
    r = Rect(rect)
    r.normalize()
    if int(width) < 0:
        return Rect(r.x, r.y, 0, 0)
    host.d_ellipse(surface._id, _c(surface, color), r.x, r.y, r.w, r.h, int(width))
    return _bounds(surface, r.x, r.y, r.w, r.h)


def arc(surface, color, rect, start_angle, stop_angle, width=1):
    r = Rect(rect)
    r.normalize()
    start, stop = float(start_angle), float(stop_angle)
    if stop < start:
        stop += math.tau
    host.d_arc(surface._id, _c(surface, color), r.x, r.y, r.w, r.h, start, stop, int(width))
    return _bounds(surface, r.x, r.y, r.w, r.h)


def line(surface, color, start_pos, end_pos, width=1):
    x1, y1 = pair(start_pos, "start_pos")
    x2, y2 = pair(end_pos, "end_pos")
    width = int(width)
    if width < 1:
        return Rect(int(x1), int(y1), 0, 0)
    host.d_line(surface._id, _c(surface, color), float(x1), float(y1), float(x2), float(y2), width)
    x, y = int(min(x1, x2)), int(min(y1, y2))
    return _bounds(surface, x, y, int(abs(x2 - x1)) + width, int(abs(y2 - y1)) + width)


def aaline(surface, color, start_pos, end_pos, blend=1):
    return line(surface, color, start_pos, end_pos, 1)


def lines(surface, color, closed, points, width=1):
    flat = _pts(points)
    if len(flat) < 4:
        raise ValueError("points argument must contain 2 or more points")
    width = int(width)
    if width < 1:
        return Rect(int(flat[0]), int(flat[1]), 0, 0)
    host.d_poly(surface._id, _c(surface, color), to_js(flat), bool(closed), width)
    return _poly_bounds(surface, flat)


def aalines(surface, color, closed, points, blend=1):
    return lines(surface, color, closed, points, 1)


def polygon(surface, color, points, width=0):
    flat = _pts(points)
    if len(flat) < 6:
        raise ValueError("points argument must contain more than 2 points")
    width = int(width)
    if width < 0:
        return Rect(int(flat[0]), int(flat[1]), 0, 0)
    host.d_poly(surface._id, _c(surface, color), to_js(flat), True, width)
    return _poly_bounds(surface, flat)


def aapolygon(surface, color, points, blend=1):
    return polygon(surface, color, points, 1)


def _poly_bounds(surface, flat):
    xs, ys = flat[0::2], flat[1::2]
    x, y = int(min(xs)), int(min(ys))
    return _bounds(surface, x, y, int(max(xs)) - x + 1, int(max(ys)) - y + 1)
