"""pygame.key"""
from . import _base
from ._base import host
from ._keys import KEY_NAMES

_repeat = (0, 0)


@_base.on_reset
def _reset():
    global _repeat
    _repeat = (0, 0)


def _slot(k):
    return k if k < 256 else 256 + (k & 0xFF)


class ScancodeWrapper:
    """What get_pressed() returns: index it with a key constant."""
    __slots__ = ("_down",)

    def __init__(self, down):
        self._down = down

    def __getitem__(self, key):
        if isinstance(key, slice):
            return tuple(i in self._down for i in range(512))[key]
        return _slot(int(key)) in self._down

    def __len__(self):
        return 512

    def __iter__(self):
        down = self._down
        return (i in down for i in range(512))

    def __repr__(self):
        return "ScancodeWrapper(%r)" % sorted(self._down)


def get_pressed():
    return ScancodeWrapper(frozenset(_base.split_ints(host.keys())))


def get_just_pressed():
    from .event import just
    return ScancodeWrapper(frozenset(_slot(k) for k in just["keys_down"]))


def get_just_released():
    from .event import just
    return ScancodeWrapper(frozenset(_slot(k) for k in just["keys_up"]))


def get_mods():
    return host.mods()


def set_mods(mods):
    pass


def get_focused():
    return bool(_base.split_ints(host.mouse())[3])


def set_repeat(delay=0, interval=0):
    global _repeat
    delay, interval = int(delay), int(interval)
    if delay < 0 or interval < 0:
        raise ValueError("delay and interval must not be negative")
    if delay and not interval:
        interval = delay
    _repeat = (delay, interval)
    host.key_repeat(delay, interval)


def get_repeat():
    return _repeat


def name(key, use_compat=True):
    return KEY_NAMES.get(int(key), "unknown key")


def key_code(name):
    wanted = str(name).lower()
    for code, nm in KEY_NAMES.items():
        if nm == wanted:
            return code
    if len(wanted) == 1:
        return ord(wanted)
    raise ValueError("unknown key name")


def start_text_input():
    pass


def stop_text_input():
    pass


def set_text_input_rect(rect):
    pass
