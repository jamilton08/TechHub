import { useEffect, useState } from 'react';
import CircuitBg from './CircuitBg.jsx';
import Widgets from './Widgets.jsx';
import './site.css';

const NAV = [
  ['#widgets', 'Widgets'],
  ['#team', 'Team'],
  ['#mission', 'Mission'],
  ['#projects', 'Projects'],
];

const TEAM = [
  {
    name: 'Herman Cordero',
    role: 'Team lead',
    blurb: 'Leads the department. Ten years as an IT industry specialist before bringing that experience into the classroom.',
    tone: 'maroon',
  },
  {
    name: 'Jonathan Cruz',
    role: 'Deep technical projects · Data',
    blurb: 'Manages the department\'s deep technical projects. Works on motion as input — cameras and wearables as controllers — and is the team\'s data expert.',
    tone: 'blue',
  },
  {
    name: 'Julian Ocansey',
    role: 'Software developer',
    blurb: 'Builds the software side of what the department ships and teaches students to do the same.',
    tone: 'maroon',
  },
  {
    name: 'John Garces',
    role: 'Technician',
    blurb: 'Keeps the hardware, networks, and labs running so everything else can.',
    tone: 'blue',
  },
];

const PROJECTS = [
  {
    title: "Jonathan's Studio",
    owner: 'Jonathan Cruz',
    status: 'Live',
    href: '/studio',
    tone: 'split',
    summary:
      'A presentation studio built for the classroom. Drag blocks onto a slide, pick a theme, and present with everything reveal.js can do — fragments, code stepping, speaker notes, PDF export.',
    vision:
      'Next: live polls and charts inside the slides, so students answer from their phones while the lesson runs and the results land on the board in real time.',
    why:
      'The polling tools we tried are subscriptions with participant caps. We would rather own the tool, shape it around how we actually teach, and let students see how it is built.',
  },
  { title: 'Coming soon', owner: 'Herman Cordero', status: 'In progress', tone: 'maroon', summary: 'Project page reserved. Check back soon.' },
  { title: 'Coming soon', owner: 'Julian Ocansey', status: 'In progress', tone: 'blue', summary: 'Project page reserved. Check back soon.' },
  { title: 'Coming soon', owner: 'John Garces', status: 'In progress', tone: 'maroon', summary: 'Project page reserved. Check back soon.' },
];

function useFonts() {
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap';
    document.head.appendChild(link);
    return () => link.remove();
  }, []);
}

function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-nav">
      <a className="site-brand" href="/">
        <img src="/hsct-logo.png" alt="HSCT shield" width="34" height="38" />
        <span><strong>HSCT</strong> TechHub</span>
      </a>
      <button type="button" className="site-burger" aria-expanded={open} aria-label="Menu" onClick={() => setOpen((o) => !o)}>
        <span /><span /><span />
      </button>
      <nav className={`site-links${open ? ' is-open' : ''}`}>
        {NAV.map(([href, label]) => <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>)}
        <a className="site-cta" href="/studio">Open Jonathan's Studio</a>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero" id="top">
      <CircuitBg />
      <div className="hero-copy">
        <p className="hero-kicker">High School of Computers and Technology · Bronx, NY</p>
        <h1>The tech department that builds its own tools.</h1>
        <p className="hero-lede">
          TechHub is run by the HSCT Technology Department. It's where our classroom
          widgets live, where you can meet the team, and where each teacher's project
          gets a home — starting with a presentation studio you can open right now.
        </p>
        <div className="hero-actions">
          <a className="btn btn-maroon" href="/studio">Open Jonathan's Studio</a>
          <a className="btn btn-ghost" href="#projects">See the projects</a>
        </div>
      </div>
      <div className="hero-shield">
        <img src="/hsct-logo.png" alt="Computers · Technology shield" />
      </div>
    </section>
  );
}

function Section({ id, eyebrow, title, children, lead }) {
  return (
    <section className="sec" id={id}>
      <div className="sec-head">
        <h2>{title}</h2>
        {lead && <p className="sec-lead">{lead}</p>}
      </div>
      <div className="sec-body">{children}</div>
    </section>
  );
}

export default function Landing() {
  useFonts();
  return (
    <div className="site">
      <Nav />
      <main>
        <Hero />

        <Section id="widgets" title="Tech widgets" lead="Small tools we use in class. Poke them — everything lights up for real.">
          <Widgets />
        </Section>

        <Section id="team" title="The team">
          <ol className="team">
            {TEAM.map((m) => (
              <li key={m.name} className={`member tone-${m.tone}`}>
                <div className="member-mark" aria-hidden="true">{m.name.split(' ').map((w) => w[0]).join('')}</div>
                <div>
                  <h3>{m.name}</h3>
                  <p className="member-role">{m.role}</p>
                  <p>{m.blurb}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="mission" title="Mission">
          <div className="mission">
            <p className="mission-statement">
              We teach computing by doing it. Every student at HSCT should leave able to
              take an idea from a sketch to something that runs — and should have seen
              their teachers do exactly that.
            </p>
            <dl className="values">
              <div><dt>Make real things</dt><dd>The tools on this page are used in our own classrooms. If it isn't good enough for us, it isn't done.</dd></div>
              <div><dt>Show the work</dt><dd>Source, decisions, and mistakes are part of the lesson. Students see how software actually gets built.</dd></div>
              <div><dt>Hardware and software</dt><dd>From wearables and sensors to web apps and data — we cover the whole stack because the world does.</dd></div>
              <div><dt>Own the tools</dt><dd>When a subscription gets in the way of teaching, we build the alternative and keep it.</dd></div>
            </dl>
          </div>
        </Section>

        <Section id="projects" title="Projects" lead="One per teacher. Each links to its own app or page as it comes online.">
          <div className="projects">
            {PROJECTS.map((p, i) => (
              <article key={i} className={`project tone-${p.tone}${p.href ? ' is-live' : ''}`}>
                <div className="project-top">
                  <span className={`status${p.href ? ' live' : ''}`}>{p.status}</span>
                  <span className="owner">{p.owner}</span>
                </div>
                <h3>{p.href ? <a href={p.href}>{p.title}</a> : p.title}</h3>
                <p>{p.summary}</p>
                {p.vision && <p><strong>Where it's going.</strong> {p.vision}</p>}
                {p.why && <p><strong>Why we're building it.</strong> {p.why}</p>}
                {p.href && <a className="btn btn-blue" href={p.href}>Open Jonathan's Studio</a>}
              </article>
            ))}
          </div>
        </Section>
      </main>

      <footer className="site-foot">
        <img src="/hsct-logo.png" alt="" width="28" height="31" />
        <span>HSCT TechHub · run by the Technology Department, High School of Computers and Technology, NYC DOE</span>
        <a href="#top">Back to top</a>
      </footer>
    </div>
  );
}
