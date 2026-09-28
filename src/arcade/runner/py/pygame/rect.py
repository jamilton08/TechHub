"""pygame.Rect — pure Python, same behavior as the real one."""


def _num(v):
    if isinstance(v, bool):
        return int(v)
    if isinstance(v, int):
        return v
    try:
        return int(v)
    except (TypeError, ValueError):
        raise TypeError("Rect values must be numbers, got %r" % (v,)) from None


def _fnum(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        raise TypeError("FRect values must be numbers, got %r" % (v,)) from None


def _rect_args(args, cv=_num):
    if len(args) == 1:
        a = args[0]
        if isinstance(a, Rect):
            return cv(a._x), cv(a._y), cv(a._w), cv(a._h)
        if hasattr(a, "rect"):
            r = a.rect() if callable(a.rect) else a.rect
            return _rect_args((r,), cv)
        try:
            n = len(a)
        except TypeError:
            raise TypeError("Argument must be rect style object, got %r" % (a,)) from None
        if n == 4:
            return tuple(cv(v) for v in a)
        if n == 2:
            (x, y), (w, h) = a
            return cv(x), cv(y), cv(w), cv(h)
    elif len(args) == 2:
        (x, y), (w, h) = args
        return cv(x), cv(y), cv(w), cv(h)
    elif len(args) == 4:
        return tuple(cv(v) for v in args)
    raise TypeError("Argument must be rect style object: Rect(x, y, width, height)")


def _xy(args):
    if len(args) == 1:
        x, y = args[0]
    elif len(args) == 2:
        x, y = args
    else:
        raise TypeError("expected a point (x, y)")
    return x, y


class Rect:
    __slots__ = ("_x", "_y", "_w", "_h")
    _cv = staticmethod(_num)          # Rect keeps whole numbers; FRect keeps floats

    @staticmethod
    def _half(v):
        return v // 2

    def __init__(self, *args):
        self._x, self._y, self._w, self._h = _rect_args(args, self._cv)

    # ── the four stored values ───────────────────────────────────────
    x = property(lambda s: s._x, lambda s, v: setattr(s, "_x", s._cv(v)))
    y = property(lambda s: s._y, lambda s, v: setattr(s, "_y", s._cv(v)))
    w = property(lambda s: s._w, lambda s, v: setattr(s, "_w", s._cv(v)))
    h = property(lambda s: s._h, lambda s, v: setattr(s, "_h", s._cv(v)))
    width = w
    height = h
    left = x
    top = y

    @property
    def right(self): return self._x + self._w
    @right.setter
    def right(self, v): self._x = self._cv(v) - self._w

    @property
    def bottom(self): return self._y + self._h
    @bottom.setter
    def bottom(self, v): self._y = self._cv(v) - self._h

    @property
    def centerx(self): return self._x + self._half(self._w)
    @centerx.setter
    def centerx(self, v): self._x = self._cv(v) - self._half(self._w)

    @property
    def centery(self): return self._y + self._half(self._h)
    @centery.setter
    def centery(self, v): self._y = self._cv(v) - self._half(self._h)

    @property
    def center(self): return (self.centerx, self.centery)
    @center.setter
    def center(self, v): self.centerx, self.centery = v

    @property
    def size(self): return (self._w, self._h)
    @size.setter
    def size(self, v): self.w, self.h = v

    @property
    def topleft(self): return (self._x, self._y)
    @topleft.setter
    def topleft(self, v): self.x, self.y = v

    @property
    def topright(self): return (self.right, self._y)
    @topright.setter
    def topright(self, v): self.right, self.y = v

    @property
    def bottomleft(self): return (self._x, self.bottom)
    @bottomleft.setter
    def bottomleft(self, v): self.x, self.bottom = v

    @property
    def bottomright(self): return (self.right, self.bottom)
    @bottomright.setter
    def bottomright(self, v): self.right, self.bottom = v

    @property
    def midtop(self): return (self.centerx, self._y)
    @midtop.setter
    def midtop(self, v): self.centerx, self.y = v

    @property
    def midbottom(self): return (self.centerx, self.bottom)
    @midbottom.setter
    def midbottom(self, v): self.centerx, self.bottom = v

    @property
    def midleft(self): return (self._x, self.centery)
    @midleft.setter
    def midleft(self, v): self.x, self.centery = v

    @property
    def midright(self): return (self.right, self.centery)
    @midright.setter
    def midright(self, v): self.right, self.centery = v

    # ── sequence behavior ─────────────────────────────────────────────
    def __len__(self): return 4

    def __getitem__(self, i):
        return (self._x, self._y, self._w, self._h)[i]

    def __setitem__(self, i, v):
        vals = [self._x, self._y, self._w, self._h]
        if isinstance(i, slice):
            vals[i] = [self._cv(n) for n in v]
            if len(vals) != 4:
                raise ValueError("Rect needs exactly 4 values")
        else:
            vals[i] = self._cv(v)
        self._x, self._y, self._w, self._h = vals

    def __iter__(self):
        return iter((self._x, self._y, self._w, self._h))

    def __eq__(self, other):
        try:
            return tuple(self) == tuple(_rect_args((other,), self._cv))
        except Exception:
            return NotImplemented

    def __ne__(self, other):
        r = self.__eq__(other)
        return r if r is NotImplemented else not r

    __hash__ = None

    def __bool__(self):
        return self._w != 0 and self._h != 0

    def __repr__(self):
        if self._cv is _num:
            return "<rect(%d, %d, %d, %d)>" % (self._x, self._y, self._w, self._h)
        return "<FRect(%s, %s, %s, %s)>" % (self._x, self._y, self._w, self._h)

    def __copy__(self):
        return type(self)(self._x, self._y, self._w, self._h)

    def __reduce__(self):
        return (Rect, (self._x, self._y, self._w, self._h))

    def copy(self):
        return type(self)(self._x, self._y, self._w, self._h)

    # ── moving and resizing ───────────────────────────────────────────
    def move(self, *args):
        x, y = _xy(args)
        return type(self)(self._x + self._cv(x), self._y + self._cv(y), self._w, self._h)

    def move_ip(self, *args):
        x, y = _xy(args)
        self._x += self._cv(x)
        self._y += self._cv(y)

    def move_to(self, **kwargs):
        r = self.copy()
        for k, v in kwargs.items():
            setattr(r, k, v)
        return r

    def inflate(self, *args):
        x, y = _xy(args)
        x, y = self._cv(x), self._cv(y)
        hx, hy = (int(x / 2), int(y / 2)) if self._cv is _num else (x / 2, y / 2)
        return type(self)(self._x - hx, self._y - hy, self._w + x, self._h + y)

    def inflate_ip(self, *args):
        r = self.inflate(*args)
        self._x, self._y, self._w, self._h = r

    def scale_by(self, x, y=None):
        if y is None:
            try:
                x, y = x
            except TypeError:
                y = x
        w, h = self._cv(self._w * x), self._cv(self._h * y)
        cx, cy = self.center
        r = type(self)(0, 0, w, h)
        r.center = (cx, cy)
        return r

    def scale_by_ip(self, x, y=None):
        self._x, self._y, self._w, self._h = self.scale_by(x, y)

    def update(self, *args):
        self._x, self._y, self._w, self._h = _rect_args(args, self._cv)

    def normalize(self):
        if self._w < 0:
            self._x += self._w
            self._w = -self._w
        if self._h < 0:
            self._y += self._h
            self._h = -self._h

    def clamp(self, *args):
        o = type(self)(*args)
        if self._w >= o._w:
            x = o._x + o._w // 2 - self._w // 2
        else:
            x = min(max(self._x, o._x), o.right - self._w)
        if self._h >= o._h:
            y = o._y + o._h // 2 - self._h // 2
        else:
            y = min(max(self._y, o._y), o.bottom - self._h)
        return type(self)(x, y, self._w, self._h)

    def clamp_ip(self, *args):
        self._x, self._y, self._w, self._h = self.clamp(*args)

    def clip(self, *args):
        o = type(self)(*args)
        x1, y1 = max(self._x, o._x), max(self._y, o._y)
        x2, y2 = min(self.right, o.right), min(self.bottom, o.bottom)
        if x2 <= x1 or y2 <= y1:
            return type(self)(self._x, self._y, 0, 0)
        return type(self)(x1, y1, x2 - x1, y2 - y1)

    def clipline(self, *args):
        if len(args) == 1:
            (x1, y1), (x2, y2) = args[0]
        elif len(args) == 2:
            (x1, y1), (x2, y2) = args
        else:
            x1, y1, x2, y2 = args
        # Liang-Barsky
        xmin, ymin, xmax, ymax = self._x, self._y, self.right - 1, self.bottom - 1
        dx, dy = x2 - x1, y2 - y1
        t0, t1 = 0.0, 1.0
        for p, q in ((-dx, x1 - xmin), (dx, xmax - x1), (-dy, y1 - ymin), (dy, ymax - y1)):
            if p == 0:
                if q < 0:
                    return ()
            else:
                t = q / p
                if p < 0:
                    if t > t1:
                        return ()
                    t0 = max(t0, t)
                else:
                    if t < t0:
                        return ()
                    t1 = min(t1, t)
        return ((round(x1 + t0 * dx), round(y1 + t0 * dy)), (round(x1 + t1 * dx), round(y1 + t1 * dy)))

    def union(self, *args):
        o = type(self)(*args)
        x1, y1 = min(self._x, o._x), min(self._y, o._y)
        x2, y2 = max(self.right, o.right), max(self.bottom, o.bottom)
        return type(self)(x1, y1, x2 - x1, y2 - y1)

    def union_ip(self, *args):
        self._x, self._y, self._w, self._h = self.union(*args)

    def unionall(self, rects):
        r = self.copy()
        for o in rects:
            r = r.union(o)
        return r

    def unionall_ip(self, rects):
        self._x, self._y, self._w, self._h = self.unionall(rects)

    def fit(self, *args):
        o = type(self)(*args)
        if self._w == 0 or self._h == 0:
            return type(self)(o.centerx, o.centery, 0, 0)
        ratio = max(self._w / o._w if o._w else 0, self._h / o._h if o._h else 0) or 1
        w, h = int(self._w / ratio), int(self._h / ratio)
        r = type(self)(0, 0, w, h)
        r.center = o.center
        return r

    # ── tests ─────────────────────────────────────────────────────────
    def contains(self, *args):
        o = type(self)(*args)
        return (self._x <= o._x and self._y <= o._y and self.right >= o.right
                and self.bottom >= o.bottom and self.right > o._x and self.bottom > o._y)

    def collidepoint(self, *args):
        x, y = _xy(args)
        return self._x <= x < self.right and self._y <= y < self.bottom

    def colliderect(self, *args):
        o = args[0] if len(args) == 1 and isinstance(args[0], Rect) else type(self)(*args)
        if self._w == 0 or self._h == 0 or o._w == 0 or o._h == 0:
            return False
        return (min(self.right, o.right) > max(self._x, o._x)
                and min(self.bottom, o.bottom) > max(self._y, o._y))

    def collidelist(self, rects):
        for i, r in enumerate(rects):
            if self.colliderect(r):
                return i
        return -1

    def collidelistall(self, rects):
        return [i for i, r in enumerate(rects) if self.colliderect(r)]

    def collideobjects(self, objects, key=None):
        for o in objects:
            if self.colliderect(key(o) if key else o):
                return o
        return None

    def collideobjectsall(self, objects, key=None):
        return [o for o in objects if self.colliderect(key(o) if key else o)]

    def collidedict(self, d, values=False):
        for k, v in d.items():
            if self.colliderect(v if values else k):
                return (k, v)
        return None

    def collidedictall(self, d, values=False):
        return [(k, v) for k, v in d.items() if self.colliderect(v if values else k)]


class FRect(Rect):
    """pygame-ce's float Rect: positions keep their fractions (x += 0.5 works)."""
    __slots__ = ()
    _cv = staticmethod(_fnum)

    @staticmethod
    def _half(v):
        return v / 2
