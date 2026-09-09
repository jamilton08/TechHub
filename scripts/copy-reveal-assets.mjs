// Copies reveal.js theme + code-highlight CSS (and their fonts) into /public/reveal
// so the app can swap themes at runtime by changing a <link href>.
// Runs automatically after `npm install`.
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, 'node_modules/reveal.js');
const out = resolve(root, 'public/reveal');

if (!existsSync(src)) {
  console.warn('[copy-reveal-assets] reveal.js not installed yet, skipping');
  process.exit(0);
}

mkdirSync(out, { recursive: true });
cpSync(resolve(src, 'dist/theme'), resolve(out, 'theme'), { recursive: true });
mkdirSync(resolve(out, 'highlight'), { recursive: true });
for (const f of ['monokai.css', 'zenburn.css']) {
  cpSync(resolve(src, 'plugin/highlight', f), resolve(out, 'highlight', f));
}
console.log('[copy-reveal-assets] copied themes to public/reveal');
