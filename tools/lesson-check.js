#!/usr/bin/env node
/* Lesson check: loads each lesson's LESSON data and checks every question and game round is well-formed
 * (answers in range, evidence answers found in the page, hotspot/slider answers that can be reached …).
 *   node tools/lesson-check.js                     every lesson in the library
 *   node tools/lesson-check.js english/a-or-an.html  just these lessons
 *   node tools/lesson-check.js --library=other.js    read the library (and its road map) from another file
 * It also checks the quest map. The stop before a lesson on its world's road is the lesson listed before it, or the one
 * named by `after:`. A lesson in the same unit as that stop must open with a recap of it ("Last time…", `from.url`);
 * a lesson that starts a new unit must open with a warm-up instead (a review stage whose `from` has no url).
 * It warns (without failing) about files over 1,500 lines: the lessons it checks, and on a full run shared/ too.
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
    case 'setclock': {
      const m = /^(\d{1,2}):(\d{2})$/.exec(q.time || '');
      if (!m || +m[1] < 1 || +m[1] > 12 || +m[2] > 59) err(`${where}: setclock time "${q.time}" should be like 3:45`);
      else if (+m[2] % (q.step || 5)) err(`${where}: setclock time ${q.time} can't be reached in steps of ${q.step || 5}`);
      if (q.start && q.start === q.time) err(`${where}: setclock starts on the answer`);
      break;
    }
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
    case 'windtest': {
      const ids = (r.seeds || []).map(sd => sd.id);
      if (ids.length < 2) err(`${where}: needs at least two seeds`);
      (r.missions || []).forEach((m, k) => (m.need || []).forEach(id => { if (!ids.includes(id)) err(`${where} mission ${k + 1}: no seed "${id}"`); }));
      break;
    }
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

// teach the robot: each line is right (ok) or has exactly one wrong word that the fix replaces
function checkTeach(s, at, err) {
  const bare = w => w.toLowerCase().replace(/^[^a-z']+|[^a-z']+$/gi, '');
  if (!(s.lines || []).length) err(`${at}: no lines`);
  (s.lines || []).forEach((l, k) => {
    const where = `${at} line ${k + 1}`;
    if (/\[\[|\*\*|</.test(l.text)) err(`${where}: lines are split into word buttons, so no [[glossary]], **bold** or HTML`);
    if (l.ok) return;
    const tokens = String(l.text).split(/\s+/);
    const wi = l.wrongAt != null ? l.wrongAt : tokens.findIndex(t => bare(t) === String(l.wrong).toLowerCase());
    if (wi < 0 || wi >= tokens.length) err(`${where}: the wrong word isn't in the sentence (use wrongAt for numbers)`);
    else if (l.wrongAt != null && l.wrong != null && tokens[wi].replace(/[.,!?;:]+$/, '') !== String(l.wrong).replace(/[.,!?;:]+$/, '')) err(`${where}: wrongAt ${wi} points at "${tokens[wi]}", not "${l.wrong}" (count the words from 0)`);
    if (!l.fix) err(`${where}: no fix`);
    if ((l.options || []).includes(l.fix)) err(`${where}: options repeat the fix`);
    if (!l.why) err(`${where}: no why`);
  });
  if ((s.lines || []).every(l => !l.ok)) err(`${at}: give at least one line that is right, so "That's right!" is a real choice`);
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
      if (c.check && !['mcq', 'evidence', 'hotspot', 'slider', 'oddone', 'build', 'type', 'predict', 'setclock'].includes(c.check.type || 'mcq')) err(`${at} page ${ci + 1} check: a reading check can't be "${c.check.type}" (use mcq or a hands-on type)`);
      if (c.check) checkQuestion(c.check, `${at} page ${ci + 1} check`, err, { passage: c.comic ? c.comic.map(x => x.say) : [].concat(c.text || c.paras || []) });
    });
    (s.questions || []).forEach((q, k) => checkQuestion(q, `${at} q${k + 1}`, err));
    (s.rounds || []).forEach((r, k) => checkRound(r, `${at} round ${k + 1} (${r.game})`, err));
    if (s.game) checkRound(s.game, `${at} game`, err);
    if (s.type === 'teach') checkTeach(s, at, err);
    if (s.type === 'case') {
      if (!s.mystery) err(`${at}: no mystery (the case file)`);
      (s.clues || []).forEach((c, k) => { if (!c.clue) err(`${at} clue ${k + 1}: no clue text`); if (!c.q) err(`${at} clue ${k + 1}: no question`); else checkQuestion(c.q, `${at} clue ${k + 1}`, err); });
      if (!(s.clues || []).length) err(`${at}: no clues`);
      if (!s.solve) err(`${at}: no solve question`); else checkQuestion(s.solve, `${at} solve`, err);
    }
    if (s.type === 'investigate') {
      const P = s.predict || {};
      if (!(P.options || []).length) err(`${at}: the prediction needs options`);
      if (P.answer != null && !(P.answer in (P.options || []))) err(`${at}: prediction answer ${P.answer} is not an option`);
      if (!s.test || !s.test.game) err(`${at}: no test game`); else checkRound(s.test, `${at} test (${s.test.game})`, err);
      (s.explain || []).forEach((q, k) => checkQuestion(q, `${at} explain q${k + 1}`, err));
      if (!(s.explain || []).length) err(`${at}: no explain questions`);
    }
  });
  return errs;
}

const args = process.argv.slice(2);
const home = (args.find(a => a.startsWith('--library=')) || '--library=shared/library.js').slice(10);
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
// files over ~1,500 lines are hard to work on: split them (engine games go in parts under shared/engine/)
const MAX_LINES = 1500;
const LONG_OK = ['shared/pixel-icons.js', 'shared/question-bank.js']; // sprite and generated data, fine to be long
const sized = args.some(a => !a.startsWith('--')) ? files
  : [...files, ...['shared', 'shared/engine'].flatMap(d => fs.readdirSync(path.join(ROOT, d)).filter(f => f.endsWith('.js')).map(f => `${d}/${f}`))];
const long = sized.filter(f => !LONG_OK.includes(f))
  .map(f => [f, fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').length]).filter(([, n]) => n > MAX_LINES);
if (long.length) console.log(`\n⚠️  Over ${MAX_LINES.toLocaleString('en-GB')} lines (split when you next change them):\n${long.map(([f, n]) => `   ${f}: ${n.toLocaleString('en-GB')} lines`).join('\n')}`);
console.log(bad ? `\n${bad} problem${bad === 1 ? '' : 's'}.` : '\nAll good.');
process.exit(bad ? 1 : 0);
