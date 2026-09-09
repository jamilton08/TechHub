/**
 * Builds a single self-contained HTML file for a deck: reveal.js from a
 * CDN, the chosen theme, and the slides rendered to static markup.
 * Upload it anywhere (GitHub Pages, Google Drive "open with", a school
 * server) and the presentation runs without this app.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import SlidesFromModel from '../present/SlidesFromModel.jsx';

const REVEAL = 'https://cdn.jsdelivr.net/npm/reveal.js@5.2.1';

export function buildStandaloneHtml({ doc, config, theme, codeTheme }) {
  const slides = renderToStaticMarkup(createElement(SlidesFromModel, { doc, width: config.width, height: config.height }));
  const { plugins, dependencies, embedded, ...cfg } = config; // eslint-disable-line no-unused-vars
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(doc.title || 'Presentation')}</title>
  <link rel="stylesheet" href="${REVEAL}/dist/reveal.css">
  <link rel="stylesheet" href="${REVEAL}/dist/theme/${theme}.css">
  <link rel="stylesheet" href="${REVEAL}/plugin/highlight/${codeTheme}.css">
  <style>.slide-canvas{position:relative;margin:0 auto}.blk{position:absolute;box-sizing:border-box}</style>
</head>
<body>
  <div class="reveal"><div class="slides">${slides}</div></div>
  <script type="module">
    import Reveal from '${REVEAL}/dist/reveal.esm.js';
    import Markdown from '${REVEAL}/plugin/markdown/markdown.esm.js';
    import Highlight from '${REVEAL}/plugin/highlight/highlight.esm.js';
    import Math from '${REVEAL}/plugin/math/math.esm.js';
    import Search from '${REVEAL}/plugin/search/search.esm.js';
    import Zoom from '${REVEAL}/plugin/zoom/zoom.esm.js';
    import Notes from '${REVEAL}/plugin/notes/notes.esm.js';
    Reveal.initialize({ ...${JSON.stringify(cfg)}, hash: true, plugins: [Markdown, Highlight, Math.KaTeX, Search, Zoom, Notes] });
  </script>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export function downloadText(filename, text, type = 'text/plain') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function pickJsonFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      const r = new FileReader();
      r.onload = () => { try { resolve(JSON.parse(r.result)); } catch { resolve(null); } };
      r.readAsText(f);
    };
    input.click();
  });
}
