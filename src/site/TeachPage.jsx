/**
 * /teach — the teacher's side of assignments and teams (api.hsct.tech).
 *
 *   Sign in (Django user, staff) →
 *   Assignments: post a lesson to a class (team size, due date), open/close it
 *   One assignment: the live board — every team, who's in and online, progress,
 *                   last activity, each member's action count; submissions with
 *                   "open on /lessons/verify"; per-team "who did what" log
 *   Lessons: upload a new lesson HTML (or a new version) into the catalog
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SiteNav from './SiteNav.jsx';
import SiteFooter from './SiteFooter.jsx';
import { useFonts } from './useFonts.js';
import { API_BASE, HAS_API, WS_BASE, api, fmtAgo, fmtDateTime, useAuth } from './api.js';
import { CATEGORIES, KINDS, allLessons, catalogSource, reloadCatalog } from './lessons.js';
import { fmtDuration } from './hsctVerify.js';
import './site.css';

const HANDOFF_KEY = 'hsct:verify-handoff';
const pct = (t) => (t.percent != null ? `${t.percent}%` : '—');

export default function TeachPage() {
  useFonts();
  useEffect(() => { document.title = 'Teach · HSCT TechHub'; }, []);
  const auth = useAuth();
  const [catalogTick, setCatalogTick] = useState(0);   // bumps after an upload changed the catalog
  const catalogChanged = async () => { await reloadCatalog(API_BASE); setCatalogTick((n) => n + 1); };
  const [view, setView] = useState(() => { const q = new URLSearchParams(location.search); return q.get('a') ? { kind: 'assignment', id: q.get('a') } : { kind: 'list' }; });

  const go = (v) => { setView(v); const u = new URL(location.href); if (v.kind === 'assignment') u.searchParams.set('a', v.id); else u.searchParams.delete('a'); history.replaceState(null, '', u); };

  return (
    <div className="site" id="top">
      <SiteNav />
      <main>
        <header className="r-hero">
          <p className="t-crumb"><a href="/">Home</a> / Teach</p>
          <h1>Teach</h1>
          <p className="t-bio">
            Post a lesson as an assignment, watch teams work on it live, and collect what they turn in.
            Students never sign in: they make a team with a code and their name inside the lesson.
          </p>
        </header>
        {!HAS_API ? (
          <section className="sec"><div className="sec-head"><h2>No backend configured</h2></div><p className="empty">Set <code>VITE_API_BASE</code> (Cloudflare Pages → Settings → Variables) to the API, e.g. <code>https://api.hsct.tech/api</code>, and redeploy. See <code>deploy/DEPLOY.md</code>.</p></section>
        ) : auth.loading ? (
          <section className="sec"><p className="empty">Checking your session…</p></section>
        ) : !auth.isTeacher ? (
          <Login auth={auth} />
        ) : view.kind === 'assignment' ? (
          <AssignmentView id={view.id} back={() => go({ kind: 'list' })} />
        ) : (
          <>
            <Assignments open={(id) => go({ kind: 'assignment', id })} catalogTick={catalogTick} />
            <LessonUpload onChanged={catalogChanged} />
            <section className="sec">
              <div className="sec-head"><h2>Account</h2></div>
              <div className="sync"><span>Signed in as <b>{auth.user.username}</b> · API {API_BASE} · catalog from {catalogSource()}</span><button type="button" onClick={auth.logout}>Sign out</button></div>
            </section>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

/* ── sign in ──────────────────────────────────────────────────────── */
function Login({ auth }) {
  const [u, setU] = useState(''); const [p, setP] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e) => { e.preventDefault(); setBusy(true); setErr(''); try { const me = await auth.login(u, p); if (!me.isTeacher) setErr('That account is not a teacher (staff) account.'); } catch (x) { setErr(x.message); } finally { setBusy(false); } };
  return (
    <section className="sec" id="login">
      <div className="sec-head"><h2>Sign in</h2><p className="sec-lead">Your Django login (made with <code>createsuperuser</code> on the server, or a staff user from /admin/).</p></div>
      <form className="tch-form" onSubmit={submit}>
        <label>Username<input value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" required /></label>
        <label>Password<input type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" required /></label>
        <div className="tch-row"><button className="btn btn-blue" disabled={busy}>Sign in</button>{err && <span className="vf-msg bad">{err}</span>}</div>
      </form>
    </section>
  );
}

/* ── assignments list + create ────────────────────────────────────── */
function Assignments({ open, catalogTick }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => api('/assignments/').then(setList).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const lessons = useMemo(() => allLessons().filter(({ lesson }) => lesson.file), [catalogTick]); // eslint-disable-line react-hooks/exhaustive-deps
  const [f, setF] = useState({ lesson: '', title: '', klass: '', group_mode: true, max_members: 4, due_at: '', instructions: '', show_leaderboard: true });
  useEffect(() => { if (!lessons.some((l) => l.lesson.slug === f.lesson)) setF((o) => ({ ...o, lesson: lessons[0]?.lesson.slug || '' })); }, [lessons]); // eslint-disable-line react-hooks/exhaustive-deps
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((o) => ({ ...o, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const create = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const body = { ...f, max_members: Number(f.max_members) || 1, due_at: f.due_at ? new Date(f.due_at).toISOString() : null };
      if (!body.title) body.title = lessons.find((l) => l.lesson.slug === f.lesson)?.lesson.title || 'Assignment';
      const a = await api('/assignments/', { method: 'POST', body });
      setF((o) => ({ ...o, title: '', due_at: '' }));
      await load();
      open(a.id);
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  const toggle = async (a) => { await api(`/assignments/${a.id}/`, { method: 'PATCH', body: { status: a.status === 'open' ? 'closed' : 'open' } }); load(); };
  const remove = async (a) => { if (!confirm(`Delete "${a.title}" and all its teams and submissions?`)) return; await api(`/assignments/${a.id}/`, { method: 'DELETE' }); load(); };

  return (
    <>
      <section className="sec" id="assignments">
        <div className="sec-head"><h2>Assignments</h2><p className="sec-lead">Open one to watch its teams live.</p></div>
        <div>
          {err && <p className="vf-msg bad">{err}</p>}
          {list === null ? <p className="empty">Loading…</p> : list.length === 0 ? <p className="empty">Nothing posted yet. Make one below.</p> : (
            <div className="vf-scroll"><table className="vf-table tch-table">
              <thead><tr><th>Assignment</th><th>Lesson</th><th>Class</th><th>Teams</th><th>Due</th><th>Status</th><th></th></tr></thead>
              <tbody>{list.map((a) => (
                <tr key={a.id} onClick={() => open(a.id)}>
                  <td><strong>{a.title}</strong><br /><small>{a.groupMode ? `teams of up to ${a.maxMembers}` : 'solo'} · {fmtDateTime(a.createdAt)}</small></td>
                  <td>{a.lessonTitle}</td><td>{a.klass || '—'}</td>
                  <td>{a.teams}{a.submitted ? <small> · {a.submitted} submitted</small> : null}</td>
                  <td>{a.dueAt ? fmtDateTime(a.dueAt) : '—'}</td>
                  <td><span className={`pill${a.isOpen ? '' : ' muted'}`}>{a.isOpen ? 'open' : a.status === 'closed' ? 'closed' : 'not open'}</span></td>
                  <td className="tch-actions" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="vf-copy" onClick={() => toggle(a)}>{a.status === 'open' ? 'Close' : 'Reopen'}</button>
                    <button type="button" className="vf-copy" onClick={() => remove(a)}>Delete</button>
                  </td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </div>
      </section>

      <section className="sec" id="new">
        <div className="sec-head"><h2>Post an assignment</h2><p className="sec-lead">Pick a lesson from the catalog. Students then see a "Work as a team" card on its first screen.</p></div>
        <form className="tch-form" onSubmit={create}>
          <label>Lesson
            <select value={f.lesson} onChange={set('lesson')}>
              {CATEGORIES.map((c) => <optgroup key={c.slug} label={c.title}>{c.topics.flatMap((t) => t.lessons.filter((l) => l.file).map((l) => <option key={l.slug} value={l.slug}>{l.title}</option>))}</optgroup>)}
            </select>
          </label>
          <label>Title <small>(defaults to the lesson's)</small><input value={f.title} onChange={set('title')} placeholder="Binary check — Period 3" maxLength={160} /></label>
          <label>Class<input value={f.klass} onChange={set('klass')} placeholder="Period 3" maxLength={80} /></label>
          <label>Due<input type="datetime-local" value={f.due_at} onChange={set('due_at')} /></label>
          <label className="tch-check"><input type="checkbox" checked={f.group_mode} onChange={set('group_mode')} /> Team assignment</label>
          <label>Team size<input type="number" min={1} max={12} value={f.max_members} onChange={set('max_members')} disabled={!f.group_mode} /></label>
          <label className="tch-check"><input type="checkbox" checked={f.show_leaderboard} onChange={set('show_leaderboard')} /> Students see the leaderboard</label>
          <label className="tch-wide">Instructions <small>(optional)</small><textarea rows={2} value={f.instructions} onChange={set('instructions')} /></label>
          <div className="tch-row tch-wide"><button className="btn btn-blue" disabled={busy || !f.lesson}>Post it</button></div>
        </form>
      </section>
    </>
  );
}

/* ── one assignment: live board ───────────────────────────────────── */
function useBoard(id) {
  const [board, setBoard] = useState(null);
  const [live, setLive] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    let ws, stop = false, tries = 0, timer;
    api(`/assignments/${id}/board/`).then(setBoard).catch((e) => setErr(e.message));
    const connect = () => {
      if (stop) return;
      try { ws = new WebSocket(`${WS_BASE}/assignment/${id}/`); } catch { return; }
      ws.onopen = () => { tries = 0; setLive(true); };
      ws.onmessage = (ev) => { try { const m = JSON.parse(ev.data); if (m.type === 'board') setBoard(m); } catch { /* ignore */ } };
      ws.onclose = () => { setLive(false); if (!stop) timer = setTimeout(connect, Math.min(15000, 1000 * 2 ** tries++)); };
    };
    connect();
    const poll = setInterval(() => { if (!live) api(`/assignments/${id}/board/`).then(setBoard).catch(() => {}); }, 15000);
    return () => { stop = true; clearTimeout(timer); clearInterval(poll); ws && ws.close(); };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  return { board, live, err };
}

function AssignmentView({ id, back }) {
  const { board, live, err } = useBoard(id);
  const [openTeam, setOpenTeam] = useState(null);
  const [subs, setSubs] = useState(null);
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 10000); return () => clearInterval(t); }, []);
  const loadSubs = useCallback(() => api(`/assignments/${id}/submissions/`).then(setSubs).catch(() => setSubs([])), [id]);
  useEffect(() => { loadSubs(); }, [loadSubs, board?.assignment?.submitted]);
  const a = board?.assignment;
  const link = a ? `${location.origin}/lessons/${a.course}/${a.lesson}` : '';

  const verifyAll = () => {
    if (!subs?.length) return;
    try { sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(subs.map((s) => ({ envelope: s.envelope, file: `${s.teamName || s.student} · ${s.badge}` })))); } catch { return alert('Could not hand the files over (storage blocked). Download them instead.'); }
    location.href = '/lessons/verify#files';
  };
  const closeTeam = async (t) => { if (!confirm(`Close team ${t.name} (${t.code})? They can't join or change anything after this.`)) return; await api(`/teams/${t.code}/close/`, { method: 'POST' }); };
  const deleteTeam = async (t) => { if (!confirm(`Remove team ${t.name} (${t.code}) and its log?`)) return; await api(`/teams/${t.code}/close/`, { method: 'DELETE' }); };

  return (
    <>
      <section className="sec" id="board">
        <div className="sec-head">
          <p className="t-crumb"><a href="/teach" onClick={(e) => { e.preventDefault(); back(); }}>Assignments</a> / {a ? a.title : '…'}</p>
          <h2>{a ? a.title : 'Loading…'}</h2>
          {a && <p className="sec-lead">{a.lessonTitle}{a.klass ? ` · ${a.klass}` : ''} · {a.groupMode ? `teams of up to ${a.maxMembers}` : 'solo'} · <span className={`pill${a.isOpen ? '' : ' muted'}`}>{a.isOpen ? 'open' : 'closed'}</span><br /><span className={`led led-green led-s${live ? ' on' : ''}`} aria-hidden="true" /> {live ? 'live' : 'reconnecting — polling'}{board && ` · ${fmtAgo(board.at)}`}</p>}
        </div>
        <div>
          {err && <p className="vf-msg bad">{err}</p>}
          {a && (
            <p className="tch-link">Students open <a href={link} target="_blank" rel="noreferrer">{link}</a>{' '}
              <button type="button" className="vf-copy" onClick={() => navigator.clipboard?.writeText(link)}>Copy link</button>
              {' '}— the team card is on the lesson's first screen. A link with <code>?team=CODE</code> lands them on the join card with the code filled in.
            </p>
          )}
          {board && board.teams.length === 0 && <p className="empty">No teams yet. They appear here the moment a student makes one.</p>}
          {board && board.teams.length > 0 && (
            <div className="tch-teams">
              {board.teams.slice().sort((x, y) => (y.percent || 0) - (x.percent || 0)).map((t) => (
                <article key={t.code} className={`tch-team is-${t.status}${openTeam === t.code ? ' is-open' : ''}`}>
                  <header>
                    <div><h3>{t.name} <code>{t.code}</code></h3><small>{t.status}{t.phase ? ` · ${t.phase}` : ''} · {t.online}/{t.members.filter((m) => !m.leftAt).length} online · {t.events} actions · {fmtDuration(t.elapsedSeconds)} · last {fmtAgo(t.lastActivity)}</small></div>
                    <div className="tch-pct"><b>{pct(t)}</b>{t.progress?.label && <small>{t.progress.label}</small>}</div>
                  </header>
                  <div className="tch-bar"><i style={{ width: `${t.percent || 0}%` }} /></div>
                  <ul className="tch-members">
                    {t.members.map((m) => (
                      <li key={m.id} className={`${m.online ? 'on' : ''}${m.leftAt ? ' left' : ''}`} title={`joined ${fmtDateTime(m.joinedAt)} · last seen ${fmtAgo(m.lastSeen)}${m.rejoins ? ` · rejoined ×${m.rejoins}` : ''}`}>
                        <i /> {m.name}{m.role && <small> {m.role}</small>}<em>{m.events} actions · {fmtDuration(m.activeSeconds)} active</em>
                      </li>
                    ))}
                  </ul>
                  <div className="tch-row">
                    <button type="button" className="vf-copy" onClick={() => setOpenTeam(openTeam === t.code ? null : t.code)}>{openTeam === t.code ? 'Hide log' : 'Who did what'}</button>
                    {t.status !== 'closed' && <button type="button" className="vf-copy" onClick={() => closeTeam(t)}>Close team</button>}
                    <button type="button" className="vf-copy" onClick={() => deleteTeam(t)}>Remove</button>
                  </div>
                  {openTeam === t.code && <TeamLog code={t.code} tick={tick} />}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="sec" id="submissions">
        <div className="sec-head"><h2>Submissions</h2><p className="sec-lead">What teams turned in. The files are encrypted; open them on the verify page with your key.</p></div>
        <div>
          {subs === null ? <p className="empty">Loading…</p> : subs.length === 0 ? <p className="empty">Nothing turned in yet.</p> : (
            <>
              <div className="vf-toolbar"><span>{subs.length} file{subs.length === 1 ? '' : 's'}</span><button type="button" className="btn btn-blue" onClick={verifyAll}>Open all on /lessons/verify</button></div>
              <div className="vf-scroll"><table className="vf-table tch-table">
                <thead><tr><th>Team</th><th>Turned in by</th><th>When</th><th>Reported score</th><th>Code</th><th></th></tr></thead>
                <tbody>{subs.map((s) => (
                  <tr key={s.id}>
                    <td>{s.teamName || '—'}{s.team && <small> {s.team}</small>}</td><td>{s.by || s.student}</td><td>{fmtDateTime(s.createdAt)}</td>
                    <td>{s.summary?.possible ? <>{s.summary.earned} / {s.summary.possible}{s.summary.tier ? <small> {s.summary.tier}</small> : null}</> : '—'}<br /><small>unverified until opened</small></td>
                    <td><code>{s.badge}</code></td>
                    <td onClick={(e) => e.stopPropagation()}><button type="button" className="vf-copy" onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(s.envelope)], { type: 'application/json' })); a.download = `HSCT_${s.envelope.lesson}_TEAM-${(s.teamName || s.student).replace(/[^A-Za-z0-9]+/g, '-')}_${s.badge}.hsct`; a.click(); }}>Download</button></td>
                  </tr>
                ))}</tbody>
              </table></div>
            </>
          )}
        </div>
      </section>
    </>
  );
}

/** Per-member timeline for one team — every HSCT.log call, who, when. */
export function TeamLog({ code, tick = 0, compact = false }) {
  const [log, setLog] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api(`/teams/${code}/log/`).then(setLog).catch((e) => setErr(e.message)); }, [code, tick]);
  if (err) return <p className="vf-msg bad">{err}</p>;
  if (!log) return <p className="vf-msg">Loading the log…</p>;
  const byMember = {};
  log.events.forEach((e) => { const k = e.member || '—'; byMember[k] = (byMember[k] || 0) + 1; });
  const t0 = log.team.startedAt ? new Date(log.team.startedAt).getTime() : null;
  return (
    <div className="tch-log">
      <p className="tch-log-sum">{Object.entries(byMember).map(([n, c]) => <span key={n} className="pill">{n}: {c}</span>)}</p>
      <div className={`vf-scroll${compact ? ' tch-log-compact' : ''}`}>
        <table className="syl-table tch-log-table">
          <thead><tr><th>Clock</th><th>Who</th><th>Did</th><th>Details</th><th>Server time</th></tr></thead>
          <tbody>{log.events.map((e) => (
            <tr key={e.id} className={`ev-${e.kind}`}>
              <td>{t0 ? fmtDuration(Math.max(0, (new Date(e.at).getTime() - t0) / 1000)) : fmtDuration(e.t)}</td>
              <td>{e.member || '—'}</td><td><b>{e.kind}</b></td>
              <td>{e.data && typeof e.data === 'object' ? Object.entries(e.data).filter(([, v]) => v == null || typeof v !== 'object').map(([k, v]) => `${k}: ${v}`).join(' · ') : ''}</td>
              <td><small>{fmtDateTime(e.at)}</small></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

/* ── lesson upload ────────────────────────────────────────────────── */
function LessonUpload({ onChanged }) {
  const [f, setF] = useState({ course: CATEGORIES[0]?.slug || '', topic: CATEGORIES[0]?.topics[0]?.id || '', topic_title: '', slug: '', title: '', description: '', kind: 'lab', minutes: '', tags: '', version: '', published: true });
  const [newTopic, setNewTopic] = useState(false);
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState(''); const [bad, setBad] = useState(false); const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const course = CATEGORIES.find((c) => c.slug === f.course);
  const set = (k) => (e) => setF((o) => ({ ...o, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const onFile = async (e) => {
    const fl = e.target.files?.[0]; setFile(fl || null);
    if (!fl) return;
    // read HSCT.lesson({ id, title, version, course }) out of the file to prefill the form
    const text = await fl.text();
    // the real call has an id: (the kit's own comments mention HSCT.lesson({...}) too)
    const m = [...text.matchAll(/HSCT\.lesson\(\s*\{([^}]*)\}/g)].find((x) => /\bid\s*:\s*'/.test(x[1]));
    if (m) {
      const get = (k) => (m[1].match(new RegExp(`${k}\\s*:\\s*'([^']*)'`)) || [])[1];
      setF((o) => ({ ...o, slug: get('id') || o.slug, title: get('title') || o.title, version: get('version') || o.version, course: CATEGORIES.some((c) => c.slug === get('course')) ? get('course') : o.course }));
    } else if (!f.slug) setF((o) => ({ ...o, slug: fl.name.replace(/\.html?$/i, '') }));
  };
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(''); setBad(false);
    try {
      const form = new FormData();
      Object.entries(f).forEach(([k, v]) => { if (v !== '' && v !== null) form.append(k, v); });
      if (newTopic) { form.set('topic', f.topic_title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')); }
      if (file) form.append('file', file);
      const r = await api('/lessons/upload/', { method: 'POST', form });
      setMsg(`${r.created ? 'Added' : 'Updated'} ${r.lesson.title} → ${r.lesson.file}`);
      if (onChanged) await onChanged();
      setFile(null); if (fileRef.current) fileRef.current.value = '';
    } catch (x) { setMsg(x.message); setBad(true); } finally { setBusy(false); }
  };
  return (
    <section className="sec" id="upload">
      <div className="sec-head"><h2>Add or update a lesson</h2><p className="sec-lead">Upload the lesson's HTML (built from <code>lesson-template/</code>). It goes to storage and into the catalog — no deploy. Picking a file prefills the fields from its <code>HSCT.lesson({'{…}'})</code> call.</p></div>
      <form className="tch-form" onSubmit={submit}>
        <label className="tch-wide">Lesson file (.html)<input ref={fileRef} type="file" accept=".html,text/html" onChange={onFile} /></label>
        <label>Course<select value={f.course} onChange={(e) => { const c = CATEGORIES.find((x) => x.slug === e.target.value); setF((o) => ({ ...o, course: e.target.value, topic: c?.topics[0]?.id || '' })); }}>{CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.title}</option>)}</select></label>
        <label>Topic{newTopic
          ? <input value={f.topic_title} onChange={set('topic_title')} placeholder="New topic title" required />
          : <select value={f.topic} onChange={set('topic')}>{(course?.topics || []).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select>}
          <small><button type="button" className="vf-copy" onClick={() => setNewTopic((v) => !v)}>{newTopic ? 'pick an existing topic' : 'new topic'}</button></small>
        </label>
        <label>Slug <small>(= the lesson's id)</small><input value={f.slug} onChange={set('slug')} pattern="[a-z0-9\\-]+" required /></label>
        <label>Title<input value={f.title} onChange={set('title')} required maxLength={160} /></label>
        <label>Kind<select value={f.kind} onChange={set('kind')}>{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
        <label>Minutes<input type="number" min={1} max={600} value={f.minutes} onChange={set('minutes')} /></label>
        <label>Version<input value={f.version} onChange={set('version')} placeholder="1.0" /></label>
        <label className="tch-check"><input type="checkbox" checked={f.published} onChange={set('published')} /> Published (students can see it)</label>
        <label className="tch-wide">Description<textarea rows={3} value={f.description} onChange={set('description')} /></label>
        <label className="tch-wide">Tags <small>(comma separated — the search uses them)</small><input value={f.tags} onChange={set('tags')} placeholder="packets, router, DNS" /></label>
        <div className="tch-row tch-wide"><button className="btn btn-blue" disabled={busy || !f.slug || !f.title}>{busy ? 'Uploading…' : 'Upload'}</button>{msg && <span className={`vf-msg${bad ? ' bad' : ' ok'}`}>{msg}</span>}</div>
      </form>
    </section>
  );
}
