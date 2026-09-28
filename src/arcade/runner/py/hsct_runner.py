"""Runs one student project inside the worker.

prepare(json) writes the project into /home/pyodide/project and says which
extra packages (numpy, …) need loading; run() executes the entry file as
__main__ and returns a JSON report: how it ended, a clean traceback that
only shows the student's own files, and any text files the program wrote
(so a game's save file shows up in the project).
"""
import builtins
import json
import os
import shutil
import signal
import sys
import time
import traceback
import types

import _hsct_host as host

PROJECT = "/home/pyodide/project"
TEXT_EXTS = {".py", ".txt", ".json", ".csv", ".md"}   # same list as the editor (store/model.js)
MAX_TEXT = 200_000
# Folder names games commonly load from. They all point back at the project,
# so pygame.image.load("assets/ship.png") finds ship.png.
FOLDER_ALIASES = ("assets", "images", "img", "sprites", "graphics", "sounds", "sound", "audio",
                  "sfx", "music", "fonts", "data", "levels")

_state = {"entry": "main.py", "files": {}, "assets": set(), "modules": set()}

_BLOCKED = {
    "js": "The browser's JavaScript isn't available to programs here.",
    "pyodide": "The browser's JavaScript isn't available to programs here.",
    "pyodide_js": "The browser's JavaScript isn't available to programs here.",
    "_hsct_host": "That module is private to the Arcade.",
    "tkinter": "tkinter opens desktop windows, which a web page can't do. Use pygame for graphics.",
    "_tkinter": "tkinter opens desktop windows, which a web page can't do. Use pygame for graphics.",
    "turtle": "turtle needs desktop windows (tkinter), which a web page can't do. Use pygame for graphics.",
}

_real_import = builtins.__import__


def _is_student(globals_):
    if not globals_:
        return False
    if globals_.get("__name__") == "__main__":
        return True
    f = globals_.get("__file__") or ""
    return f.startswith(PROJECT + "/")


def _guarded_import(name, globals=None, locals=None, fromlist=(), level=0):
    if level == 0:
        root = name.partition(".")[0]
        if globals is None:  # called as __import__("js") — look at who called
            try:
                globals = sys._getframe(1).f_globals
            except ValueError:
                globals = None
        if root in _BLOCKED and _is_student(globals):
            raise ModuleNotFoundError("No module named '%s'. %s" % (root, _BLOCKED[root]), name=root)
    return _real_import(name, globals, locals, fromlist, level)


def _input(prompt=""):
    prompt = str(prompt)
    if prompt:
        sys.stdout.write(prompt)
    sys.stdout.flush()
    sys.stderr.flush()
    if not host.isolated():
        raise RuntimeError("input() is turned off because this page isn't cross-origin isolated. "
                           "Ask your teacher to check the site's COOP/COEP headers.")
    line = host.read_line(prompt)
    if line is None:
        host.clear_interrupt()
        raise KeyboardInterrupt
    return line


def _sleep(seconds):
    seconds = float(seconds)
    if seconds < 0:
        raise ValueError("sleep length must be non-negative")
    sys.stdout.flush()
    sys.stderr.flush()
    host.sleep(seconds * 1000.0)
    if host.stopped():
        host.clear_interrupt()
        raise KeyboardInterrupt


def boot():
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(line_buffering=True)
        except Exception:
            pass
    builtins.input = _input
    builtins.__import__ = _guarded_import
    time.sleep = _sleep
    signal.signal(signal.SIGINT, _on_sigint)
    os.makedirs(PROJECT, exist_ok=True)
    import pygame  # noqa: F401  (warm it up so the first run starts fast)


def _clear_project():
    for name in os.listdir(PROJECT):
        p = os.path.join(PROJECT, name)
        if os.path.islink(p) or os.path.isfile(p):
            os.unlink(p)
        elif os.path.isdir(p):
            shutil.rmtree(p, ignore_errors=True)


def _purge_modules():
    for name, mod in list(sys.modules.items()):
        f = getattr(mod, "__file__", None) or ""
        if f.startswith(PROJECT + "/") or name in _state["modules"]:
            del sys.modules[name]


def prepare(spec_json):
    spec = json.loads(spec_json)
    _purge_modules()
    _clear_project()
    files = {f["name"]: f["content"] for f in spec["files"]}
    for name, content in files.items():
        with open(os.path.join(PROJECT, name), "w", encoding="utf-8", newline="") as fh:
            fh.write(content)
    for alias in FOLDER_ALIASES:
        if alias not in files:
            try:
                os.symlink(PROJECT, os.path.join(PROJECT, alias))
            except OSError:
                pass
    _state["entry"] = spec.get("entry") or "main.py"
    _state["files"] = files
    _state["assets"] = set(spec.get("assets") or [])
    _state["modules"] = {n[:-3] for n in files if n.endswith(".py")}

    import pygame
    pygame._reset()
    pygame.mixer._set_lengths(spec.get("soundLengths") or {})

    # Which imports aren't standard library, pygame, or the project's own files?
    need = set()
    try:
        from pyodide.code import find_imports
        std = set(sys.stdlib_module_names) | set(sys.builtin_module_names)
        for name, src in files.items():
            if not name.endswith(".py"):
                continue
            try:
                found = find_imports(src)
            except SyntaxError:
                continue
            for mod in found:
                root = mod.partition(".")[0]
                if root in std or root in _state["modules"] or root in _BLOCKED or root == "pygame":
                    continue
                if root in sys.modules:
                    continue
                need.add(root)
    except Exception:
        pass
    return json.dumps({"importCode": "\n".join("import %s" % n for n in sorted(need))})


def _short(filename):
    if filename and filename.startswith(PROJECT + "/"):
        return filename[len(PROJECT) + 1:]
    return filename


def _describe(exc):
    files = _state["files"]
    info = {"type": type(exc).__name__, "message": str(exc), "file": None, "line": None, "col": None}
    if isinstance(exc, SyntaxError):
        info["file"] = _short(exc.filename)
        info["line"] = exc.lineno
        info["col"] = exc.offset
        text = "".join(traceback.format_exception_only(type(exc), exc))
        info["traceback"] = text.replace(PROJECT + "/", "")
        info["message"] = exc.msg
        return info
    frames = traceback.extract_tb(exc.__traceback__)
    mine = [f for f in frames if _short(f.filename) in files]
    if mine:
        last = mine[-1]
        info["file"] = _short(last.filename)
        info["line"] = last.lineno
        info["col"] = (last.colno + 1) if getattr(last, "colno", None) is not None else None
    for f in mine:
        f.filename = _short(f.filename)
    head = "Traceback (most recent call last):\n" if mine else ""
    body = "".join(traceback.format_list(mine))
    try:
        tail = "".join(traceback.TracebackException.from_exception(exc).format_exception_only())
    except Exception:
        tail = "".join(traceback.format_exception_only(type(exc), exc))
    info["traceback"] = (head + body + tail).replace(PROJECT + "/", "")
    lines = tail.strip().splitlines()
    if lines:
        last_line = lines[-1]
        prefix = type(exc).__name__ + ": "
        info["message"] = last_line[len(prefix):] if last_line.startswith(prefix) else last_line
    return info


def _changed_files():
    out = []
    try:
        names = sorted(os.listdir(PROJECT))
    except OSError:
        return out
    for name in names:
        p = os.path.join(PROJECT, name)
        if os.path.islink(p) or not os.path.isfile(p) or name in _state["assets"]:
            continue
        if os.path.splitext(name)[1].lower() not in TEXT_EXTS or os.path.getsize(p) > MAX_TEXT:
            continue
        try:
            with open(p, encoding="utf-8", newline="") as fh:
                content = fh.read()
        except (UnicodeDecodeError, OSError):
            continue
        if _state["files"].get(name) != content:
            out.append({"name": name, "content": content})
    return out


def _on_sigint(signum, frame):
    """Stop button → KeyboardInterrupt, but only while the student's code runs.

    Pyodide turns the Stop button into a SIGINT. One can arrive a moment
    after the program has already ended (say, while we tidy up); ignoring
    it then keeps the runner itself from being interrupted.
    """
    host.clear_interrupt()
    if _armed[0]:
        raise KeyboardInterrupt


_armed = [False]


def run():
    entry = _state["entry"]
    path = os.path.join(PROJECT, entry)
    os.chdir(PROJECT)
    if sys.path[0] != PROJECT:
        if PROJECT in sys.path:
            sys.path.remove(PROJECT)
        sys.path.insert(0, PROJECT)
    old_main = sys.modules.get("__main__")
    old_argv = sys.argv
    main = types.ModuleType("__main__")
    main.__file__ = path
    main.__builtins__ = builtins
    sys.modules["__main__"] = main
    sys.argv = [entry]
    outcome, error = "ok", None
    try:
        try:
            with open(path, encoding="utf-8") as fh:
                src = fh.read()
            code = compile(src, path, "exec")
            _armed[0] = True
            exec(code, main.__dict__)
            _armed[0] = False
        except SystemExit as e:
            _armed[0] = False
            if e.code not in (None, 0) and not isinstance(e.code, int):
                print(e.code, file=sys.stderr)
        except KeyboardInterrupt:
            _armed[0] = False
            outcome = "stopped"
        except BaseException as e:  # noqa: BLE001 — we report everything
            _armed[0] = False
            if host.stopped():
                outcome = "stopped"
            else:
                outcome, error = "error", _describe(e)
    except KeyboardInterrupt:
        _armed[0] = False
        outcome = "stopped"
    finally:
        _armed[0] = False
        host.clear_interrupt()
        sys.modules["__main__"] = old_main
        sys.argv = old_argv
        for stream in (sys.stdout, sys.stderr):
            try:
                stream.flush()
            except Exception:
                pass
        try:
            import pygame
            pygame.mixer.stop()
        except Exception:
            pass
    return json.dumps({"outcome": outcome, "error": error, "files": _changed_files()})
