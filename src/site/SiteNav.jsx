import { useEffect, useRef, useState } from 'react';
import { NAV } from './navData.js';

/**
 * Sticky navbar with mega-menu dropdowns (entry → groups → items).
 * Desktop: hover/click opens a panel under the bar. Mobile: the burger
 * opens a drawer where each dropdown is an accordion.
 */
export default function SiteNav() {
  const [open, setOpen] = useState(null);   // index of the open dropdown
  const [drawer, setDrawer] = useState(false);
  const [flip, setFlip] = useState(false);
  const ref = useRef(null);

  // Keep the open panel on screen: if it would run off the right edge, anchor it right.
  useEffect(() => {
    if (open === null) return;
    const panel = ref.current?.querySelector('.nav-dd.is-open .nav-panel');
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    setFlip(r.right > window.innerWidth - 8);
  }, [open]);

  useEffect(() => {
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(null); };
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(null); setDrawer(false); } };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, []);

  return (
    <header className={`site-nav${drawer ? ' drawer-open' : ''}`} ref={ref}>
      <a className="site-brand" href="/">
        <img src="/hsct-logo.png" alt="HSCT shield" width="34" height="38" />
        <span><strong>HSCT</strong> TechHub</span>
      </a>

      <button type="button" className="site-burger" aria-expanded={drawer} aria-label="Menu" onClick={() => setDrawer((d) => !d)}>
        <span /><span /><span />
      </button>

      <nav className="site-links" aria-label="Site">
        {NAV.map((entry, i) => entry.groups ? (
          <div key={entry.label} className={`nav-dd${open === i ? ' is-open' : ''}${open === i && flip ? ' flip' : ''}`}>
            <button
              type="button"
              aria-expanded={open === i}
              onClick={() => { setFlip(false); setOpen(open === i ? null : i); }}
              onMouseEnter={() => { if (open !== null && open !== i && window.matchMedia('(hover: hover)').matches) { setFlip(false); setOpen(i); } }}
            >
              {entry.label}
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
            </button>
            <div className="nav-panel" role="group" aria-label={entry.label}>
              {entry.groups.map((g) => (
                <div key={g.label} className="nav-group">
                  {g.href ? <a className="nav-group-title" href={g.href} onClick={() => setOpen(null)}>{g.label}</a> : <div className="nav-group-title">{g.label}</div>}
                  {g.search && (
                    <form className="nav-search" action={g.search.action} method="get" role="search">
                      <input type="search" name="q" placeholder={g.search.placeholder} aria-label={g.search.placeholder} autoComplete="off" />
                      <button type="submit">Go</button>
                    </form>
                  )}
                  <ul>
                    {g.items.map((it) => (
                      <li key={it.label}>
                        {it.href && !it.soon ? (
                          <a href={it.href} onClick={() => { setOpen(null); setDrawer(false); }}>
                            {it.label}{it.sub && <small>{it.sub}</small>}
                          </a>
                        ) : it.href ? (
                          <a href={it.href} className="is-soon" onClick={() => { setOpen(null); setDrawer(false); }}>
                            {it.label}<small>coming soon</small>
                          </a>
                        ) : (
                          <span className="is-soon">{it.label}<small>coming soon</small></span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <a key={entry.label} href={entry.href} onClick={() => setDrawer(false)}>{entry.label}</a>
        ))}
        <a className="site-cta" href="/studio">Open Jonathan's Studio</a>
      </nav>
    </header>
  );
}
