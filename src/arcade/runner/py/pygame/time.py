"""pygame.time — Clock, ticks and timers."""
import time as _systime
from . import _base

_start = _systime.perf_counter()


@_base.on_reset
def _reset():
    global _start
    _start = _systime.perf_counter()


def _ms():
    return (_systime.perf_counter() - _start) * 1000.0


def get_ticks():
    return int(_ms())


def wait(milliseconds):
    t0 = _ms()
    _base.block_ms(int(milliseconds))
    return int(_ms() - t0)


def delay(milliseconds):
    return wait(milliseconds)


def set_timer(event, millis, loops=0):
    from .event import _set_timer
    _set_timer(event, millis, loops)


class Clock:
    def __init__(self):
        self._last = None
        self._time = 0
        self._raw = 0
        self._frames = []

    def tick(self, framerate=0):
        now = _ms()
        if self._last is None:
            self._last = now
            _base.flush_streams()
            from ._base import host
            host.flush()
            _base.check_stop()
            return 0
        self._raw = now - self._last
        if framerate and framerate > 0:
            target = 1000.0 / framerate
            if self._raw < target:
                _base.block_ms(target - self._raw)
            else:
                _base.block_ms(0)
        else:
            _base.block_ms(0)
        now = _ms()
        self._time = now - self._last
        self._last = now
        self._frames.append(self._time)
        if len(self._frames) > 10:
            self._frames.pop(0)
        return int(self._time)

    tick_busy_loop = tick

    def get_time(self):
        return int(self._time)

    def get_rawtime(self):
        return int(self._raw)

    def get_fps(self):
        if not self._frames:
            return 0.0
        avg = sum(self._frames) / len(self._frames)
        return 1000.0 / avg if avg else 0.0
