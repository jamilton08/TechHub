import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import Landing from './site/Landing.jsx';
import TeacherPage from './site/TeacherPage.jsx';
import ResourcePage from './site/ResourcePage.jsx';

// Tiny path router (public/_redirects makes Cloudflare serve index.html
// for every path, so this runs on direct visits too).
//   /                      department site
//   /teachers/<slug>       a teacher's page (src/site/teachers.js)
//   /pages/<slug>          a resource page  (src/site/pages.js)
//   /studio                Jonathan's Studio
const path = window.location.pathname.replace(/\/+$/, '') || '/';
let Page = Landing;
let props = {};
let m;
if (path.startsWith('/studio')) Page = App;
else if ((m = path.match(/^\/teachers\/([^/]+)$/))) { Page = TeacherPage; props = { slug: m[1] }; }
else if ((m = path.match(/^\/pages\/([^/]+)$/))) { Page = ResourcePage; props = { slug: m[1] }; }

// No <StrictMode> on purpose: it double-mounts effects in dev, and
// reveal.js does not survive being torn down and re-initialized against
// DOM it already rewrote. The Deck component guards against it anyway.
createRoot(document.getElementById('root')).render(<Page {...props} />);
