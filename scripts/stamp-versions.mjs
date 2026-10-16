#!/usr/bin/env node
/* Cache-busting versions, worked out instead of typed.
 *
 * Every page loads its scripts and styles as name.js?v=..., so a browser
 * holding an old copy fetches the new one when the file changes. Bumping
 * those numbers by hand across 70 pages went wrong more than once (a page
 * left on an old script). This sets every ?v= that points at a file in this
 * repo to the first 8 characters of that file's content hash: it changes
 * exactly when the file does, and never otherwise.
 *
 *   node scripts/stamp-versions.mjs          stamp everything
 *   node scripts/stamp-versions.mjs --check  exit 1 if anything is stale
 *
 * `npm run stamp` runs this and then regenerates the industry pages, whose
 * generators take their versions from the same hashes (industry-pages/build.js).
 * Run it before every commit that touches a script, a stylesheet or a page.
 */
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const SKIP = new Set(['node_modules', '.git', 'mobile', 'supabase', 'vendor', '.vercel']);
const REF = /([A-Za-z0-9_.\/-]+\.(?:js|css|svg|png|jpe?g|webp|json|webmanifest))\?v=([A-Za-z0-9]+)/g;

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(html|js)$/.test(name)) out.push(p);
  }
  return out;
}

const hashes = new Map();
function versionOf(file) {
  if (!hashes.has(file)) hashes.set(file, createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 8));
  return hashes.get(file);
}

/* Where a reference points: next to the file that makes it, else from the
   site root (an absolute /path, or a script built with a base like '../'). */
function target(fromFile, ref) {
  const clean = ref.replace(/^(\.\.\/)+/, (m) => m); // keep ../ for the relative try
  const candidates = ref.startsWith('/')
    ? [join(ROOT, ref)]
    : [join(dirname(fromFile), clean), join(ROOT, ref.replace(/^(\.\.\/|\.\/)+/, ''))];
  return candidates.find((c) => c.startsWith(ROOT) && existsSync(c) && statSync(c).isFile()) || null;
}

const files = walk(ROOT, []);
let changed = new Set();
/* A file that is itself stamped (app.js loads requests.js?v=) changes its own
   hash, so go round until nothing moves. */
for (let pass = 0; pass < 6; pass++) {
  let moved = false;
  hashes.clear();
  for (const f of files) {
    const before = readFileSync(f, 'utf8');
    const after = before.replace(REF, (whole, ref, v) => {
      const t = target(f, ref);
      if (!t || t === f) return whole;
      const want = versionOf(t);
      return v === want ? whole : `${ref}?v=${want}`;
    });
    if (after !== before) {
      moved = true;
      changed.add(relative(ROOT, f));
      if (!CHECK) writeFileSync(f, after);
    }
  }
  if (!moved || CHECK) break;
}

if (CHECK) {
  if (changed.size) {
    console.error(`Stale ?v= versions in ${changed.size} file(s): ${[...changed].slice(0, 10).join(', ')}${changed.size > 10 ? ', ...' : ''}`);
    console.error('Run: npm run stamp');
    process.exit(1);
  }
  console.log('All ?v= versions match their files.');
} else {
  console.log(changed.size ? `Stamped ${changed.size} file(s).` : 'Nothing to stamp.');
}
