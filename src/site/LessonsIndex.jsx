import { useEffect } from 'react';
import SiteNav from './SiteNav.jsx';
import SiteFooter from './SiteFooter.jsx';
import LessonCard from './LessonCard.jsx';
import SearchBar, { SearchResults } from './SearchBar.jsx';
import { useLessonSearch } from './search.js';
import { CATEGORIES, countLessons, newestLessons } from './lessons.js';
import { useFonts } from './useFonts.js';
import './site.css';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function LessonsIndex() {
  useFonts();
  useEffect(() => { document.title = 'Lessons · HSCT TechHub'; }, []);
  const search = useLessonSearch();
  const newest = newestLessons(4);
  const total = CATEGORIES.reduce((n, c) => n + countLessons(c), 0);

  return (
    <div className="site" id="top">
      <SiteNav />
      <main>
        <header className="r-hero">
          <p className="t-crumb"><a href="/">Home</a> / Lessons</p>
          <h1>Lessons</h1>
          <p className="t-bio">
            Every lesson is a page you open and work through right here — games, labs,
            readings, and quizzes from the department's classes. Pick a course to see
            its topics, or search everything by title, topic, or type.
          </p>
          <SearchBar search={search} placeholder="Search every lesson — try “ticket” or “rules”" />
        </header>

        {search.active && (
          <section className="sec" id="results">
            <div className="sec-head">
              <h2>Results</h2>
              <p className="sec-lead">Best matches first. Cards show the course and topic each lesson lives in.</p>
            </div>
            <SearchResults search={search} />
          </section>
        )}

        <section className="sec" id="courses">
          <div className="sec-head">
            <h2>Courses</h2>
            <p className="sec-lead">{plural(CATEGORIES.length, 'course')}, {plural(total, 'lesson')} posted so far. More land during the year.</p>
          </div>
          <ol className="course-grid">
            {CATEGORIES.map((c) => {
              const n = countLessons(c);
              return (
                <li key={c.slug} className={`course tone-${c.tone}`}>
                  <a href={`/lessons/${c.slug}`}>
                    <div className="course-top">
                      <h3>{c.title}</h3>
                      <span className={`pill${n ? '' : ' muted'}`}>{n ? plural(n, 'lesson') : 'Coming soon'}</span>
                    </div>
                    <p>{c.blurb}</p>
                    <ul className="course-topics">
                      {c.topics.map((t) => (
                        <li key={t.id}>{t.title}{t.lessons.length > 0 && <small>{t.lessons.length}</small>}</li>
                      ))}
                    </ul>
                  </a>
                </li>
              );
            })}
          </ol>
        </section>

        {!search.active && newest.length > 0 && (
          <section className="sec" id="newest">
            <div className="sec-head">
              <h2>Newest</h2>
              <p className="sec-lead">The latest lessons posted, across every course.</p>
            </div>
            <div className="lesson-grid">
              {newest.map(({ category, lesson }) => (
                <LessonCard key={`${category.slug}/${lesson.slug}`} category={category} lesson={lesson} showCategory />
              ))}
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
