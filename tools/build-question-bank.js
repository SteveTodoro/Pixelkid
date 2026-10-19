#!/usr/bin/env node
/* Builds shared/question-bank.js: quick questions from every lesson, for the quest map's challenger NPCs.
 *   node tools/build-question-bank.js
 * Takes the boss battle questions that work on their own (multiple choice, true/false, gap, typed answer),
 * skipping any that need a picture. (Video questions often lean on what the video showed, so they are left out.) Re-run it after adding or changing a lesson.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');

// the same loader as lesson-check.js: run a lesson's scripts with stand-ins for the browser helpers
const stub = new Proxy(function () {}, {
  get: (_, k) => (k === Symbol.toPrimitive ? () => '' : k === 'toString' || k === 'valueOf' ? () => '' : stub),
  apply: () => stub,
  construct: () => stub,
});
function loadLesson(file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const code = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n;\n');
  const window = {};
  const sandbox = new Proxy({ window, console, Math, JSON, Array, Object, String, Number, Boolean, Date, RegExp, Error }, {
    has: () => true,
    get: (t, k) => (k === Symbol.unscopables ? undefined : k in t ? t[k] : k in window ? window[k] : stub),
    set: (t, k, v) => { window[k] = v; return true; },
  });
  vm.runInNewContext(`with (sb) { ${code} }`, { sb: sandbox });
  return window.LESSON;
}

const text = t => String(t).replace(/\[\[([^\]|]+)(\|[^\]]*)?\]\]/g, '$1').replace(/\*\*/g, '');
const needsLesson = q => q.pic || q.img || q.optionsHtml || q.html || /\bvideo\b|\bpicture\b|\bshown\b|\bthis (clock|map|graph|chart)\b|\babove\b|\bbelow\b/i.test(q.q || '');
const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const lessons = [...index.matchAll(/id: '([^']+)'[^\n]*file: '([^']+)'/g)].map(m => ({ id: m[1], file: m[2] }));
const bank = {};
for (const { id, file } of lessons) {
  const L = loadLesson(file), out = [];
  for (const s of L.stages || []) {
    if (s.type !== 'quiz') continue; // video questions often lean on what the video showed
    for (const q of s.questions || []) {
      const type = q.type || 'mcq';
      if (!['mcq', 'tf', 'gap', 'type'].includes(type) || needsLesson(q)) continue;
      const b = { type, q: text(q.q || ''), answer: q.answer };
      if (q.options) b.options = q.options.map(text);
      if (q.hint) b.hint = text(q.hint);
      if (q.explain) b.explain = text(q.explain);
      if (type === 'tf' && !b.q) continue;
      out.push(b);
    }
  }
  bank[id] = out;
  console.log(`${String(out.length).padStart(3)}  ${file}`);
}
fs.writeFileSync(path.join(ROOT, 'shared/question-bank.js'),
  '/* Quick questions from every lesson, for the quest map\'s challenger NPCs. Made by tools/build-question-bank.js – don\'t edit by hand. */\n'
  + `window.QUESTION_BANK = ${JSON.stringify(bank)};\n`);
console.log(`\nWrote shared/question-bank.js (${Object.values(bank).reduce((n, a) => n + a.length, 0)} questions).`);
