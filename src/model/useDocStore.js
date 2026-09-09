import { useCallback, useEffect, useRef, useState } from 'react';
import { starterDoc } from './deckModel.js';

const KEY = 'jonathans-studio:doc';
const MAX_HISTORY = 100;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const doc = JSON.parse(raw);
      if (doc && Array.isArray(doc.slides) && doc.slides.length) return doc;
    }
  } catch { /* fall through */ }
  return starterDoc();
}

/**
 * useDocStore() → { doc, setDoc, replaceDoc, undo, redo, canUndo, canRedo }
 *
 * setDoc(nextOrFn, { record = true, base })
 *   record:false is for high-frequency updates (dragging). When the drag
 *   ends, call setDoc(final, { base: docBeforeDrag }) so the whole drag
 *   is one undo step.
 */
export function useDocStore() {
  const [doc, setDocState] = useState(load);
  const past = useRef([]);
  const future = useRef([]);
  const [, bump] = useState(0);
  const docRef = useRef(doc);
  docRef.current = doc;

  useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(doc)); }
      catch { /* quota — probably big data-URL images; ignore */ }
    }, 250);
    return () => clearTimeout(t);
  }, [doc]);

  const setDoc = useCallback((next, { record = true, base } = {}) => {
    const cur = docRef.current;
    const value = typeof next === 'function' ? next(cur) : next;
    if (value === cur && !base) return;
    if (record) {
      past.current.push(base ?? cur);
      if (past.current.length > MAX_HISTORY) past.current.shift();
      future.current = [];
    }
    docRef.current = value;
    setDocState(value);
    bump((n) => n + 1);
  }, []);

  /** Replace wholesale (new/import). Clears history. */
  const replaceDoc = useCallback((value) => {
    past.current = [];
    future.current = [];
    docRef.current = value;
    setDocState(value);
    bump((n) => n + 1);
  }, []);

  const undo = useCallback(() => {
    if (!past.current.length) return;
    future.current.push(docRef.current);
    const prev = past.current.pop();
    docRef.current = prev;
    setDocState(prev);
    bump((n) => n + 1);
  }, []);

  const redo = useCallback(() => {
    if (!future.current.length) return;
    past.current.push(docRef.current);
    const nxt = future.current.pop();
    docRef.current = nxt;
    setDocState(nxt);
    bump((n) => n + 1);
  }, []);

  return { doc, setDoc, replaceDoc, undo, redo, canUndo: past.current.length > 0, canRedo: future.current.length > 0 };
}
