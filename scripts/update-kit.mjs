#!/usr/bin/env node
/**
 * Re-copies lesson-template/hsct-lesson.js into every lesson that inlines the
 * kit (between <!-- HSCT KIT START --> and <!-- HSCT KIT END -->), and
 * lesson-template/hsct-world.js into every lesson that inlines the world kit
 * (<!-- HSCT WORLD START --> … <!-- HSCT WORLD END -->), so a kit upgrade
 * reaches every lesson without touching their own code.
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
const KITS = [
  { name: 'kit', file: 'hsct-lesson.js', start: /^<!-- HSCT KIT START[^\n]*-->[ \t]*$/m, end: '<!-- HSCT KIT END -->', ver: /var KIT = '([^']+)'/ },
  { name: 'world', file: 'hsct-world.js', start: /^<!-- HSCT WORLD START[^\n]*-->[ \t]*$/m, end: '<!-- HSCT WORLD END -->', ver: /version: '([^']+)' \};/ },
];
for (const k of KITS) { k.src = readFileSync(join(ROOT, 'lesson-template', k.file), 'utf8').trim(); k.version = (k.src.match(k.ver) || [])[1]; }

const args = process.argv.slice(2);
const check = args.includes('--check');
let files = args.filter((a) => !a.startsWith('--'));
if (!files.length) {
  const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.html') ? [p] : []; });
  files = [...walk(join(ROOT, 'public', 'lesson-files')), join(ROOT, 'lesson-template', 'lesson-starter.html'), join(ROOT, 'lesson-template', 'lesson-world-starter.html')];
}

let changed = 0, skipped = 0;
for (const f of files) {
  let src = readFileSync(f, 'utf8');
  const notes = [];
  let touched = false;
  for (const k of KITS) {
    // The real START is the first marker on its own line (it may carry a "do not edit" note);
    // the real END is the last one — the kits' own header comments mention both markers inline.
    const startM = src.match(k.start);
    const i = startM ? startM.index : -1, iEnd = startM ? i + startM[0].length : -1;
    const j = src.lastIndexOf(k.end);
    if (i < 0 || j < 0 || j < i) continue;
    const have = (src.slice(iEnd, j).match(k.ver) || [])[1] || '—';
    if (check) { notes.push(`${k.name} ${have}${have === k.version ? '' : ' (old)'}`); continue; }
    const inner = src.slice(iEnd, j);
    const open = inner.match(/^\s*<script[^>]*>\s*/)?.[0] ?? '\n<script>\n';
    const close = inner.match(/\s*<\/script>\s*$/)?.[0] ?? '\n</script>\n';
    const out = src.slice(0, iEnd) + open + k.src + close + src.slice(j);
    if (out !== src) { src = out; touched = true; notes.push(`${k.name} ${have} → ${k.version}`); } else notes.push(`${k.name} ${have}`);
  }
  if (!notes.length) { console.log(`skip   ${rel(f)}  (no kit markers)`); skipped++; continue; }
  if (touched) { writeFileSync(f, src); changed++; }
  console.log(`${check ? 'ok    ' : touched ? 'update' : 'same  '} ${rel(f)}  ${notes.join(' · ')}`);
}
if (!check) console.log(`\n${changed} updated, ${skipped} skipped (no markers). Kits: ${KITS.map((k) => `${k.name} ${k.version}`).join(', ')}.`);

function rel(p) { return p.startsWith(ROOT) ? p.slice(ROOT.length + 1) : p; }
