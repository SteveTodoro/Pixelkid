#!/usr/bin/env node
/* Lesson check: loads each lesson's LESSON data and checks every question and game round is well-formed
 * (answers in range, evidence answers found in the page, hotspot/slider answers that can be reached …).
 *   node tools/lesson-check.js                     every lesson in the library
 *   node tools/lesson-check.js english/a-or-an.html  just these lessons
 *   node tools/lesson-check.js --home=other.html     read the library (and its road map) from another home page
 * It also checks the quest map. The stop before a lesson on its world's road is the lesson listed before it, or the one
 * named by `after:`. A lesson in the same unit as that stop must open with a recap of it ("Last time…", `from.url`);
 * a lesson that starts a new unit must open with a warm-up instead (a review stage whose `from` has no url).
 * Exits with code 1 when anything is wrong. Run it with tools/activity-audit.js after writing or changing a lesson.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');

// A stand-in for every browser helper a lesson calls while building its data (Pixel.svg, Clock.svg …):
// any property or call returns another stand-in, and it turns into an empty string when used as text.
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

const strip = t => String(t).replace(/\[\[([^\]|]+)(\|[^\]]*)?\]\]/g, '$1').replace(/\*\*/g, '').toLowerCase();
const sentences = t => (strip(t).match(/[^.!?…]+[.!?…]+["'”’)]*\s*|[^.!?…]+$/g) || [strip(t)]);
const cleanTyped = t => String(t).toLowerCase().replace(/[^a-z0-9£:]+/g, ' ').trim();
const isInt = (n, len) => Number.isInteger(n) && n >= 0 && n < len;

function checkQuestion(q, where, err, ctx = {}) {
  const type = q.type || 'mcq';
  if (!q.q && type !== 'tf') err(`${where}: no question text`);
  switch (type) {
    case 'mcq': case 'gap':
      if (!Array.isArray(q.options) || q.options.length < 2) return err(`${where}: needs 2+ options`);
      if (!isInt(q.answer, q.options.length)) err(`${where}: answer ${q.answer} is not an option index`);
      if (!q.optionsHtml && new Set(q.options.map(String)).size !== q.options.length) err(`${where}: repeated option`);
      if (type === 'gap' && !String(q.q).includes('___')) err(`${where}: gap question has no ___`);
      break;
    case 'tf':
      if (typeof q.answer !== 'boolean') err(`${where}: tf answer must be true or false`);
      break;
    case 'order':
      if (!Array.isArray(q.items) || q.items.length < 2) err(`${where}: order needs 2+ items`);
      break;
    case 'evidence': {
      const passage = ctx.passage || [].concat(q.passage || []);
      if (!passage.length) return err(`${where}: evidence needs a passage (or a reading page)`);
      const sents = passage.flatMap(sentences);
      for (const a of [].concat(q.answer)) {
        const n = sents.filter(s => s.includes(String(a).toLowerCase())).length;
        if (!n) err(`${where}: evidence answer "${a}" is not in any sentence`);
      }
      const proving = sents.filter(s => [].concat(q.answer).some(a => s.includes(String(a).toLowerCase())));
      if (proving.length === sents.length) err(`${where}: every sentence proves it – the answer is too broad`);
      break;
    }
    case 'hotspot':
      if (!Array.isArray(q.spots) || q.spots.length < 2) return err(`${where}: hotspot needs 2+ spots`);
      for (const a of [].concat(q.answer)) if (!isInt(a, q.spots.length)) err(`${where}: hotspot answer ${a} is not a spot index`);
      if (!q.img) err(`${where}: hotspot has no img`);
      break;
    case 'slider': {
      const min = q.min ?? 0, max = q.max ?? 100, step = q.step || 1;
      if (!(max > min)) err(`${where}: slider max must be above min`);
      if (typeof q.answer !== 'number' || q.answer < min || q.answer > max) err(`${where}: slider answer outside ${min}–${max}`);
      else if (Math.abs(((q.answer - min) / step) - Math.round((q.answer - min) / step)) > 1e-6 && !(q.tolerance >= step / 2)) err(`${where}: slider answer can't be reached in steps of ${step}`);
      if ((q.from ?? min) === q.answer) err(`${where}: slider starts on the answer`);
      break;
    }
    case 'oddone':
      if (!Array.isArray(q.items) || q.items.length < 3) return err(`${where}: oddone needs 3+ items`);
      if (!isInt(q.answer, q.items.length)) err(`${where}: oddone answer is not an item index`);
      if (!Array.isArray(q.reasons) || !isInt(q.reason, q.reasons.length)) err(`${where}: oddone needs reasons + a reason index`);
      break;
    case 'build':
      if (!Array.isArray(q.answer) || q.answer.length < 2) return err(`${where}: build answer must be a list of 2+ tiles`);
      for (const x of q.extra || []) if (q.answer.includes(x)) err(`${where}: build decoy "${x}" is also in the answer`);
      break;
    case 'type':
      if (![].concat(q.answer).length || [].concat(q.answer).some(a => !cleanTyped(a))) err(`${where}: type answer is empty after cleaning`);
      break;
    case 'predict':
      if (!Array.isArray(q.options) || q.options.length < 2) err(`${where}: predict needs 2+ options`);
      if (q.answer != null && !isInt(q.answer, q.options.length)) err(`${where}: predict answer is not an option index`);
      if (!q.reveal) err(`${where}: predict needs a reveal`);
      if (!q.then) err(`${where}: predict needs a then question`);
      else checkQuestion(q.then, `${where} → then`, err);
      break;
    default:
      err(`${where}: unknown question type "${type}"`);
  }
}

function checkItems(items, where, err) {
  if (!Array.isArray(items) || !items.length) return err(`${where}: no items`);
  if (!items.some(i => i.ok)) err(`${where}: no right items`);
  if (!items.some(i => !i.ok)) err(`${where}: no wrong items`);
  for (const i of items) if (!i.label) err(`${where}: an item has no label`);
}

function checkRound(r, where, err) {
  (r.missions || []).forEach((m, mi) => (m.ask || []).forEach((q, k) => checkQuestion(q, `${where} mission ${mi + 1} q${k + 1}`, err)));
  switch (r.game) {
    case 'questions':
      (r.questions || []).forEach((q, k) => checkQuestion(q, `${where} q${k + 1}`, err));
      if (!(r.questions || []).length) err(`${where}: no questions`);
      break;
    case 'runner': case 'platformer':
      checkItems(r.items, where, err);
      break;
    case 'invaders':
      if (!(r.waves || []).length) err(`${where}: no waves`);
      (r.waves || []).forEach((w, k) => (w.spell ? !w.clue && err(`${where} wave ${k + 1}: spelling wave needs a clue`) : checkItems(w.items, `${where} wave ${k + 1}`, err)));
      break;
    case 'mystery':
      if (!(r.words || []).length) err(`${where}: no words`);
      for (const w of r.words || []) {
        if (!w.word || !(w.clues || []).length) err(`${where}: a word needs word + clues`);
        if (w.options && !w.options.includes(w.word)) err(`${where}: options for "${w.word}" don't include it`);
        if ((w.clues || []).some(c => strip(c).includes(String(w.word).toLowerCase()))) err(`${where}: a clue gives away "${w.word}"`);
      }
      break;
    case 'crossword':
      for (const e of r.entries || []) if (!/^[A-Z]+$/.test(e.answer)) err(`${where}: crossword answer "${e.answer}" must be A–Z capitals`);
      break;
    case 'wordsearch':
      for (const w of r.words || []) if (w.length > (r.size || 10)) err(`${where}: "${w}" is longer than the grid`);
      break;
  }
}

function check(file) {
  const errs = [];
  const err = m => errs.push(m);
  let L;
  try { L = loadLesson(file); } catch (e) { return [`could not load: ${e.message}`]; }
  if (!L) return ['no window.LESSON'];
  (L.stages || []).forEach((s, si) => {
    const at = `stage ${si + 1} (${s.type}${s.title ? ': ' + s.title : ''})`;
    (s.cards || []).forEach((c, ci) => {
      if (c.check && !['mcq', 'evidence', 'hotspot', 'slider', 'oddone', 'build', 'type', 'predict'].includes(c.check.type || 'mcq')) err(`${at} page ${ci + 1} check: a reading check can't be "${c.check.type}" (use mcq or a hands-on type)`);
      if (c.check) checkQuestion(c.check, `${at} page ${ci + 1} check`, err, { passage: c.comic ? c.comic.map(x => x.say) : [].concat(c.text || c.paras || []) });
    });
    (s.questions || []).forEach((q, k) => checkQuestion(q, `${at} q${k + 1}`, err));
    (s.rounds || []).forEach((r, k) => checkRound(r, `${at} round ${k + 1} (${r.game})`, err));
    if (s.game) checkRound(s.game, `${at} game`, err);
  });
  return errs;
}

const args = process.argv.slice(2);
const home = (args.find(a => a.startsWith('--home=')) || '--home=index.html').slice(7);
let files = args.filter(a => !a.startsWith('--'));
const index = fs.readFileSync(path.join(ROOT, home), 'utf8');
if (!files.length) files = [...index.matchAll(/file: '([^']+)'/g)].map(m => m[1]).filter(f => fs.existsSync(path.join(ROOT, f)));

// the road map: each lesson's stop before it (same rule as the home page's roadTree)
const roadErrs = {}, before = {};
{
  const src = index.match(/const LIBRARY = (\{[\s\S]*?\n\});/);
  const LIB = src ? vm.runInNewContext(`(${src[1]})`) : {};
  for (const [world, w] of Object.entries(LIB)) {
    w.lessons.forEach((l, i) => {
      const p = l.after ? w.lessons.find(x => x.title === l.after) : w.lessons[i - 1];
      if (l.after && !p) (roadErrs[l.file || world] = roadErrs[l.file || world] || []).push(`map: "${l.title}" is after "${l.after}", which isn't in the ${world} world`);
      if (l.file) before[l.file] = { l, p: p || null };
    });
  }
}
function checkRecap(file) {
  if (!(file in before)) return [];
  const { l, p } = before[file], same = p && p.unit === l.unit;
  const review = (loadLesson(file).stages || []).find(s => s.type === 'review'), from = (review && review.from) || {};
  if (!review) return same && p.file ? [`map: same unit as "${p.title}", so start with a recap of it`] : [];
  if (!from.url) return same && p.file ? [`map: same unit as "${p.title}", so recap it instead of a warm-up`] : [];
  if (!same) return [`map: starts a new unit (${l.unit}), so open with a warm-up instead of a recap of "${from.title}"`];
  return from.title === p.title ? [] : [`map: the recap looks back at "${from.title}", but the stop before this one on the road is "${p.title}"`];
}

let bad = 0;
for (const e of Object.entries(roadErrs)) if (!files.includes(e[0])) { bad += e[1].length; console.log(`❌ ${home}\n${e[1].map(x => '   ' + x).join('\n')}`); }
for (const f of files) {
  const errs = [...check(f), ...(roadErrs[f] || []), ...checkRecap(f)];
  if (errs.length) { bad += errs.length; console.log(`❌ ${f}\n${errs.map(e => '   ' + e).join('\n')}`); }
  else console.log(`✅ ${f}`);
}
console.log(bad ? `\n${bad} problem${bad === 1 ? '' : 's'}.` : '\nAll good.');
process.exit(bad ? 1 : 0);
