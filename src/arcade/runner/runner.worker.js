/**
 * The Python worker. Loads Pyodide (CPython in WebAssembly), installs the
 * pygame-compatible layer, and runs one student program at a time.
 *
 * The program's game loop blocks this worker — that's fine, it's a worker.
 * Drawing happens on OffscreenCanvases here; every display.flip() copies the
 * screen into an ImageBitmap and posts it to the runner page. Input comes the
 * other way through shared memory (see protocol.js), because a blocked
 * worker never sees postMessage.
 */
import { C, STDIN, keySlot, drainEvents, clearRing } from './protocol.js';
import { keyConstantsPython } from './keymap.js';
// Every .py file under ./py is written into Pyodide's filesystem at /hsct.
const PY_SOURCES = import.meta.glob('./py/**/*.py', { query: '?raw', import: 'default', eager: true });
const SHIM_FILES = { 'pygame/_keys.py': keyConstantsPython() };
for (const [path, src] of Object.entries(PY_SOURCES)) SHIM_FILES[path.replace(/^\.\/py\//, '')] = src;

let py = null;          // the Pyodide instance
let S = null;           // shared memory views (null when not cross-origin isolated)
let runId = 0;          // current run, stamped on every message
let stopBase = 0;       // ctrl[STOP] when this run started
let displayHint = { width: 960, height: 600 };

const post = (msg, transfer) => self.postMessage({ runId, ...msg }, transfer || []);
const now = () => performance.now();

/* ── output: coalesced so a print() loop can't flood the page ───────── */
const outQueue = [];
let outChars = 0;
let lastOut = 0;
const decoders = { stdout: new TextDecoder(), stderr: new TextDecoder() };
function writeOut(stream, text) {
  if (!text) return;
  const last = outQueue[outQueue.length - 1];
  if (last && last[0] === stream) last[1] += text; else outQueue.push([stream, text]);
  outChars += text.length;
  if (outChars > 16384 || now() - lastOut > 40) flushOut();
}
function flushOut() {
  for (const [stream, text] of outQueue) post({ type: 'out', stream, text });
  outQueue.length = 0;
  outChars = 0;
  lastOut = now();
}
const writer = (stream) => ({
  isatty: true,
  write(buf) { writeOut(stream, decoders[stream].decode(buf, { stream: true })); return buf.length; },
});

/* ── surfaces ────────────────────────────────────────────────────────── */
const surfaces = new Map(); // id → { c, x, w, h, alpha, key, dirty, kc }
let display = null;         // surface 0
let presentCanvas = null;
let pctx = null;
let framesSent = 0;
let framePending = false;
let lastFrame = 0;
const masks = new Map();    // mask id → { w, h, b: Uint8Array }
const images = new Map();   // asset name → ImageBitmap
const fontFamilies = new Map(); // asset name → CSS family

function makeSurface(id, w, h, alpha) {
  w = Math.max(0, Math.floor(w)); h = Math.max(0, Math.floor(h));
  const c = new OffscreenCanvas(Math.max(1, w), Math.max(1, h));
  const x = c.getContext('2d');
  if (!alpha) { x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height); }
  const s = { c, x, w, h, alpha: null, key: null, dirty: true, kc: null };
  surfaces.set(id, s);
  return s;
}
const get = (id) => surfaces.get(id);
const touch = (s) => { s.dirty = true; if (s === display) framePending = true; };

/** Colorkey without destroying pixels: keep a second canvas with the key made transparent. */
function keyed(s) {
  if (!s.key) return s.c;
  if (s.kc && !s.dirty) return s.kc;
  const [kr, kg, kb] = s.key;
  if (!s.kc || s.kc.width !== s.c.width || s.kc.height !== s.c.height) s.kc = new OffscreenCanvas(s.c.width, s.c.height);
  const kx = s.kc.getContext('2d');
  const img = s.x.getImageData(0, 0, s.c.width, s.c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] === kr && d[i + 1] === kg && d[i + 2] === kb) d[i + 3] = 0;
  }
  kx.putImageData(img, 0, 0);
  s.dirty = false;
  return s.kc;
}

// pygame BLEND_* flags → closest canvas composite mode (RGB and RGBA variants)
const BLEND = { 1: 'lighter', 2: 'difference', 3: 'multiply', 4: 'darken', 5: 'lighten',
  6: 'lighter', 7: 'difference', 8: 'multiply', 9: 'darken', 10: 'lighten' };

function strokeSetup(x, css, width) {
  x.strokeStyle = css; x.lineWidth = width; x.lineJoin = 'miter'; x.lineCap = 'butt';
}

function presentFrame(force) {
  if (!display) return;
  if (!force) {
    if (S) { if (framesSent - Atomics.load(S.ctrl, C.FRAMES_SHOWN) >= 2) return; }
    else if (now() - lastFrame < 14) return;
  }
  if (!framePending && !force) return;
  pctx.globalCompositeOperation = 'copy';
  pctx.drawImage(display.c, 0, 0);
  const bitmap = presentCanvas.transferToImageBitmap();
  post({ type: 'frame', bitmap }, [bitmap]);
  framesSent++;
  framePending = false;
  lastFrame = now();
}

/** Called before anything that blocks, so the screen and console are current. */
function beforeBlock() {
  if (framePending) presentFrame(true);
  if (outQueue.length) flushOut();
}

const stopRequested = () => (S ? Atomics.load(S.ctrl, C.STOP) !== stopBase : false);

/* ── the module Python sees as `_hsct_host` ──────────────────────────── */
const host = {
  isolated: () => Boolean(S),
  display_hint: () => `${displayHint.width},${displayHint.height}`,

  s_new(id, w, h, alpha) { makeSurface(id, w, h, alpha); },
  s_free(id) { if (id !== 0) surfaces.delete(id); },
  s_fill(id, css, x, y, w, h) {
    const s = get(id); if (!s) return;
    s.x.clearRect(x, y, w, h);
    if (css) { s.x.fillStyle = css; s.x.fillRect(x, y, w, h); }
    touch(s);
  },
  s_blit(dst, src, x, y, ax, ay, aw, ah, flags) {
    const d = get(dst), s = get(src); if (!d || !s || !s.w || !s.h) return;
    const img = keyed(s);
    d.x.globalAlpha = s.alpha == null ? 1 : s.alpha / 255;
    d.x.globalCompositeOperation = BLEND[flags] || 'source-over';
    if (aw >= 0) { if (aw > 0 && ah > 0) d.x.drawImage(img, ax, ay, aw, ah, x, y, aw, ah); }
    else d.x.drawImage(img, x, y);
    d.x.globalAlpha = 1;
    d.x.globalCompositeOperation = 'source-over';
    touch(d);
  },
  s_alpha(id, a) { const s = get(id); if (s) s.alpha = a < 0 ? null : a; },
  s_colorkey(id, r, g, b) { const s = get(id); if (!s) return; s.key = r < 0 ? null : [r, g, b]; s.dirty = true; },
  s_get_at(id, x, y) {
    const s = get(id); if (!s) return 0;
    const d = s.x.getImageData(x, y, 1, 1).data;
    return ((d[0] << 24) | (d[1] << 16) | (d[2] << 8) | d[3]) >>> 0;
  },
  s_set_at(id, x, y, css) {
    const s = get(id); if (!s) return;
    s.x.clearRect(x, y, 1, 1); s.x.fillStyle = css; s.x.fillRect(x, y, 1, 1); touch(s);
  },
  s_copy(id, src, x, y, w, h) {
    const s = get(src); if (!s) return;
    const n = makeSurface(id, w, h, true);
    if (w > 0 && h > 0) n.x.drawImage(s.c, x, y, w, h, 0, 0, w, h);
    n.alpha = s.alpha; n.key = s.key;
  },
  s_flatten(id) {
    const s = get(id); if (!s) return;
    s.x.globalCompositeOperation = 'destination-over';
    s.x.fillStyle = '#000'; s.x.fillRect(0, 0, s.c.width, s.c.height);
    s.x.globalCompositeOperation = 'source-over';
    touch(s);
  },
  s_scroll(id, dx, dy) {
    const s = get(id); if (!s) return;
    const tmp = new OffscreenCanvas(s.c.width, s.c.height);
    tmp.getContext('2d').drawImage(s.c, 0, 0);
    s.x.globalCompositeOperation = 'copy';
    s.x.drawImage(tmp, dx, dy);
    s.x.globalCompositeOperation = 'source-over';
    touch(s);
  },

  d_rect(id, css, x, y, w, h, width, radius) {
    const s = get(id); if (!s) return;
    const X = s.x;
    if (width > 0 && (w <= width * 2 || h <= width * 2)) width = 0;
    if (radius > 0) {
      radius = Math.min(radius, w / 2, h / 2);
      X.beginPath();
      if (width > 0) { strokeSetup(X, css, width); X.roundRect(x + width / 2, y + width / 2, w - width, h - width, Math.max(0, radius - width / 2)); X.stroke(); }
      else { X.fillStyle = css; X.roundRect(x, y, w, h, radius); X.fill(); }
    } else if (width > 0) {
      strokeSetup(X, css, width); X.strokeRect(x + width / 2, y + width / 2, w - width, h - width);
    } else { X.fillStyle = css; X.fillRect(x, y, w, h); }
    touch(s);
  },
  d_circle(id, css, cx, cy, r, width) {
    const s = get(id); if (!s || r < 1) return;
    const X = s.x;
    X.beginPath();
    if (width > 0 && width < r) { strokeSetup(X, css, width); X.arc(cx + 0.5, cy + 0.5, r - width / 2, 0, Math.PI * 2); X.stroke(); }
    else { X.fillStyle = css; X.arc(cx + 0.5, cy + 0.5, r, 0, Math.PI * 2); X.fill(); }
    touch(s);
  },
  d_ellipse(id, css, x, y, w, h, width) {
    const s = get(id); if (!s || w < 1 || h < 1) return;
    const X = s.x;
    X.beginPath();
    if (width > 0 && width * 2 < Math.min(w, h)) {
      strokeSetup(X, css, width);
      X.ellipse(x + w / 2, y + h / 2, w / 2 - width / 2, h / 2 - width / 2, 0, 0, Math.PI * 2); X.stroke();
    } else { X.fillStyle = css; X.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); X.fill(); }
    touch(s);
  },
  d_arc(id, css, x, y, w, h, start, stop, width) {
    const s = get(id); if (!s || w < 1 || h < 1) return;
    const X = s.x;
    strokeSetup(X, css, Math.max(1, width));
    X.beginPath();
    const hw = Math.max(1, width) / 2;
    X.ellipse(x + w / 2, y + h / 2, Math.max(0.5, w / 2 - hw), Math.max(0.5, h / 2 - hw), 0, -start, -stop, true);
    X.stroke();
    touch(s);
  },
  d_poly(id, css, pts, closed, width) {
    const s = get(id); if (!s || pts.length < 4) return;
    const X = s.x;
    const off = width > 0 && width % 2 === 1 ? 0.5 : 0;
    X.beginPath();
    X.moveTo(pts[0] + off, pts[1] + off);
    for (let i = 2; i < pts.length; i += 2) X.lineTo(pts[i] + off, pts[i + 1] + off);
    if (closed) X.closePath();
    if (width > 0) { strokeSetup(X, css, width); X.lineJoin = 'round'; X.stroke(); }
    else { X.fillStyle = css; X.fill(); }
    touch(s);
  },
  d_line(id, css, x1, y1, x2, y2, width) {
    const s = get(id); if (!s || width < 1) return;
    const X = s.x;
    const off = width % 2 === 1 ? 0.5 : 0;
    strokeSetup(X, css, width);
    X.lineCap = width > 1 ? 'butt' : 'square';
    X.beginPath(); X.moveTo(x1 + off, y1 + off); X.lineTo(x2 + off, y2 + off); X.stroke();
    touch(s);
  },

  t_scale(id, src, w, h, smooth) {
    const s = get(src); if (!s) return;
    const n = makeSurface(id, w, h, true);
    n.x.imageSmoothingEnabled = Boolean(smooth);
    if (w > 0 && h > 0 && s.w > 0 && s.h > 0) n.x.drawImage(s.c, 0, 0, s.w, s.h, 0, 0, w, h);
    n.alpha = s.alpha; n.key = s.key;
  },
  t_flip(id, src, fx, fy) {
    const s = get(src); if (!s) return;
    const n = makeSurface(id, s.w, s.h, true);
    n.x.setTransform(fx ? -1 : 1, 0, 0, fy ? -1 : 1, fx ? s.w : 0, fy ? s.h : 0);
    n.x.drawImage(s.c, 0, 0);
    n.x.setTransform(1, 0, 0, 1, 0, 0);
    n.alpha = s.alpha; n.key = s.key;
  },
  t_rotate(id, src, w, h, radians, scale, smooth) {
    const s = get(src); if (!s) return;
    const n = makeSurface(id, w, h, true);
    n.x.imageSmoothingEnabled = Boolean(smooth);
    n.x.translate(w / 2, h / 2);
    n.x.rotate(-radians);
    n.x.scale(scale, scale);
    n.x.drawImage(keyed(s), -s.w / 2, -s.h / 2);
    n.x.setTransform(1, 0, 0, 1, 0, 0);
    n.alpha = s.alpha;
  },

  f_metrics(font) {
    const x = (host._mx ||= new OffscreenCanvas(4, 4).getContext('2d'));
    x.font = font;
    const m = x.measureText('Mgy');
    const px = parseFloat(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] || '16');
    const asc = m.fontBoundingBoxAscent ?? px * 0.9;
    const desc = m.fontBoundingBoxDescent ?? px * 0.25;
    return `${Math.ceil(asc)},${Math.ceil(desc)}`;
  },
  f_width(text, font) {
    const x = (host._mx ||= new OffscreenCanvas(4, 4).getContext('2d'));
    x.font = font;
    return Math.ceil(x.measureText(text).width);
  },
  f_render(id, text, font, css, bg, w, h, asc, underline) {
    const n = makeSurface(id, w, h, true);
    const X = n.x;
    if (bg) { X.fillStyle = bg; X.fillRect(0, 0, w, h); }
    X.font = font; X.fillStyle = css; X.textBaseline = 'alphabetic';
    X.fillText(text, 0, asc);
    if (underline) X.fillRect(0, asc + 2, w, Math.max(1, Math.round(h / 16)));
  },
  f_family(name) { return fontFamilies.get(name) || fontFamilies.get(baseName(name)) || ''; },

  img_load(id, name) {
    const bmp = images.get(name) || images.get(baseName(name));
    if (!bmp) return -1;
    const n = makeSurface(id, bmp.width, bmp.height, true);
    n.x.drawImage(bmp, 0, 0);
    return bmp.width * 65536 + bmp.height;
  },

  /* masks: one byte per pixel, 1 = solid */
  m_new(id, w, h, fill) { masks.set(id, { w, h, b: new Uint8Array(Math.max(0, w * h)).fill(fill ? 1 : 0) }); },
  m_free(id) { masks.delete(id); },
  m_from_surface(id, sid, threshold) {
    const s = get(sid); if (!s) return;
    const m = { w: s.w, h: s.h, b: new Uint8Array(s.w * s.h) };
    if (s.w && s.h) {
      const src = keyed(s);
      const d = (src === s.c ? s.x : src.getContext('2d')).getImageData(0, 0, s.w, s.h).data;
      for (let i = 0, p = 3; i < m.b.length; i++, p += 4) m.b[i] = d[p] > threshold ? 1 : 0;
    }
    masks.set(id, m);
  },
  m_get_at(id, x, y) { const m = masks.get(id); return m ? m.b[y * m.w + x] : 0; },
  m_set_at(id, x, y, v) { const m = masks.get(id); if (m && x >= 0 && y >= 0 && x < m.w && y < m.h) m.b[y * m.w + x] = v; },
  m_fill(id, v) { masks.get(id)?.b.fill(v); },
  m_invert(id) { const m = masks.get(id); if (m) for (let i = 0; i < m.b.length; i++) m.b[i] ^= 1; },
  m_copy(id, src) { const m = masks.get(src); if (m) masks.set(id, { w: m.w, h: m.h, b: m.b.slice() }); },
  m_count(id) { const m = masks.get(id); let n = 0; if (m) for (const v of m.b) n += v; return n; },
  m_overlap(a, b, ox, oy) {
    const A = masks.get(a), B = masks.get(b); if (!A || !B) return -1;
    const x0 = Math.max(0, ox), y0 = Math.max(0, oy);
    const x1 = Math.min(A.w, ox + B.w), y1 = Math.min(A.h, oy + B.h);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        if (A.b[y * A.w + x] && B.b[(y - oy) * B.w + (x - ox)]) return x * 65536 + y;
      }
    }
    return -1;
  },
  m_overlap_area(a, b, ox, oy) {
    const A = masks.get(a), B = masks.get(b); if (!A || !B) return 0;
    let n = 0;
    for (let y = Math.max(0, oy); y < Math.min(A.h, oy + B.h); y++) {
      for (let x = Math.max(0, ox); x < Math.min(A.w, ox + B.w); x++) {
        if (A.b[y * A.w + x] && B.b[(y - oy) * B.w + (x - ox)]) n++;
      }
    }
    return n;
  },
  m_overlap_mask(id, a, b, ox, oy) {
    const A = masks.get(a), B = masks.get(b);
    const out = { w: A.w, h: A.h, b: new Uint8Array(A.w * A.h) };
    for (let y = Math.max(0, oy); y < Math.min(A.h, oy + B.h); y++) {
      for (let x = Math.max(0, ox); x < Math.min(A.w, ox + B.w); x++) {
        if (A.b[y * A.w + x] && B.b[(y - oy) * B.w + (x - ox)]) out.b[y * A.w + x] = 1;
      }
    }
    masks.set(id, out);
  },
  m_centroid(id) {
    const m = masks.get(id); let sx = 0, sy = 0, n = 0;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.b[y * m.w + x]) { sx += x; sy += y; n++; }
    return n ? Math.floor(sx / n) * 65536 + Math.floor(sy / n) : 0;
  },
  m_bounds(id) {
    const m = masks.get(id); let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.b[y * m.w + x]) {
      if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
    }
    return x1 < 0 ? '' : `${x0},${y0},${x1 - x0 + 1},${y1 - y0 + 1}`;
  },
  m_draw(sid, id, css) {
    const s = get(sid), m = masks.get(id); if (!s || !m) return;
    s.x.fillStyle = css;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.b[y * m.w + x]) s.x.fillRect(x, y, 1, 1);
    touch(s);
  },

  display_set(w, h) {
    w = Math.min(Math.max(1, w | 0), 3840); h = Math.min(Math.max(1, h | 0), 2160);
    display = makeSurface(0, w, h, false);
    presentCanvas = new OffscreenCanvas(w, h);
    pctx = presentCanvas.getContext('2d');
    framePending = true;
    post({ type: 'display', width: w, height: h });
    return w * 65536 + h;
  },
  display_caption(text) { post({ type: 'caption', text: String(text) }); },
  display_close() { beforeBlock(); display = null; post({ type: 'display-closed' }); },
  present() { framePending = true; presentFrame(false); },

  events() {
    if (!S) return '';
    const flat = drainEvents(S.ring);
    return flat ? flat.join(',') : '';
  },
  keys() {
    if (!S) return '';
    const out = [];
    for (let i = 0; i < S.keys.length; i++) if (S.keys[i]) out.push(i);
    return out.join(',');
  },
  key_slot: (k) => keySlot(k),
  mouse() {
    if (!S) return '0,0,0,0,0';
    const c = S.ctrl;
    return `${c[C.MOUSE_X]},${c[C.MOUSE_Y]},${c[C.MOUSE_BUTTONS]},${c[C.FOCUSED]},${c[C.MOUSE_IN]}`;
  },
  mods: () => (S ? Atomics.load(S.ctrl, C.MODS) : 0),
  wait_event(ms) {
    if (!S) return;
    beforeBlock();
    const v = Atomics.load(S.ctrl, C.EVT);
    if (Atomics.load(S.ring, 0) !== Atomics.load(S.ring, 1)) return;
    const stopV = Atomics.load(S.ctrl, C.STOP);
    const deadline = ms > 0 ? now() + ms : Infinity;
    // Wait on EVT in short slices so a Stop (which bumps STOP) is noticed.
    while (Atomics.load(S.ctrl, C.EVT) === v && Atomics.load(S.ctrl, C.STOP) === stopV) {
      const left = deadline - now();
      if (left <= 0) break;
      Atomics.wait(S.ctrl, C.EVT, v, Math.min(left, 50));
    }
  },
  sleep(ms) {
    beforeBlock();
    if (!(ms > 0)) return;
    if (S) {
      const v = Atomics.load(S.ctrl, C.STOP);
      Atomics.wait(S.ctrl, C.STOP, v, ms);
    } else {
      const end = now() + ms;
      while (now() < end) { /* no shared memory: busy-wait */ }
    }
  },
  stopped: () => stopRequested(),
  /** We raise KeyboardInterrupt ourselves; clear Pyodide's flag so it isn't raised twice. */
  clear_interrupt() { if (S) S.interrupt[0] = 0; },

  read_line(prompt) {
    beforeBlock();
    if (!S) return null;
    Atomics.store(S.ctrl, C.STDIN_STATE, STDIN.WAITING);
    post({ type: 'input', prompt: String(prompt ?? '') });
    for (;;) {
      const st = Atomics.load(S.ctrl, C.STDIN_STATE);
      if (st === STDIN.READY) break;
      if (st === STDIN.CANCELLED || stopRequested()) { Atomics.store(S.ctrl, C.STDIN_STATE, STDIN.IDLE); return null; }
      Atomics.wait(S.ctrl, C.STDIN_STATE, st, 200);
    }
    const len = Atomics.load(S.ctrl, C.STDIN_LEN);
    const line = new TextDecoder().decode(S.stdin.slice(0, len));
    Atomics.store(S.ctrl, C.STDIN_STATE, STDIN.IDLE);
    return line;
  },

  sound(json) { post({ type: 'sound', cmd: json }); },
  mouse_visible(v) { post({ type: 'cursor', visible: Boolean(v) }); },
  key_repeat(delay, interval) { post({ type: 'key-repeat', delay, interval }); },
  flush() { beforeBlock(); },
};

const baseName = (p) => String(p).replace(/\\/g, '/').split('/').pop();

/* ── lock-down while student code runs ───────────────────────────────── */
// Shared games run in the viewer's browser. While a program runs, take away
// everything it could use to reach the network or this site's storage;
// Pyodide only needs them before and after (loading packages). This is the
// second line of defense — the first is hosting the runner on its own origin
// (see src/arcade/config.js → RUNNER_URL).
const LOCKED = ['fetch', 'XMLHttpRequest', 'WebSocket', 'WebTransport', 'EventSource', 'indexedDB',
  'caches', 'importScripts', 'Worker', 'SharedWorker', 'BroadcastChannel', 'Request', 'Response'];
const stash = [];
function lockGlobals() {
  // Some live on the global object, some on its prototypes (WorkerGlobalScope…).
  for (let obj = self; obj && obj !== Object.prototype; obj = Object.getPrototypeOf(obj)) {
    for (const name of LOCKED) {
      const desc = Object.getOwnPropertyDescriptor(obj, name);
      if (!desc || !desc.configurable) continue;
      stash.push([obj, name, desc]);
      delete obj[name];
    }
  }
}
function unlockGlobals() {
  for (const [obj, name, desc] of stash) Object.defineProperty(obj, name, desc);
  stash.length = 0;
}

/* ── boot ────────────────────────────────────────────────────────────── */
async function boot({ shared, pyodideBase, packageBase }) {
  S = shared;
  const t0 = now();
  const { loadPyodide } = await import(/* @vite-ignore */ new URL('pyodide.mjs', new URL(pyodideBase, self.location.href)).href);
  py = await loadPyodide({
    indexURL: new URL(pyodideBase, self.location.href).href,
    packageBaseUrl: packageBase || undefined,
    stdout: (s) => writeOut('stdout', `${s}\n`),
    stderr: (s) => writeOut('stderr', `${s}\n`),
    env: { HOME: '/home/pyodide' },
  });
  py.setStdout(writer('stdout'));
  py.setStderr(writer('stderr'));
  py.setStdin({
    stdin: () => { const line = host.read_line(''); return line == null ? null : `${line}\n`; },
    isatty: true,
  });
  if (S) py.setInterruptBuffer(S.interrupt);
  py.registerJsModule('_hsct_host', host);
  py.FS.mkdirTree('/hsct/pygame');
  for (const [path, src] of Object.entries(SHIM_FILES)) py.FS.writeFile(`/hsct/${path}`, src);
  py.runPython('import sys; sys.path.insert(0, "/hsct"); import hsct_runner; hsct_runner.boot()');
  self.postMessage({ type: 'ready', ms: Math.round(now() - t0), version: py.version, python: py.runPython('import sys; sys.version.split()[0]') });
}

const fontFaces = [];
async function prepareAssets(assets) {
  images.forEach((b) => b.close?.());
  images.clear();
  fontFaces.forEach((f) => self.fonts.delete(f));   // fonts are loaded fresh each run
  fontFaces.length = 0;
  fontFamilies.clear();
  for (const a of assets) {
    if (/^image\//.test(a.type)) {
      try { images.set(a.name, await createImageBitmap(new Blob([a.data], { type: a.type }))); }
      catch { writeOut('stderr', `Could not read the image ${a.name}\n`); }
    } else if (/\.(ttf|otf|woff2?)$/i.test(a.name)) {
      try {
        const family = `asset-${runId}-${fontFaces.length}`;
        const face = new FontFace(family, a.data.slice(0));
        await face.load();
        self.fonts.add(face);
        fontFaces.push(face);
        fontFamilies.set(a.name, family);
      } catch { writeOut('stderr', `Could not read the font ${a.name}\n`); }
    }
  }
}

async function run(msg) {
  runId = msg.runId;
  stopBase = S ? Atomics.load(S.ctrl, C.STOP) : 0;
  displayHint = msg.displayHint || displayHint;
  if (S) {
    clearRing(S.ring);
    Atomics.store(S.ctrl, C.STDIN_STATE, STDIN.IDLE);
    Atomics.store(S.ctrl, C.FRAMES_SHOWN, 0);
    S.interrupt[0] = 0;
  }
  outQueue.length = 0;
  surfaces.clear(); masks.clear();
  display = null; framesSent = 0; framePending = false;

  let result;
  let runner;
  try {
    await prepareAssets(msg.assets || []);
    py.FS.mkdirTree('/home/pyodide/project');
    runner = py.pyimport('hsct_runner');
    const need = JSON.parse(runner.prepare(JSON.stringify({
      entry: msg.entry,
      files: msg.files,
      assets: (msg.assets || []).map((a) => a.name),
      soundLengths: msg.soundLengths || {},
    })));
    for (const a of msg.assets || []) py.FS.writeFile(`/home/pyodide/project/${a.name}`, new Uint8Array(a.data));
    if (need.importCode) {
      post({ type: 'status', state: 'loading-packages', detail: need.importCode.replace(/import /g, '').split('\n').join(', ') });
      try { await py.loadPackagesFromImports(need.importCode, { messageCallback: () => {}, errorCallback: () => {} }); }
      catch { /* the import fails later with a normal ModuleNotFoundError */ }
    }
    post({ type: 'status', state: 'running' });
    lockGlobals();
    try { result = JSON.parse(runner.run()); }
    finally { unlockGlobals(); }
  } catch (e) {
    // Anything that escapes run() means the interpreter itself broke
    // (e.g. the browser's stack ran out). The runner page restarts us.
    const lines = String((e && e.message) || e).trim().split('\n');
    console.error('[arcade worker] run() escaped:', String((e && e.message) || e));
    result = { outcome: 'crashed', error: { type: 'Crash', message: lines[lines.length - 1] } };
  } finally {
    try { runner?.destroy(); } catch { /* already gone */ }
  }
  beforeBlock();
  if (display) presentFrame(true);
  post({ type: 'done', ...result });
}

self.onmessage = async (e) => {
  const msg = e.data;
  try {
    if (msg.type === 'init') await boot(msg);
    else if (msg.type === 'run') await run(msg);
  } catch (err) {
    self.postMessage({ type: 'fatal', runId, message: String(err && err.message || err), stack: String(err && err.stack || '') });
  }
};
