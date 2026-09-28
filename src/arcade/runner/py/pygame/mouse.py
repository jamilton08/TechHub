"""pygame.mouse — positions are in game pixels, whatever size the screen is shown at."""
from . import _base
from ._base import host

_visible = True
_last = None


@_base.on_reset
def _reset():
    global _visible, _last
    _visible = True
    _last = None


def _state():
    x, y, buttons, focused, inside = _base.split_ints(host.mouse())
    return x, y, buttons, inside


def get_pos():
    x, y, _, _ = _state()
    return (x, y)


def get_rel():
    global _last
    x, y, _, _ = _state()
    if _last is None:
        _last = (x, y)
    rel = (x - _last[0], y - _last[1])
    _last = (x, y)
    return rel


def get_pressed(num_buttons=3):
    _, _, b, _ = _state()
    out = (bool(b & 1), bool(b & 2), bool(b & 4))
    if num_buttons == 5:
        return out + (False, False)
    return out


def get_just_pressed():
    from .event import just
    return tuple(b in just["mouse_down"] for b in (1, 2, 3, 6, 7))


def get_just_released():
    from .event import just
    return tuple(b in just["mouse_up"] for b in (1, 2, 3, 6, 7))


def set_pos(*pos):
    pass


def set_visible(value):
    global _visible
    prev = _visible
    _visible = bool(value)
    host.mouse_visible(_visible)
    return prev


def get_visible():
    return _visible


def get_focused():
    return bool(_state()[3])


def set_cursor(*args, **kwargs):
    pass


def get_cursor():
    return None


def set_relative_mode(enable):
    set_visible(not enable)


def get_relative_mode():
    return not _visible
