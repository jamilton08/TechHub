import { useEffect, useState } from 'react';
import SiteNav from './SiteNav.jsx';
import SiteFooter from './SiteFooter.jsx';
import { getTeacher, DEFAULT_CONTRACT, TEACHERS } from './teachers.js';
import { useFonts } from './useFonts.js';
import './site.css';

const TABS = [['contract', 'Class contract'], ['syllabus', 'Syllabus'], ['classes', 'Classes']];

export default function TeacherPage({ slug }) {
  useFonts();
  const t = getTeacher(slug);
  const [openClass, setOpenClass] = useState(t?.classes[0]?.id || null);

  useEffect(() => { document.title = t ? `${t.name} · HSCT TechHub` : 'Not found · HSCT TechHub'; }, [t]);

  if (!t) {
    return (
      <div className="site"><SiteNav />
        <main className="page"><h1>No teacher at that address.</h1><p><a href="/#team">Back to the team</a></p></main>
        <SiteFooter />
      </div>
    );
  }

  const contract = t.contract || DEFAULT_CONTRACT;
  const initials = t.name.split(' ').map((w) => w[0]).join('');

  return (
    <div className="site" id="top">
      <SiteNav />
      <main>
        <header className={`t-hero tone-${t.tone}`}>
          <div className="t-hero-inner">
            <div className="member-mark" aria-hidden="true">{initials}</div>
            <div>
              <p className="t-crumb"><a href="/#team">Team</a> / {t.name}</p>
              <h1>{t.name}</h1>
              <p className="t-role">{t.role}</p>
              <p className="t-bio">{t.bio}</p>
              {t.email && <p><a href={`mailto:${t.email}`}>{t.email}</a></p>}
            </div>
          </div>
          <nav className="t-tabs" aria-label="Sections">
            {TABS.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
          </nav>
        </header>

        <section className="sec" id="contract">
          <div className="sec-head"><h2>Class contract</h2><p className="sec-lead">What we agree to, both directions. Same for every class in the department unless a teacher says otherwise.</p></div>
          <ol className="contract">
            {contract.map((c, i) => (
              <li key={i}><div><h3>{c.title}</h3><p>{c.text}</p></div></li>
            ))}
          </ol>
        </section>

        <section className="sec" id="syllabus">
          <div className="sec-head"><h2>Syllabus</h2><p className="sec-lead">Unit by unit, per class.</p></div>
          <div>
            {t.classes.length === 0 && <Empty what="syllabus" />}
            {t.classes.map((c) => (
              <details key={c.id} className="syl" open={openClass === c.id} onToggle={(e) => e.target.open && setOpenClass(c.id)}>
                <summary><span>{c.name}</span><small>{c.grades && `Grades ${c.grades}`}</small></summary>
                {c.syllabus.length === 0 ? (
                  <p className="empty">Syllabus coming soon.</p>
                ) : (
                  <table className="syl-table">
                    <thead><tr><th>Unit</th><th>Weeks</th><th>Topics</th></tr></thead>
                    <tbody>
                      {c.syllabus.map((u, i) => <tr key={i}><td>{u.unit}</td><td>{u.weeks}</td><td>{u.topics}</td></tr>)}
                    </tbody>
                  </table>
                )}
              </details>
            ))}
          </div>
        </section>

        <section className="sec" id="classes">
          <div className="sec-head">
            <h2>Classes</h2>
            <p className="sec-lead">This list will sync from Google Classroom. Until then it's maintained by hand.</p>
          </div>
          <div>
            {t.classes.length === 0 ? <Empty what="class list" /> : (
              <ul className="classes">
                {t.classes.map((c) => (
                  <li key={c.id} className={`klass tone-${t.tone}`}>
                    <div className="klass-top">
                      <h3>{c.name}</h3>
                      {c.period && <span className="pill">Period {c.period}</span>}
                      {c.grades && <span className="pill">Grades {c.grades}</span>}
                    </div>
                    <p>{c.description}</p>
                    <div className="klass-actions">
                      <a href="#syllabus" onClick={() => setOpenClass(c.id)}>View syllabus</a>
                      {c.classroomCode
                        ? <span className="pill">Classroom code: <code>{c.classroomCode}</code></span>
                        : <span className="pill muted">Classroom code coming soon</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="sync">
              <button type="button" disabled>Sync with Google Classroom</button>
              <span>Coming soon — classes, rosters, and posted work will pull in automatically.</span>
            </div>
          </div>
        </section>

        <section className="sec">
          <div className="sec-head"><h2>Other teachers</h2></div>
          <ul className="t-others">
            {TEACHERS.filter((o) => o.slug !== t.slug).map((o) => (
              <li key={o.slug}><a href={`/teachers/${o.slug}`}><strong>{o.name}</strong><span>{o.role}</span></a></li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function Empty({ what }) {
  return <p className="empty">No {what} posted yet. Check back at the start of the term.</p>;
}
