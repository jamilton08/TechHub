#!/usr/bin/env node
/**
 * Re-copies lesson-template/hsct-lesson.js into every lesson that inlines the
 * kit (between <!-- HSCT KIT START --> and <!-- HSCT KIT END -->), so a kit
 * upgrade (v1.1 → v1.2 teams) reaches every lesson without touching their
 * own code.
 *
 *   node scripts/update-kit.mjs                      # every file under public/lesson-files + the starters
 *   node scripts/update-kit.mjs path/to/lesson.html  # just these
 *   node scripts/update-kit.mjs --check              # list files and their kit version, change nothing
 *
 * A lesson whose markers are missing is left alone and reported.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KIT = readFileSync(join(ROOT, 'lesson-template', 'hsct-lesson.js'), 'utf8').trim();
const KIT_VERSION = (KIT.match(/var KIT = '([^']+)'/) || [])[1];
const START = '<!-- HSCT KIT START -->';
const END = '<!-- HSCT KIT END -->';

const args = process.argv.slice(2);
const check = args.includes('--check');
let files = args.filter((a) => !a.startsWith('--'));
if (!files.length) {
  const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.html') ? [p] : []; });
  files = [...walk(join(ROOT, 'public', 'lesson-files')), join(ROOT, 'lesson-template', 'lesson-starter.html'), join(ROOT, 'lesson-template', 'lesson-world-starter.html')];
}

let changed = 0, skipped = 0;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  // The real START is the first marker on its own line (it may carry a "do not edit" note);
  // the real END is the last one — the kit's own header comment mentions both markers inline.
  const startM = src.match(/^<!-- HSCT KIT START[^\n]*-->[ \t]*$/m);
  const i = startM ? startM.index : -1, iEnd = startM ? i + startM[0].length : -1;
  const j = src.lastIndexOf(END);
  const have = (src.match(/var KIT = '([^']+)'/) || [])[1] || '—';
  if (i < 0 || j < 0 || j < i) { console.log(`skip   ${rel(f)}  (no kit markers; kit ${have})`); skipped++; continue; }
  if (check) { console.log(`${have === KIT_VERSION ? 'ok    ' : 'old   '} ${rel(f)}  kit ${have}`); continue; }
  // keep whatever wraps the kit (usually "<script>" right after START and "</script>" before END)
  const inner = src.slice(iEnd, j);
  const open = inner.match(/^\s*<script[^>]*>\s*/)?.[0] ?? '\n<script>\n';
  const close = inner.match(/\s*<\/script>\s*$/)?.[0] ?? '\n</script>\n';
  const out = src.slice(0, iEnd) + open + KIT + close + src.slice(j);
  if (out !== src) { writeFileSync(f, out); changed++; console.log(`update ${rel(f)}  ${have} → ${KIT_VERSION}`); }
  else console.log(`same   ${rel(f)}  kit ${have}`);
}
if (!check) console.log(`\n${changed} updated, ${skipped} skipped (no markers). Kit ${KIT_VERSION}.`);

function rel(p) { return p.startsWith(ROOT) ? p.slice(ROOT.length + 1) : p; }
