import { useEffect, useRef } from 'react';
import { EditorView, keymap, Decoration, lineNumbers, highlightActiveLine, highlightActiveLineGutter,
  drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightSpecialChars } from '@codemirror/view';
import { EditorState, StateEffect, StateField, Compartment } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { indentUnit, bracketMatching, foldGutter, foldKeymap, indentOnInput, syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { python } from '@codemirror/lang-python';
import { json } from '@codemirror/lang-json';
import { tags as t } from '@lezer/highlight';
import { pygameCompletions } from '../lib/completions.js';

/* ── colors: the navy "board" look from the site's widgets ─────────── */
const theme = EditorView.theme({
  '&': { color: '#e9ecfb', backgroundColor: '#0d1533', height: '100%', fontSize: 'var(--code-size, 15px)' },
  '.cm-scroller': { fontFamily: 'ui-monospace, "SF Mono", "IBM Plex Mono", Menlo, Consolas, monospace', lineHeight: '1.55' },
  '.cm-content': { caretColor: '#7aa2ff', padding: '10px 0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#7aa2ff', borderLeftWidth: '2px' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': { backgroundColor: '#2b3a86 !important' },
  '.cm-gutters': { backgroundColor: '#0b1230', color: '#56608f', border: 'none', borderRight: '1px solid #1c2660' },
  '.cm-activeLineGutter': { backgroundColor: '#141d45', color: '#a9b7ea' },
  '.cm-activeLine': { backgroundColor: 'rgba(122, 162, 255, .06)' },
  '.cm-matchingBracket': { backgroundColor: 'rgba(122, 162, 255, .25)', outline: '1px solid #3a4a9c' },
  '.cm-foldPlaceholder': { backgroundColor: '#1c2660', border: 'none', color: '#a9b7ea' },
  '.cm-tooltip': { backgroundColor: '#141d45', border: '1px solid #26306a', color: '#e9ecfb' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: '#1f3fae', color: '#fff' },
  '.cm-completionDetail': { color: '#8b95c9', fontStyle: 'normal', marginLeft: '8px' },
  '.cm-searchMatch': { backgroundColor: 'rgba(255, 205, 60, .25)' },
  '.cm-panels': { backgroundColor: '#141d45', color: '#e9ecfb' },
  '.cm-panels input, .cm-panels button': { color: '#101a3f' },
  '.cm-error-line': { backgroundColor: 'rgba(255, 107, 122, .16)', boxShadow: 'inset 3px 0 0 #ff6b7a' },
}, { dark: true });

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.operatorKeyword], color: '#ff8fa0', fontWeight: '600' },
  { tag: [t.string, t.special(t.string)], color: '#9ef0b8' },
  { tag: [t.number, t.bool, t.null], color: '#ffcd6b' },
  { tag: t.comment, color: '#6f7bb3', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#8fb3ff' },
  { tag: t.definition(t.variableName), color: '#e9ecfb' },
  { tag: [t.className, t.definition(t.className)], color: '#ffcd6b' },
  { tag: t.propertyName, color: '#c6d0ff' },
  { tag: [t.self, t.special(t.variableName)], color: '#ff8fa0', fontStyle: 'italic' },
  { tag: [t.operator, t.punctuation, t.bracket], color: '#a9b7ea' },
  { tag: t.invalid, color: '#ff6b7a' },
]);

/* ── the red "error here" line ─────────────────────────────────────── */
const setError = StateEffect.define();
const errorField = StateField.define({
  create: () => Decoration.none,
  update(deco, tr) {
    for (const e of tr.effects) {
      if (e.is(setError)) {
        if (!e.value) return Decoration.none;
        const line = tr.state.doc.line(Math.min(Math.max(1, e.value), tr.state.doc.lines));
        return Decoration.set([Decoration.line({ class: 'cm-error-line' }).range(line.from)]);
      }
    }
    return tr.docChanged ? Decoration.none : deco.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

const language = new Compartment();
const langFor = (name) => (/\.py$/.test(name) ? python() : /\.json$/.test(name) ? json() : []);

function baseExtensions({ onRun, onSave, onChange }) {
  return [
    lineNumbers(), highlightActiveLineGutter(), highlightSpecialChars(), history(), foldGutter(),
    drawSelection(), dropCursor(), EditorState.allowMultipleSelections.of(true), indentOnInput(),
    syntaxHighlighting(highlight), bracketMatching(), closeBrackets(), rectangularSelection(),
    crosshairCursor(), highlightActiveLine(), highlightSelectionMatches(),
    autocompletion({ override: undefined, activateOnTyping: true }),
    EditorState.languageData.of(() => [{ autocomplete: pygameCompletions }]),
    indentUnit.of('    '),
    EditorState.tabSize.of(4),
    keymap.of([
      { key: 'Mod-Enter', preventDefault: true, run: () => { onRun.current?.(); return true; } },
      { key: 'Mod-s', preventDefault: true, run: () => { onSave.current?.(); return true; } },
      indentWithTab,
      ...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap, ...completionKeymap,
    ]),
    theme,
    errorField,
    EditorView.lineWrapping,
    EditorView.updateListener.of((u) => { if (u.docChanged) onChange.current?.(u.state.doc.toString()); }),
    EditorView.contentAttributes.of({ 'aria-label': 'Code editor', spellcheck: 'false', autocorrect: 'off', autocapitalize: 'off' }),
  ];
}

/**
 * One CodeMirror view; each file keeps its own state (text, undo history,
 * cursor) so switching tabs feels like switching files in a real editor.
 */
export default function CodeEditor({ fileName, value, onChange, onRun, onSave, errorLine, readOnly, focusKey }) {
  const host = useRef(null);
  const view = useRef(null);
  const states = useRef(new Map());
  const cbs = { onChange: useRef(onChange), onRun: useRef(onRun), onSave: useRef(onSave) };
  cbs.onChange.current = onChange;
  cbs.onRun.current = onRun;
  cbs.onSave.current = onSave;
  const refs = useRef(cbs);

  const makeState = (name, doc) => EditorState.create({
    doc,
    extensions: [
      baseExtensions(refs.current),
      language.of(langFor(name)),
      EditorState.readOnly.of(Boolean(readOnly)),
    ],
  });

  const shown = useRef({ file: null, key: null });

  useEffect(() => {
    view.current = new EditorView({ parent: host.current, state: makeState(fileName, value) });
    shown.current = { file: fileName, key: focusKey };
    return () => { view.current?.destroy(); view.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch files, open another project, or take a new value from outside
  // (the program wrote the file, an example was loaded…).
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    if (shown.current.key !== focusKey) {
      states.current.clear();
      shown.current = { file: null, key: focusKey };
    }
    if (shown.current.file !== fileName) {
      if (shown.current.file) states.current.set(shown.current.file, v.state);
      let next = states.current.get(fileName);
      if (!next || next.doc.toString() !== value) next = makeState(fileName, value);
      v.setState(next);
      shown.current.file = fileName;
    } else if (v.state.doc.toString() !== value) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileName, value, focusKey]);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    v.dispatch({ effects: setError.of(errorLine || null) });
    if (errorLine) {
      const line = v.state.doc.line(Math.min(errorLine, v.state.doc.lines));
      v.dispatch({ selection: { anchor: line.from }, effects: EditorView.scrollIntoView(line.from, { y: 'center' }) });
      v.focus();
    }
  }, [errorLine, fileName]);

  return <div className="arc-editor" ref={host} />;
}
