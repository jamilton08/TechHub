"""pygame.joystick — no controllers in the browser yet."""
from ._base import error

_init = False


def init():
    global _init
    _init = True


def quit():
    global _init
    _init = False


def get_init():
    return _init


def get_count():
    return 0


class Joystick:
    def __init__(self, id):
        raise error("Invalid joystick device number")


JoystickType = Joystick
