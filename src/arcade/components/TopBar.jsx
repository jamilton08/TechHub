import { useEffect, useRef, useState } from 'react';

const SAVE_TEXT = {
  saved: { browser: 'Saved in this browser', account: 'Saved to your account' },
  saving: { browser: 'Saving…', account: 'Saving…' },
  unsaved: { browser: 'Editing…', account: 'Editing…' },
  error: { browser: 'Couldn’t save', account: 'Couldn’t save — retrying' },
  conflict: { browser: 'Changed elsewhere', account: 'Changed in another tab or computer' },
  readonly: { browser: 'Not your project — remix to save', account: 'Not your project — remix to save' },
};

export default function TopBar({
  project, where, saveState, running, runnerReady, onRun, onStop, onTitle,
  onMenu, canSignIn, signInHref, onDownload,
}) {
  const [dl, setDl] = useState(false);
  const dlRef = useRef(null);
  useEffect(() => {
    if (!dl) return undefined;
    const close = (e) => { if (!dlRef.current?.contains(e.target)) setDl(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [dl]);

  return (
    <header className="arc-bar">
      <a className="site-brand arc-brand" href="/" title="HSCT TechHub home">
        <img src="/hsct-logo.png" alt="HSCT shield" width="30" height="34" />
        <span><strong>Python</strong> Arcade</span>
      </a>

      <div className="arc-title">
        {project && (
          <input
            className="arc-title-input"
            value={project.title}
            onChange={(e) => onTitle(e.target.value)}
            aria-label="Project name"
            maxLength={80}
            spellCheck="false"
          />
        )}
        <span className={`arc-save save-${saveState}`} role="status">{project ? (SAVE_TEXT[saveState]?.[where] || '') : ''}</span>
      </div>

      <div className="arc-run-controls">
        <button type="button" className="btn arc-btn-run" onClick={onRun} disabled={!project}
          title="Run main.py (Ctrl+Enter)" aria-keyshortcuts="Control+Enter">
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2 1.5v9l8-4.5z" fill="currentColor" /></svg>
          {running ? 'Restart' : 'Run'}
        </button>
        <button type="button" className="btn arc-btn-stop" onClick={onStop} disabled={!running}>
          <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><rect x="2" y="2" width="8" height="8" fill="currentColor" /></svg>
          Stop
        </button>
      </div>

      <nav className="arc-actions" aria-label="Project">
        <button type="button" onClick={() => onMenu('projects')}>My projects</button>
        <button type="button" onClick={() => onMenu('examples')}>Examples</button>
        <button type="button" onClick={() => onMenu('share')} disabled={!project}>Share</button>
        <div className="arc-dd" ref={dlRef}>
          <button type="button" aria-haspopup="menu" aria-expanded={dl} onClick={() => setDl(!dl)} disabled={!project}>Download</button>
          {dl && (
            <div className="arc-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => { setDl(false); onDownload('zip'); }}>Whole project (.zip)</button>
              <button type="button" role="menuitem" onClick={() => { setDl(false); onDownload('file'); }}>Just this file</button>
            </div>
          )}
        </div>
        <button type="button" onClick={() => onMenu('help')}>Help</button>
        {canSignIn && <a className="arc-signin" href={signInHref}>Sign in</a>}
      </nav>
    </header>
  );
}
