/**
 * The runner page (play/runner.html). Owns the Python worker, the game
 * screen, keyboard + mouse capture, and sound. The /play editor talks to it
 * only through postMessage (see protocol.js for the message list), so this
 * page can later live on a separate origin without any other changes.
 */
import './frame.css';
import { C, STDIN, EV, makeShared, pushEvent, keySlot, TAG } from './protocol.js';
import { CODE_TO_KEY, MOD_OF_CODE, KMOD } from './keymap.js';
import { PYODIDE_BASE, PYODIDE_PACKAGES } from '../config.js';

const $ = (id) => document.getElementById(id);
const canvas = $('screen');
const ctx = canvas.getContext('bitmaprenderer');
const idle = $('idle');
const hint = $('hint');
const badge = $('badge');

const S = makeShared();
let worker = null;
let workerReady = false;
let queuedRun = null;
let current = null;       // { runId, displayOpen, waitingInput, stopping, done: Promise, resolve }
let parentOrigin = '*';
let display = null;       // { width, height }
let repeat = null;        // key repeat enabled by pygame.key.set_repeat
let pyInfo = {};

/* ── talking to the /play page ───────────────────────────────────────── */
function toParent(type, data = {}) {
  if (window.parent === window) return;
  window.parent.postMessage({ [TAG]: 1, type, ...data }, parentOrigin);
}

function setState(state, text, sub = '') {
  document.body.dataset.state = state;
  $('idle-text').textContent = text;
  $('idle-sub').textContent = sub;
  toParent('status', { state, runId: current?.runId ?? null, text, sub });
}

/* ── the worker ──────────────────────────────────────────────────────── */
function spawn() {
  workerReady = false;
  worker = new Worker(new URL('./runner.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = onWorker;
  worker.onerror = (e) => {
    e.preventDefault?.();
    if (!workerReady) bootFailed(e.message || 'The Python worker could not start.');
    else crash(`The Python worker stopped: ${e.message || 'unknown error'}`);
  };
  if (S) {
    // fresh worker, fresh counters
    Atomics.store(S.ctrl, C.STDIN_STATE, STDIN.IDLE);
    S.interrupt[0] = 0;
  }
  worker.postMessage({
    type: 'init',
    shared: S,
    pyodideBase: new URL(PYODIDE_BASE, location.href).href,
    packageBase: PYODIDE_PACKAGES,
  });
  if (!current) setState('loading', 'Loading Python…', 'The first time can take a few seconds.');
}

function restartWorker() {
  try { worker?.terminate(); } catch { /* gone */ }
  stopAllSound();
  spawn();
}

/** Python never came up (blocked download, old browser…). Don't loop; say so. */
function bootFailed(message) {
  try { worker?.terminate(); } catch { /* gone */ }
  worker = null;
  setState('crashed', 'Python could not load', message);
  toParent('boot-failed', { message });
  const run = current;
  queuedRun = null;
  if (run) finish(run, { outcome: 'crashed', error: { type: 'LoadError', message: `Python could not load: ${message}` } });
}

function crash(message) {
  const run = current;
  restartWorker();
  if (run) finish(run, { outcome: 'crashed', error: { type: 'Crash', message } });
}

function onWorker(e) {
  const m = e.data;
  if (m.type === 'ready') {
    workerReady = true;
    pyInfo = { python: m.python, pyodide: m.version, bootMs: m.ms };
    toParent('ready', pyInfo);
    if (queuedRun) {
      const { run, msg } = queuedRun;
      queuedRun = null;
      if (current === run) dispatch(run, msg);
    }
    else if (!current) setState('ready', 'Press Run to start your program', `Python ${m.python}`);
    return;
  }
  if (m.type === 'fatal') {
    if (!workerReady) bootFailed(m.message);
    else crash(m.message);
    return;
  }
  const run = current;
  if (!run || m.runId !== run.runId) return;   // late message from a run we already ended
  switch (m.type) {
    case 'out': toParent('out', { runId: run.runId, stream: m.stream, text: m.text }); break;
    case 'status':
      if (m.state === 'running') setState('running', 'Running…', 'Output shows in the console.');
      else setState(m.state, 'Loading packages…', m.detail);
      break;
    case 'input':
      run.waitingInput = true;
      if (!display) setState('input', 'Waiting for you to type', 'Type your answer in the console and press Enter.');
      toParent('input', { runId: run.runId, prompt: m.prompt });
      break;
    case 'display': openDisplay(m.width, m.height); break;
    case 'caption': run.caption = m.text; toParent('caption', { runId: run.runId, text: m.text }); break;
    case 'display-closed': closeDisplay('Game closed'); break;
    case 'frame':
      if (display) ctx.transferFromImageBitmap(m.bitmap); else m.bitmap.close();
      if (S) Atomics.add(S.ctrl, C.FRAMES_SHOWN, 1);
      break;
    case 'sound': sound(JSON.parse(m.cmd)); break;
    case 'cursor': canvas.classList.toggle('no-cursor', !m.visible); break;
    case 'key-repeat': repeat = m.delay > 0 ? { delay: m.delay, interval: m.interval } : null; break;
    case 'done':
      finish(run, m);
      if (m.outcome === 'crashed') restartWorker();   // the interpreter is unusable after a fatal error
      break;
    default: break;
  }
}

/* ── runs ────────────────────────────────────────────────────────────── */
let pendingStart = null;   // a Run that's waiting for the previous program to stop

async function startRun(msg) {
  if (current) {
    // Run pressed while something is running: stop that first. A Stop pressed
    // meanwhile cancels this start too.
    const pending = { runId: msg.runId, cancelled: false };
    pendingStart = pending;
    await stop();
    if (pendingStart === pending) pendingStart = null;
    if (pending.cancelled) {
      toParent('done', { runId: msg.runId, outcome: 'stopped', error: null, files: [] });
      return;
    }
  }
  const run = { runId: msg.runId, displayOpen: false, waitingInput: false, stopping: false, dispatched: false };
  run.done = new Promise((res) => { run.resolve = res; });
  current = run;
  closeDisplay(null);
  badge.hidden = true;
  canvas.classList.remove('no-cursor');
  repeat = null;
  if (!workerReady) {
    if (!worker) spawn();
    queuedRun = { run, msg };
    setState('loading', 'Loading Python…', 'Your program starts as soon as Python is ready.');
    return;
  }
  await dispatch(run, msg);
}

async function dispatch(run, msg) {
  if (S) {
    releaseKeys(false);
    Atomics.store(S.ctrl, C.MOUSE_BUTTONS, 0);
  }
  setState('running', 'Starting…');
  const assets = msg.assets || [];
  const soundLengths = await decodeSounds(assets);
  if (current !== run || run.finished) return;   // stopped while sounds were loading
  run.dispatched = true;
  worker.postMessage({
    type: 'run',
    runId: run.runId,
    entry: msg.entry,
    files: msg.files,
    assets,
    soundLengths,
    displayHint: { width: Math.max(320, Math.round(innerWidth)), height: Math.max(240, Math.round(innerHeight)) },
  });
}

function finish(run, m) {
  if (run.finished) return;
  run.finished = true;
  const outcome = run.stopping && m.outcome !== 'crashed' ? 'stopped' : m.outcome;
  run.resolve?.();
  if (current === run) current = null;
  stopAllSound();
  releaseKeys(false);
  hint.hidden = true;
  if (outcome === 'error') setState('error', 'Your program hit an error', 'Details are in the console.');
  else if (outcome === 'stopped') setState('done', 'Stopped', 'Press Run to start again.');
  else if (outcome === 'crashed') setState('crashed', 'Python crashed and restarted', m.error?.message || '');
  else setState('done', 'Program finished', 'Press Run to start again.');
  if (display) {
    badge.textContent = outcome === 'error' ? 'Error — see the console' : outcome === 'stopped' ? 'Stopped' : 'Game over — press Run to play again';
    badge.hidden = false;
  }
  toParent('done', { runId: run.runId, outcome, error: m.error || null, files: m.files || [] });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function stop() {
  const run = current;
  if (!run || run.finished) return;
  run.stopping = true;
  setState('stopping', 'Stopping…');
  if (!run.dispatched) { queuedRun = null; finish(run, { outcome: 'stopped' }); return; }
  if (S) {
    // 1. Close the window the polite way, so a game can save before it quits.
    if (display && !run.waitingInput) {
      pushEvent(S.ring, S.ctrl, EV.QUIT);
      await Promise.race([run.done, wait(350)]);
      if (run.finished) return;
    }
    // 2. KeyboardInterrupt, and wake anything that's sleeping or waiting for input.
    S.interrupt[0] = 2;
    Atomics.add(S.ctrl, C.STOP, 1);
    Atomics.notify(S.ctrl, C.STOP);
    Atomics.store(S.ctrl, C.STDIN_STATE, STDIN.CANCELLED);
    Atomics.notify(S.ctrl, C.STDIN_STATE);
    Atomics.add(S.ctrl, C.EVT, 1);
    Atomics.notify(S.ctrl, C.EVT);
    await Promise.race([run.done, wait(1200)]);
    if (run.finished) return;
  }
  // 3. Still going (stuck in a tight loop the interrupt can't reach): restart Python.
  restartWorker();
  finish(run, { outcome: 'stopped' });
}

function sendStdin(line) {
  const run = current;
  if (!run || !S || Atomics.load(S.ctrl, C.STDIN_STATE) !== STDIN.WAITING) return;
  const bytes = new TextEncoder().encode(String(line));
  const n = Math.min(bytes.length, S.stdin.length);
  S.stdin.set(bytes.subarray(0, n));
  Atomics.store(S.ctrl, C.STDIN_LEN, n);
  Atomics.store(S.ctrl, C.STDIN_STATE, STDIN.READY);
  Atomics.notify(S.ctrl, C.STDIN_STATE);
  run.waitingInput = false;
  if (!display) setState('running', 'Running…', 'Output shows in the console.');
}

/* ── the game screen ─────────────────────────────────────────────────── */
function openDisplay(width, height) {
  display = { width, height };
  if (current) current.displayOpen = true;
  canvas.width = width;
  canvas.height = height;
  canvas.hidden = false;
  idle.hidden = true;
  badge.hidden = true;
  layout();
  canvas.focus({ preventScroll: true });
  updateHint();
  toParent('display', { runId: current?.runId, width, height });
}

function closeDisplay(message) {
  display = null;
  canvas.hidden = true;
  idle.hidden = false;
  hint.hidden = true;
  if (message) setState('running', message, 'The program is still running.');
  if (current && message) toParent('display', { runId: current.runId, width: 0, height: 0 });
}

function layout() {
  if (!display) return;
  const scale = Math.min(innerWidth / display.width, innerHeight / display.height);
  canvas.style.width = `${Math.floor(display.width * scale)}px`;
  canvas.style.height = `${Math.floor(display.height * scale)}px`;
  canvas.classList.toggle('pixelated', scale >= 1.5);
}
addEventListener('resize', layout);

function updateHint() {
  hint.hidden = !(display && current && !document.hasFocus());
}

/* ── keyboard ────────────────────────────────────────────────────────── */
const held = new Map(); // KeyboardEvent.code → [key, scancode]
let mods = 0;

function modsFor(e) {
  let m = mods;
  if (e.getModifierState?.('CapsLock')) m |= KMOD.CAPS; else m &= ~KMOD.CAPS;
  if (e.getModifierState?.('NumLock')) m |= KMOD.NUM; else m &= ~KMOD.NUM;
  return m;
}

function keyFor(e) {
  const hit = CODE_TO_KEY.get(e.code);
  if (hit) return hit;
  if (e.key && e.key.length === 1) return [e.key.toLowerCase().codePointAt(0), 0];
  return [0, 0];
}

const UNICODE = { Enter: 13, NumpadEnter: 13, Backspace: 8, Tab: 9, Escape: 27, Delete: 127 };

function onKeyDown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); toParent('shortcut', { name: 'run' }); return; }
  if (!current || !S) return;
  const passThrough = e.ctrlKey || e.metaKey || ['F5', 'F11', 'F12'].includes(e.code);
  if (!passThrough) e.preventDefault();
  if (MOD_OF_CODE[e.code]) mods |= MOD_OF_CODE[e.code];
  const [key, scan] = keyFor(e);
  const m = modsFor(e);
  Atomics.store(S.ctrl, C.MODS, m);
  if (e.repeat && !repeat) return;
  if (!e.repeat) {
    held.set(e.code, [key, scan]);
    if (key) S.keys[keySlot(key)] = 1;
  }
  const uni = e.key.length === 1 ? e.key.codePointAt(0) : (UNICODE[e.code] || 0);
  pushEvent(S.ring, S.ctrl, EV.KEYDOWN, key, m, uni, scan);
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) pushEvent(S.ring, S.ctrl, EV.TEXTINPUT, e.key.codePointAt(0));
}

function onKeyUp(e) {
  if (!S) return;
  if (MOD_OF_CODE[e.code]) mods &= ~MOD_OF_CODE[e.code];
  const m = modsFor(e);
  Atomics.store(S.ctrl, C.MODS, m);
  const [key, scan] = held.get(e.code) || keyFor(e);
  held.delete(e.code);
  if (key) S.keys[keySlot(key)] = 0;
  if (current) {
    e.preventDefault();
    pushEvent(S.ring, S.ctrl, EV.KEYUP, key, m, 0, scan);
  }
}

/** Let go of everything (window lost focus, or a run ended) so no key sticks down. */
function releaseKeys(sendEvents) {
  if (!S) return;
  for (const [key, scan] of held.values()) {
    if (key) S.keys[keySlot(key)] = 0;
    if (sendEvents && current) pushEvent(S.ring, S.ctrl, EV.KEYUP, key, 0, 0, scan);
  }
  held.clear();
  S.keys.fill(0);
  mods = 0;
  Atomics.store(S.ctrl, C.MODS, 0);
}

addEventListener('keydown', onKeyDown);
addEventListener('keyup', onKeyUp);
addEventListener('blur', () => {
  releaseKeys(true);
  if (S) {
    Atomics.store(S.ctrl, C.FOCUSED, 0);
    Atomics.store(S.ctrl, C.MOUSE_BUTTONS, 0);
    if (current) pushEvent(S.ring, S.ctrl, EV.WINDOWFOCUSLOST);
  }
  updateHint();
});
addEventListener('focus', () => {
  if (S) {
    Atomics.store(S.ctrl, C.FOCUSED, 1);
    if (current) pushEvent(S.ring, S.ctrl, EV.WINDOWFOCUSGAINED);
  }
  updateHint();
});

/* ── mouse ───────────────────────────────────────────────────────────── */
let lastMotion = 0;
let pendingRel = [0, 0];
let lastPos = null;

function gamePos(e) {
  const r = canvas.getBoundingClientRect();
  const x = Math.floor(((e.clientX - r.left) * display.width) / r.width);
  const y = Math.floor(((e.clientY - r.top) * display.height) / r.height);
  return [Math.max(0, Math.min(display.width - 1, x)), Math.max(0, Math.min(display.height - 1, y))];
}

const BUTTON = { 0: 1, 1: 2, 2: 3, 3: 6, 4: 7 };
const BIT = { 1: 1, 2: 2, 3: 4 };

canvas.addEventListener('pointermove', (e) => {
  if (!display || !S) return;
  const [x, y] = gamePos(e);
  if (lastPos) { pendingRel[0] += x - lastPos[0]; pendingRel[1] += y - lastPos[1]; }
  lastPos = [x, y];
  Atomics.store(S.ctrl, C.MOUSE_X, x);
  Atomics.store(S.ctrl, C.MOUSE_Y, y);
  const t = performance.now();
  if (current && t - lastMotion > 8) {
    pushEvent(S.ring, S.ctrl, EV.MOUSEMOTION, x, y, pendingRel[0], pendingRel[1], Atomics.load(S.ctrl, C.MOUSE_BUTTONS));
    pendingRel = [0, 0];
    lastMotion = t;
  }
});
canvas.addEventListener('pointerenter', () => S && Atomics.store(S.ctrl, C.MOUSE_IN, 1));
canvas.addEventListener('pointerleave', () => S && Atomics.store(S.ctrl, C.MOUSE_IN, 0));
canvas.addEventListener('pointerdown', (e) => {
  resumeAudio();
  canvas.focus({ preventScroll: true });
  if (!display || !S || !current) return;
  e.preventDefault();
  canvas.setPointerCapture?.(e.pointerId);
  const [x, y] = gamePos(e);
  const b = BUTTON[e.button] || 1;
  Atomics.store(S.ctrl, C.MOUSE_X, x);
  Atomics.store(S.ctrl, C.MOUSE_Y, y);
  Atomics.or(S.ctrl, C.MOUSE_BUTTONS, BIT[b] || 0);
  pushEvent(S.ring, S.ctrl, EV.MOUSEBUTTONDOWN, x, y, b);
});
canvas.addEventListener('pointerup', (e) => {
  if (!display || !S) return;
  const [x, y] = gamePos(e);
  const b = BUTTON[e.button] || 1;
  Atomics.and(S.ctrl, C.MOUSE_BUTTONS, ~(BIT[b] || 0));
  if (current) pushEvent(S.ring, S.ctrl, EV.MOUSEBUTTONUP, x, y, b);
});
canvas.addEventListener('wheel', (e) => {
  if (!display || !S || !current) return;
  e.preventDefault();
  const dy = e.deltaY < 0 ? 1 : e.deltaY > 0 ? -1 : 0;
  const dx = e.deltaX > 0 ? 1 : e.deltaX < 0 ? -1 : 0;
  const [x, y] = gamePos(e);
  pushEvent(S.ring, S.ctrl, EV.MOUSEWHEEL, dx, dy);
  if (dy) {
    const b = dy > 0 ? 4 : 5;
    pushEvent(S.ring, S.ctrl, EV.MOUSEBUTTONDOWN, x, y, b);
    pushEvent(S.ring, S.ctrl, EV.MOUSEBUTTONUP, x, y, b);
  }
}, { passive: false });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.tabIndex = 0;
addEventListener('pointerdown', resumeAudio);
addEventListener('keydown', resumeAudio);

/* ── sound (pygame.mixer) ────────────────────────────────────────────── */
let audio = null;
const buffers = new Map();      // asset name → AudioBuffer
const playing = new Map();      // Sound id → Set of { src, gain }
let music = null;               // { src, gain, name, loops, volume, startedAt, offset }

function audioCtx() {
  if (!audio) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audio = new AC();
  }
  return audio;
}
let audioPausedByProgram = false;
function resumeAudio() {
  if (audio && audio.state === 'suspended' && !audioPausedByProgram) audio.resume().catch(() => {});
}

async function decodeSounds(assets) {
  const lengths = {};
  buffers.clear();   // a re-uploaded (or another project's) boom.wav must not reuse the old sound
  const sounds = assets.filter((a) => /^audio\//.test(a.type) || /\.(wav|ogg|mp3|m4a|aac|flac)$/i.test(a.name));
  if (!sounds.length) return lengths;
  const ac = audioCtx();
  if (!ac) return lengths;
  await Promise.all(sounds.map(async (a) => {
    try {
      const buf = await ac.decodeAudioData(a.data.slice(0));
      buffers.set(a.name, buf);
      lengths[a.name] = buf.duration;
    } catch {
      toParent('out', { runId: current?.runId, stream: 'stderr', text: `Could not read the sound ${a.name} — try a .wav or .mp3 file.\n` });
    }
  }));
  return lengths;
}

function startSource(name, loops, volume, offset = 0) {
  const ac = audioCtx();
  const buf = buffers.get(name) || buffers.get(String(name).split('/').pop());
  if (!ac || !buf) return null;
  resumeAudio();
  const src = ac.createBufferSource();
  const gain = ac.createGain();
  gain.gain.value = volume;
  src.buffer = buf;
  src.connect(gain).connect(ac.destination);
  if (loops !== 0) src.loop = true;
  src.start(0, offset % buf.duration);
  if (loops > 0) src.stop(ac.currentTime + buf.duration * (loops + 1) - offset);
  return { src, gain, buf };
}

function sound(cmd) {
  switch (cmd.op) {
    case 'play': {
      const h = startSource(cmd.name, cmd.loops, cmd.volume);
      if (!h) return;
      if (cmd.maxtime > 0) h.src.stop(audio.currentTime + cmd.maxtime / 1000);
      if (!playing.has(cmd.id)) playing.set(cmd.id, new Set());
      playing.get(cmd.id).add(h);
      h.src.onended = () => playing.get(cmd.id)?.delete(h);
      break;
    }
    case 'stop': playing.get(cmd.id)?.forEach((h) => { try { h.src.stop(); } catch { /* done */ } }); playing.delete(cmd.id); break;
    case 'volume': playing.get(cmd.id)?.forEach((h) => { h.gain.gain.value = cmd.volume; }); break;
    case 'stopall': stopAllSound(); break;
    case 'pauseall': audioPausedByProgram = true; audio?.suspend(); break;
    case 'resumeall': audioPausedByProgram = false; resumeAudio(); break;
    case 'music-play': {
      stopMusic();
      const h = startSource(cmd.name, cmd.loops, cmd.volume, cmd.start || 0);
      if (h) music = { ...h, name: cmd.name, loops: cmd.loops, volume: cmd.volume, startedAt: audio.currentTime - (cmd.start || 0) };
      break;
    }
    case 'music-stop': stopMusic(); break;
    case 'music-pause':
      if (music && !music.paused) {
        music.offset = audio.currentTime - music.startedAt;
        try { music.src.stop(); } catch { /* done */ }
        music.paused = true;
      }
      break;
    case 'music-resume':
      if (music && music.paused) {
        const h = startSource(music.name, music.loops, music.volume, music.offset);
        if (h) music = { ...music, ...h, paused: false, startedAt: audio.currentTime - music.offset };
      }
      break;
    case 'music-volume': if (music) { music.volume = cmd.volume; music.gain.gain.value = cmd.volume; } break;
    default: break;
  }
}

function stopMusic() {
  if (music) { try { music.src.stop(); } catch { /* done */ } }
  music = null;
}

function stopAllSound() {
  if (audioPausedByProgram) { audioPausedByProgram = false; resumeAudio(); }
  playing.forEach((set) => set.forEach((h) => { try { h.src.stop(); } catch { /* done */ } }));
  playing.clear();
  stopMusic();
}

/* ── messages from the /play page ────────────────────────────────────── */
addEventListener('message', (e) => {
  if (e.source !== window.parent || !e.data || e.data[TAG] !== 1) return;
  parentOrigin = e.origin === 'null' ? '*' : e.origin;
  const m = e.data;
  switch (m.type) {
    case 'hello': toParent('hello', { isolated: Boolean(S), ready: workerReady, ...pyInfo }); break;
    case 'run': resumeAudio(); startRun(m); break;
    case 'stop':
      if (pendingStart) pendingStart.cancelled = true;   // Stop also cancels a Run that's waiting to start
      stop();
      break;
    case 'stdin': sendStdin(m.line); break;
    case 'focus': canvas.hidden ? window.focus() : canvas.focus({ preventScroll: true }); break;
    case 'restart': restartWorker(); break;
    default: break;
  }
});

spawn();
toParent('hello', { isolated: Boolean(S), ready: false });
