import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Deck from './deck/Deck.jsx';
import Editor from './editor/Editor.jsx';
import Navbar from './navbar/Navbar.jsx';
import SlidesFromModel from './present/SlidesFromModel.jsx';
import { DEFAULT_CONFIG, REQUIRES_RELOAD } from './deck/revealConfig.js';
import { applyTheme, applyCodeTheme } from './deck/themes.js';
import { useDocStore } from './model/useDocStore.js';
import { newDoc, starterDoc } from './model/deckModel.js';
import { buildStandaloneHtml, downloadText, pickJsonFile } from './export/standalone.js';
import './app.css';

const STORAGE_KEY = 'jonathans-studio:settings';
const PRINT_MODE = new URLSearchParams(window.location.search).has('print-pdf');

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      config: { ...DEFAULT_CONFIG, ...(saved.config || {}) },
      theme: saved.theme || 'black',
      codeTheme: saved.codeTheme || 'monokai',
    };
  } catch {
    return { config: DEFAULT_CONFIG, theme: 'black', codeTheme: 'monokai' };
  }
}

export default function App() {
  const [{ config, theme, codeTheme }, setSettings] = useState(loadSettings);
  const store = useDocStore();
  const { doc } = store;

  const [mode, setModeState] = useState(PRINT_MODE ? 'present' : 'edit');
  const [session, setSession] = useState(0); // bumps to remount the reveal deck
  const [deck, setDeck] = useState(null);     // live Reveal instance (present mode only)
  const [live, setLive] = useState({ h: 0, v: 0, total: 0, isOverview: false, isPaused: false, isAutoSliding: false, isScrollView: false });
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);
  const hostRef = useRef(null);

  /* body class scopes the studio's fixed-height layout to this route */
  useEffect(() => { document.body.classList.add('studio'); return () => document.body.classList.remove('studio'); }, []);

  /* persist + apply themes */
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ config, theme, codeTheme }));
  }, [config, theme, codeTheme]);
  useEffect(() => { applyTheme(theme); }, [theme]);
  useEffect(() => { applyCodeTheme(codeTheme); }, [codeTheme]);

  const notify = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  }, []);

  const setMode = useCallback((m) => {
    if (m === 'present') { setSession((n) => n + 1); window.location.hash = ''; }
    else setDeck(null);
    setModeState(m);
  }, []);

  /* F5 → present (Esc is reveal's overview key, so leaving is a button) */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'F5' && mode === 'edit') { e.preventDefault(); setMode('present'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, setMode]);

  /* keep the status readout in sync with reveal */
  const refreshLive = useCallback((d) => {
    if (!d) return;
    const { h, v } = d.getIndices();
    setLive({
      h, v,
      total: d.getHorizontalSlides().length,
      isOverview: d.isOverview(),
      isPaused: d.isPaused(),
      isAutoSliding: d.isAutoSliding(),
      isScrollView: d.isScrollView(),
    });
  }, []);

  const onReady = useCallback((d) => {
    setDeck(d);
    refreshLive(d);
    const events = [
      'slidechanged', 'overviewshown', 'overviewhidden', 'paused', 'resumed',
      'autoslideresumed', 'autoslidepaused', 'fragmentshown', 'fragmenthidden', 'resize',
    ];
    events.forEach((ev) => d.on(ev, () => refreshLive(d)));
    if (PRINT_MODE) setTimeout(() => window.print(), 800);
  }, [refreshLive]);

  /* option setters used by the menus */
  const setOptions = useCallback((patch) => {
    setSettings((s) => ({ ...s, config: { ...s.config, ...patch } }));
    if (!deck) return;
    const { view, ...rest } = patch;
    if (Object.keys(rest).length) deck.configure(rest);
    if (view !== undefined) deck.toggleScrollView(view === 'scroll');
    if (Object.keys(patch).some((k) => REQUIRES_RELOAD.has(k))) notify('Reload the page to apply');
    refreshLive(deck);
  }, [deck, notify, refreshLive]);

  const setOption = useCallback((key, value) => setOptions({ [key]: value }), [setOptions]);

  /* re-layout whenever the host resizes (fullscreen, window, devtools...) */
  useEffect(() => {
    if (!deck || !hostRef.current) return;
    const ro = new ResizeObserver(() => deck.layout());
    ro.observe(hostRef.current);
    return () => ro.disconnect();
  }, [deck]);

  /* file actions */
  const file = useMemo(() => ({
    newDeck: () => { if (window.confirm('Start a new empty deck? The current one is replaced.')) store.replaceDoc(newDoc()); },
    loadStarter: () => { if (window.confirm('Replace the current deck with the starter deck?')) store.replaceDoc(starterDoc()); },
    importJson: async () => {
      const data = await pickJsonFile();
      if (data && Array.isArray(data.slides)) { store.replaceDoc(data); notify('Deck imported'); }
      else notify('That file is not a deck export');
    },
    exportJson: () => downloadText(`${slug(doc.title)}.json`, JSON.stringify(doc, null, 2), 'application/json'),
    exportHtml: () => downloadText(`${slug(doc.title)}.html`, buildStandaloneHtml({ doc, config, theme, codeTheme }), 'text/html'),
  }), [store, doc, config, theme, codeTheme, notify]);

  const ctx = useMemo(() => ({
    mode, setMode,
    deck, config, live, theme, codeTheme,
    docTitle: doc.title,
    setDocTitle: (title) => store.setDoc((d) => ({ ...d, title })),
    undo: store.undo, redo: store.redo, canUndo: store.canUndo, canRedo: store.canRedo,
    file,
    setOption, setOptions,
    setTheme: (id) => setSettings((s) => ({ ...s, theme: id })),
    setCodeTheme: (id) => setSettings((s) => ({ ...s, codeTheme: id })),
    notify,
    fullscreen: () => {
      const el = hostRef.current;
      if (!el) return;
      if (document.fullscreenElement) document.exitFullscreen();
      else el.requestFullscreen?.();
    },
    openPrintView: () => {
      window.open(`${window.location.pathname}?print-pdf`, '_blank');
      notify('Use the browser print dialog → Save as PDF');
    },
    copy: async (text, msg) => {
      try { await navigator.clipboard.writeText(text); notify(msg); }
      catch { notify('Clipboard blocked by browser'); }
    },
    reset: () => { localStorage.removeItem(STORAGE_KEY); window.location.reload(); },
  }), [mode, setMode, deck, config, live, theme, codeTheme, doc.title, store, file, setOption, setOptions, notify]);

  const slides = <SlidesFromModel doc={doc} width={config.width} height={config.height} />;

  if (PRINT_MODE) {
    return (
      <div className="print-mode">
        <Deck config={config} printMode onReady={onReady}>{slides}</Deck>
      </div>
    );
  }

  return (
    <div className="app">
      <Navbar ctx={ctx} toast={toast} />
      {mode === 'edit' ? (
        <Editor store={store} width={config.width} height={config.height} notify={notify} />
      ) : (
        <div className="deck-host" ref={hostRef}>
          <Deck key={session} config={config} onReady={onReady}>{slides}</Deck>
        </div>
      )}
    </div>
  );
}

const slug = (s) => (s || 'deck').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'deck';
