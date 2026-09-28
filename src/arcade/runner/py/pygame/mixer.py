"""pygame.mixer — sounds play through the browser (Web Audio)."""
import json
import os
import time as _systime
from . import _base
from ._base import host, PROJECT_DIR, error

_init = False
_lengths = {}     # asset name -> seconds (measured by the runner page)
_volumes = {}


def _send(**cmd):
    host.sound(json.dumps(cmd))


def _resolve(file):
    name = _base.asset_name(file)
    if name in _lengths:
        return name
    base = os.path.basename(name)
    if base in _lengths:
        return base
    if os.path.exists(os.path.join(PROJECT_DIR, name)):
        return name
    raise FileNotFoundError("No file '%s' found in working directory '%s'." % (name, PROJECT_DIR))


@_base.on_reset
def _reset():
    global _init
    _init = False
    music._reset()


def _set_lengths(lengths):
    _lengths.clear()
    _lengths.update(lengths)


def init(frequency=44100, size=-16, channels=2, buffer=512, devicename=None, allowedchanges=5):
    global _init
    _init = True


def pre_init(*args, **kwargs):
    pass


def quit():
    global _init
    stop()
    _init = False


def get_init():
    return (44100, -16, 2) if _init else None


def get_num_channels():
    return 8


def set_num_channels(count):
    pass


def set_reserved(count):
    return count


def stop():
    _send(op="stopall")
    music._playing = False


def pause():
    _send(op="pauseall")


def unpause():
    _send(op="resumeall")


def fadeout(time):
    stop()


def get_busy():
    return music.get_busy()


def find_channel(force=False):
    return Channel(0)


def get_sdl_mixer_version(linked=True):
    return (2, 8, 0)


class Sound:
    def __init__(self, file=None, buffer=None, array=None, **kwargs):
        if file is None:
            file = kwargs.get("file")
        if file is None or hasattr(file, "read"):
            raise NotImplementedError("Sound() needs a file name here, like pygame.mixer.Sound('boom.wav')")
        self._name = _resolve(file)
        self._id = _base.new_id()
        self._volume = 1.0

    def play(self, loops=0, maxtime=0, fade_ms=0):
        _send(op="play", id=self._id, name=self._name, loops=int(loops), volume=self._volume,
              maxtime=int(maxtime))
        return Channel(0, self)

    def stop(self):
        _send(op="stop", id=self._id)

    def fadeout(self, time):
        self.stop()

    def set_volume(self, value):
        self._volume = max(0.0, min(1.0, float(value)))
        _send(op="volume", id=self._id, volume=self._volume)

    def get_volume(self):
        return self._volume

    def get_length(self):
        return float(_lengths.get(self._name, 0.0))

    def get_num_channels(self):
        return 0

    def get_raw(self):
        return b""


class Channel:
    def __init__(self, id=0, sound=None):
        self._id = id
        self._sound = sound

    def play(self, sound, loops=0, maxtime=0, fade_ms=0):
        self._sound = sound
        sound.play(loops, maxtime, fade_ms)

    def stop(self):
        if self._sound:
            self._sound.stop()

    def pause(self):
        pass

    def unpause(self):
        pass

    def fadeout(self, time):
        self.stop()

    def set_volume(self, left, right=None):
        if self._sound:
            self._sound.set_volume(left)

    def get_volume(self):
        return self._sound.get_volume() if self._sound else 1.0

    def get_busy(self):
        return False

    def get_sound(self):
        return self._sound

    def queue(self, sound):
        sound.play()

    def get_queue(self):
        return None

    def set_endevent(self, type=None):
        pass

    def get_endevent(self):
        return 0


class _Music:
    def _reset(self):
        self._name = None
        self._volume = 1.0
        self._playing = False
        self._paused = False
        self._started = 0.0
        self._loops = 0
        self._endevent = 0

    def __init__(self):
        self._reset()

    def load(self, filename, namehint=""):
        self._name = _resolve(filename)

    def unload(self):
        self.stop()
        self._name = None

    def play(self, loops=0, start=0.0, fade_ms=0):
        if not self._name:
            raise error("music not loaded")
        self._loops = int(loops)
        self._playing = True
        self._paused = False
        self._started = _systime.perf_counter()
        _send(op="music-play", name=self._name, loops=self._loops, volume=self._volume, start=float(start))

    def rewind(self):
        if self._playing:
            self.play(self._loops)

    def stop(self):
        self._playing = False
        self._paused = False
        _send(op="music-stop")

    def pause(self):
        if self._playing:
            self._paused = True
            _send(op="music-pause")

    def unpause(self):
        if self._paused:
            self._paused = False
            _send(op="music-resume")

    def fadeout(self, time):
        self.stop()

    def set_volume(self, volume):
        self._volume = max(0.0, min(1.0, float(volume)))
        _send(op="music-volume", volume=self._volume)

    def get_volume(self):
        return self._volume

    def _ends_at(self):
        length = _lengths.get(self._name or "", 0.0)
        if self._loops < 0 or not length:
            return None
        return self._started + length * (self._loops + 1)

    def get_busy(self):
        if not self._playing or self._paused:
            return False
        end = self._ends_at()
        return end is None or _systime.perf_counter() < end

    def get_pos(self):
        if not self._playing:
            return -1
        return int((_systime.perf_counter() - self._started) * 1000)

    def set_pos(self, pos):
        pass

    def queue(self, filename, namehint="", loops=0):
        pass

    def set_endevent(self, type=None):
        self._endevent = int(type or 0)

    def get_endevent(self):
        return self._endevent


music = _Music()


def _pump_music_end():
    if music._playing and not music._paused and music._endevent:
        end = music._ends_at()
        if end is not None and _systime.perf_counter() >= end:
            music._playing = False
            from .event import post, Event
            post(Event(music._endevent))
