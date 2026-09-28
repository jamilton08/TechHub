import { useEffect, useRef, useState } from 'react';
import { nameProblem, kindOf } from '../store/model.js';

export const ASSETS_TAB = '__assets__';

/**
 * File tabs above the editor: every code/text file, a "+" to add one, and
 * the Assets tab (images, sounds, fonts) at the end.
 */
export default function FileTabs({ project, active, onSelect, onAdd, onRename, onDelete, onSetEntry, readOnly }) {
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState(null);       // file name whose menu is open
  const [renaming, setRenaming] = useState(null);
  const names = project.files.map((f) => f.name);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menu) return undefined;
    const close = (e) => { if (!menuRef.current?.contains(e.target)) setMenu(null); };
    const esc = (e) => { if (e.key === 'Escape') setMenu(null); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [menu]);

  return (
    <div className="arc-tabs" role="tablist" aria-label="Project files">
      {project.files.map((f) => (
        <div key={f.name} className={`arc-tab${active === f.name ? ' is-active' : ''}`}>
          {renaming === f.name ? (
            <NameField
              initial={f.name}
              taken={names.filter((n) => n !== f.name)}
              onDone={(n) => { setRenaming(null); if (n && n !== f.name) onRename(f.name, n); }}
            />
          ) : (
            <button type="button" role="tab" aria-selected={active === f.name} onClick={() => onSelect(f.name)}
              onDoubleClick={() => !readOnly && setRenaming(f.name)} title={f.name === project.entry ? 'Run starts here' : f.name}>
              {f.name === project.entry && <span className="arc-entry" aria-label="main file">▶</span>}
              {f.name}
            </button>
          )}
          {!readOnly && active === f.name && renaming !== f.name && (
            <button type="button" className="arc-tab-more" aria-label={`More for ${f.name}`} aria-haspopup="menu"
              aria-expanded={menu === f.name} onClick={() => setMenu(menu === f.name ? null : f.name)}>⋯</button>
          )}
          {menu === f.name && (
            <div className="arc-menu" role="menu" ref={menuRef}>
              <button type="button" role="menuitem" onClick={() => { setMenu(null); setRenaming(f.name); }}>Rename</button>
              {kindOf(f.name) === 'code' && f.name !== project.entry && (
                <button type="button" role="menuitem" onClick={() => { setMenu(null); onSetEntry(f.name); }}>Make this the main file</button>
              )}
              <button type="button" role="menuitem" className="danger" disabled={f.name === project.entry}
                title={f.name === project.entry ? 'Run starts here — make another file the main file first' : ''}
                onClick={() => { setMenu(null); onDelete(f.name); }}>Delete</button>
            </div>
          )}
        </div>
      ))}
      {!readOnly && (adding ? (
        <div className="arc-tab is-active">
          <NameField initial="" placeholder="helper.py" taken={names}
            onDone={(n) => { setAdding(false); if (n) onAdd(n); }} />
        </div>
      ) : (
        <button type="button" className="arc-tab-add" onClick={() => setAdding(true)} title="New file (another .py, or a .txt / .json data file)">+ File</button>
      ))}
      <span className="arc-tabs-gap" />
      <div className={`arc-tab arc-tab-assets${active === ASSETS_TAB ? ' is-active' : ''}`}>
        <button type="button" role="tab" aria-selected={active === ASSETS_TAB} onClick={() => onSelect(ASSETS_TAB)}>
          Assets <small>{project.assets.length}</small>
        </button>
      </div>
    </div>
  );
}

function NameField({ initial, taken, onDone, placeholder }) {
  const [value, setValue] = useState(initial);
  const [problem, setProblem] = useState('');
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  const commit = () => {
    const n = value.trim();
    if (!n || n === initial) { onDone(null); return; }
    const withExt = /\.[A-Za-z0-9]+$/.test(n) ? n : `${n}.py`;
    const p = nameProblem(withExt, taken);
    if (p) { setProblem(p); ref.current?.focus(); return; }
    onDone(withExt);
  };
  return (
    <span className="arc-namefield">
      <input
        ref={ref}
        value={value}
        placeholder={placeholder}
        aria-label="File name"
        aria-invalid={Boolean(problem)}
        onChange={(e) => { setValue(e.target.value); setProblem(''); }}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onDone(null); }}
        onBlur={() => { if (!problem) commit(); }}
      />
      {problem && <span className="arc-namefield-problem" role="alert">{problem}</span>}
    </span>
  );
}
