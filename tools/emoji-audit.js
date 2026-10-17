#!/usr/bin/env node
/* Emoji audit: which emoji are still in the lessons, and which have a pixel icon in shared/pixel-icons.js.
 *   node tools/emoji-audit.js            summary: missing emoji (most-used first), faces left, coverage
 *   node tools/emoji-audit.js --all      every emoji with its count, status and files
 * Status: icon (drawn in Pixel.icons), keep (flags + small UI glyphs that stay as text), MISSING.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

// load Pixel + Pixel.icons with a stand-in window
const window = {};
for (const f of ['shared/pixel.js', 'shared/pixel-icons.js']) {
  const p = path.join(ROOT, f);
  if (fs.existsSync(p)) new Function('window', 'document', fs.readFileSync(p, 'utf8'))(window, undefined);
}
const Pixel = window.Pixel || {};
const has = e => !!(Pixel.has && Pixel.has(e));
const keep = e => !!(Pixel.KEEP && Pixel.KEEP(e));

const files = [];
(function walk(dir) {
  for (const n of fs.readdirSync(dir)) {
    if (n.startsWith('.') || n === 'tools' || n === 'node_modules' || n === 'fonts') continue;
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.(html|js)$/.test(n) && n !== 'pixel-icons.js') files.push(p);
  }
})(ROOT);

// one emoji = a pictographic char (+ optional variation selector / skin tone / ZWJ sequence), or a flag pair, or a tag-sequence flag
const RE = /(?:\p{Regional_Indicator}{2})|(?:\u{1F3F4}[\u{E0060}-\u{E007F}]+)|(?:[\p{Extended_Pictographic}←-⇿⬅-⬇←▶◀✔✖](?:️|[\u{1F3FB}-\u{1F3FF}])?(?:‍\p{Extended_Pictographic}️?)*)/gu;
const FACE = /[\u{1F600}-\u{1F64F}\u{1F466}-\u{1F487}\u{1F9D1}-\u{1F9DF}\u{1F9B8}\u{1F9B9}\u{1F440}-\u{1F450}\u{1F4AA}\u{1F57A}\u{1F91A}-\u{1F91F}\u{1F926}\u{1F930}-\u{1F93E}\u{1F64B}-\u{1F64F}\u{1F464}\u{1F465}\u{1F482}\u{1F483}\u{1F936}\u{1F937}\u{1F938}\u{1F44D}\u{1F44F}\u{1F91D}\u{1F932}]/u;

const seen = new Map();
for (const f of files) {
  const rel = path.relative(ROOT, f);
  const txt = fs.readFileSync(f, 'utf8');
  for (const m of txt.matchAll(RE)) {
    const e = m[0];
    const s = seen.get(e) || { n: 0, files: new Set() };
    s.n++; s.files.add(rel); seen.set(e, s);
  }
}
const rows = [...seen].map(([e, s]) => ({ e, n: s.n, files: [...s.files], status: has(e) ? 'icon' : keep(e) ? 'keep' : 'MISSING', face: FACE.test(e) }))
  .sort((a, b) => b.n - a.n);

if (process.argv.includes('--all')) {
  for (const r of rows) console.log(`${r.status.padEnd(7)} ${String(r.n).padStart(4)}  ${r.e}  ${r.files.join(', ')}`);
} else {
  const missing = rows.filter(r => r.status === 'MISSING');
  const faces = missing.filter(r => r.face);
  console.log(`Emoji kinds: ${rows.length}   icons: ${rows.filter(r => r.status === 'icon').length}   kept as text: ${rows.filter(r => r.status === 'keep').length}   missing: ${missing.length}`);
  console.log(`Uses covered: ${rows.filter(r => r.status !== 'MISSING').reduce((t, r) => t + r.n, 0)} / ${rows.reduce((t, r) => t + r.n, 0)}`);
  if (faces.length) console.log(`\nFACE / PEOPLE emoji still without an icon: ${faces.map(r => r.e).join(' ')}`);
  if (missing.length) console.log(`\nMissing (most used first):\n${missing.map(r => `${r.e} ${r.n}`).join('  ')}`);
}
