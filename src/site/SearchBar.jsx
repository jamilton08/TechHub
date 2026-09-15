import { useRef } from 'react';
import LessonCard from './LessonCard.jsx';
import { CATEGORIES, KINDS } from './lessons.js';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function Chip({ on, onClick, children }) {
  return <button type="button" className="chip" aria-pressed={on} onClick={onClick}>{children}</button>;
}

/**
 * The search box. `search` is the object from useLessonSearch().
 * Course chips are hidden when the search is pinned to one course.
 */
export default function SearchBar({ search, placeholder = 'Search lessons', compact = false, label = 'Search lessons' }) {
  const { q, setQ, course, setCourse, kind, setKind, pinned, active, results, clear } = search;
  const input = useRef(null);

  return (
    <div className={`search${compact ? ' compact' : ''}`} role="search">
      <div className="search-field">
        <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M13 13l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        <input
          ref={input}
          type="search"
          value={q}
          placeholder={placeholder}
          aria-label={label}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') { clear(); input.current?.blur(); } }}
        />
        {active && <button type="button" className="search-clear" onClick={() => { clear(); input.current?.focus(); }}>Clear</button>}
      </div>
      <div className="chips">
        {!pinned && (
          <>
            <Chip on={!course} onClick={() => setCourse('')}>All courses</Chip>
            {CATEGORIES.map((c) => <Chip key={c.slug} on={course === c.slug} onClick={() => setCourse(course === c.slug ? '' : c.slug)}>{c.title}</Chip>)}
          </>
        )}
      </div>
      <div className="chips">
        <Chip on={!kind} onClick={() => setKind('')}>Any type</Chip>
        {Object.entries(KINDS).map(([id, k]) => <Chip key={id} on={kind === id} onClick={() => setKind(kind === id ? '' : id)}>{k.label}</Chip>)}
      </div>
      <p className="search-count" aria-live="polite">
        {active ? (results.length ? `${plural(results.length, 'lesson')} found` : 'No lessons match') : ''}
      </p>
    </div>
  );
}

/** Results as a card grid, or an empty state with a way out. */
export function SearchResults({ search, showCategory = true }) {
  const { q, results, clear } = search;
  if (results.length === 0) {
    return (
      <div className="empty search-empty">
        <p>{q.trim() ? <>Nothing matches <strong>{q.trim()}</strong> with these filters.</> : 'Nothing matches these filters yet.'}</p>
        <p>Try a single word, check the spelling, or clear the filters and browse the courses below.</p>
        <button type="button" className="btn btn-ghost" onClick={clear}>Clear search</button>
      </div>
    );
  }
  return (
    <div className="lesson-grid">
      {results.map(({ key, category, topic, lesson }) => (
        <LessonCard key={key} category={category} topic={topic} lesson={lesson} showCategory={showCategory} />
      ))}
    </div>
  );
}
