import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import Landing from './site/Landing.jsx';
import TeacherPage from './site/TeacherPage.jsx';
import ResourcePage from './site/ResourcePage.jsx';
import LessonsIndex from './site/LessonsIndex.jsx';
import CategoryPage from './site/CategoryPage.jsx';
import LessonPage from './site/LessonPage.jsx';
import VerifyPage from './site/VerifyPage.jsx';

// Tiny path router (public/_redirects makes Cloudflare serve index.html
// for every path, so this runs on direct visits too).
//   /                      department site
//   /teachers/<slug>       a teacher's page (src/site/teachers.js)
//   /pages/<slug>          a resource page  (src/site/pages.js)
//   /lessons               the lessons directory (src/site/lessons.js)
//   /lessons/<course>      one course: topics and lesson cards
//   /lessons/<course>/<lesson>  one lesson, rendered from its HTML file
//   /lessons/verify        teachers: open students' encrypted result files
//   /studio                Jonathan's Studio
//   /play                  Python Arcade (opens your last project)
//   /play/<project id>     Python Arcade, one project
const path = window.location.pathname.replace(/\/+$/, '') || '/';
let Page = Landing;
let props = {};
let m;
if (path.startsWith('/studio')) Page = App;
else if ((m = path.match(/^\/teachers\/([^/]+)$/))) { Page = TeacherPage; props = { slug: m[1] }; }
else if ((m = path.match(/^\/pages\/([^/]+)$/))) { Page = ResourcePage; props = { slug: m[1] }; }
else if (path === '/lessons') Page = LessonsIndex;
else if (path === '/lessons/verify') Page = VerifyPage;
else if ((m = path.match(/^\/lessons\/([^/]+)$/))) { Page = CategoryPage; props = { slug: m[1] }; }
else if ((m = path.match(/^\/lessons\/([^/]+)\/([^/]+)$/))) { Page = LessonPage; props = { category: m[1], lesson: m[2] }; }

// No <StrictMode> on purpose: it double-mounts effects in dev, and
// reveal.js does not survive being torn down and re-initialized against
// DOM it already rewrote. The Deck component guards against it anyway.
const root = createRoot(document.getElementById('root'));
if ((m = path.match(/^\/play(?:\/([\w-]+))?$/))) {
  // The Arcade (editor + Python runner) loads as its own chunk so the rest
  // of the site doesn't pay for CodeMirror.
  const projectId = m[1] || null;
  import('./arcade/ArcadePage.jsx').then(({ default: ArcadePage }) => root.render(<ArcadePage projectId={projectId} />));
} else {
  root.render(<Page {...props} />);
}
