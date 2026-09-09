import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import Landing from './site/Landing.jsx';

// Tiny path router. "/" is the department site, "/studio" is Jonathan's
// Studio. Vite's dev server and preview already fall back to index.html
// for any path; on GitHub Pages copy index.html to 404.html to get the
// same behaviour.
const path = window.location.pathname.replace(/\/+$/, '') || '/';
const Page = path.startsWith('/studio') ? App : Landing;

// No <StrictMode> on purpose: it double-mounts effects in dev, and
// reveal.js does not survive being torn down and re-initialized against
// DOM it already rewrote. The Deck component guards against it anyway.
createRoot(document.getElementById('root')).render(<Page />);
