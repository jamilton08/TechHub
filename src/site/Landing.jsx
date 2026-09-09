import { useEffect } from 'react';
import CircuitBg from './CircuitBg.jsx';
import Widgets from './Widgets.jsx';
import SiteNav from './SiteNav.jsx';
import SiteFooter from './SiteFooter.jsx';
import { TEACHERS } from './teachers.js';
import { useFonts } from './useFonts.js';
import './site.css';

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
  useEffect(() => { document.title = 'HSCT TechHub'; }, []);
  return (
    <div className="site">
      <SiteNav />
      <main>
        <Hero />

        <Section id="widgets" title="Tech widgets" lead="Small tools we use in class. Poke them — everything lights up for real.">
          <Widgets />
        </Section>

        <Section id="team" title="The team" lead="Click a teacher for their class contract, syllabus, and classes.">
          <ol className="team">
            {TEACHERS.map((m) => (
              <li key={m.slug} className={`member tone-${m.tone}`}>
                <a className="member-link" href={`/teachers/${m.slug}`}>
                  <div className="member-mark" aria-hidden="true">{m.name.split(' ').map((w) => w[0]).join('')}</div>
                  <div>
                    <h3>{m.name}</h3>
                    <p className="member-role">{m.role}</p>
                    <p>{m.bio}</p>
                    <span className="member-more">Class contract, syllabus, classes →</span>
                  </div>
                </a>
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

      <SiteFooter />
    </div>
  );
}
