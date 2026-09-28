"""pygame.gfxdraw — the older drawing API, mapped onto pygame.draw."""
import math
from . import draw
from .rect import Rect


def pixel(surface, x, y, color):
    surface.set_at((x, y), color)


def hline(surface, x1, x2, y, color):
    draw.line(surface, color, (min(x1, x2), y), (max(x1, x2), y))


def vline(surface, x, y1, y2, color):
    draw.line(surface, color, (x, min(y1, y2)), (x, max(y1, y2)))


def line(surface, x1, y1, x2, y2, color):
    draw.line(surface, color, (x1, y1), (x2, y2))


def rectangle(surface, rect, color):
    draw.rect(surface, color, rect, 1)


def box(surface, rect, color):
    draw.rect(surface, color, rect)


def circle(surface, x, y, r, color):
    draw.circle(surface, color, (x, y), r, 1)


aacircle = circle


def filled_circle(surface, x, y, r, color):
    draw.circle(surface, color, (x, y), r)


def ellipse(surface, x, y, rx, ry, color):
    draw.ellipse(surface, color, Rect(x - rx, y - ry, rx * 2, ry * 2), 1)


aaellipse = ellipse


def filled_ellipse(surface, x, y, rx, ry, color):
    draw.ellipse(surface, color, Rect(x - rx, y - ry, rx * 2, ry * 2))


def arc(surface, x, y, r, start_angle, stop_angle, color):
    # gfxdraw uses degrees, clockwise
    draw.arc(surface, color, Rect(x - r, y - r, r * 2, r * 2),
             math.radians(-stop_angle), math.radians(-start_angle), 1)


def pie(surface, x, y, r, start_angle, stop_angle, color):
    arc(surface, x, y, r, start_angle, stop_angle, color)
    for a in (start_angle, stop_angle):
        draw.line(surface, color, (x, y), (x + r * math.cos(math.radians(a)), y + r * math.sin(math.radians(a))))


def trigon(surface, x1, y1, x2, y2, x3, y3, color):
    draw.polygon(surface, color, [(x1, y1), (x2, y2), (x3, y3)], 1)


aatrigon = trigon


def filled_trigon(surface, x1, y1, x2, y2, x3, y3, color):
    draw.polygon(surface, color, [(x1, y1), (x2, y2), (x3, y3)])


def polygon(surface, points, color):
    draw.polygon(surface, color, points, 1)


aapolygon = polygon


def filled_polygon(surface, points, color):
    draw.polygon(surface, color, points)


def textured_polygon(surface, points, texture, tx, ty):
    draw.polygon(surface, (128, 128, 128), points)


def bezier(surface, points, steps, color):
    pts = list(points)
    out = []
    for i in range(steps + 1):
        t = i / steps
        p = pts[:]
        while len(p) > 1:
            p = [(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t) for a, b in zip(p, p[1:])]
        out.append(p[0])
    draw.lines(surface, color, False, out, 1)
