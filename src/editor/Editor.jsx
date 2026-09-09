import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Canvas from './Canvas.jsx';
import SlideStrip from './SlideStrip.jsx';
import Toolbox from './Toolbox.jsx';
import { getSlide } from '../model/deckModel.js';
import * as ops from '../model/ops.js';
import './editor.css';

const isTyping = (el) =>
  el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

export default function Editor({ store, width, height, notify }) {
  const { doc, setDoc, undo, redo } = store;
  const [cur, setCur] = useState({ h: 0, v: 0 });
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const dragBase = useRef(null); // doc snapshot before a drag starts

  // Clamp the cursor if the doc changed underneath us (undo, import…)
  const safeCur = useMemo(() => {
    const h = Math.min(cur.h, doc.slides.length - 1);
    const v = Math.min(cur.v, doc.slides[h]?.subslides.length || 0);
    return { h, v };
  }, [cur, doc]);
  const slide = getSlide(doc, safeCur.h, safeCur.v);
  const block = slide?.blocks.find((b) => b.id === selectedId) || null;

  const go = useCallback((h, v = 0) => { setCur({ h, v }); setSelectedId(null); setEditingId(null); }, []);

  /* ── actions handed to the toolbox / canvas ─────────────────────── */
  const { h, v } = safeCur;
  const actions = useMemo(() => ({
    addBlock: (type, x, y, extra) => {
      const n = slide?.blocks.length || 0;
      const [next, id] = ops.addBlock(doc, h, v, type, x ?? 80 + (n % 6) * 40, y ?? 80 + (n % 6) * 40, extra);
      setDoc(next); setSelectedId(id);
    },
    patchBlock: (patch) => block && setDoc(ops.updateBlock(doc, h, v, block.id, patch)),
    styleBlock: (patch) => block && setDoc(ops.updateBlockStyle(doc, h, v, block.id, patch)),
    propsBlock: (patch) => block && setDoc(ops.updateBlockProps(doc, h, v, block.id, patch)),
    duplicateBlock: () => { if (!block) return; const [next, id] = ops.duplicateBlock(doc, h, v, block.id); setDoc(next); setSelectedId(id); },
    deleteBlock: () => { if (!block) return; setDoc(ops.deleteBlock(doc, h, v, block.id)); setSelectedId(null); },
    reorderBlock: (dir) => block && setDoc(ops.reorderBlock(doc, h, v, block.id, dir)),

    patchSlide: (patch) => setDoc(ops.updateSlide(doc, h, v, patch)),
    addSlideAfter: () => { const [next, nh] = ops.addSlideAfter(doc, h); setDoc(next); go(nh, 0); },
    addSubslide: () => { const [next, nv] = ops.addSubslide(doc, h, v); setDoc(next); go(h, nv); },
    duplicateSlide: () => { const [next, nh, nv] = ops.duplicateSlide(doc, h, v); setDoc(next); go(nh, nv); },
    deleteSlide: () => {
      if (!window.confirm('Delete this slide?')) return;
      const [next, nh, nv] = ops.deleteSlide(doc, h, v); setDoc(next); go(nh, nv);
    },
    moveSubslide: (dir) => { const [next, nv] = ops.moveSubslide(doc, h, v, dir); setDoc(next); go(h, nv); },
    canMoveSub: (dir) => { const n = doc.slides[h].subslides.length; const j = v - 1 + dir; return j >= 0 && j < n; },
    reorderTop: (from, to) => { setDoc(ops.moveTopSlide(doc, from, to)); go(to, 0); },
  }), [doc, h, v, block, slide, setDoc, go]);

  /* ── canvas callbacks ───────────────────────────────────────────── */
  const onMove = useCallback((id, patch) => {
    if (!dragBase.current) dragBase.current = doc;
    setDoc((d) => ops.updateBlock(d, h, v, id, patch), { record: false });
  }, [doc, h, v, setDoc]);

  const onDragEnd = useCallback(() => {
    const base = dragBase.current;
    dragBase.current = null;
    if (base) setDoc((d) => d, { base });
  }, [setDoc]);

  const onSetContent = useCallback((id, content) => {
    setDoc(ops.updateBlock(doc, h, v, id, { content }));
  }, [doc, h, v, setDoc]);

  /* ── keyboard ───────────────────────────────────────────────────── */
  useEffect(() => {
    const onKey = (e) => {
      if (isTyping(document.activeElement)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if (mod && e.key.toLowerCase() === 'd' && block) { e.preventDefault(); actions.duplicateBlock(); return; }
      if (e.key === 'Escape') { setSelectedId(null); setEditingId(null); return; }
      if (block && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); actions.deleteBlock(); return; }
      if (block && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
        actions.patchBlock({ x: block.x + d[0], y: block.y + d[1] });
        return;
      }
      if (!block && e.key === 'PageDown') { e.preventDefault(); go(Math.min(h + 1, doc.slides.length - 1)); }
      if (!block && e.key === 'PageUp') { e.preventDefault(); go(Math.max(h - 1, 0)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [block, actions, undo, redo, go, h, doc.slides.length]);

  if (!slide) return null;

  return (
    <div className="editor">
      <SlideStrip
        doc={doc}
        width={width}
        height={height}
        cur={safeCur}
        onSelect={go}
        onReorder={actions.reorderTop}
        onAddSlide={actions.addSlideAfter}
        onAddSubslide={actions.addSubslide}
      />
      <Canvas
        slide={slide}
        width={width}
        height={height}
        selectedId={selectedId}
        editingId={editingId}
        onSelect={setSelectedId} // editing ends on blur, which commits the text
        onStartEdit={(id) => { setSelectedId(id); setEditingId(id); }}
        onStopEdit={() => setEditingId(null)}
        onMove={onMove}
        onDragEnd={onDragEnd}
        onAddBlock={actions.addBlock}
        onSetContent={onSetContent}
        notify={notify}
      />
      <Toolbox block={block} slide={slide} cur={safeCur} actions={actions} notify={notify} />
    </div>
  );
}
