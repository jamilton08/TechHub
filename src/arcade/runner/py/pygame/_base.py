"""Shared internals for the HSCT web edition of pygame.

Everything that touches the browser goes through `host` (the `_hsct_host`
module the worker registers). Surfaces live on the JavaScript side as
OffscreenCanvases; Python only keeps their integer ids.
"""
import sys
import _hsct_host as host

PROJECT_DIR = "/home/pyodide/project"


class error(RuntimeError):
    """pygame.error"""


_next_id = 0


def new_id():
    global _next_id
    _next_id += 1
    return _next_id


_reset_hooks = []


def on_reset(fn):
    _reset_hooks.append(fn)
    return fn


def reset():
    for fn in _reset_hooks:
        try:
            fn()
        except Exception:
            pass


def flush_streams():
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.flush()
        except Exception:
            pass


def check_stop():
    if host.stopped():
        host.clear_interrupt()
        raise KeyboardInterrupt


def block_ms(ms):
    """Sleep without burning the CPU. Stop wakes it early."""
    flush_streams()
    host.sleep(max(0.0, float(ms)))
    check_stop()


def asset_name(path):
    """Turn whatever path a student passes into the project-relative name."""
    import os
    name = os.fspath(path)
    if not isinstance(name, str):
        name = name.decode()
    name = name.replace("\\", "/")
    if name.startswith(PROJECT_DIR + "/"):
        name = name[len(PROJECT_DIR) + 1:]
    while name.startswith("./"):
        name = name[2:]
    return name


def split_ints(text):
    return [int(v) for v in text.split(",")] if text else []


# ── colors ────────────────────────────────────────────────────────────
# X11 values, which is what pygame uses ("green" is 0,255,0 and "gray" is
# 190,190,190 — not the CSS values).
_NAMED = {
    "aliceblue": (240, 248, 255), "antiquewhite": (250, 235, 215), "aqua": (0, 255, 255),
    "aquamarine": (127, 255, 212), "azure": (240, 255, 255), "beige": (245, 245, 220),
    "bisque": (255, 228, 196), "black": (0, 0, 0), "blanchedalmond": (255, 235, 205),
    "blue": (0, 0, 255), "blueviolet": (138, 43, 226), "brown": (165, 42, 42),
    "burlywood": (222, 184, 135), "cadetblue": (95, 158, 160), "chartreuse": (127, 255, 0),
    "chocolate": (210, 105, 30), "coral": (255, 127, 80), "cornflowerblue": (100, 149, 237),
    "cornsilk": (255, 248, 220), "crimson": (220, 20, 60), "cyan": (0, 255, 255),
    "darkblue": (0, 0, 139), "darkcyan": (0, 139, 139), "darkgoldenrod": (184, 134, 11),
    "darkgray": (169, 169, 169), "darkgreen": (0, 100, 0), "darkgrey": (169, 169, 169),
    "darkkhaki": (189, 183, 107), "darkmagenta": (139, 0, 139), "darkolivegreen": (85, 107, 47),
    "darkorange": (255, 140, 0), "darkorchid": (153, 50, 204), "darkred": (139, 0, 0),
    "darksalmon": (233, 150, 122), "darkseagreen": (143, 188, 143), "darkslateblue": (72, 61, 139),
    "darkslategray": (47, 79, 79), "darkslategrey": (47, 79, 79), "darkturquoise": (0, 206, 209),
    "darkviolet": (148, 0, 211), "deeppink": (255, 20, 147), "deepskyblue": (0, 191, 255),
    "dimgray": (105, 105, 105), "dimgrey": (105, 105, 105), "dodgerblue": (30, 144, 255),
    "firebrick": (178, 34, 34), "floralwhite": (255, 250, 240), "forestgreen": (34, 139, 34),
    "fuchsia": (255, 0, 255), "gainsboro": (220, 220, 220), "ghostwhite": (248, 248, 255),
    "gold": (255, 215, 0), "goldenrod": (218, 165, 32), "gray": (190, 190, 190),
    "green": (0, 255, 0), "greenyellow": (173, 255, 47), "grey": (190, 190, 190),
    "honeydew": (240, 255, 240), "hotpink": (255, 105, 180), "indianred": (205, 92, 92),
    "indigo": (75, 0, 130), "ivory": (255, 255, 240), "khaki": (240, 230, 140),
    "lavender": (230, 230, 250), "lavenderblush": (255, 240, 245), "lawngreen": (124, 252, 0),
    "lemonchiffon": (255, 250, 205), "lightblue": (173, 216, 230), "lightcoral": (240, 128, 128),
    "lightcyan": (224, 255, 255), "lightgoldenrodyellow": (250, 250, 210), "lightgray": (211, 211, 211),
    "lightgreen": (144, 238, 144), "lightgrey": (211, 211, 211), "lightpink": (255, 182, 193),
    "lightsalmon": (255, 160, 122), "lightseagreen": (32, 178, 170), "lightskyblue": (135, 206, 250),
    "lightslategray": (119, 136, 153), "lightslategrey": (119, 136, 153), "lightsteelblue": (176, 196, 222),
    "lightyellow": (255, 255, 224), "lime": (0, 255, 0), "limegreen": (50, 205, 50),
    "linen": (250, 240, 230), "magenta": (255, 0, 255), "maroon": (176, 48, 96),
    "mediumaquamarine": (102, 205, 170), "mediumblue": (0, 0, 205), "mediumorchid": (186, 85, 211),
    "mediumpurple": (147, 112, 219), "mediumseagreen": (60, 179, 113), "mediumslateblue": (123, 104, 238),
    "mediumspringgreen": (0, 250, 154), "mediumturquoise": (72, 209, 204), "mediumvioletred": (199, 21, 133),
    "midnightblue": (25, 25, 112), "mintcream": (245, 255, 250), "mistyrose": (255, 228, 225),
    "moccasin": (255, 228, 181), "navajowhite": (255, 222, 173), "navy": (0, 0, 128),
    "navyblue": (0, 0, 128), "oldlace": (253, 245, 230), "olive": (128, 128, 0),
    "olivedrab": (107, 142, 35), "orange": (255, 165, 0), "orangered": (255, 69, 0),
    "orchid": (218, 112, 214), "palegoldenrod": (238, 232, 170), "palegreen": (152, 251, 152),
    "paleturquoise": (175, 238, 238), "palevioletred": (219, 112, 147), "papayawhip": (255, 239, 213),
    "peachpuff": (255, 218, 185), "peru": (205, 133, 63), "pink": (255, 192, 203),
    "plum": (221, 160, 221), "powderblue": (176, 224, 230), "purple": (160, 32, 240),
    "rebeccapurple": (102, 51, 153), "red": (255, 0, 0), "rosybrown": (188, 143, 143),
    "royalblue": (65, 105, 225), "saddlebrown": (139, 69, 19), "salmon": (250, 128, 114),
    "sandybrown": (244, 164, 96), "seagreen": (46, 139, 87), "seashell": (255, 245, 238),
    "sienna": (160, 82, 45), "silver": (192, 192, 192), "skyblue": (135, 206, 235),
    "slateblue": (106, 90, 205), "slategray": (112, 128, 144), "slategrey": (112, 128, 144),
    "snow": (255, 250, 250), "springgreen": (0, 255, 127), "steelblue": (70, 130, 180),
    "tan": (210, 180, 140), "teal": (0, 128, 128), "thistle": (216, 191, 216),
    "tomato": (255, 99, 71), "turquoise": (64, 224, 208), "violet": (238, 130, 238),
    "wheat": (245, 222, 179), "white": (255, 255, 255), "whitesmoke": (245, 245, 245),
    "yellow": (255, 255, 0), "yellowgreen": (154, 205, 50),
}
for _n in range(101):
    _v = round(_n * 255 / 100)
    _NAMED["gray%d" % _n] = (_v, _v, _v)
    _NAMED["grey%d" % _n] = (_v, _v, _v)


def named_color(name):
    key = name.lower().replace(" ", "").replace("_", "")
    if key in _NAMED:
        return _NAMED[key] + (255,)
    text = name.strip()
    if text.startswith("#") or text.lower().startswith("0x"):
        digits = text[1:] if text.startswith("#") else text[2:]
        if len(digits) in (6, 8):
            try:
                vals = [int(digits[i:i + 2], 16) for i in range(0, len(digits), 2)]
            except ValueError:
                vals = None
            if vals:
                return tuple(vals) + ((255,) if len(vals) == 3 else ())
    raise ValueError("invalid color name '%s'" % name)


def rgba(color):
    """Any pygame color argument -> (r, g, b, a) ints."""
    from .color import Color
    if isinstance(color, Color):
        return (color.r, color.g, color.b, color.a)
    if isinstance(color, str):
        return named_color(color)
    if isinstance(color, int) and not isinstance(color, bool):
        return ((color >> 16) & 255, (color >> 8) & 255, color & 255, 255)
    try:
        n = len(color)
    except TypeError:
        raise TypeError("invalid color argument: %r" % (color,)) from None
    if n not in (3, 4):
        raise ValueError("invalid color argument: %r (a color needs 3 or 4 numbers)" % (color,))
    vals = []
    for v in color:
        try:
            v = int(v)
        except (TypeError, ValueError):
            raise TypeError("invalid color argument: %r (colors are numbers 0-255)" % (color,)) from None
        if v < 0 or v > 255:
            raise ValueError("invalid color argument: %r (each number must be 0-255)" % (color,))
        vals.append(v)
    if n == 3:
        vals.append(255)
    return tuple(vals)


_css_cache = {}


def css(color, opaque=False):
    try:
        key = (color, opaque)
        hit = _css_cache.get(key)
        if hit is not None:
            return hit
    except TypeError:
        key = None
    r, g, b, a = rgba(color)
    if opaque or a == 255:
        out = "rgb(%d,%d,%d)" % (r, g, b)
    else:
        out = "rgba(%d,%d,%d,%.4f)" % (r, g, b, a / 255)
    if key is not None and len(_css_cache) < 4096:
        _css_cache[key] = out
    return out


def pair(value, what="position"):
    """(x, y) from a 2-sequence or anything with x/y."""
    try:
        x, y = value
    except (TypeError, ValueError):
        raise TypeError("%s must be a pair of numbers like (x, y), got %r" % (what, value)) from None
    return x, y
