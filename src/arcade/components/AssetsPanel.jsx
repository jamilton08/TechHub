import { useRef, useState } from 'react';
import { ACCEPT_UPLOADS, LIMITS, kindOf } from '../store/model.js';

const SNIPPET = {
  image: (n) => `pygame.image.load("${n}").convert_alpha()`,
  sound: (n) => `pygame.mixer.Sound("${n}")`,
  font: (n) => `pygame.font.Font("${n}", 32)`,
};

const size = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Images, sounds and fonts for the project, plus the upload drop zone. */
export default function AssetsPanel({ project, previews, onUpload, onDelete, onCopy, readOnly, busy }) {
  const input = useRef(null);
  const [over, setOver] = useState(false);
  const total = project.assets.reduce((n, a) => n + (a.size || 0), 0);

  const drop = (e) => {
    e.preventDefault();
    setOver(false);
    if (!readOnly && e.dataTransfer?.files?.length) onUpload(e.dataTransfer.files);
  };

  return (
    <div className="arc-assets" onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}>
      {!readOnly && (
        <button type="button" className={`arc-drop${over ? ' is-over' : ''}`} onClick={() => input.current?.click()} disabled={busy}>
          <strong>{busy ? 'Uploading…' : 'Add images, sounds or fonts'}</strong>
          <span>Drop files here or click to choose. PNG, JPG, GIF · WAV, MP3, OGG · TTF. Up to {LIMITS.assetBytes / 1024 / 1024} MB each.</span>
          <span>.py and .txt files you drop become code files.</span>
          <input ref={input} type="file" multiple accept={ACCEPT_UPLOADS} hidden
            onChange={(e) => { if (e.target.files.length) onUpload(e.target.files); e.target.value = ''; }} />
        </button>
      )}
      {project.assets.length === 0 ? (
        <p className="arc-assets-empty">No assets yet. Your code finds them by name — <code>pygame.image.load("ship.png")</code> loads a file called ship.png from here.</p>
      ) : (
        <>
          <ul className="arc-asset-grid">
            {project.assets.map((a) => {
              const kind = kindOf(a.name);
              return (
                <li key={a.name} className="arc-asset">
                  <div className={`arc-asset-preview kind-${kind}`}>
                    {kind === 'image' && previews[a.name] && <img src={previews[a.name]} alt="" />}
                    {kind === 'sound' && previews[a.name] && <audio controls preload="none" src={previews[a.name]} />}
                    {kind === 'font' && <span aria-hidden="true">Aa</span>}
                  </div>
                  <div className="arc-asset-meta">
                    <strong title={a.name}>{a.name}</strong>
                    <span>{size(a.size || 0)}</span>
                  </div>
                  <code className="arc-asset-code">{SNIPPET[kind]?.(a.name)}</code>
                  <div className="arc-asset-actions">
                    <button type="button" className="arc-chip" onClick={() => onCopy(SNIPPET[kind]?.(a.name) || a.name)}>Copy code</button>
                    {!readOnly && <button type="button" className="arc-chip danger" onClick={() => onDelete(a.name)}>Delete</button>}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="arc-assets-total">{project.assets.length} files · {size(total)} of {LIMITS.projectAssetBytes / 1024 / 1024} MB</p>
        </>
      )}
    </div>
  );
}
