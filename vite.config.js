import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

/**
 * The Python Arcade (/play) needs SharedArrayBuffer so a running game can
 * read the keyboard and input(). Browsers only allow that on pages that are
 * "cross-origin isolated", which takes two headers. Production gets them from
 * public/_headers (Cloudflare) or nginx; this plugin does the same for
 * `npm run dev` and `npm run preview`. Only /play pages and workers get them,
 * so the rest of the site (YouTube embeds, lesson iframes…) is unaffected.
 */
function crossOriginIsolation() {
  const handler = (req, res, next) => {
    const dest = req.headers['sec-fetch-dest'];
    const url = req.url || '';
    const isPlayPage = url.startsWith('/play') && (dest === 'document' || dest === 'iframe' || !dest);
    if (isPlayPage || dest === 'worker' || dest === 'sharedworker') {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    }
    next();
  };
  return {
    name: 'cross-origin-isolation',
    configureServer: (server) => { server.middlewares.use(handler); },
    configurePreviewServer: (server) => { server.middlewares.use(handler); },
  };
}

export default defineConfig({
  plugins: [react(), crossOriginIsolation()],
  worker: { format: 'es' },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        runner: resolve(__dirname, 'play/runner.html'),
      },
    },
  },
});
