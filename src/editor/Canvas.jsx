import { useCallback, useEffect, useRef, useState } from 'react';
import { BlockContent, blockStyle, editorBackgroundStyle, editorBackgroundInfo, SlideBody } from '../present/BlockContent.jsx';

const SNAP = 10;
const snap = (n) => Math.round(n / SNAP) * SNAP;
const EDITABLE = new Set(['heading', 'text']);
// Blocks whose content should take clicks (play, scroll) once selected.
const INTERACTIVE = new Set(['video', 'iframe']);

/**
 * A slide drawn at native size and scaled with CSS, wrapped in the same
 * .reveal / .slides / section classes reveal.js uses — so the active
 * theme styles it exactly like the presentation will.
 */
export function SlideSurface({ slide, width, height, scale, className = '', children, ...rest }) {
  return (
    <div
      className={`reveal reveal-viewport edit-surface ${className}`}
      style={{ width: width * scale, height: height * scale }}
      {...rest}
    >
      <div className="slides" style={{ width, height, transform: `scale(${scale})` }}>
        <section className="present" style={{ top: 0, height: '100%', padding: 0 }}>
          <div className="edit-bg" style={editorBackgroundStyle(slide.bg)}>
            {(() => {
              const v = editorBackgroundInfo(slide.bg);
              if (v?.kind === 'file') return <video src={v.src} muted loop autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: slide.bg.opacity ?? 1 }} />;
              if (v || slide.bg?.type === 'iframe') return <span className="edit-bg-label">{slide.bg.type} background — plays while presenting</span>;
              return null;
            })()}
          </div>
          {children ?? <SlideBody slide={slide} width={width} height={height} />}
        </section>
      </div>
    </div>
  );
}

/** Plain text out of a contentEditable, ignoring CSS text-transform (innerText would uppercase). */
function readEditableText(el) {
  let out = '';
  const walk = (n) => {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) out += c.nodeValue;
      else if (c.nodeName === 'BR') out += '\n';
      else { if (out && (c.nodeName === 'DIV' || c.nodeName === 'P')) out += '\n'; walk(c); }
    }
  };
  walk(el);
  return out.replace(/\n$/, '');
}

/** Reads dropped/pasted files into data URLs. Images only for now. */
export function fileToDataUrl(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
}

export default function Canvas({
  slide, width, height, selectedId, editingId,
  onSelect, onStartEdit, onStopEdit, onMove, onDragEnd, onAddBlock, onSetContent, notify,
}) {
  const hostRef = useRef(null);
  const [scale, setScale] = useState(0.5);

  /* fit the slide into the available space */
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width: cw, height: ch } = e.contentRect;
      setScale(Math.max(0.05, Math.min((cw - 48) / width, (ch - 48) / height)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, height]);

  /* focus the text when inline editing starts, caret at the end */
  useEffect(() => {
    if (!editingId) return;
    const el = hostRef.current?.querySelector('.edit-blk.is-editing [contenteditable]');
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }, [editingId]);

  /* ── drag to move / resize ─────────────────────────────────────── */
  const dragRef = useRef(null);

  const beginDrag = useCallback((e, block, mode) => {
    if (editingId === block.id) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect(block.id);
    dragRef.current = { id: block.id, mode, sx: e.clientX, sy: e.clientY, x: block.x, y: block.y, w: block.w, h: block.h, moved: false };

    const onMoveEv = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = (ev.clientX - d.sx) / scale;
      const dy = (ev.clientY - d.sy) / scale;
      if (!d.moved && Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
      d.moved = true;
      const patch = {};
      if (d.mode === 'move') {
        patch.x = snap(d.x + dx);
        patch.y = snap(d.y + dy);
      } else {
        if (d.mode.includes('e')) patch.w = Math.max(40, snap(d.w + dx));
        if (d.mode.includes('s')) patch.h = Math.max(30, snap(d.h + dy));
      }
      onMove(d.id, patch);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMoveEv);
      window.removeEventListener('pointerup', onUp);
      const d = dragRef.current;
      dragRef.current = null;
      if (d?.moved) onDragEnd();
    };
    window.addEventListener('pointermove', onMoveEv);
    window.addEventListener('pointerup', onUp);
  }, [editingId, onSelect, onMove, onDragEnd, scale]);

  /* ── drops: toolbox items, image files, urls ───────────────────── */
  const slidePoint = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: snap((e.clientX - rect.left) / scale), y: snap((e.clientY - rect.top) / scale) };
  };

  const onDrop = async (e) => {
    e.preventDefault();
    const { x, y } = slidePoint(e);
    const type = e.dataTransfer.getData('application/x-block-type');
    if (type) { onAddBlock(type, x - 40, y - 20); return; }

    const files = [...(e.dataTransfer.files || [])];
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length) {
      for (const [i, f] of images.entries()) {
        if (f.size > 3_000_000) { notify(`${f.name} is over 3 MB — use a URL instead`); continue; }
        const url = await fileToDataUrl(f);
        onAddBlock('image', x + i * 30, y + i * 30, { content: url });
      }
      return;
    }
    const uri = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (uri && /^https?:\/\//.test(uri)) {
      const isImg = /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(uri);
      onAddBlock(isImg ? 'image' : 'iframe', x, y, { content: uri.trim() });
      return;
    }
    if (uri) onAddBlock('text', x, y, { content: uri });
  };

  const editableProps = (block) => (editingId === block.id
    ? {
      contentEditable: true,
      suppressContentEditableWarning: true,
      onBlur: (e) => { onSetContent(block.id, readEditableText(e.currentTarget)); onStopEdit(); },
      onPointerDown: (e) => e.stopPropagation(),
      onKeyDown: (e) => { if (e.key === 'Escape') e.currentTarget.blur(); },
      style: { outline: 'none', margin: 0, whiteSpace: 'pre-wrap', cursor: 'text' },
    }
    : undefined);

  return (
    <div className="canvas-host" ref={hostRef} onPointerDown={() => onSelect(null)}>
      <SlideSurface
        slide={slide}
        width={width}
        height={height}
        scale={scale}
        className="edit-canvas"
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
        onDrop={onDrop}
        onDoubleClick={(e) => { const { x, y } = slidePoint(e); onAddBlock('text', x - 40, y - 20); }}
      >
        {slide.blocks.map((blk) => {
          const selected = blk.id === selectedId;
          const editing = blk.id === editingId;
          const interactive = selected && INTERACTIVE.has(blk.type);
          return (
            <div
              key={blk.id}
              className={`blk blk-${blk.type} edit-blk${selected ? ' is-selected' : ''}${editing ? ' is-editing' : ''}${interactive ? ' is-interactive' : ''}`}
              style={blockStyle(blk, true)}
              data-id={blk.dataId || undefined}
              onPointerDown={(e) => { if (interactive && !e.target.closest('.edit-grip')) { e.stopPropagation(); return; } beginDrag(e, blk, 'move'); }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (EDITABLE.has(blk.type)) onStartEdit(blk.id);
              }}
            >
              <BlockContent block={blk} editableProps={editableProps(blk)} />
              {blk.fragment && <span className="edit-tag">fragment: {blk.fragment}{blk.fragmentIndex != null && blk.fragmentIndex !== '' ? ` #${blk.fragmentIndex}` : ''}</span>}
              {interactive && <span className="edit-grip" title="Drag to move">⋮⋮ move</span>}
              {selected && !editing && (
                <>
                  <span className="edit-handle h-e" onPointerDown={(e) => beginDrag(e, blk, 'e')} />
                  <span className="edit-handle h-s" onPointerDown={(e) => beginDrag(e, blk, 's')} />
                  <span className="edit-handle h-se" onPointerDown={(e) => beginDrag(e, blk, 'se')} />
                </>
              )}
            </div>
          );
        })}
      </SlideSurface>
      <div className="canvas-hint">{Math.round(scale * 100)}% · drag toolbox items or image files onto the slide · double-click empty space for text</div>
    </div>
  );
}
