"""pygame.event — keyboard, mouse and timer events from the game screen."""
import time as _time
from . import _base
from ._base import host
from .constants import (NOEVENT, QUIT, KEYDOWN, KEYUP, TEXTINPUT, MOUSEMOTION, MOUSEBUTTONDOWN,
                        MOUSEBUTTONUP, MOUSEWHEEL, USEREVENT, WINDOWFOCUSGAINED, WINDOWFOCUSLOST,
                        ACTIVEEVENT, VIDEORESIZE, VIDEOEXPOSE)

_NAMES = {
    NOEVENT: "NoEvent", QUIT: "Quit", KEYDOWN: "KeyDown", KEYUP: "KeyUp", TEXTINPUT: "TextInput",
    MOUSEMOTION: "MouseMotion", MOUSEBUTTONDOWN: "MouseButtonDown", MOUSEBUTTONUP: "MouseButtonUp",
    MOUSEWHEEL: "MouseWheel", USEREVENT: "UserEvent", WINDOWFOCUSGAINED: "WindowFocusGained",
    WINDOWFOCUSLOST: "WindowFocusLost", ACTIVEEVENT: "ActiveEvent", VIDEORESIZE: "VideoResize",
    VIDEOEXPOSE: "VideoExpose",
}


class Event:
    def __init__(self, type, dict=None, **kwargs):
        if not isinstance(type, int):
            raise TypeError("event type must be an integer")
        self.__dict__["type"] = type
        attrs = {}
        if dict:
            attrs.update(dict)
        attrs.update(kwargs)
        if "type" in attrs:
            raise ValueError("'type' is not a valid event attribute name")
        self.__dict__.update(attrs)

    @property
    def dict(self):
        return {k: v for k, v in self.__dict__.items() if k != "type"}

    def __setattr__(self, name, value):
        if name == "type":
            raise AttributeError("can't change an event's type")
        self.__dict__[name] = value

    def __eq__(self, other):
        return isinstance(other, Event) and self.__dict__ == other.__dict__

    def __ne__(self, other):
        return not self.__eq__(other)

    def __bool__(self):
        return self.type != NOEVENT

    __hash__ = None

    def __repr__(self):
        return "<Event(%d-%s %r)>" % (self.type, event_name(self.type), self.dict)


EventType = Event

_queue = []
_blocked = set()
_timers = {}           # event type -> [interval_ms, due_ms, loops_left, Event]
_next_custom = USEREVENT + 1
_grab = False
_last_mouse = [0, 0]


@_base.on_reset
def _reset():
    global _next_custom
    _queue.clear()
    _blocked.clear()
    _timers.clear()
    _next_custom = USEREVENT + 1


def _now():
    return _time.perf_counter() * 1000.0


def _decode(v):
    t = v[0]
    if t == KEYDOWN:
        return Event(KEYDOWN, key=v[1], mod=v[2], unicode=chr(v[3]) if v[3] else "", scancode=v[4], window=None)
    if t == KEYUP:
        return Event(KEYUP, key=v[1], mod=v[2], unicode="", scancode=v[4], window=None)
    if t == TEXTINPUT:
        return Event(TEXTINPUT, text=chr(v[1]), window=None)
    if t == MOUSEMOTION:
        b = v[5]
        return Event(MOUSEMOTION, pos=(v[1], v[2]), rel=(v[3], v[4]),
                     buttons=(b & 1, (b >> 1) & 1, (b >> 2) & 1), touch=False, window=None)
    if t in (MOUSEBUTTONDOWN, MOUSEBUTTONUP):
        return Event(t, pos=(v[1], v[2]), button=v[3], touch=False, window=None)
    if t == MOUSEWHEEL:
        return Event(MOUSEWHEEL, x=v[1], y=v[2], flipped=False, precise_x=float(v[1]),
                     precise_y=float(v[2]), touch=False, window=None)
    return Event(t, window=None)


# what changed since the last pump — for key.get_just_pressed() and friends
just = {"keys_down": set(), "keys_up": set(), "mouse_down": set(), "mouse_up": set()}


def _pump():
    raw = host.events()
    for s in just.values():
        s.clear()
    if raw:
        vals = _base.split_ints(raw)
        for i in range(0, len(vals), 8):
            ev = _decode(vals[i:i + 8])
            if ev.type == KEYDOWN:
                just["keys_down"].add(ev.key)
            elif ev.type == KEYUP:
                just["keys_up"].add(ev.key)
            elif ev.type == MOUSEBUTTONDOWN:
                just["mouse_down"].add(ev.button)
            elif ev.type == MOUSEBUTTONUP:
                just["mouse_up"].add(ev.button)
            if ev.type not in _blocked:
                _queue.append(ev)
    if _timers:
        now = _now()
        for etype, t in list(_timers.items()):
            interval, due, loops, ev = t
            if now >= due:
                if etype not in _blocked:
                    _queue.append(ev)
                if loops == 1:
                    del _timers[etype]
                else:
                    t[1] = due + interval if due + interval > now else now + interval
                    if loops > 1:
                        t[2] = loops - 1
    from . import mixer
    mixer._pump_music_end()


def pump():
    _pump()


def _matches(ev, eventtype, exclude):
    if eventtype is not None:
        types = eventtype if isinstance(eventtype, (list, tuple, set)) else (eventtype,)
        if ev.type not in types:
            return False
    if exclude is not None:
        ex = exclude if isinstance(exclude, (list, tuple, set)) else (exclude,)
        if ev.type in ex:
            return False
    return True


def get(eventtype=None, pump=True, exclude=None):
    _base.check_stop()
    if pump:
        _pump()
    if eventtype is None and exclude is None:
        out = _queue[:]
        _queue.clear()
        return out
    out, keep = [], []
    for ev in _queue:
        (out if _matches(ev, eventtype, exclude) else keep).append(ev)
    _queue[:] = keep
    return out


def poll():
    _base.check_stop()
    _pump()
    return _queue.pop(0) if _queue else Event(NOEVENT)


def wait(timeout=0):
    start = _now()
    while True:
        _base.check_stop()
        _pump()
        if _queue:
            return _queue.pop(0)
        elapsed = _now() - start
        if timeout and elapsed >= timeout:
            return Event(NOEVENT)
        slice_ms = 100.0
        if timeout:
            slice_ms = min(slice_ms, timeout - elapsed)
        if _timers:
            slice_ms = min(slice_ms, max(1.0, min(t[1] for t in _timers.values()) - _now()))
        if host.isolated():
            host.wait_event(max(1.0, slice_ms))
        else:
            _base.block_ms(max(1.0, slice_ms))


def peek(eventtype=None, pump=True):
    if pump:
        _pump()
    if eventtype is None:
        return _queue[0] if _queue else Event(NOEVENT)
    return any(_matches(ev, eventtype, None) for ev in _queue)


def clear(eventtype=None, pump=True):
    if pump:
        _pump()
    if eventtype is None:
        _queue.clear()
    else:
        _queue[:] = [ev for ev in _queue if not _matches(ev, eventtype, None)]


def post(event):
    if event.type in _blocked:
        return False
    _queue.append(event)
    return True


def event_name(type):
    if type in _NAMES:
        return _NAMES[type]
    if USEREVENT <= type:
        return "UserEvent"
    return "Unknown"


def set_blocked(type):
    if type is None:
        _blocked.update(_NAMES.keys())
        return
    for t in (type if isinstance(type, (list, tuple, set)) else (type,)):
        _blocked.add(t)


def set_allowed(type):
    if type is None:
        _blocked.clear()
        return
    for t in (type if isinstance(type, (list, tuple, set)) else (type,)):
        _blocked.discard(t)


def get_blocked(type):
    types = type if isinstance(type, (list, tuple, set)) else (type,)
    return any(t in _blocked for t in types)


def set_grab(grab):
    global _grab
    _grab = bool(grab)


def get_grab():
    return _grab


def set_keyboard_grab(grab):
    set_grab(grab)


def get_keyboard_grab():
    return _grab


def custom_type():
    global _next_custom
    t = _next_custom
    _next_custom += 1
    return t


def _set_timer(event, millis, loops=0):
    ev = event if isinstance(event, Event) else Event(int(event))
    millis = int(millis)
    if millis <= 0:
        _timers.pop(ev.type, None)
        return
    _timers[ev.type] = [millis, _now() + millis, int(loops), ev]
