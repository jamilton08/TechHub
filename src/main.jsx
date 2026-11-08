import { createRoot } from 'react-dom/client';
import { loadCatalog } from './site/lessons.js';
import { API_BASE } from './site/api.js';

// Tiny path router (public/_redirects makes Cloudflare serve index.html
// for every path, so this runs on direct visits too).
//   /                      department site
//   /teachers/<slug>       a teacher's page (src/site/teachers.js)
//   /pages/<slug>          a resource page  (src/site/pages.js)
//   /lessons               the lessons directory (catalog from the API; src/site/lessons.js is the fallback)
//   /lessons/<course>      one course: topics and lesson cards
//   /lessons/<course>/<lesson>  one lesson, rendered from its HTML file (?team=CODE joins a team)
//   /lessons/verify        teachers: open students' encrypted result files
//   /teach                 teachers: assignments, live team boards, submissions, lesson uploads
//   /studio                Jonathan's Studio
//   /play                  Python Arcade (opens your last project)
//   /play/<project id>     Python Arcade, one project
const path = window.location.pathname.replace(/\/+$/, '') || '/';
const root = createRoot(document.getElementById('root'));
let m;

if ((m = path.match(/^\/play(?:\/([\w-]+))?$/))) {
  // The Arcade (editor + Python runner) loads as its own chunk so the rest
  // of the site doesn't pay for CodeMirror.
  const projectId = m[1] || null;
  import('./arcade/ArcadePage.jsx').then(({ default: ArcadePage }) => root.render(<ArcadePage projectId={projectId} />));
} else if (path.startsWith('/studio')) {
  import('./App.jsx').then(({ default: App }) => root.render(<App />));
} else {
  // The lesson catalog comes from the API. It's settled before the site modules load, because
  // the nav and the course pages read CATEGORIES at import time (a cached copy applies at once;
  // a first visit waits up to ~2 s, then falls back to the list in lessons.js).
  loadCatalog({ apiBase: API_BASE }).then(() => import('./site/routes.jsx')).then(({ routes }) => {
    let Page = routes.Landing, props = {};
    if ((m = path.match(/^\/teachers\/([^/]+)$/))) { Page = routes.TeacherPage; props = { slug: m[1] }; }
    else if ((m = path.match(/^\/pages\/([^/]+)$/))) { Page = routes.ResourcePage; props = { slug: m[1] }; }
    else if (path === '/lessons') Page = routes.LessonsIndex;
    else if (path === '/lessons/verify') Page = routes.VerifyPage;
    else if (path === '/teach') Page = routes.TeachPage;
    else if ((m = path.match(/^\/lessons\/([^/]+)$/))) { Page = routes.CategoryPage; props = { slug: m[1] }; }
    else if ((m = path.match(/^\/lessons\/([^/]+)\/([^/]+)$/))) { Page = routes.LessonPage; props = { category: m[1], lesson: m[2] }; }
    // No <StrictMode> on purpose: it double-mounts effects in dev, and
    // reveal.js does not survive being torn down and re-initialized against
    // DOM it already rewrote. The Deck component guards against it anyway.
    root.render(<Page {...props} />);
  });
}
