"""pygame.image — loads the pictures uploaded in the project's Assets."""
from . import _base
from ._base import host, PROJECT_DIR
from .surface import Surface


def load(file, namehint=""):
    if hasattr(file, "read"):
        raise NotImplementedError("image.load() needs a file name here, like pygame.image.load('ship.png')")
    name = _base.asset_name(file)
    sid = _base.new_id()
    packed = host.img_load(sid, name)
    if packed < 0:
        raise FileNotFoundError("No file '%s' found in working directory '%s'." % (name, PROJECT_DIR))
    return Surface._wrap(sid, packed // 65536, packed % 65536, True)


load_basic = load
load_extended = load


def get_extended():
    return True


def save(surface, file, namehint=""):
    raise NotImplementedError("image.save() isn't available in the browser yet")


save_extended = save


def tostring(*args, **kwargs):
    raise NotImplementedError("image.tostring() isn't available in the HSCT Arcade")


tobytes = fromstring = frombytes = frombuffer = tostring
