// Copies the Pyodide runtime (CPython compiled to WebAssembly) into
// public/pyodide/<version>/ so the Python Arcade loads it from hsct.tech
// itself — no CDN for a school filter to block, no cross-origin headers to
// fight. The version is in the path, so browsers can cache the 10 MB
// interpreter for a year and an upgrade still takes effect immediately.
// Runs automatically after `npm install` (Cloudflare runs it on every build).
import { cpSync, mkdirSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, 'node_modules/pyodide');

if (!existsSync(src)) {
  console.warn('[copy-pyodide] pyodide not installed yet, skipping');
  process.exit(0);
}

const FILES = [
  'pyodide.mjs',        // loader (ES module)
  'pyodide.asm.mjs',    // emscripten glue
  'pyodide.asm.wasm',   // the interpreter (~10 MB, under Cloudflare's 25 MB file limit)
  'python_stdlib.zip',  // the standard library
  'pyodide-lock.json',  // package index (extra packages like numpy come from the CDN)
];

const { version } = JSON.parse(readFileSync(resolve(src, 'package.json'), 'utf8'));
const top = resolve(root, 'public/pyodide');
const out = resolve(top, version);
rmSync(top, { recursive: true, force: true }); // drop older versions
mkdirSync(out, { recursive: true });
for (const f of FILES) cpSync(resolve(src, f), resolve(out, f));
console.log(`[copy-pyodide] copied Pyodide ${version} to public/pyodide/${version}`);
