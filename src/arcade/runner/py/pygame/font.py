"""pygame.font — text drawn with the browser's fonts."""
import os
from . import _base
from ._base import host, css
from .surface import Surface

_init = False

_FAMILIES = {
    "arial": "Arial, Helvetica, Arimo, sans-serif",
    "helvetica": "Helvetica, Arial, sans-serif",
    "freesans": "Arial, Helvetica, sans-serif",
    "freesansbold": "Arial, Helvetica, sans-serif",
    "sans": "sans-serif",
    "sansserif": "sans-serif",
    "verdana": "Verdana, sans-serif",
    "tahoma": "Tahoma, Verdana, sans-serif",
    "segoeui": '"Segoe UI", system-ui, sans-serif',
    "calibri": "Calibri, Carlito, sans-serif",
    "trebuchetms": '"Trebuchet MS", sans-serif',
    "impact": "Impact, Haettenschweiler, sans-serif",
    "comicsans": '"Comic Sans MS", "Comic Sans", "Comic Neue", cursive',
    "comicsansms": '"Comic Sans MS", "Comic Sans", "Comic Neue", cursive',
    "timesnewroman": '"Times New Roman", Times, Tinos, serif',
    "times": '"Times New Roman", Times, serif',
    "georgia": "Georgia, serif",
    "serif": "serif",
    "couriernew": '"Courier New", Courier, Cousine, monospace',
    "courier": '"Courier New", Courier, monospace',
    "consolas": "Consolas, Menlo, monospace",
    "monospace": "monospace",
    "mono": "monospace",
    "lucidaconsole": '"Lucida Console", monospace',
}


@_base.on_reset
def _reset():
    global _init
    _init = False


def init():
    global _init
    _init = True


def quit():
    global _init
    _init = False


def get_init():
    return _init


def get_default_font():
    return "freesansbold.ttf"


def get_fonts():
    return sorted(_FAMILIES)


def match_font(name, bold=False, italic=False):
    return None


def get_sdl_ttf_version(linked=True):
    return (2, 22, 0)


def _family_for(name):
    if name is None:
        return None
    names = name if isinstance(name, (list, tuple)) else str(name).split(",")
    for n in names:
        key = str(n).lower().replace(" ", "").replace("_", "").replace("-", "")
        if key in _FAMILIES:
            return _FAMILIES[key]
    first = str(names[0]).strip() if names else ""
    return '"%s", sans-serif' % first.replace('"', "") if first else None


class Font:
    def __init__(self, file=None, size=20):
        size = max(1, int(size))
        self._bold = False
        self._italic = False
        self._underline = False
        self._strikethrough = False
        self.point_size = size
        family = None
        if file is None or (isinstance(file, str) and os.path.basename(file).lower() in ("freesansbold.ttf", "freesans.ttf")):
            # pygame's default font is a bold sans, drawn a bit smaller than the size you ask for
            self._px = max(1, int(size * 0.6875))
            family = "Arial, Helvetica, Arimo, sans-serif"
            self._bold = True
            self._default = True
        else:
            self._px = size
            self._default = False
            asset = host.f_family(_base.asset_name(file)) if not hasattr(file, "read") else ""
            if asset:
                family = '"%s"' % asset
            else:
                family = _family_for(os.path.splitext(os.path.basename(str(file)))[0]) or "sans-serif"
        self._family = family
        self._update()

    def _css(self):
        style = "italic " if self._italic else ""
        weight = "bold " if self._bold else ""
        return "%s%s%dpx %s" % (style, weight, self._px, self._family)

    def _update(self):
        self._font = self._css()
        asc, desc = _base.split_ints(host.f_metrics(self._font))
        self._asc, self._desc = asc, desc
        self._height = asc + desc

    # ── drawing text ───────────────────────────────────────────────────
    def render(self, text, antialias, color, background=None, wraplength=0):
        if text is None:
            text = ""
        if not isinstance(text, str):
            if isinstance(text, bytes):
                text = text.decode("utf-8", "replace")
            else:
                raise TypeError("text must be a string, got %s — use str() to turn it into text"
                                % type(text).__name__)
        lines = text.split("\n")
        if wraplength and wraplength > 0:
            lines = [ln for raw in lines for ln in self._wrap(raw, int(wraplength))]
        if len(lines) == 1:
            return self._render_line(lines[0], color, background)
        parts = [self._render_line(ln, color, background) for ln in lines]
        w = max(p.get_width() for p in parts)
        out = Surface((w, self._height * len(parts)), 65536)
        if background is not None:
            out.fill(background)
        for i, p in enumerate(parts):
            out.blit(p, (0, i * self._height))
        return out

    def _wrap(self, text, width):
        words, lines, cur = text.split(" "), [], ""
        for w in words:
            trial = (cur + " " + w) if cur else w
            if cur and host.f_width(trial, self._font) > width:
                lines.append(cur)
                cur = w
            else:
                cur = trial
        lines.append(cur)
        return lines

    def _render_line(self, text, color, background):
        text = text.replace("\t", "    ")
        w = host.f_width(text, self._font) if text else 0
        sid = _base.new_id()
        host.f_render(sid, text, self._font, css(color), css(background) if background is not None else "",
                      w, self._height, self._asc, bool(self._underline))
        return Surface._wrap(sid, w, self._height, background is None)

    def size(self, text):
        text = str(text)
        return (host.f_width(text, self._font) if text else 0, self._height)

    def get_linesize(self):
        return self._height

    def get_height(self):
        return self._height

    def get_ascent(self):
        return self._asc

    def get_descent(self):
        return -self._desc

    def get_point_size(self):
        return self.point_size

    def set_point_size(self, size):
        self.point_size = int(size)
        self._px = max(1, int(size * 0.6875)) if self._default else int(size)
        self._update()

    def set_bold(self, value):
        self._bold = bool(value)
        self._update()

    def get_bold(self):
        return self._bold

    def set_italic(self, value):
        self._italic = bool(value)
        self._update()

    def get_italic(self):
        return self._italic

    def set_underline(self, value):
        self._underline = bool(value)

    def get_underline(self):
        return self._underline

    def set_strikethrough(self, value):
        self._strikethrough = bool(value)

    def get_strikethrough(self):
        return self._strikethrough

    bold = property(get_bold, set_bold)
    italic = property(get_italic, set_italic)
    underline = property(get_underline, set_underline)
    strikethrough = property(get_strikethrough, set_strikethrough)

    def metrics(self, text):
        out = []
        for ch in str(text):
            w = host.f_width(ch, self._font)
            out.append((0, w, -self._desc, self._asc, w))
        return out


FontType = Font


def SysFont(name, size, bold=False, italic=False, constructor=None):
    f = Font.__new__(Font)
    f._bold = bool(bold)
    f._italic = bool(italic)
    f._underline = False
    f._strikethrough = False
    f._default = False
    f.point_size = max(1, int(size))
    f._px = f.point_size
    f._family = _family_for(name) or "Arial, Helvetica, sans-serif"
    f._update()
    return f
