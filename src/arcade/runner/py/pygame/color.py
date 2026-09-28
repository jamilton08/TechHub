"""pygame.Color"""
from ._base import rgba, _NAMED


def _clamp(v):
    return max(0, min(255, int(v)))


class Color:
    __slots__ = ("r", "g", "b", "a")

    def __init__(self, *args):
        if len(args) == 1:
            self.r, self.g, self.b, self.a = rgba(args[0])
        elif len(args) in (3, 4):
            self.r, self.g, self.b, self.a = rgba(args)
        else:
            raise ValueError("Color needs a name, a hex string, or 3-4 numbers")

    def __iter__(self):
        return iter((self.r, self.g, self.b, self.a))

    def __len__(self):
        return 4

    def __getitem__(self, i):
        return (self.r, self.g, self.b, self.a)[i]

    def __setitem__(self, i, v):
        vals = [self.r, self.g, self.b, self.a]
        vals[i] = v
        self.r, self.g, self.b, self.a = (_clamp(n) for n in vals)

    def __eq__(self, other):
        try:
            return tuple(self) == rgba(other)
        except (TypeError, ValueError):
            return NotImplemented

    def __hash__(self):
        return hash(tuple(self))

    def __repr__(self):
        return "Color(%d, %d, %d, %d)" % (self.r, self.g, self.b, self.a)

    def __add__(self, o):
        o = Color(o)
        return Color(*(min(255, a + b) for a, b in zip(self, o)))

    def __sub__(self, o):
        o = Color(o)
        return Color(*(max(0, a - b) for a, b in zip(self, o)))

    def __mul__(self, o):
        o = Color(o)
        return Color(*(min(255, a * b) for a, b in zip(self, o)))

    def __invert__(self):
        return Color(255 - self.r, 255 - self.g, 255 - self.b, 255 - self.a)

    def __int__(self):
        return (self.r << 24) | (self.g << 16) | (self.b << 8) | self.a

    def lerp(self, color, amount):
        o = Color(color)
        t = float(amount)
        if not 0 <= t <= 1:
            raise ValueError("amount must be between 0 and 1")
        return Color(*(round(a + (b - a) * t) for a, b in zip(self, o)))

    def grayscale(self):
        v = round(0.299 * self.r + 0.587 * self.g + 0.114 * self.b)
        return Color(v, v, v, self.a)

    def normalize(self):
        return tuple(v / 255 for v in self)

    def update(self, *args):
        c = Color(*args)
        self.r, self.g, self.b, self.a = c

    def correct_gamma(self, gamma):
        return Color(*(round(((v / 255) ** gamma) * 255) for v in (self.r, self.g, self.b)), self.a)

    @property
    def rgb(self):
        return (self.r, self.g, self.b)

    @property
    def hsva(self):
        import colorsys
        h, s, v = colorsys.rgb_to_hsv(self.r / 255, self.g / 255, self.b / 255)
        return (h * 360, s * 100, v * 100, self.a / 255 * 100)

    @hsva.setter
    def hsva(self, value):
        import colorsys
        h, s, v = value[0], value[1], value[2]
        a = value[3] if len(value) > 3 else 100
        r, g, b = colorsys.hsv_to_rgb(h / 360, s / 100, v / 100)
        self.r, self.g, self.b, self.a = round(r * 255), round(g * 255), round(b * 255), round(a / 100 * 255)

    @property
    def hsla(self):
        import colorsys
        h, l, s = colorsys.rgb_to_hls(self.r / 255, self.g / 255, self.b / 255)
        return (h * 360, s * 100, l * 100, self.a / 255 * 100)

    @hsla.setter
    def hsla(self, value):
        import colorsys
        h, s, l = value[0], value[1], value[2]
        a = value[3] if len(value) > 3 else 100
        r, g, b = colorsys.hls_to_rgb(h / 360, l / 100, s / 100)
        self.r, self.g, self.b, self.a = round(r * 255), round(g * 255), round(b * 255), round(a / 100 * 255)

    @classmethod
    def from_hsva(cls, h, s, v, a=100):
        c = cls(0, 0, 0)
        c.hsva = (h, s, v, a)
        return c

    @classmethod
    def from_hsla(cls, h, s, l, a=100):
        c = cls(0, 0, 0)
        c.hsla = (h, s, l, a)
        return c


THECOLORS = {name: v + (255,) for name, v in _NAMED.items()}
