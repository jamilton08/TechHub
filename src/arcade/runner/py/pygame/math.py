"""pygame.math — Vector2 and Vector3."""
import math as _m


def clamp(value, min_value, max_value):
    return max(min_value, min(max_value, value))


def lerp(a, b, weight):
    return a + (b - a) * weight


def invlerp(a, b, value):
    return (value - a) / (b - a)


def remap(i_min, i_max, o_min, o_max, value):
    return lerp(o_min, o_max, invlerp(i_min, i_max, value))


def _vals(args, n):
    if len(args) == 0:
        return [0.0] * n
    if len(args) == 1:
        a = args[0]
        if isinstance(a, (int, float)):
            return [float(a)] * n
        vals = list(a)
        if len(vals) != n:
            raise ValueError("Vector%d needs %d numbers, got %r" % (n, n, a))
        return [float(v) for v in vals]
    if len(args) == n:
        return [float(v) for v in args]
    raise TypeError("Vector%d() takes %d numbers" % (n, n))


class _Vec:
    __slots__ = ("_v",)
    N = 2

    def __init__(self, *args):
        self._v = _vals(args, self.N)

    def _new(self, vals):
        v = self.__class__.__new__(self.__class__)
        v._v = list(vals)
        return v

    def _other(self, o):
        if isinstance(o, _Vec):
            return o._v
        return _vals((o,), self.N)

    # sequence
    def __len__(self): return self.N
    def __getitem__(self, i): return self._v[i]

    def __setitem__(self, i, value):
        if isinstance(i, slice):
            vals = list(self._v)
            vals[i] = [float(x) for x in value]
            if len(vals) != self.N:
                raise ValueError("slice changed the vector's length")
            self._v = vals
        else:
            self._v[i] = float(value)

    def __iter__(self): return iter(self._v)
    def __repr__(self): return "<Vector%d(%s)>" % (self.N, ", ".join(repr(v) for v in self._v))
    def __str__(self): return "[%s]" % ", ".join("%g" % v for v in self._v)

    def __eq__(self, o):
        try:
            return self._v == self._other(o)
        except (TypeError, ValueError):
            return NotImplemented

    def __ne__(self, o):
        r = self.__eq__(o)
        return r if r is NotImplemented else not r

    __hash__ = None

    def __bool__(self): return any(self._v)

    # arithmetic
    def __add__(self, o): return self._new(a + b for a, b in zip(self._v, self._other(o)))
    __radd__ = __add__
    def __sub__(self, o): return self._new(a - b for a, b in zip(self._v, self._other(o)))
    def __rsub__(self, o): return self._new(b - a for a, b in zip(self._v, self._other(o)))
    def __neg__(self): return self._new(-a for a in self._v)
    def __pos__(self): return self._new(self._v)

    def __mul__(self, o):
        if isinstance(o, (int, float)):
            return self._new(a * o for a in self._v)
        return sum(a * b for a, b in zip(self._v, self._other(o)))

    __rmul__ = __mul__

    def __truediv__(self, o): return self._new(a / o for a in self._v)
    def __floordiv__(self, o): return self._new(a // o for a in self._v)
    def __mod__(self, o):
        if isinstance(o, (int, float)):
            return self._new(a % o for a in self._v)
        return self._new(a % b for a, b in zip(self._v, self._other(o)))

    def __abs__(self): return self.length()
    def __round__(self, n=None): return self._new(round(a, n) for a in self._v)

    def __iadd__(self, o):
        self._v = [a + b for a, b in zip(self._v, self._other(o))]
        return self

    def __isub__(self, o):
        self._v = [a - b for a, b in zip(self._v, self._other(o))]
        return self

    def __imul__(self, o):
        self._v = [a * o for a in self._v]
        return self

    def __itruediv__(self, o):
        self._v = [a / o for a in self._v]
        return self

    def __copy__(self): return self._new(self._v)
    def copy(self): return self._new(self._v)

    # geometry
    def dot(self, o): return sum(a * b for a, b in zip(self._v, self._other(o)))
    def length(self): return _m.sqrt(sum(a * a for a in self._v))
    magnitude = length
    def length_squared(self): return sum(a * a for a in self._v)
    magnitude_squared = length_squared

    def normalize(self):
        n = self.length()
        if n == 0:
            raise ValueError("Can't normalize Vector of length Zero")
        return self._new(a / n for a in self._v)

    def normalize_ip(self):
        self._v = self.normalize()._v

    def is_normalized(self): return abs(self.length_squared() - 1) < 1e-6

    def scale_to_length(self, value):
        n = self.length()
        if n == 0:
            raise ValueError("Cannot scale a vector with zero length")
        self._v = [a * value / n for a in self._v]

    def distance_to(self, o): return _m.sqrt(self.distance_squared_to(o))
    def distance_squared_to(self, o): return sum((a - b) ** 2 for a, b in zip(self._v, self._other(o)))

    def lerp(self, o, t):
        if not 0 <= t <= 1:
            raise ValueError("Argument 2 must be in range [0, 1]")
        return self._new(a + (b - a) * t for a, b in zip(self._v, self._other(o)))

    def reflect(self, normal):
        n = self._new(self._other(normal)).normalize()
        return self - n * (2 * self.dot(n))

    def reflect_ip(self, normal):
        self._v = self.reflect(normal)._v

    def clamp_magnitude(self, *args):
        lo, hi = (0, args[0]) if len(args) == 1 else args
        n = self.length()
        if n == 0:
            return self.copy()
        target = max(lo, min(hi, n))
        return self._new(a * target / n for a in self._v)

    def clamp_magnitude_ip(self, *args):
        self._v = self.clamp_magnitude(*args)._v

    def move_towards(self, target, max_distance):
        t = self._new(self._other(target))
        delta = t - self
        d = delta.length()
        if d <= max_distance or d == 0:
            return t
        return self + delta * (max_distance / d)

    def move_towards_ip(self, target, max_distance):
        self._v = self.move_towards(target, max_distance)._v

    def update(self, *args):
        self._v = _vals(args, self.N)

    def elementwise(self):
        return self


class Vector2(_Vec):
    __slots__ = ()
    N = 2

    x = property(lambda s: s._v[0], lambda s, v: s._v.__setitem__(0, float(v)))
    y = property(lambda s: s._v[1], lambda s, v: s._v.__setitem__(1, float(v)))

    @property
    def xy(self): return Vector2(self._v)
    @xy.setter
    def xy(self, v): self._v = _vals((v,), 2)

    @property
    def yx(self): return Vector2(self._v[1], self._v[0])

    def cross(self, o):
        ox, oy = self._other(o)
        return self._v[0] * oy - self._v[1] * ox

    def rotate(self, angle):
        return self.rotate_rad(_m.radians(angle))

    def rotate_rad(self, angle):
        c, s = _m.cos(angle), _m.sin(angle)
        x, y = self._v
        return Vector2(x * c - y * s, x * s + y * c)

    def rotate_ip(self, angle): self._v = self.rotate(angle)._v
    def rotate_rad_ip(self, angle): self._v = self.rotate_rad(angle)._v

    def angle_to(self, o):
        ox, oy = self._other(o)
        return _m.degrees(_m.atan2(oy, ox) - _m.atan2(self._v[1], self._v[0]))

    def as_polar(self):
        return (self.length(), _m.degrees(_m.atan2(self._v[1], self._v[0])))

    def from_polar(self, polar):
        r, a = polar
        a = _m.radians(a)
        self._v = [r * _m.cos(a), r * _m.sin(a)]

    def project(self, o):
        o = Vector2(self._other(o))
        return o * (self.dot(o) / o.length_squared())

    @property
    def angle(self):
        return _m.degrees(_m.atan2(self._v[1], self._v[0]))

    @property
    def angle_rad(self):
        return _m.atan2(self._v[1], self._v[0])


class Vector3(_Vec):
    __slots__ = ()
    N = 3

    x = property(lambda s: s._v[0], lambda s, v: s._v.__setitem__(0, float(v)))
    y = property(lambda s: s._v[1], lambda s, v: s._v.__setitem__(1, float(v)))
    z = property(lambda s: s._v[2], lambda s, v: s._v.__setitem__(2, float(v)))

    @property
    def xy(self): return Vector2(self._v[0], self._v[1])

    def cross(self, o):
        a, b, c = self._v
        x, y, z = self._other(o)
        return Vector3(b * z - c * y, c * x - a * z, a * y - b * x)

    def rotate_z(self, angle):
        c, s = _m.cos(_m.radians(angle)), _m.sin(_m.radians(angle))
        x, y, z = self._v
        return Vector3(x * c - y * s, x * s + y * c, z)

    def angle_to(self, o):
        ov = Vector3(self._other(o))
        d = self.length() * ov.length()
        if d == 0:
            return 0.0
        return _m.degrees(_m.acos(max(-1.0, min(1.0, self.dot(ov) / d))))
