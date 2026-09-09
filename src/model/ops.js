/** Pure doc → doc operations used by the editor. All return a new doc. */
import { withSlide, newSlide, newBlock, cloneSlide, uid } from './deckModel.js';

// ── blocks ──────────────────────────────────────────────────────────
export const updateBlock = (doc, h, v, id, patch) =>
  withSlide(doc, h, v, (s) => { const b = s.blocks.find((x) => x.id === id); if (b) Object.assign(b, patch); });

export const updateBlockStyle = (doc, h, v, id, patch) =>
  withSlide(doc, h, v, (s) => { const b = s.blocks.find((x) => x.id === id); if (b) b.style = { ...b.style, ...patch }; });

export const updateBlockProps = (doc, h, v, id, patch) =>
  withSlide(doc, h, v, (s) => { const b = s.blocks.find((x) => x.id === id); if (b) b.props = { ...b.props, ...patch }; });

export function addBlock(doc, h, v, type, x, y, extra = {}) {
  const blk = { ...newBlock(type, x, y), ...extra };
  return [withSlide(doc, h, v, (s) => { s.blocks.push(blk); }), blk.id];
}

export const deleteBlock = (doc, h, v, id) =>
  withSlide(doc, h, v, (s) => { s.blocks = s.blocks.filter((b) => b.id !== id); });

export function duplicateBlock(doc, h, v, id) {
  let newId = null;
  const next = withSlide(doc, h, v, (s) => {
    const i = s.blocks.findIndex((b) => b.id === id);
    if (i < 0) return;
    const copy = structuredClone(s.blocks[i]);
    copy.id = uid('b'); copy.x += 30; copy.y += 30;
    s.blocks.splice(i + 1, 0, copy);
    newId = copy.id;
  });
  return [next, newId];
}

/** dir: +1 = bring forward, -1 = send backward */
export const reorderBlock = (doc, h, v, id, dir) =>
  withSlide(doc, h, v, (s) => {
    const i = s.blocks.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= s.blocks.length) return;
    [s.blocks[i], s.blocks[j]] = [s.blocks[j], s.blocks[i]];
  });

// ── slides ──────────────────────────────────────────────────────────
export const updateSlide = (doc, h, v, patch) =>
  withSlide(doc, h, v, (s) => Object.assign(s, patch));

/** Inserts a new top-level slide after h. Returns [doc, newH]. */
export function addSlideAfter(doc, h) {
  const next = structuredClone(doc);
  next.slides.splice(h + 1, 0, newSlide());
  return [next, h + 1];
}

/** Adds a vertical slide under top-level h, after v. Returns [doc, newV]. */
export function addSubslide(doc, h, v) {
  const next = structuredClone(doc);
  const top = next.slides[h];
  const at = Math.max(v, 0); // v=0 → insert at start of subslides
  top.subslides.splice(at, 0, newSlide());
  return [next, at + 1];
}

export function duplicateSlide(doc, h, v) {
  const next = structuredClone(doc);
  if (v === 0) {
    next.slides.splice(h + 1, 0, cloneSlide(next.slides[h]));
    return [next, h + 1, 0];
  }
  const subs = next.slides[h].subslides;
  subs.splice(v, 0, cloneSlide(subs[v - 1]));
  return [next, h, v + 1];
}

export function deleteSlide(doc, h, v) {
  const next = structuredClone(doc);
  if (v === 0) {
    if (next.slides.length === 1) {
      next.slides[0] = newSlide();
      return [next, 0, 0];
    }
    next.slides.splice(h, 1);
    return [next, Math.max(0, h - 1), 0];
  }
  next.slides[h].subslides.splice(v - 1, 1);
  return [next, h, Math.max(0, v - 1)];
}

/** Move top-level slide from index `from` to index `to`. */
export function moveTopSlide(doc, from, to) {
  if (from === to) return doc;
  const next = structuredClone(doc);
  const [s] = next.slides.splice(from, 1);
  next.slides.splice(to, 0, s);
  return next;
}

/** Move a vertical slide up/down within its stack. dir ±1. Returns [doc, newV]. */
export function moveSubslide(doc, h, v, dir) {
  const next = structuredClone(doc);
  const subs = next.slides[h].subslides;
  const i = v - 1, j = i + dir;
  if (i < 0 || j < 0 || j >= subs.length) return [doc, v];
  [subs[i], subs[j]] = [subs[j], subs[i]];
  return [next, j + 1];
}
