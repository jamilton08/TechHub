import { useEffect, useMemo, useState } from 'react';
import { KINDS, allLessons } from './lessons.js';

/**
 * Lesson search. Everything runs in the browser against lessons.js —
 * no server, no index to rebuild. Fine well into the hundreds of lessons.
 *
 * Matching: every word in the query must match something (title, tags,
 * topic, course, kind, description). A word matches when a word in the
 * field starts with it ("tick" finds "tickets"); words of 4+ letters also
 * match inside a word ("shoot" finds "troubleshooting"). Title hits rank
 * above tag hits, which rank above description hits.
 */

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const words = (s) => norm(s).split(/[^a-z0-9+#.]+/).filter(Boolean);

const field = (text) => ({ text: norm(text), words: words(text) });
const matches = (f, term) => f.words.some((w) => w.startsWith(term)) || (term.length >= 4 && f.text.includes(term));

let INDEX = null;
function index() {
  if (INDEX) return INDEX;
  INDEX = allLessons().map((hit) => ({
    ...hit,
    key: `${hit.category.slug}/${hit.lesson.slug}`,
    f: {
      title: field(hit.lesson.title),
      tags: field((hit.lesson.tags || []).join(' ')),
      topic: field(hit.topic.title),
      course: field(hit.category.title),
      kind: field((KINDS[hit.lesson.kind] || KINDS.reading).label),
      description: field(hit.lesson.description),
    },
  }));
  return INDEX;
}

/** Returns [{ category, topic, lesson, score }] sorted best-first. */
export function searchLessons({ q = '', course = '', kind = '', postedOnly = true } = {}) {
  const terms = words(q);
  let hits = index();
  if (course) hits = hits.filter((h) => h.category.slug === course);
  if (kind) hits = hits.filter((h) => h.lesson.kind === kind);
  if (postedOnly) hits = hits.filter((h) => h.lesson.file);
  if (!terms.length) {
    return hits.slice().sort((a, b) => (b.lesson.added || '').localeCompare(a.lesson.added || ''));
  }
  const out = [];
  for (const h of hits) {
    let score = 0;
    for (const t of terms) {
      let s = 0;
      if (matches(h.f.title, t)) s = h.f.title.words.some((w) => w.startsWith(t)) ? 6 : 4;
      else if (matches(h.f.tags, t)) s = 3;
      else if (matches(h.f.topic, t) || matches(h.f.course, t) || matches(h.f.kind, t)) s = 2;
      else if (matches(h.f.description, t)) s = 1;
      if (!s) { score = 0; break; }
      score += s;
    }
    if (score) out.push({ ...h, score });
  }
  return out.sort((a, b) => b.score - a.score || (b.lesson.added || '').localeCompare(a.lesson.added || ''));
}

/**
 * Search state for a page. Reads ?q=, ?course=, ?kind= on load and writes
 * them back as they change, so a search is a shareable link and the nav's
 * search box can land on /lessons?q=... . Pass `course` to pin the search
 * to one course (the course page).
 */
export function useLessonSearch({ course: pinned = '' } = {}) {
  const initial = useMemo(() => new URLSearchParams(window.location.search), []);
  const [q, setQ] = useState(initial.get('q') || '');
  const [course, setCourse] = useState(pinned || initial.get('course') || '');
  const [kind, setKind] = useState(initial.get('kind') || '');

  useEffect(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set('q', q.trim());
    if (course && !pinned) p.set('course', course);
    if (kind) p.set('kind', kind);
    const qs = p.toString();
    const url = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
    if (url !== window.location.pathname + window.location.search + window.location.hash) {
      window.history.replaceState(null, '', url);
    }
  }, [q, course, kind, pinned]);

  const active = Boolean(q.trim() || (course && !pinned) || kind);
  const results = useMemo(() => (active ? searchLessons({ q, course, kind }) : []), [q, course, kind, active]);
  const clear = () => { setQ(''); if (!pinned) setCourse(''); setKind(''); };

  return { q, setQ, course, setCourse, kind, setKind, active, results, clear, pinned: Boolean(pinned) };
}
