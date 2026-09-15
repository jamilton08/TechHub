import { useEffect, useRef, useState } from 'react';
import { KINDS, lessonHref, lessonSrc } from './lessons.js';

/* The preview renders the real lesson at this size, then scales it to
   fit the card. 16:10 like a laptop screen. */
const PREVIEW_W = 1280;
const PREVIEW_H = 800;

/**
 * A miniature of the lesson: the actual page, loaded in an iframe and
 * scaled down. It only loads once the card is near the viewport, and it
 * can't be clicked or tabbed into — the card's link does that.
 */
export function LessonScreen({ src, title, onLoaded }) {
  const box = useRef(null);
  const [scale, setScale] = useState(0);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / PREVIEW_W));
    ro.observe(el);
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setNear(true); io.disconnect(); }
    }, { rootMargin: '240px' });
    io.observe(el);
    return () => { ro.disconnect(); io.disconnect(); };
  }, []);

  return (
    <div className="lesson-screen" ref={box}>
      {src && near && scale > 0 ? (
        <iframe
          src={src}
          title={`Preview of ${title}`}
          aria-hidden="true"
          tabIndex={-1}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin"
          style={{ width: PREVIEW_W, height: PREVIEW_H, transform: `scale(${scale})` }}
          onLoad={onLoaded}
        />
      ) : !src ? (
        <div className="lesson-screen-off"><span>Coming soon</span></div>
      ) : null}
    </div>
  );
}

export default function LessonCard({ category, topic, lesson, showCategory = false }) {
  const [loaded, setLoaded] = useState(false);
  const src = lessonSrc(category, lesson);
  const kind = KINDS[lesson.kind] || KINDS.reading;

  return (
    <article className={`lesson-card tone-${category.tone}${src ? '' : ' is-soon'}`}>
      <LessonScreen src={src} title={lesson.title} onLoaded={() => setLoaded(true)} />
      <div className="lesson-body">
        <div className="lesson-meta">
          <span className={`led led-green led-xs${loaded ? ' on' : ''}`} aria-hidden="true" />
          {(showCategory || topic) && (
            <span className="lesson-cat">
              {showCategory && category.title}
              {topic && <span className="lesson-topic">{showCategory ? ' / ' : ''}{topic.title}</span>}
            </span>
          )}
          <span className="pill">{kind.label}</span>
          {lesson.minutes && <span className="pill">{lesson.minutes} min</span>}
        </div>
        <h3>{src ? <a href={lessonHref(category, lesson)}>{lesson.title}</a> : lesson.title}</h3>
        <p>{lesson.description}</p>
        <span className="lesson-go">{src ? kind.verb : 'Not posted yet'}</span>
      </div>
    </article>
  );
}
