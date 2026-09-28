import { useEffect, useRef, useState } from 'react';
import { hintFor } from '../lib/hints.js';

/**
 * Program output, the input() box, and errors explained in plain English.
 * entries: [{ id, kind: 'out'|'err'|'sys'|'in'|'error', text, error? }]
 */
export default function Console({ entries, waiting, onSubmit, onClear, onJump, compact }) {
  const scroller = useRef(null);
  const input = useRef(null);
  const [line, setLine] = useState('');
  const stick = useRef(true);

  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [entries, waiting]);

  useEffect(() => {
    if (waiting) {
      setLine('');
      input.current?.focus({ preventScroll: true });
    }
  }, [waiting]);

  const onScroll = () => {
    const el = scroller.current;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  const submit = (e) => {
    e.preventDefault();
    onSubmit(line);
    setLine('');
  };

  return (
    <section className={`arc-console${compact ? ' is-compact' : ''}`} aria-label="Console">
      <header className="arc-panel-head">
        <h2>Console</h2>
        <button type="button" className="arc-chip" onClick={onClear} disabled={!entries.length}>Clear</button>
      </header>
      <div className="arc-console-body" ref={scroller} onScroll={onScroll} onClick={() => waiting && input.current?.focus()}>
        {!entries.length && !waiting && (
          <p className="arc-console-empty">What your program prints shows up here. Programs that use <code>input()</code> ask their questions here too.</p>
        )}
        <div className="arc-log">
          {entries.map((e) => (e.kind === 'error'
            ? <ErrorBlock key={e.id} error={e.error} onJump={onJump} />
            : <span key={e.id} className={`log-${e.kind}`}>{e.text}</span>))}
          {waiting && (
            <form className="arc-input" onSubmit={submit}>
              <label className="visually-hidden" htmlFor="arc-stdin">Type your answer</label>
              <input
                id="arc-stdin"
                ref={input}
                value={line}
                onChange={(e) => setLine(e.target.value)}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                placeholder="Type here and press Enter"
              />
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

function ErrorBlock({ error, onJump }) {
  const hint = hintFor(error);
  const where = error.line ? `line ${error.line}${error.file && error.file !== 'main.py' ? ` of ${error.file}` : ''}` : '';
  return (
    <div className="log-error" role="alert">
      <div className="log-error-head">
        <strong>{error.type}</strong>
        {where && (
          <button type="button" className="log-jump" onClick={() => onJump(error)}>
            {`on ${where}`}
          </button>
        )}
      </div>
      <p className="log-error-msg">{error.message}</p>
      {hint && <p className="log-error-hint">{hint}</p>}
      {error.traceback && (
        <details>
          <summary>Full error</summary>
          <pre>{error.traceback}</pre>
        </details>
      )}
    </div>
  );
}
