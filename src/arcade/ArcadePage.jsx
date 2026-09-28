import { useCallback, useEffect, useRef, useState } from 'react';
import TopBar from './components/TopBar.jsx';
import FileTabs, { ASSETS_TAB } from './components/FileTabs.jsx';
import CodeEditor from './components/CodeEditor.jsx';
import AssetsPanel from './components/AssetsPanel.jsx';
import GamePanel from './components/GamePanel.jsx';
import Console from './components/Console.jsx';
import { ProjectsDialog, ExamplesDialog, ShareDialog, HelpDialog } from './components/Dialogs.jsx';
import { RunnerHost } from './runner/RunnerHost.js';
import { chooseStore, localStore, apiStore, loginHref, moveLocalToAccount } from './store/index.js';
import { memoryStore } from './store/memoryStore.js';
import { newProject, kindOf, isTextName, cleanUploadName, nameProblem, LIMITS, mimeOf } from './store/model.js';
import { decodeShare } from './lib/share.js';
import { API_BASE } from './config.js';
import { makeZip, downloadBlob } from './lib/zip.js';
import { useFonts } from '../site/useFonts.js';
import '../site/site.css';
import './arcade.css';

const LAST_KEY = 'hsct-arcade:last';
const SPLIT_KEY = 'hsct-arcade:split';
const MAX_LOG_CHARS = 150_000;
let logId = 0;

/** A callback whose identity never changes but always sees the latest render. */
function useStable(fn) {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((...args) => ref.current(...args), []);
}

const slug = (s) => (s || 'game').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'game';
const readLS = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const writeLS = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

export default function ArcadePage({ projectId }) {
  useFonts();
  useEffect(() => {
    document.body.classList.add('arcade-body');
    document.title = 'Python Arcade · HSCT TechHub';
    return () => document.body.classList.remove('arcade-body');
  }, []);

  /* where projects live */
  const storeRef = useRef(localStore);
  const [where, setWhere] = useState('browser');
  const [canSignIn, setCanSignIn] = useState(false);

  /* the open project */
  const [project, setProject] = useState(null);
  const projectRef = useRef(null);
  projectRef.current = project;
  const [active, setActive] = useState('main.py');
  const [focusKey, setFocusKey] = useState('');
  const [readOnly, setReadOnly] = useState(false);
  const [saveState, setSaveState] = useState('saved');
  const [previews, setPreviews] = useState({});
  const assetData = useRef(new Map());   // name → { type, data: ArrayBuffer }
  const [uploading, setUploading] = useState(false);

  /* running */
  const iframeRef = useRef(null);
  const hostRef = useRef(null);
  const [runner, setRunner] = useState({ state: 'loading', ready: false, isolated: null, python: '' });
  const [running, setRunning] = useState(false);
  const runInfo = useRef({ start: 0, sawDisplay: false });
  const runProject = useRef(new Map());   // runId → project id, so late results never land in another project
  const [entries, setEntries] = useState([]);
  const [waiting, setWaiting] = useState(null);
  const [screen, setScreen] = useState({ width: 0, height: 0, caption: '' });
  const [screenBig, setScreenBig] = useState(true);
  const [errorMark, setErrorMark] = useState(null); // { file, line }

  /* chrome */
  const [dialog, setDialog] = useState(null);
  const [projectList, setProjectList] = useState(null);
  const [localCount, setLocalCount] = useState(0);
  const [moving, setMoving] = useState('');
  const [notice, setNotice] = useState(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);
  const [split, setSplit] = useState(() => Number(readLS(SPLIT_KEY)) || 0.52);

  const say = useStable((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  });

  /* ── console log, batched per animation frame ──────────────────────── */
  const pending = useRef([]);
  const flushQueued = useRef(false);
  const flushLog = useStable(() => {
    flushQueued.current = false;
    const items = pending.current;
    pending.current = [];
    if (!items.length) return;
    setEntries((prev) => {
      const next = prev.slice();
      for (const item of items) {
        const last = next[next.length - 1];
        if (last && (item.kind === 'out' || item.kind === 'err') && last.kind === item.kind) {
          next[next.length - 1] = { ...last, text: last.text + item.text };
        } else next.push({ id: ++logId, ...item });
      }
      // Keep the newest ~150k characters: drop whole old entries, then trim the oldest one left.
      let excess = next.reduce((n, e) => n + (e.text ? e.text.length : 0), 0) - MAX_LOG_CHARS;
      while (excess > 0 && next.length > 1 && (next[0].text || '').length <= excess) {
        excess -= (next[0].text || '').length;
        next.shift();
      }
      if (excess > 0 && next[0]?.text) next[0] = { ...next[0], text: `…${next[0].text.slice(excess + 1)}` };
      return next;
    });
  });
  const log = useStable((kind, text, extra) => {
    pending.current.push({ kind, text, ...extra });
    if (!flushQueued.current) {
      flushQueued.current = true;
      requestAnimationFrame(() => flushLog());
      setTimeout(() => flushQueued.current && flushLog(), 120); // background tabs don't run rAF
    }
  });

  /* ── saving ────────────────────────────────────────────────────────── */
  const dirty = useRef(false);
  const saveTimer = useRef(null);
  const saving = useRef(null);

  const saveStateRef = useRef('saved');
  saveStateRef.current = saveState;

  /** Save now if there are changes. Resolves true when everything is saved. */
  const saveNow = useStable(async () => {
    clearTimeout(saveTimer.current);
    if (saving.current) await saving.current;
    const p = projectRef.current;
    if (!p || readOnly) return true;
    if (!dirty.current) return saveStateRef.current !== 'error' && saveStateRef.current !== 'conflict';
    dirty.current = false;
    setSaveState('saving');
    let ok = false;
    const job = (async () => {
      try {
        const saved = await storeRef.current.save(p);
        const merge = (cur) => (cur && cur.id === saved.id ? { ...cur, version: saved.version, updatedAt: saved.updatedAt } : cur);
        projectRef.current = merge(projectRef.current);
        setProject(merge);
        setSaveState(dirty.current ? 'unsaved' : 'saved');
        ok = !dirty.current;
      } catch (e) {
        dirty.current = true;   // nothing was saved, so these edits are still unsaved
        if (e && e.status === 409) { setSaveState('conflict'); return; }
        setSaveState('error');
        if (e && e.status >= 400 && e.status < 500) {
          // The server refused this version of the project; retrying won't help.
          setNotice({ kind: 'warn', text: `Couldn’t save: ${e.message}` });
        } else {
          saveTimer.current = setTimeout(() => saveNow(), 5000);   // offline or server trouble: try again
        }
      }
    })();
    saving.current = job;
    await job;
    saving.current = null;
    return ok;
  });

  /** Before leaving this project: save, and ask if that didn't work. */
  const okToLeave = useStable(async () => {
    if (await saveNow()) return true;
    return window.confirm('Your latest changes to this project couldn’t be saved. Leave it anyway?');
  });

  const markDirty = useStable(() => {
    if (readOnly) return;
    dirty.current = true;
    setSaveState('unsaved');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveNow(), 700);
  });

  /** Change the project (functional update) and schedule a save. */
  const change = useStable((fn) => {
    const next = fn(projectRef.current);
    projectRef.current = next;
    setProject(next);
    markDirty();
  });

  useEffect(() => {
    const flush = () => { if (dirty.current) saveNow(); };
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    const onUnload = (e) => {
      const unsaved = dirty.current || ['error', 'conflict'].includes(saveStateRef.current);
      flush();
      if (unsaved) { e.preventDefault(); e.returnValue = ''; }   // "Leave site? Changes may not be saved."
    };
    window.addEventListener('beforeunload', onUnload);
    document.addEventListener('visibilitychange', onHide);
    return () => { window.removeEventListener('beforeunload', onUnload); document.removeEventListener('visibilitychange', onHide); };
  }, [saveNow]);

  /* ── opening projects ──────────────────────────────────────────────── */
  /** Show a project. `source` is where its assets come from (a shared project
   *  you don't own may live on the server even while you save to this browser). */
  const loadProject = useStable(async (p, source = storeRef.current) => {
    if (running) { hostRef.current?.abandon(); setRunning(false); }
    const store = source;
    Object.values(previews).forEach((u) => URL.revokeObjectURL(u));
    const data = new Map();
    const urls = {};
    for (const a of p.assets || []) {
      try {
        const blob = await store.getAssetBlob(p.id, a);
        data.set(a.name, { type: a.type || blob.type || mimeOf(a.name), data: await blob.arrayBuffer() });
        urls[a.name] = URL.createObjectURL(blob);
      } catch { /* shown as missing */ }
    }
    assetData.current = data;
    setPreviews(urls);
    dirty.current = false;
    projectRef.current = p;
    setProject(p);
    setFocusKey(`${p.id}:${Date.now()}`);
    setActive(p.files.some((f) => f.name === p.entry) ? p.entry : (p.files[0]?.name || ASSETS_TAB));
    const ro = p.isOwner === false;
    setReadOnly(ro);
    setSaveState(ro ? 'readonly' : 'saved');
    setEntries([]);
    setErrorMark(null);
    setWaiting(null);
    const main = p.files.find((f) => f.name === p.entry)?.content || '';
    setScreenBig(/pygame/.test(main));
    document.title = `${p.title} · Python Arcade · HSCT TechHub`;
    if (window.location.pathname !== `/play/${p.id}` || window.location.hash) {
      window.history.replaceState(null, '', `/play/${p.id}`);
    }
    if (!ro) writeLS(LAST_KEY, p.id);
  });

  const openProject = useStable(async (id) => {
    if (!(await okToLeave())) return false;
    const p = await storeRef.current.get(id);
    if (!p) { say('That project could not be opened.'); return false; }
    await loadProject(p);
    setNotice(null);
    return true;
  });

  const createProject = useStable(async (opts) => {
    if (projectRef.current && !(await okToLeave())) return null;
    const p = await storeRef.current.create(newProject(opts));
    await loadProject(p);
    return p;
  });

  /* first load */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let info;
      try {
        info = await chooseStore();
        await info.store.list(); // make sure storage actually works here
      } catch {
        info = { store: memoryStore, where: 'memory', canSignIn: false };
        setNotice({ kind: 'warn', text: 'This browser won’t let the Arcade save projects. Your work lasts until you close the tab — use Download (.zip) to keep it.' });
      }
      if (cancelled) return;
      storeRef.current = info.store;
      setWhere(info.where === 'account' ? 'account' : 'browser');
      setCanSignIn(Boolean(info.canSignIn));
      const store = info.store;

      const share = window.location.hash.match(/^#share=([\w-]+)/);
      if (share) {
        try {
          const shared = await decodeShare(share[1]);
          const p = await store.create(newProject({ title: shared.title, files: shared.files, entry: shared.entry }));
          await loadProject(p);
          setNotice({ kind: 'shared', text: 'This is your own copy of a game someone shared. Look through the code, then press Run.' });
          return;
        } catch {
          setNotice({ kind: 'warn', text: 'That share link didn’t work — it may have been cut off when it was copied.' });
        }
      }
      if (projectId) {
        const p = await store.get(projectId).catch(() => null);
        if (p) { await loadProject(p); return; }
        if (API_BASE && info.where !== 'account') {
          // Someone shared a link to their account project; you're not signed in.
          const shared = await apiStore.get(projectId).catch(() => null);
          if (shared) { await loadProject({ ...shared, isOwner: false }, apiStore); return; }
        }
        setNotice({
          kind: 'warn',
          text: info.where === 'account' ? 'That project doesn’t exist, or it isn’t shared with you.'
            : API_BASE ? 'That project is private or doesn’t exist. If it’s yours, sign in to open it.'
              : 'That project isn’t saved in this browser. Projects stay on the computer they were made on until sign-in is turned on.',
        });
      }
      const last = readLS(LAST_KEY);
      if (last) {
        const p = await store.get(last).catch(() => null);
        if (p && p.isOwner !== false) { await loadProject(p); return; }
      }
      const list = await store.list().catch(() => []);
      if (list.length) {
        const p = await store.get(list[0].id);
        if (p) { await loadProject(p); return; }
      }
      await createProject({ title: 'My first game' });
      setNotice({ kind: 'welcome', text: 'Welcome to the Python Arcade! This blank game is yours — press Run to see it, or open Examples for finished games to learn from.' });
    })().catch((e) => setNotice({ kind: 'warn', text: `Something went wrong opening your project: ${e.message}` }));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── the runner ────────────────────────────────────────────────────── */
  /** Files a run wrote (save files, high scores) go back into the project they ran in. */
  const mergeWrittenFiles = useStable((m) => {
    const p = projectRef.current;
    if (!m.files?.length || !p || readOnly || runProject.current.get(m.runId) !== p.id) return [];
    const taken = p.files.map((x) => x.name);
    const accepted = m.files.filter((f) => taken.includes(f.name)
      || (taken.length < LIMITS.files && !nameProblem(f.name, taken) && !p.assets.some((a) => a.name === f.name)));
    if (!accepted.length) return [];
    change((cur) => {
      const files = cur.files.slice();
      for (const f of accepted) {
        const i = files.findIndex((x) => x.name === f.name);
        if (i >= 0) files[i] = { ...files[i], content: f.content };
        else files.push({ name: f.name, content: f.content });
      }
      return { ...cur, files };
    });
    return accepted.map((f) => f.name);
  });

  const onDone = useStable((m) => {
    setRunning(false);
    setWaiting(null);
    flushLog();
    const secs = ((performance.now() - runInfo.current.start) / 1000).toFixed(1);
    if (m.outcome === 'ok') log('sys', `✓ Finished in ${secs} s\n`);
    else if (m.outcome === 'stopped') log('sys', '■ Stopped\n');
    if (m.error) {
      log('error', '', { error: m.error });
      const p = projectRef.current;
      if (m.error.line && p?.files.some((f) => f.name === m.error.file)) {
        setErrorMark({ file: m.error.file, line: m.error.line });
        setActive(m.error.file);
      }
    }
    const saved = mergeWrittenFiles(m);
    if (saved.length) log('sys', `Your program saved ${saved.join(', ')} — ${saved.length === 1 ? 'it’s' : 'they’re'} in the tabs above.\n`);
    if (!runInfo.current.sawDisplay) setScreenBig(false);
  });

  useEffect(() => {
    const host = new RunnerHost({
      onHello: (m) => {
        setRunner((r) => ({ ...r, isolated: m.isolated, ready: m.ready || r.ready, python: m.python || r.python }));
        if (m.isolated === false) {
          setNotice({ kind: 'warn', text: 'Keyboard input and input() are off: this page isn’t cross-origin isolated. Check the COOP/COEP headers in public/_headers.' });
        }
      },
      onReady: (m) => setRunner((r) => ({ ...r, ready: true, python: m.python, state: r.state === 'loading' ? 'ready' : r.state })),
      onBootFailed: (m) => {
        setRunner((r) => ({ ...r, ready: false, state: 'crashed' }));
        log('error', '', { error: { type: 'LoadError', message: m.message } });
      },
      onStatus: (m) => setRunner((r) => ({ ...r, state: m.state })),
      onOut: (m) => log(m.stream === 'stderr' ? 'err' : 'out', m.text),
      onInput: () => setWaiting({}),
      onDisplay: (m) => {
        setScreen((s) => ({ ...s, width: m.width, height: m.height }));
        if (m.width > 0) { runInfo.current.sawDisplay = true; setScreenBig(true); }
      },
      onCaption: (m) => setScreen((s) => ({ ...s, caption: m.text })),
      onDone: (m) => onDone(m),
      onStaleDone: (m) => mergeWrittenFiles(m),
      onShortcut: (m) => { if (m.name === 'run') run(); },
    });
    hostRef.current = host;
    host.attach(iframeRef.current);
    return () => host.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = useStable(async () => {
    const p = projectRef.current;
    if (!p) return;
    if (!p.files.some((f) => f.name === p.entry)) { say(`There’s no ${p.entry} to run.`); return; }
    saveNow();
    pending.current = [];
    setEntries([{ id: ++logId, kind: 'sys', text: `▶ Running ${p.entry}${runner.ready ? '' : ' (Python is still loading…)'}\n` }]);
    setErrorMark(null);
    setWaiting(null);
    setScreen({ width: 0, height: 0, caption: '' });
    runInfo.current = { start: performance.now(), sawDisplay: false };
    setRunning(true);
    const assets = [...assetData.current].map(([name, a]) => ({ name, type: a.type, data: a.data }));
    const id = hostRef.current.run({ entry: p.entry, files: p.files, assets });
    runProject.current.set(id, p.id);
    hostRef.current.focus();
  });

  const stop = useStable(() => { hostRef.current?.stop(); });

  const submitInput = useStable((line) => {
    hostRef.current?.stdin(line);
    log('in', `${line}\n`);
    setWaiting(null);
  });

  /* page-wide shortcuts (the editor handles its own) */
  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveNow().then(() => say('Saved')); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [run, saveNow, say]);

  /* ── files ─────────────────────────────────────────────────────────── */
  const editFile = useStable((name, content) => {
    if (errorMark) setErrorMark(null);
    change((p) => ({ ...p, files: p.files.map((f) => (f.name === name ? { ...f, content } : f)) }));
  });
  const addFile = useStable((name) => {
    if (projectRef.current.files.length >= LIMITS.files) { say(`A project can have up to ${LIMITS.files} files.`); return; }
    const content = name.endsWith('.py') ? `# ${name}\n# Use it from main.py with: import ${name.slice(0, -3)}\n` : '';
    change((p) => ({ ...p, files: [...p.files, { name, content }] }));
    setActive(name);
  });
  const renameFile = useStable((from, to) => {
    if (from === projectRef.current.entry && !to.endsWith('.py')) { say('The main file has to stay a .py file.'); return; }
    if (projectRef.current.assets.some((a) => a.name.toLowerCase() === to.toLowerCase())) { say(`There’s already an asset called ${to}.`); return; }
    change((p) => ({ ...p, entry: p.entry === from ? to : p.entry, files: p.files.map((f) => (f.name === from ? { ...f, name: to } : f)) }));
    setActive(to);
  });
  const deleteFile = useStable((name) => {
    if (!window.confirm(`Delete ${name}? This can’t be undone.`)) return;
    change((p) => ({ ...p, files: p.files.filter((f) => f.name !== name) }));
    setActive(projectRef.current.entry);
  });
  const setEntry = useStable((name) => { change((p) => ({ ...p, entry: name })); say(`Run now starts ${name}`); });
  const setTitle = useStable((title) => change((p) => ({ ...p, title })));

  const upload = useStable(async (fileList) => {
    const p = projectRef.current;
    if (!p || readOnly) return;
    setUploading(true);
    let used = p.assets.reduce((n, a) => n + (a.size || 0), 0);
    try {
      for (const file of Array.from(fileList)) {
        const name = cleanUploadName(file.name);
        const kind = kindOf(name);
        if (!kind) { say(`${file.name} isn’t a file type the Arcade uses.`); continue; }
        const cur = projectRef.current;
        if (cur.id !== p.id) break;   // switched projects mid-upload
        const textNames = cur.files.map((f) => f.name);
        const assetNames = cur.assets.map((a) => a.name);
        if (isTextName(name)) {
          if (file.size > LIMITS.fileChars) { say(`${file.name} is too big for a code file.`); continue; }
          const exists = textNames.includes(name);
          const problem = exists ? null : nameProblem(name, [...textNames, ...assetNames]);
          if (problem) { say(`${name}: ${problem}`); continue; }
          if (!exists && textNames.length >= LIMITS.files) { say(`A project can have up to ${LIMITS.files} files.`); continue; }
          const content = await file.text();
          if (exists && !window.confirm(`Replace ${name} with the uploaded file?`)) continue;
          change((cur) => ({ ...cur, files: exists ? cur.files.map((f) => (f.name === name ? { ...f, content } : f)) : [...cur.files, { name, content }] }));
          setActive(name);
          continue;
        }
        const problem = nameProblem(name, textNames);
        if (problem) { say(`${name}: ${problem}`); continue; }
        if (!assetNames.includes(name) && assetNames.length >= LIMITS.assets) { say(`A project can have up to ${LIMITS.assets} assets.`); continue; }
        if (file.size > LIMITS.assetBytes) { say(`${file.name} is over ${LIMITS.assetBytes / 1024 / 1024} MB.`); continue; }
        if (used + file.size > LIMITS.projectAssetBytes) { say('This project is out of room for assets.'); break; }
        const blob = new Blob([file], { type: file.type || mimeOf(name) });
        await saveNow();
        const updated = await storeRef.current.putAsset(p.id, name, blob);
        used += file.size;
        if (projectRef.current?.id !== p.id) break;   // saved to the right project; just don't show it here
        assetData.current.set(name, { type: blob.type, data: await blob.arrayBuffer() });
        setPreviews((prev) => {
          if (prev[name]) URL.revokeObjectURL(prev[name]);
          return { ...prev, [name]: URL.createObjectURL(blob) };
        });
        const merge = (cur) => ({ ...cur, assets: updated.assets, updatedAt: updated.updatedAt });
        projectRef.current = merge(projectRef.current);
        setProject(merge);
      }
    } catch (e) {
      say(`Upload failed: ${e.message}`);
    } finally {
      setUploading(false);
    }
  });

  const deleteAsset = useStable(async (name) => {
    if (!window.confirm(`Delete ${name}?`)) return;
    const updated = await storeRef.current.removeAsset(projectRef.current.id, name);
    assetData.current.delete(name);
    setPreviews((prev) => { if (prev[name]) URL.revokeObjectURL(prev[name]); const n = { ...prev }; delete n[name]; return n; });
    const merge = (cur) => ({ ...cur, assets: updated ? updated.assets : cur.assets.filter((a) => a.name !== name) });
    projectRef.current = merge(projectRef.current);
    setProject(merge);
  });

  const copy = useStable(async (text) => {
    try { await navigator.clipboard.writeText(text); say('Copied'); }
    catch { say('Copy blocked by the browser — select it and press Ctrl+C.'); }
  });

  /* ── projects dialog actions ───────────────────────────────────────── */
  const refreshList = useStable(async () => {
    setProjectList(null);
    setProjectList(await storeRef.current.list().catch(() => []));
    if (where === 'account') setLocalCount((await localStore.list().catch(() => [])).length);
  });
  useEffect(() => { if (dialog === 'projects') refreshList(); }, [dialog, refreshList]);

  const duplicate = useStable(async (id, { title, remix } = {}) => {
    await saveNow();
    const store = storeRef.current;
    const src = id === projectRef.current?.id ? projectRef.current : await store.get(id);
    if (!src) return null;
    if (remix && where === 'account' && src.isOwner === false) {
      return apiStore.remix(id);
    }
    const copyP = await store.create(newProject({ title: title || `Copy of ${src.title}`, files: src.files, entry: src.entry, remixOf: src.id }));
    for (const a of src.assets) {
      const found = src.id === projectRef.current?.id ? assetData.current.get(a.name) : null;
      const blob = found ? new Blob([found.data], { type: found.type }) : await store.getAssetBlob(src.id, a).catch(() => null);
      if (blob) await store.putAsset(copyP.id, a.name, blob);
    }
    return store.get(copyP.id);
  });

  const deleteProject = useStable(async (id, title) => {
    if (!window.confirm(`Delete “${title || 'Untitled'}”? This can’t be undone.`)) return;
    await storeRef.current.remove(id);
    if (id === projectRef.current?.id) {
      dirty.current = false;
      saveStateRef.current = 'saved';
      const list = await storeRef.current.list();
      if (list.length) await openProject(list[0].id);
      else await createProject({ title: 'My game' });
    }
    refreshList();
  });

  const moveLocal = useStable(async () => {
    try {
      const { moved, failed } = await moveLocalToAccount((i, n, title) => setMoving(i < n ? `${i + 1} of ${n}: ${title}` : ''));
      setMoving('');
      if (failed.length) say(`Couldn’t move ${failed.map((f) => `“${f.title}” (${f.message})`).join(', ')}`);
      if (moved.length && window.confirm(`Moved ${moved.length} project(s) to your account. Remove the copies saved in this browser?`)) {
        for (const id of moved) await localStore.remove(id);
      }
      refreshList();
    } catch (e) {
      setMoving('');
      say(`Couldn’t move projects: ${e.message}`);
    }
  });

  const setVisibility = useStable(async (visibility) => {
    try {
      const p = await apiStore.setVisibility(projectRef.current.id, visibility);
      const merge = (cur) => ({ ...cur, visibility: p.visibility });
      projectRef.current = merge(projectRef.current);
      setProject(merge);
    } catch (e) { say(`Couldn’t change sharing: ${e.message}`); }
  });

  const resolveConflict = useStable(async (keepMine) => {
    const p = projectRef.current;
    if (!keepMine) { await openProject(p.id); return; }
    const remote = await storeRef.current.get(p.id);
    projectRef.current = { ...p, version: remote.version };
    setProject(projectRef.current);
    dirty.current = true;
    await saveNow();
  });

  /* ── downloads ─────────────────────────────────────────────────────── */
  const download = useStable((what) => {
    const p = projectRef.current;
    if (!p) return;
    if (what === 'file') {
      const f = p.files.find((x) => x.name === active) || p.files.find((x) => x.name === p.entry);
      downloadBlob(f.name, new Blob([f.content], { type: 'text/plain' }));
      return;
    }
    const dir = slug(p.title);
    const readme = [
      `${p.title} — made in the HSCT Python Arcade (hsct.tech/play)`,
      '',
      'To run it on your own computer:',
      '  1. Install Python from https://www.python.org',
      '  2. In a terminal:   pip install pygame-ce',
      `  3. In this folder:  python ${p.entry}`,
      '',
    ].join('\r\n');
    const entriesZ = [
      ...p.files.map((f) => ({ name: `${dir}/${f.name}`, data: f.content })),
      ...[...assetData.current].map(([name, a]) => ({ name: `${dir}/${name}`, data: a.data })),
      { name: `${dir}/HOW_TO_RUN.txt`, data: readme },
    ];
    downloadBlob(`${dir}.zip`, makeZip(entriesZ));
  });

  /* ── split between code and screen ─────────────────────────────────── */
  const startDrag = (e) => {
    const main = e.currentTarget.parentElement;
    const rect = main.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    const move = (ev) => setSplit(Math.min(0.75, Math.max(0.28, (ev.clientX - rect.left) / rect.width)));
    const up = (ev) => {
      ev.target.removeEventListener('pointermove', move);
      ev.target.removeEventListener('pointerup', up);
      setSplit((s) => { writeLS(SPLIT_KEY, String(s)); return s; });
    };
    e.currentTarget.addEventListener('pointermove', move);
    e.currentTarget.addEventListener('pointerup', up);
  };

  const activeFile = project?.files.find((f) => f.name === active);
  const closeDialog = useCallback(() => setDialog(null), []);

  return (
    <div className="site arcade" style={{ '--split': split }}>
      <TopBar
        project={project}
        where={where}
        saveState={saveState}
        running={running}
        runnerReady={runner.ready}
        onRun={run}
        onStop={stop}
        onTitle={setTitle}
        onMenu={setDialog}
        canSignIn={canSignIn}
        signInHref={loginHref()}
        onDownload={download}
      />

      <div className="arc-notices">
          {readOnly && project && (
            <div className="arc-notice notice-shared">
              <span>You’re looking at someone else’s game. Run it and read it — to change it, make your own copy.</span>
              <button type="button" className="btn btn-blue" onClick={async () => { const p = await duplicate(project.id, { title: project.title, remix: true }); if (p) await loadProject(p); }}>Remix</button>
            </div>
          )}
          {saveState === 'conflict' && (
            <div className="arc-notice notice-warn">
              <span>This project was changed in another tab or on another computer.</span>
              <button type="button" className="btn btn-ghost" onClick={() => resolveConflict(false)}>Load that version</button>
              <button type="button" className="btn btn-blue" onClick={() => resolveConflict(true)}>Keep mine</button>
            </div>
          )}
          {notice && (
            <div className={`arc-notice notice-${notice.kind}`}>
              <span>{notice.text}</span>
              {notice.kind === 'welcome' && <button type="button" className="btn btn-ghost" onClick={() => { setNotice(null); setDialog('examples'); }}>See examples</button>}
              <button type="button" className="arc-x" aria-label="Dismiss" onClick={() => setNotice(null)}>×</button>
            </div>
          )}
      </div>

      <main className="arc-main">
        <section className="arc-code" aria-label="Code">
          {project ? (
            <>
              <FileTabs
                project={project}
                active={active}
                onSelect={setActive}
                onAdd={addFile}
                onRename={renameFile}
                onDelete={deleteFile}
                onSetEntry={setEntry}
                readOnly={readOnly}
              />
              {active === ASSETS_TAB ? (
                <AssetsPanel project={project} previews={previews} onUpload={upload} onDelete={deleteAsset}
                  onCopy={copy} readOnly={readOnly} busy={uploading} />
              ) : activeFile ? (
                <CodeEditor
                  fileName={activeFile.name}
                  value={activeFile.content}
                  onChange={(text) => editFile(activeFile.name, text)}
                  onRun={run}
                  onSave={() => saveNow().then(() => say('Saved'))}
                  errorLine={errorMark && errorMark.file === activeFile.name ? errorMark.line : null}
                  focusKey={focusKey}
                  readOnly={readOnly}
                />
              ) : <div className="arc-editor arc-loading">Pick a file above.</div>}
            </>
          ) : <div className="arc-editor arc-loading">Opening your project…</div>}
        </section>

        <div className="arc-split" role="separator" aria-orientation="vertical" aria-label="Resize" onPointerDown={startDrag} />

        <div className={`arc-run${screenBig ? ' screen-big' : ' screen-small'}`}>
          <GamePanel iframeRef={iframeRef} screen={screen} big={screenBig} onToggleBig={() => setScreenBig((b) => !b)} runner={runner} />
          <Console
            entries={entries}
            waiting={waiting}
            onSubmit={submitInput}
            onClear={() => setEntries([])}
            onJump={(err) => { setActive(err.file); setErrorMark({ file: err.file, line: err.line }); }}
          />
        </div>
      </main>

      {dialog === 'projects' && (
        <ProjectsDialog
          list={projectList}
          currentId={project?.id}
          where={where}
          localCount={localCount}
          moving={moving}
          onOpen={async (id) => { setDialog(null); await openProject(id); }}
          onNew={async () => { setDialog(null); await createProject({ title: 'Untitled game' }); }}
          onExamples={() => setDialog('examples')}
          onDuplicate={async (id) => { const p = await duplicate(id); if (p) { setDialog(null); await loadProject(p); } }}
          onDelete={deleteProject}
          onMoveLocal={moveLocal}
          onClose={closeDialog}
        />
      )}
      {dialog === 'examples' && (
        <ExamplesDialog
          onClose={closeDialog}
          onPick={async (ex) => {
            setDialog(null);
            await createProject({ title: ex.title, files: [{ name: 'main.py', content: ex.code }] });
            setNotice(null);
          }}
        />
      )}
      {dialog === 'share' && project && (
        <ShareDialog project={project} where={where} onVisibility={setVisibility} onCopy={copy}
          onDownload={() => { setDialog(null); download('zip'); }} onClose={closeDialog} />
      )}
      {dialog === 'help' && <HelpDialog onClose={closeDialog} python={runner.python} />}

      {toast && <div className="arc-toast" role="status">{toast}</div>}
    </div>
  );
}
