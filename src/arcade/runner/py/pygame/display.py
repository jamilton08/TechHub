"""pygame.display — the game window is the screen panel on the page."""
from . import _base
from ._base import host, error
from .surface import Surface

_screen = None
_caption = "pygame window"
_initialized = False


@_base.on_reset
def _reset():
    global _screen, _caption, _initialized
    _screen = None
    _caption = "pygame window"
    _initialized = False


def init():
    global _initialized
    _initialized = True


def get_init():
    return _initialized


def quit():
    global _screen, _initialized
    if _screen is not None:
        host.display_close()
    _screen = None
    _initialized = False


def _hint():
    w, h = _base.split_ints(host.display_hint())
    return w, h


def set_mode(size=(0, 0), flags=0, depth=0, display=0, vsync=0):
    global _screen, _initialized
    try:
        w, h = size
        w, h = int(w), int(h)
    except (TypeError, ValueError):
        raise TypeError("set_mode() size must be (width, height), got %r" % (size,)) from None
    if w < 0 or h < 0:
        raise error("Cannot set negative sized display mode")
    if w == 0 or h == 0:
        hw, hh = _hint()
        w, h = w or hw, h or hh
    packed = host.display_set(w, h)
    w, h = packed // 65536, packed % 65536
    _screen = Surface._wrap(0, w, h, False)
    _screen._id = 0
    _initialized = True
    host.display_caption(_caption)
    return _screen


def get_surface():
    return _screen


def _need_screen():
    if _screen is None:
        raise error("video system not initialized — call pygame.display.set_mode() first")


def flip():
    _need_screen()
    host.present()


def update(rectangle=None, *more):
    _need_screen()
    host.present()


def set_caption(title, icontitle=None):
    global _caption
    _caption = str(title)
    host.display_caption(_caption)


def get_caption():
    return (_caption, _caption)


def set_icon(surface):
    pass


def get_window_size():
    _need_screen()
    return _screen.get_size()


def get_desktop_sizes():
    return [_hint()]


def list_modes(depth=0, flags=0, display=0):
    return [_hint()]


def mode_ok(size, flags=0, depth=0, display=0):
    return 32


def get_num_displays():
    return 1


def get_active():
    return _screen is not None


def get_driver():
    return "hsct-web"


def toggle_fullscreen():
    return 0


def iconify():
    return False


def set_gamma(*args):
    return False


def get_wm_info():
    return {}


def set_allow_screensaver(value=True):
    pass


def get_allow_screensaver():
    return False


def is_fullscreen():
    return False


class _Info:
    def __init__(self):
        w, h = _screen.get_size() if _screen else _hint()
        self.hw = False
        self.wm = True
        self.video_mem = 0
        self.bitsize = 32
        self.bytesize = 4
        self.masks = (0xFF0000, 0xFF00, 0xFF, 0)
        self.shifts = (16, 8, 0, 0)
        self.losses = (0, 0, 0, 8)
        self.blit_hw = self.blit_hw_CC = self.blit_hw_A = False
        self.blit_sw = self.blit_sw_CC = self.blit_sw_A = False
        self.current_w, self.current_h = _hint()
        if _screen:
            self.current_w, self.current_h = w, h

    def __repr__(self):
        return "<VideoInfo(current_w = %d, current_h = %d)>" % (self.current_w, self.current_h)


def Info():
    return _Info()
