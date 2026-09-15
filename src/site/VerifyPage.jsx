import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import SiteNav from './SiteNav.jsx';
import SiteFooter from './SiteFooter.jsx';
import { useFonts } from './useFonts.js';
import { downloadText, fmtDuration, generateKeyPair, hasCrypto, importPrivateKey, openResult, parseEnvelopes, toCsv } from './hsctVerify.js';
import './site.css';

const KEY_STORE = 'hsct:verify-private-key';
const fmtDate = (iso) => { try { return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch { return iso; } };

export default function VerifyPage() {
  useFonts();
  useEffect(() => { document.title = 'Verify result files · HSCT TechHub'; }, []);

  /* --- the private key, kept in this browser only --- */
  const [keyText, setKeyText] = useState(() => { try { return localStorage.getItem(KEY_STORE) || ''; } catch { return ''; } });
  const [key, setKey] = useState(null);
  const [keyMsg, setKeyMsg] = useState('');
  useEffect(() => {
    let live = true;
    if (!keyText.trim()) { setKey(null); setKeyMsg(''); return; }
    importPrivateKey(keyText).then((k) => { if (live) { setKey(k); setKeyMsg('Key loaded. It stays in this browser until you forget it.'); } })
      .catch((e) => { if (live) { setKey(null); setKeyMsg(e.message); } });
    return () => { live = false; };
  }, [keyText]);
  const saveKey = (t) => { setKeyText(t); try { if (t.trim()) localStorage.setItem(KEY_STORE, t); else localStorage.removeItem(KEY_STORE); } catch { /* private mode */ } };

  const [fresh, setFresh] = useState(null);
  const makePair = async () => {
    const pair = await generateKeyPair();
    setFresh(pair);
    downloadText('teacher-private-key.jwk', JSON.stringify(pair.privateJwk, null, 2) + '\n', 'application/json');
    saveKey(JSON.stringify(pair.privateJwk));
  };

  /* --- files and pasted codes --- */
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(null);
  const [paste, setPaste] = useState('');
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);

  const addEnvelopes = async (items) => {
    if (!key) return;
    setBusy(true);
    const next = [];
    for (const { envelope, file } of items) {
      const r = await openResult(envelope, key);
      const p = r.payload;
      next.push({
        id: `${envelope.badge}-${file}-${next.length}`,
        student: p ? p.student.name : envelope.student,
        lesson: p ? p.lesson.id : envelope.lesson,
        title: p ? p.lesson.title : envelope.title,
        finished: p ? p.finished : envelope.finished,
        seconds: p ? p.seconds : null,
        activeSeconds: p ? p.activeSeconds : null,
        earned: p ? p.score.earned : null,
        possible: p ? p.score.possible : null,
        percent: p ? p.score.percent : null,
        tier: p ? p.tier : null,
        badge: envelope.badge,
        status: r.ok ? 'OK' : `FAILED — ${r.error}`,
        ok: r.ok,
        file,
        payload: p,
      });
    }
    setRows((old) => {
      const seen = new Set(old.map((r) => r.badge + r.file));
      return [...old, ...next.filter((r) => !seen.has(r.badge + r.file))];
    });
    setBusy(false);
  };

  const onFiles = async (list) => {
    const items = [];
    for (const f of Array.from(list || [])) {
      const text = await f.text();
      parseEnvelopes(text).forEach((envelope) => items.push({ envelope, file: f.name }));
      if (!parseEnvelopes(text).length) items.push({ envelope: { hsct: 1, badge: '—', student: '—', lesson: '—', finished: '', data: '', key: '', iv: '' }, file: `${f.name} (not a result file)` });
    }
    await addEnvelopes(items);
    if (fileInput.current) fileInput.current.value = '';
  };
  const onPaste = async () => {
    const envs = parseEnvelopes(paste);
    await addEnvelopes(envs.map((envelope, i) => ({ envelope, file: `pasted #${i + 1}` })));
    setPaste('');
  };

  const dupNames = useMemo(() => {
    const by = new Map();
    rows.forEach((r) => { if (r.ok) by.set(`${r.student}|${r.lesson}`, (by.get(`${r.student}|${r.lesson}`) || 0) + 1); });
    return by;
  }, [rows]);

  const sorted = useMemo(() => rows.slice().sort((a, b) => a.lesson.localeCompare(b.lesson) || a.student.localeCompare(b.student) || (a.finished || '').localeCompare(b.finished || '')), [rows]);

  return (
    <div className="site" id="top">
      <SiteNav />
      <main>
        <header className="r-hero">
          <p className="t-crumb"><a href="/">Home</a> / <a href="/lessons">Lessons</a> / Verify</p>
          <h1>Verify result files</h1>
          <p className="t-bio">
            Students finish a lesson and download a <code>.hsct</code> file. Drop those files here to see
            who did what, when, how long it took, and the score. Files are encrypted; nothing opens without
            your private key, and a file that was edited after it was made will not open at all.
          </p>
        </header>

        {!hasCrypto() && (
          <section className="sec"><div className="sec-head"><h2>Needs https</h2></div><p className="empty">This page has to run on a secure page (https or localhost) to decrypt anything.</p></section>
        )}

        <section className="sec" id="key">
          <div className="sec-head">
            <h2>Your key</h2>
            <p className="sec-lead">Paste the private key once. It is saved in this browser only — never in the site.</p>
          </div>
          <div>
            <textarea
              className="vf-key" rows={4} value={keyText} spellCheck={false}
              placeholder='{"kty":"RSA","d":"…" …}  — the contents of teacher-private-key.jwk'
              onChange={(e) => saveKey(e.target.value)}
              aria-label="Private key (JWK)"
            />
            <div className="vf-row">
              <p className={`vf-msg${key ? ' ok' : keyText.trim() ? ' bad' : ''}`}>{keyMsg || 'No key loaded yet.'}</p>
              {keyText && <button type="button" className="btn btn-ghost" onClick={() => saveKey('')}>Forget key</button>}
            </div>
            <details className="vf-details">
              <summary>Need a new key pair?</summary>
              <p>
                This makes a fresh pair, downloads the private key, and loads it here. You then have to paste the public
                key into <code>lesson-template/hsct-lesson.js</code> and into every lesson that inlines the kit —
                files sealed with the old key will not open with the new one.
              </p>
              <button type="button" className="btn btn-blue" onClick={makePair} disabled={!hasCrypto()}>Generate a new key pair</button>
              {fresh && (
                <>
                  <p style={{ marginTop: 12 }}>Public key — replace <code>PUBLIC_KEY</code> in the kit with this:</p>
                  <textarea className="vf-key" rows={3} readOnly value={JSON.stringify(fresh.publicJwk)} onFocus={(e) => e.target.select()} aria-label="New public key" />
                </>
              )}
            </details>
          </div>
        </section>

        <section className="sec" id="files">
          <div className="sec-head">
            <h2>Result files</h2>
            <p className="sec-lead">Drop as many as you like. Pasted codes work too — one per line.</p>
          </div>
          <div>
            <label
              className={`vf-drop${key ? '' : ' is-off'}`}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
            >
              <input ref={fileInput} type="file" multiple accept=".hsct,.json,.txt" disabled={!key} onChange={(e) => onFiles(e.target.files)} />
              <strong>{key ? 'Drop .hsct files here, or click to choose' : 'Load your key first'}</strong>
              <span>Any number at once. Duplicates are skipped.</span>
            </label>
            <div className="vf-paste">
              <textarea rows={3} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Or paste result codes here" aria-label="Pasted result codes" disabled={!key} />
              <button type="button" className="btn btn-blue" onClick={onPaste} disabled={!key || !paste.trim() || busy}>Open pasted codes</button>
            </div>

            {rows.length > 0 && (
              <>
                <div className="vf-toolbar">
                  <span>{rows.filter((r) => r.ok).length} opened{rows.some((r) => !r.ok) ? `, ${rows.filter((r) => !r.ok).length} failed` : ''}</span>
                  <button type="button" className="btn btn-ghost" onClick={() => downloadText(`hsct-results-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(sorted), 'text/csv')}>Download CSV</button>
                  <button type="button" className="btn btn-ghost" onClick={() => { setRows([]); setOpen(null); }}>Clear</button>
                </div>
                <div className="vf-scroll">
                  <table className="vf-table">
                    <thead><tr><th>Student</th><th>Lesson</th><th>Finished</th><th>Time</th><th>Score</th><th>Tier</th><th>Code</th><th>Status</th></tr></thead>
                    <tbody>
                      {sorted.map((r) => (
                        <Fragment key={r.id}>
                          <tr className={`${r.ok ? '' : 'is-bad'}${open === r.id ? ' is-open' : ''}`} onClick={() => setOpen(open === r.id ? null : r.id)}>
                            <td>{r.student}{r.ok && dupNames.get(`${r.student}|${r.lesson}`) > 1 && <span className="pill muted" title="More than one file for this student and lesson">×{dupNames.get(`${r.student}|${r.lesson}`)}</span>}</td>
                            <td>{r.title || r.lesson}</td>
                            <td>{r.finished ? fmtDate(r.finished) : '—'}</td>
                            <td>{r.seconds != null ? fmtDuration(r.seconds) : '—'}{r.activeSeconds != null && r.activeSeconds < r.seconds - 60 ? <small> ({fmtDuration(r.activeSeconds)} active)</small> : null}</td>
                            <td>{r.earned != null ? <><b>{r.earned}</b> / {r.possible}{r.percent != null && <small> {r.percent}%</small>}</> : '—'}</td>
                            <td>{r.tier || '—'}</td>
                            <td><code>{r.badge}</code></td>
                            <td className={r.ok ? 'ok' : 'bad'}>{r.status}</td>
                          </tr>
                          {open === r.id && (
                            <tr className="vf-detail">
                              <td colSpan={8}>
                                <div className="vf-detail-grid">
                                  <div>
                                    <p><strong>File:</strong> {r.file}</p>
                                    {r.payload && <p><strong>Started:</strong> {fmtDate(r.payload.started)} · <strong>Lesson version:</strong> {r.payload.lesson.version} · <strong>Kit:</strong> {r.payload.kit}</p>}
                                    {r.payload?.sections?.length > 0 && (
                                      <table className="syl-table"><thead><tr><th>Section</th><th>Result</th></tr></thead><tbody>
                                        {r.payload.sections.map((s, i) => <tr key={i}><td>{s.title}</td><td>{s.status != null ? s.status : `${s.earned}${s.possible != null ? ` / ${s.possible}` : ''}`}</td></tr>)}
                                      </tbody></table>
                                    )}
                                  </div>
                                  {r.payload && (
                                    <details>
                                      <summary>{r.payload.events.length} logged events · raw data</summary>
                                      <pre>{JSON.stringify({ extra: r.payload.extra, events: r.payload.events, env: r.payload.env }, null, 1)}</pre>
                                    </details>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
