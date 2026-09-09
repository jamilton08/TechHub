import { useEffect } from 'react';
import SiteNav from './SiteNav.jsx';
import SiteFooter from './SiteFooter.jsx';
import { getPage, PAGES } from './pages.js';
import { useFonts } from './useFonts.js';
import './site.css';

export default function ResourcePage({ slug }) {
  useFonts();
  const page = getPage(slug);
  useEffect(() => { document.title = page ? `${page.title} · HSCT TechHub` : 'Not found · HSCT TechHub'; }, [page]);

  if (!page) {
    return (
      <div className="site"><SiteNav />
        <main className="page"><h1>Nothing at that address.</h1><p><a href="/">Back home</a></p></main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="site" id="top">
      <SiteNav />
      <main>
        <header className="r-hero">
          <p className="t-crumb"><a href="/">Home</a> / Resources / {page.title}</p>
          <h1>{page.title}</h1>
          <p className="t-bio">{page.intro}</p>
        </header>
        {page.sections.map((sec) => (
          <section className="sec" id={sec.id} key={sec.id}>
            <div className="sec-head"><h2>{sec.title}</h2></div>
            <ul className="res-list">
              {sec.items.map((it) => (
                <li key={it.title} className={`res${it.href ? '' : ' is-soon'}`}>
                  <div>
                    <h3>{it.href ? <a href={it.href} target={/^https?:/.test(it.href) ? '_blank' : undefined} rel="noreferrer">{it.title}</a> : it.title}</h3>
                    <p>{it.description}</p>
                  </div>
                  {it.href ? <a className="btn btn-blue" href={it.href} target={/^https?:/.test(it.href) ? '_blank' : undefined} rel="noreferrer">Open</a> : <span className="pill muted">Link coming soon</span>}
                </li>
              ))}
            </ul>
          </section>
        ))}
        <section className="sec">
          <div className="sec-head"><h2>More resources</h2></div>
          <ul className="t-others">
            {Object.entries(PAGES).filter(([s]) => s !== slug).map(([s, p]) => (
              <li key={s}><a href={`/pages/${s}`}><strong>{p.title}</strong><span>{p.intro}</span></a></li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
