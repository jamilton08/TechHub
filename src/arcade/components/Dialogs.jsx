import { useEffect, useRef, useState } from 'react';
import { EXAMPLES } from '../examples/index.js';
import { canShareByLink, encodeShare, shareUrl } from '../lib/share.js';

/* ── modal shell (native <dialog>: focus trap + Esc for free) ───────── */
export function Modal({ title, onClose, children, wide, footer }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    const onCancel = (e) => { e.preventDefault(); onClose(); };
    d?.addEventListener('cancel', onCancel);
    return () => d?.removeEventListener('cancel', onCancel);
  }, [onClose]);
  return (
    <dialog ref={ref} className={`arc-dialog${wide ? ' is-wide' : ''}`} aria-label={title}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      <div className="arc-dialog-inner">
        <header>
          <h2>{title}</h2>
          <button type="button" className="arc-x" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="arc-dialog-body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </dialog>
  );
}

const ago = (iso) => {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString();
};

/* ── My projects ─────────────────────────────────────────────────────── */
export function ProjectsDialog({ list, currentId, where, localCount, onOpen, onNew, onExamples, onDuplicate, onDelete, onMoveLocal, onClose, moving }) {
  return (
    <Modal title="My projects" onClose={onClose} wide
      footer={(
        <>
          <button type="button" className="btn btn-blue" onClick={onNew}>New game</button>
          <button type="button" className="btn btn-ghost" onClick={onExamples}>Start from an example</button>
        </>
      )}>
      <p className="arc-dialog-note">
        {where === 'account'
          ? 'Saved to your account — open them from any computer.'
          : 'Saved in this browser on this computer. Use Download (.zip) to keep a copy somewhere else.'}
      </p>
      {where === 'account' && localCount > 0 && (
        <div className="arc-banner">
          <span>{localCount} project{localCount === 1 ? ' is' : 's are'} saved only in this browser.</span>
          <button type="button" className="btn btn-blue" onClick={onMoveLocal} disabled={Boolean(moving)}>
            {moving ? `Moving… ${moving}` : 'Move them to my account'}
          </button>
        </div>
      )}
      {list === null ? <p>Loading…</p> : list.length === 0 ? <p>No projects yet.</p> : (
        <ul className="arc-projects">
          {list.map((p) => (
            <li key={p.id} className={p.id === currentId ? 'is-current' : ''}>
              <button type="button" className="arc-project-open" onClick={() => onOpen(p.id)}>
                <strong>{p.title || 'Untitled'}</strong>
                <span>{p.id === currentId ? 'Open now · ' : ''}edited {ago(p.updatedAt)}{p.fileCount ? ` · ${p.fileCount} file${p.fileCount === 1 ? '' : 's'}` : ''}</span>
              </button>
              <div className="arc-project-actions">
                <button type="button" className="arc-chip" onClick={() => onDuplicate(p.id)}>Duplicate</button>
                <button type="button" className="arc-chip danger" onClick={() => onDelete(p.id, p.title)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/* ── Examples ────────────────────────────────────────────────────────── */
export function ExamplesDialog({ onPick, onClose }) {
  return (
    <Modal title="Start from an example" onClose={onClose} wide>
      <p className="arc-dialog-note">Each one opens as a new project of your own — change anything.</p>
      <ul className="arc-examples">
        {EXAMPLES.map((ex) => (
          <li key={ex.id}>
            <button type="button" onClick={() => onPick(ex)}>
              <span className="arc-example-top"><span className="pill">{ex.level}</span><small>{ex.uses}</small></span>
              <strong>{ex.title}</strong>
              <span>{ex.blurb}</span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

/* ── Share ───────────────────────────────────────────────────────────── */
export function ShareDialog({ project, where, onVisibility, onCopy, onDownload, onClose }) {
  const [link, setLink] = useState('');
  const [problem, setProblem] = useState('');
  const account = where === 'account';

  useEffect(() => {
    let alive = true;
    if (account) {
      setLink(project.visibility && project.visibility !== 'private' ? `${location.origin}/play/${project.id}` : '');
      return undefined;
    }
    if (!canShareByLink()) { setProblem('This browser can’t make share links. Use Download instead.'); return undefined; }
    encodeShare(project).then((t) => alive && setLink(shareUrl(t))).catch(() => alive && setProblem('Could not make a link.'));
    return () => { alive = false; };
  }, [project, account]);

  return (
    <Modal title="Share this game" onClose={onClose}>
      {account ? (
        <>
          <fieldset className="arc-visibility">
            <legend>Who can open it</legend>
            {[
              ['private', 'Only me', 'Nobody else can see it.'],
              ['unlisted', 'Anyone with the link', 'Classmates can play it and remix their own copy.'],
            ].map(([value, label, note]) => (
              <label key={value}>
                <input type="radio" name="vis" checked={(project.visibility || 'private') === value} onChange={() => onVisibility(value)} />
                <span><strong>{label}</strong><small>{note}</small></span>
              </label>
            ))}
          </fieldset>
          {link && <LinkBox link={link} onCopy={onCopy} />}
        </>
      ) : (
        <>
          <p>Anyone who opens this link gets their <strong>own copy</strong> of your code to run and change. Your project here stays yours.</p>
          {problem ? <p className="arc-warn">{problem}</p> : link ? <LinkBox link={link} onCopy={onCopy} /> : <p>Making the link…</p>}
          {project.assets.length > 0 && (
            <p className="arc-warn">Images and sounds don’t fit in a link. To share those too, use <button type="button" className="arc-linklike" onClick={onDownload}>Download (.zip)</button> and send the file.</p>
          )}
          {link.length > 6000 && <p className="arc-warn">This link is very long, so some apps may cut it off. Download (.zip) is safer for big projects.</p>}
          <p className="arc-dialog-note">Links change when your code changes — share again after edits.</p>
        </>
      )}
    </Modal>
  );
}

function LinkBox({ link, onCopy }) {
  return (
    <div className="arc-linkbox">
      <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Share link" />
      <button type="button" className="btn btn-blue" onClick={() => onCopy(link)}>Copy link</button>
    </div>
  );
}

/* ── Help ────────────────────────────────────────────────────────────── */
export function HelpDialog({ onClose, python }) {
  return (
    <Modal title="Python Arcade help" onClose={onClose} wide>
      <div className="arc-help">
        <section>
          <h3>Running</h3>
          <ul>
            <li><kbd>Run</kbd> (or <kbd>Ctrl</kbd>+<kbd>Enter</kbd>) starts <strong>main.py</strong> — the file marked ▶. <kbd>Stop</kbd> ends it.</li>
            <li>Click the game screen before using the keyboard in a game.</li>
            <li><code>print()</code> and <code>input()</code> use the console under the screen.</li>
            <li>Errors show the line, what Python said, and what it usually means. Click the line to jump to it.</li>
          </ul>
        </section>
        <section>
          <h3>Files</h3>
          <ul>
            <li><kbd>+ File</kbd> adds another .py file — <code>import helper</code> loads <strong>helper.py</strong>. Double-click a tab to rename it.</li>
            <li><strong>Assets</strong> holds images, sounds and fonts. Load them by name: <code>pygame.image.load("ship.png")</code>.</li>
            <li>Files your program writes (like a save file or high score) appear as new tabs after it ends.</li>
          </ul>
        </section>
        <section>
          <h3>What works</h3>
          <p>Real Python{python ? ` ${python}` : ''} with its standard library (random, math, time, json…), plus pygame:</p>
          <ul className="arc-help-api">
            <li><code>display</code> set_mode, flip, update, set_caption</li>
            <li><code>draw</code> rect, circle, ellipse, line, lines, polygon, arc</li>
            <li><code>Surface</code> fill, blit, get_rect, set_colorkey, set_alpha, convert_alpha</li>
            <li><code>Rect</code> everything — move, colliderect, collidepoint, clamp, center…</li>
            <li><code>event</code> get, wait, post, custom_type · <code>key</code> get_pressed, name</li>
            <li><code>mouse</code> get_pos, get_pressed, set_visible</li>
            <li><code>time</code> Clock, tick, get_ticks, set_timer</li>
            <li><code>font</code> SysFont, Font, render · <code>image</code> load</li>
            <li><code>transform</code> scale, rotate, flip, rotozoom</li>
            <li><code>mixer</code> Sound, music · <code>sprite</code> Sprite, Group, spritecollide</li>
            <li><code>math</code> Vector2 · <code>mask</code> pixel-perfect collisions</li>
          </ul>
          <p>Not here: tkinter and turtle (they need desktop windows), joysticks, and saving images. Games written with <code>async</code>/<code>await</code> loops won’t run — use the normal loop.</p>
        </section>
        <section>
          <h3>Saving</h3>
          <p>Your work saves as you type. Use <strong>Download (.zip)</strong> to keep a copy or hand it in.</p>
        </section>
        <section>
          <h3>Running it at home</h3>
          <ol>
            <li>Install Python from python.org.</li>
            <li>In a terminal: <code>pip install pygame-ce</code></li>
            <li>Unzip your project and run: <code>python main.py</code></li>
          </ol>
          <p>The same code works — the Arcade speaks pygame.</p>
        </section>
      </div>
    </Modal>
  );
}
