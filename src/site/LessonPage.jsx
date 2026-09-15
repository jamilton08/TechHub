import { useEffect, useRef, useState } from 'react';
import SiteNav from './SiteNav.jsx';
import SiteFooter from './SiteFooter.jsx';
import { KINDS, findLesson, lessonHref, lessonSrc } from './lessons.js';
import { useFonts } from './useFonts.js';
import './site.css';

export default function LessonPage({ category: categorySlug, lesson: lessonSlug }) {
  useFonts();
  const hit = findLesson(categorySlug, lessonSlug);
  const frame = useRef(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    document.title = hit ? `${hit.lesson.title} · ${hit.category.title} · HSCT TechHub` : 'Not found · HSCT TechHub';
  }, [hit]);

  if (!hit || !hit.lesson.file) {
    return (
      <div className="site"><SiteNav />
        <main className="page">
          <h1>{hit ? 'This lesson is not posted yet.' : 'No lesson at that address.'}</h1>
          <p><a href={hit ? `/lessons/${hit.category.slug}` : '/lessons'}>{hit ? `Back to ${hit.category.title}` : 'Back to lessons'}</a></p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const { category, topic, lesson, prev, next } = hit;
  const src = lessonSrc(category, lesson);
  const kind = KINDS[lesson.kind] || KINDS.reading;
  const others = topic.lessons.filter((l) => l.slug !== lesson.slug && l.file);

  const fullscreen = () => {
    const el = frame.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

  return (
    <div className={`site lesson-view tone-${category.tone}`} id="top">
      <SiteNav />
      <main>
        <div className="lesson-bar">
          <div className="lesson-bar-text">
            <p className="t-crumb">
              <a href="/lessons">Lessons</a> / <a href={`/lessons/${category.slug}`}>{category.title}</a> / <a href={`/lessons/${category.slug}#${topic.id}`}>{topic.title}</a>
            </p>
            <h1>
              <span className={`led led-green led-s${loaded ? ' on' : ''}`} aria-hidden="true" />
              {lesson.title}
            </h1>
          </div>
          <div className="lesson-tools">
            {prev && prev.file && <a className="btn btn-ghost" href={lessonHref(category, prev)}>Previous</a>}
            {next && next.file && <a className="btn btn-ghost" href={lessonHref(category, next)}>Next</a>}
            <button type="button" className="btn btn-ghost" onClick={fullscreen}>Fullscreen</button>
            <a className="btn btn-blue" href={src} target="_blank" rel="noreferrer">Open in a new tab</a>
          </div>
        </div>

        <div className="lesson-stage">
          <iframe
            ref={frame}
            className="lesson-frame"
            src={src}
            title={lesson.title}
            allow="fullscreen; clipboard-write"
            allowFullScreen
            onLoad={() => setLoaded(true)}
          />
        </div>

        <section className="sec" id="about">
          <div className="sec-head">
            <h2>About this lesson</h2>
            <p className="sec-lead">Part of {topic.title} in {category.title}.</p>
          </div>
          <div>
            <div className="lesson-meta">
              <span className="pill">{kind.label}</span>
              {lesson.minutes && <span className="pill">About {lesson.minutes} min</span>}
            </div>
            <p className="lesson-about">{lesson.description}</p>
            <p className="lesson-about-note">
              The lesson runs in the frame above. If it feels cramped, use Fullscreen, or open it in its own tab.
            </p>
            {others.length > 0 && (
              <>
                <h3 className="lesson-more">More in {topic.title}</h3>
                <ul className="t-others">
                  {others.map((l) => (
                    <li key={l.slug}><a href={lessonHref(category, l)}><strong>{l.title}</strong><span>{(KINDS[l.kind] || KINDS.reading).label}{l.minutes ? ` · ${l.minutes} min` : ''}</span></a></li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
