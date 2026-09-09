import { BLOCK_TYPES, FRAGMENT_EFFECTS, TRANSITIONS, BG_TYPES, CODE_LANGS } from '../model/deckModel.js';
import { fileToDataUrl } from './Canvas.jsx';

const FONT_SIZES = ['', '0.5em', '0.6em', '0.7em', '0.8em', '0.9em', '1.2em', '1.5em', '2em', '2.5em', '3em'];

function Field({ label, children, wide }) {
  return (
    <label className={`tb-field${wide ? ' is-wide' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function Num({ value, onChange, ...rest }) {
  return <input type="number" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} {...rest} />;
}

function Check({ label, checked, onChange }) {
  return (
    <label className="tb-check">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

async function pickImage(onUrl, notify) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async () => {
    const f = input.files?.[0];
    if (!f) return;
    if (f.size > 3_000_000) { notify('Over 3 MB — host it and paste the URL instead'); return; }
    onUrl(await fileToDataUrl(f));
  };
  input.click();
}

/* ── Add ──────────────────────────────────────────────────────────── */
function AddPanel({ onAdd }) {
  return (
    <section className="tb-section">
      <h3>Add to slide</h3>
      <p className="tb-help">Click to place, or drag onto the canvas.</p>
      <div className="tb-grid">
        {BLOCK_TYPES.map((t) => (
          <button
            key={t.type}
            type="button"
            className="tb-add"
            draggable
            onDragStart={(e) => { e.dataTransfer.setData('application/x-block-type', t.type); e.dataTransfer.effectAllowed = 'copy'; }}
            onClick={() => onAdd(t.type)}
          >
            <span className="tb-add-icon" aria-hidden="true">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
    </section>
  );
}

/* ── Block inspector ──────────────────────────────────────────────── */
function BlockPanel({ block, onPatch, onStyle, onProps, onDuplicate, onDelete, onReorder, notify }) {
  const p = block.props || {};
  const s = block.style || {};
  const textual = ['heading', 'text', 'list', 'markdown', 'code', 'math'].includes(block.type);
  const urlish = ['image', 'video', 'iframe'].includes(block.type);
  const typeDef = BLOCK_TYPES.find((t) => t.type === block.type);

  return (
    <section className="tb-section">
      <h3>{typeDef?.label || block.type} block</h3>

      {textual && (
        <Field label={block.type === 'list' ? 'Items (one per line)' : 'Content'} wide>
          <textarea rows={block.type === 'code' || block.type === 'markdown' ? 8 : 3} value={block.content} onChange={(e) => onPatch({ content: e.target.value })} spellCheck={block.type !== 'code'} />
        </Field>
      )}
      {urlish && (
        <Field label="URL" wide>
          <input type="text" value={block.content} placeholder="https://…" onChange={(e) => onPatch({ content: e.target.value })} />
        </Field>
      )}
      {block.type === 'image' && (
        <div className="tb-row">
          <button type="button" onClick={() => pickImage((url) => onPatch({ content: url }), notify)}>Upload image…</button>
          <Field label="Fit">
            <select value={p.fit || 'contain'} onChange={(e) => onProps({ fit: e.target.value })}>
              <option value="contain">Contain</option><option value="cover">Cover</option><option value="fill">Stretch</option>
            </select>
          </Field>
        </div>
      )}
      {block.type === 'heading' && (
        <Field label="Level">
          <select value={p.level || 2} onChange={(e) => onProps({ level: Number(e.target.value) })}>
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>H{n}</option>)}
          </select>
        </Field>
      )}
      {block.type === 'list' && <Check label="Numbered" checked={p.ordered} onChange={(v) => onProps({ ordered: v })} />}
      {block.type === 'code' && (
        <div className="tb-row">
          <Field label="Language">
            <select value={p.lang || 'plaintext'} onChange={(e) => onProps({ lang: e.target.value })}>
              {CODE_LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </Field>
          <Field label="Step lines">
            <input type="text" value={p.lines || ''} placeholder="1|3-4|6" onChange={(e) => onProps({ lines: e.target.value })} />
          </Field>
        </div>
      )}
      {block.type === 'video' && <p className="tb-help">YouTube, Vimeo and Google Drive links are embedded automatically. Anything else must be a direct .mp4/.webm URL. Autoplay/loop/mute only apply to direct files (YouTube handles its own).</p>}
      {block.type === 'video' && (
        <div className="tb-row">
          <Check label="Autoplay" checked={p.autoplay} onChange={(v) => onProps({ autoplay: v })} />
          <Check label="Loop" checked={p.loop} onChange={(v) => onProps({ loop: v })} />
          <Check label="Muted" checked={p.muted} onChange={(v) => onProps({ muted: v })} />
          <Check label="Controls" checked={p.controls !== false} onChange={(v) => onProps({ controls: v })} />
        </div>
      )}
      {block.type === 'math' && <p className="tb-help">Use \[ … \] for display math or $ … $ inline. Renders while presenting.</p>}

      <h4>Position</h4>
      <div className="tb-row tb-row-4">
        <Field label="X"><Num value={block.x} onChange={(v) => onPatch({ x: v })} /></Field>
        <Field label="Y"><Num value={block.y} onChange={(v) => onPatch({ y: v })} /></Field>
        <Field label="W"><Num value={block.w} onChange={(v) => onPatch({ w: v })} min={20} /></Field>
        <Field label="H"><Num value={block.h} onChange={(v) => onPatch({ h: v })} min={20} /></Field>
      </div>

      <h4>Style</h4>
      <div className="tb-row">
        <Field label="Font size">
          <select value={s.fontSize || ''} onChange={(e) => onStyle({ fontSize: e.target.value })}>
            {FONT_SIZES.map((f) => <option key={f} value={f}>{f || 'Theme'}</option>)}
          </select>
        </Field>
        <Field label="Align">
          <select value={s.align || ''} onChange={(e) => onStyle({ align: e.target.value })}>
            <option value="">Theme</option><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
          </select>
        </Field>
      </div>
      <div className="tb-row">
        <Field label="Text color">
          <span className="tb-color">
            <input type="color" value={s.color || '#ffffff'} onChange={(e) => onStyle({ color: e.target.value })} />
            <button type="button" onClick={() => onStyle({ color: '' })} title="Use theme color">✕</button>
          </span>
        </Field>
        <Field label="Background">
          <span className="tb-color">
            <input type="color" value={s.bg || '#000000'} onChange={(e) => onStyle({ bg: e.target.value })} />
            <button type="button" onClick={() => onStyle({ bg: '' })} title="No background">✕</button>
          </span>
        </Field>
      </div>
      <div className="tb-row tb-row-3">
        <Field label="Opacity"><input type="range" min="0" max="1" step="0.05" value={s.opacity ?? 1} onChange={(e) => onStyle({ opacity: Number(e.target.value) })} /></Field>
        <Field label="Padding"><Num value={s.padding || 0} min={0} onChange={(v) => onStyle({ padding: v || 0 })} /></Field>
        <Field label="Radius"><Num value={s.radius || 0} min={0} onChange={(v) => onStyle({ radius: v || 0 })} /></Field>
      </div>

      <h4>Reveal</h4>
      <div className="tb-row">
        <Field label="Fragment">
          <select value={block.fragment || ''} onChange={(e) => onPatch({ fragment: e.target.value })}>
            {FRAGMENT_EFFECTS.map((f) => <option key={f} value={f}>{f || 'None (always visible)'}</option>)}
          </select>
        </Field>
        <Field label="Order">
          <Num value={block.fragmentIndex ?? ''} min={0} placeholder="auto" onChange={(v) => onPatch({ fragmentIndex: v === '' ? null : v })} />
        </Field>
      </div>
      <Field label="Auto-animate id" wide>
        <input type="text" value={block.dataId || ''} placeholder="same id on next slide → tweens" onChange={(e) => onPatch({ dataId: e.target.value.trim() })} />
      </Field>

      <div className="tb-actions">
        <button type="button" onClick={onDuplicate}>Duplicate</button>
        <button type="button" onClick={() => onReorder(1)} title="Bring forward">Forward</button>
        <button type="button" onClick={() => onReorder(-1)} title="Send backward">Back</button>
        <button type="button" className="danger" onClick={onDelete}>Delete</button>
      </div>
    </section>
  );
}

/* ── Slide settings ───────────────────────────────────────────────── */
function SlidePanel({ slide, cur, canMoveSub, onPatch, onAddAfter, onAddSub, onDuplicate, onDelete, onMoveSub, notify }) {
  const bg = slide.bg || { type: 'none', value: '', opacity: 1 };
  const setBg = (patch) => onPatch({ bg: { ...bg, ...patch } });
  const isSub = cur.v > 0;

  return (
    <section className="tb-section">
      <h3>Slide {cur.h + 1}{isSub ? `.${cur.v}` : ''}</h3>

      <h4>Background</h4>
      <Field label="Type" wide>
        <select value={bg.type} onChange={(e) => setBg({ type: e.target.value, value: e.target.value === 'color' ? '#0b6e4f' : '' })}>
          {BG_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </Field>
      {bg.type === 'color' && (
        <Field label="Color" wide><input type="color" value={bg.value || '#000000'} onChange={(e) => setBg({ value: e.target.value })} /></Field>
      )}
      {bg.type === 'gradient' && (
        <Field label="CSS gradient" wide>
          <input type="text" value={bg.value} placeholder="linear-gradient(135deg, #1b2a49, #2e86ab)" onChange={(e) => setBg({ value: e.target.value })} />
        </Field>
      )}
      {(bg.type === 'image' || bg.type === 'video' || bg.type === 'iframe') && (
        <Field label="URL" wide>
          <input type="text" value={bg.value} placeholder={bg.type === 'video' ? 'YouTube link or .mp4 URL' : 'https://…'} onChange={(e) => setBg({ value: e.target.value })} />
        </Field>
      )}
      {bg.type === 'video' && <p className="tb-help">Plays muted and looped behind the slide. YouTube/Vimeo links become an embedded player.</p>}
      {bg.type === 'image' && (
        <button type="button" onClick={() => pickImage((url) => setBg({ value: url }), notify)}>Upload image…</button>
      )}
      {bg.type !== 'none' && (
        <Field label="Opacity" wide>
          <input type="range" min="0.1" max="1" step="0.05" value={bg.opacity ?? 1} onChange={(e) => setBg({ opacity: Number(e.target.value) })} />
        </Field>
      )}

      <h4>Behavior</h4>
      <div className="tb-row">
        <Field label="Transition">
          <select value={slide.transition || ''} onChange={(e) => onPatch({ transition: e.target.value })}>
            {TRANSITIONS.map((t) => <option key={t} value={t}>{t || 'Deck default'}</option>)}
          </select>
        </Field>
        <Field label="Auto-slide (ms)">
          <Num value={slide.autoslide || 0} min={0} step={500} onChange={(v) => onPatch({ autoslide: v || 0 })} />
        </Field>
      </div>
      <div className="tb-row">
        <Check label="Auto-animate to next" checked={slide.autoAnimate} onChange={(v) => onPatch({ autoAnimate: v })} />
        <Check label="Hidden" checked={slide.hidden} onChange={(v) => onPatch({ hidden: v })} />
      </div>
      <Field label="Speaker notes" wide>
        <textarea rows={3} value={slide.notes || ''} onChange={(e) => onPatch({ notes: e.target.value })} />
      </Field>

      <div className="tb-actions">
        <button type="button" onClick={onAddAfter}>+ Slide after</button>
        <button type="button" onClick={onAddSub}>+ Vertical</button>
        <button type="button" onClick={onDuplicate}>Duplicate</button>
        {isSub && <button type="button" disabled={!canMoveSub(-1)} onClick={() => onMoveSub(-1)}>Up</button>}
        {isSub && <button type="button" disabled={!canMoveSub(1)} onClick={() => onMoveSub(1)}>Down</button>}
        <button type="button" className="danger" onClick={onDelete}>Delete slide</button>
      </div>
      <p className="tb-help">Reorder horizontal slides by dragging them in the left strip.</p>
    </section>
  );
}

/* ── the panel ────────────────────────────────────────────────────── */
export default function Toolbox({ block, slide, cur, actions, notify }) {
  return (
    <aside className="toolbox" aria-label="Toolbox">
      <AddPanel onAdd={actions.addBlock} />
      {block && (
        <BlockPanel
          block={block}
          notify={notify}
          onPatch={actions.patchBlock}
          onStyle={actions.styleBlock}
          onProps={actions.propsBlock}
          onDuplicate={actions.duplicateBlock}
          onDelete={actions.deleteBlock}
          onReorder={actions.reorderBlock}
        />
      )}
      <SlidePanel
        slide={slide}
        cur={cur}
        notify={notify}
        canMoveSub={actions.canMoveSub}
        onPatch={actions.patchSlide}
        onAddAfter={actions.addSlideAfter}
        onAddSub={actions.addSubslide}
        onDuplicate={actions.duplicateSlide}
        onDelete={actions.deleteSlide}
        onMoveSub={actions.moveSubslide}
      />
    </aside>
  );
}
