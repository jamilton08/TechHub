/**
 * Shared layout for the memory the runner page and the Python worker both
 * see (SharedArrayBuffer). A student's game loop blocks the worker, so the
 * worker can't receive normal messages while it runs; instead it reads
 * keys, mouse, events and typed input straight out of this shared memory.
 *
 * SharedArrayBuffer only exists when the page is cross-origin isolated
 * (COOP + COEP headers — see public/_headers). Without it the runner still
 * runs programs and draws games, but keyboard/mouse input and input() are off.
 */

// ctrl: Int32Array(16)
export const C = {
  STOP: 0,          // bumped + notified when Stop is pressed (sleeps wait on it)
  EVT: 1,           // bumped + notified on every new event (event.wait waits on it)
  STDIN_STATE: 2,   // 0 idle · 1 worker waiting · 2 line ready · 3 cancelled
  STDIN_LEN: 3,     // bytes of UTF-8 in the stdin buffer
  FRAMES_SHOWN: 4,  // runner page counts frames it has drawn (backpressure)
  MOUSE_X: 5,
  MOUSE_Y: 6,
  MOUSE_BUTTONS: 7, // bit 0 left · bit 1 middle · bit 2 right
  MODS: 8,          // pygame KMOD_* bitmask of held modifiers
  FOCUSED: 9,       // 1 while the game has keyboard focus
  MOUSE_IN: 10,     // 1 while the pointer is over the game
};
export const CTRL_LEN = 16;

export const STDIN = { IDLE: 0, WAITING: 1, READY: 2, CANCELLED: 3 };
export const STDIN_BYTES = 64 * 1024;

// key state: one byte per slot; slot = keycode (< 256) or 256 + scancode
export const KEY_SLOTS = 512;
export const keySlot = (keycode) => (keycode < 256 ? keycode : 256 + (keycode & 0xff));

// event ring: [writeCount, readCount, then RING_SIZE records of EVT_INTS ints]
export const RING_SIZE = 256;
export const EVT_INTS = 8;
export const RING_HEADER = 2;
export const RING_LEN = RING_HEADER + RING_SIZE * EVT_INTS;

// pygame 2 event type numbers (same values real pygame uses)
export const EV = {
  QUIT: 256,
  KEYDOWN: 768,
  KEYUP: 769,
  TEXTINPUT: 771,
  MOUSEMOTION: 1024,
  MOUSEBUTTONDOWN: 1025,
  MOUSEBUTTONUP: 1026,
  MOUSEWHEEL: 1027,
  WINDOWFOCUSGAINED: 32780,
  WINDOWFOCUSLOST: 32781,
  USEREVENT: 32866,
};

export function makeShared() {
  if (!self.crossOriginIsolated || typeof SharedArrayBuffer === 'undefined') return null;
  return {
    ctrl: new Int32Array(new SharedArrayBuffer(CTRL_LEN * 4)),
    interrupt: new Uint8Array(new SharedArrayBuffer(1)),
    keys: new Uint8Array(new SharedArrayBuffer(KEY_SLOTS)),
    ring: new Int32Array(new SharedArrayBuffer(RING_LEN * 4)),
    stdin: new Uint8Array(new SharedArrayBuffer(STDIN_BYTES)),
  };
}

/** Producer side (runner page). Drops the event if the program isn't reading. */
export function pushEvent(ring, ctrl, type, a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, g = 0) {
  const w = Atomics.load(ring, 0);
  const r = Atomics.load(ring, 1);
  if (w - r >= RING_SIZE) return false;
  const base = RING_HEADER + (w % RING_SIZE) * EVT_INTS;
  ring[base] = type; ring[base + 1] = a; ring[base + 2] = b; ring[base + 3] = c;
  ring[base + 4] = d; ring[base + 5] = e; ring[base + 6] = f; ring[base + 7] = g;
  Atomics.store(ring, 0, w + 1);
  Atomics.add(ctrl, C.EVT, 1);
  Atomics.notify(ctrl, C.EVT);
  return true;
}

/** Consumer side (worker). Returns a flat array of EVT_INTS-sized records. */
export function drainEvents(ring) {
  const w = Atomics.load(ring, 0);
  const r = Atomics.load(ring, 1);
  if (w === r) return null;
  const out = [];
  for (let i = r; i < w; i++) {
    const base = RING_HEADER + (i % RING_SIZE) * EVT_INTS;
    for (let k = 0; k < EVT_INTS; k++) out.push(ring[base + k]);
  }
  Atomics.store(ring, 1, w);
  return out;
}

export function clearRing(ring) {
  Atomics.store(ring, 1, Atomics.load(ring, 0));
}

/**
 * Messages between the /play page and the runner page (postMessage), all
 * tagged { arcade: 1, type, runId }:
 *
 *   page → runner   run { runId, entry, files:[{name,content}], assets:[{name,type,data:ArrayBuffer}] }
 *                   stop { runId }   stdin { runId, line }   focus {}
 *   runner → page   hello { isolated, version }   status { state, detail }
 *                   out { runId, stream:'stdout'|'stderr', text }
 *                   input { runId, prompt }       display { runId, width, height, caption }
 *                   done { runId, outcome:'ok'|'error'|'stopped'|'crashed', error?, files? }
 */
export const TAG = 'hsct-arcade';
