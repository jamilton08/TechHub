import { useEffect, useRef, useState } from 'react';
import { MENUS } from './menus.js';
import './navbar.css';

/* ── one dropdown ──────────────────────────────────────────────────── */
function Menu({ menu, ctx, open, onOpen, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (!ref.current?.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <div className={`nb-menu${open ? ' is-open' : ''}`} ref={ref}>
      <button
        type="button"
        className="nb-menu-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={!menu.alwaysOn && !ctx.deck}
        onClick={() => (open ? onClose() : onOpen())}
        onMouseEnter={() => { if (ctx.anyOpen && !open) onOpen(); }}
      >
        {menu.label}
      </button>
      {open && (
        <div className="nb-dropdown" role="menu">
          {menu.items.filter((it) => it.hideIn !== ctx.mode).map((item, i) => (
            <MenuItem key={i} item={item} ctx={ctx} close={onClose} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── one row inside a dropdown ─────────────────────────────────────── */
function MenuItem({ item, ctx, close }) {
  switch (item.type) {
    case 'sep':
      return <div className="nb-sep" role="separator" />;

    case 'heading':
      return <div className="nb-heading">{item.label}</div>;

    case 'action': {
      const disabled = item.disabled?.(ctx) ?? false;
      return (
        <button
          type="button"
          role="menuitem"
          className="nb-item"
          disabled={disabled}
          onClick={() => { item.run(ctx); close(); }}
        >
          <span className="nb-check" />
          <span className="nb-label">{item.label}</span>
          {item.key && <kbd className="nb-key">{item.key}</kbd>}
        </button>
      );
    }

    case 'toggle': {
      const on = item.isOn(ctx);
      const disabled = item.disabled?.(ctx) ?? false;
      return (
        <button
          type="button"
          role="menuitemcheckbox"
          aria-checked={on}
          className="nb-item"
          disabled={disabled}
          onClick={() => item.apply(ctx)}
        >
          <span className={`nb-check${on ? ' on' : ''}`}>{on ? '✓' : ''}</span>
          <span className="nb-label">{item.label}</span>
          {item.key && <kbd className="nb-key">{item.key}</kbd>}
        </button>
      );
    }

    case 'radio': {
      const active = item.isActive(ctx);
      return (
        <button
          type="button"
          role="menuitemradio"
          aria-checked={active}
          className="nb-item"
          onClick={() => item.apply(ctx)}
        >
          <span className={`nb-check${active ? ' on' : ''}`}>{active ? '●' : ''}</span>
          <span className="nb-label">{item.label}</span>
        </button>
      );
    }

    case 'select':
      return (
        <label className="nb-field">
          <span className="nb-label">{item.label}</span>
          <select value={item.value(ctx)} onChange={(e) => item.apply(ctx, e.target.value)}>
            {item.choices.map((c) => (
              <option key={String(c.value)} value={String(c.value)}>{c.label}</option>
            ))}
          </select>
        </label>
      );

    case 'number':
      return (
        <label className="nb-field">
          <span className="nb-label">{item.label}</span>
          <input
            type="number"
            min={item.min}
            max={item.max}
            step={item.step}
            value={item.value(ctx)}
            onChange={(e) => item.apply(ctx, Number(e.target.value))}
          />
        </label>
      );

    case 'goto':
      return <GotoRow ctx={ctx} close={close} />;

    default:
      return null;
  }
}

function GotoRow({ ctx, close }) {
  const [h, setH] = useState(ctx.live.h + 1);
  const [v, setV] = useState(ctx.live.v);
  const go = () => { ctx.deck.slide(Number(h) - 1, Number(v)); close(); };
  return (
    <div className="nb-field nb-goto">
      <span className="nb-label">Go to slide</span>
      <input type="number" min="1" value={h} onChange={(e) => setH(e.target.value)} aria-label="Horizontal index" />
      <span className="nb-dim">.</span>
      <input type="number" min="0" value={v} onChange={(e) => setV(e.target.value)} aria-label="Vertical index" />
      <button type="button" className="nb-go" onClick={go}>Go</button>
    </div>
  );
}

/* ── the bar ───────────────────────────────────────────────────────── */
export default function Navbar({ ctx, toast }) {
  const [openId, setOpenId] = useState(null);
  const fullCtx = { ...ctx, anyOpen: openId !== null };
  const { live } = ctx;

  return (
    <header className="nb">
      <div className="nb-brand">
        <a href="/" className="nb-home" title="Back to the HSCT Technology Department site">
          <img src="/hsct-logo.png" alt="HSCT" width="20" height="22" />
        </a>
        Jonathan's Studio
      </div>

      <div className="nb-mode" role="tablist" aria-label="Mode">
        <button type="button" role="tab" aria-selected={ctx.mode === 'edit'} className={ctx.mode === 'edit' ? 'is-on' : ''} onClick={() => ctx.setMode('edit')}>Edit</button>
        <button type="button" role="tab" aria-selected={ctx.mode === 'present'} className={ctx.mode === 'present' ? 'is-on' : ''} onClick={() => ctx.setMode('present')}>Present</button>
      </div>

      <nav className="nb-menus" aria-label="Deck controls">
        {MENUS.filter((m) => m.modes.includes(ctx.mode)).map((m) => (
          <Menu
            key={m.id}
            menu={m}
            ctx={fullCtx}
            open={openId === m.id}
            onOpen={() => setOpenId(m.id)}
            onClose={() => setOpenId(null)}
          />
        ))}
      </nav>

      <div className="nb-status">
        {toast && <span className="nb-toast">{toast}</span>}
        {live.isPaused && <span className="nb-badge">Paused</span>}
        {live.isOverview && <span className="nb-badge">Overview</span>}
        {live.isScrollView && <span className="nb-badge">Scroll</span>}
        {live.isAutoSliding && <span className="nb-badge live">Auto</span>}
        {ctx.mode === 'present' ? (
          <span className="nb-pos" title="Slide h.v · current / total">
            {live.h + 1}{live.v ? `.${live.v}` : ''}
            <span className="nb-dim"> / {live.total}</span>
          </span>
        ) : (
          <input
            className="nb-title"
            value={ctx.docTitle}
            onChange={(e) => ctx.setDocTitle(e.target.value)}
            aria-label="Deck title"
            title="Deck title — saved automatically in this browser"
          />
        )}
      </div>
    </header>
  );
}
