#!/usr/bin/env node
/* Activity audit: is each lesson's mix of activities varied enough? Run it after writing or changing a lesson.
 *   node tools/activity-audit.js          every lesson in library order, with its warnings
 *   node tools/activity-audit.js --warn   only the lessons that have warnings
 * Warnings (the rules are in TOPICS.md):
 *   - more than one word puzzle (crossword / wordsearch) in a lesson, or puzzles in two lessons in a row
 *   - the same arcade game as the lesson before it in the same world (the Spell Test's own Letter Blaster doesn't count:
 *     it is part of every spell test)
 *   - multiple choice is more than 60% of the lesson's questions (reading checks count too)
 *   - exactly the same stage order as the lesson before it in the same world
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const STAGES = ['welcome', 'review', 'read', 'video', 'game', 'break', 'quiz', 'investigate', 'case', 'teach'];
const QUESTIONS = ['mcq', 'tf', 'gap', 'order', 'evidence', 'hotspot', 'slider', 'oddone', 'build', 'type', 'predict'];
const PUZZLES = ['crossword', 'wordsearch'];
const ARCADE = ['invaders', 'runner', 'platformer', 'blocks'];
const MCQ_LIMIT = 0.6;

// lessons in the order the library lists them, grouped by world
const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const worlds = [];
for (const m of index.matchAll(/^  (\w+): \{\n\s+label: '([^']+)'([\s\S]*?)\n    \],/gm)) {
  worlds.push({ key: m[1], label: m[2], files: [...m[3].matchAll(/file: '([^']+)'/g)].map(f => f[1]) });
}

const count = list => list.reduce((o, k) => ((o[k] = (o[k] || 0) + 1), o), {});
const show = o => Object.entries(o).map(([k, n]) => (n > 1 ? `${k}×${n}` : k)).join(' ') || '–';

function audit(file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const types = [...src.matchAll(/type: '(\w+)'/g)].map(m => m[1]);
  const stages = types.filter(t => STAGES.includes(t));
  const games = [...src.matchAll(/game: '(\w+)'/g)].map(m => m[1]);
  // arcade rounds inside a Spell Test stage (the Letter Blaster) are part of the test, not the lesson's arcade pick
  const spellArcade = src.split(/\n\s*\{\s*\n\s*type: '/).filter(part => /kind: 'Spelling test'/.test(part))
    .flatMap(part => [...part.matchAll(/game: '(\w+)'/g)].map(m => m[1])).filter(g => ARCADE.includes(g));
  const arcade = games.filter(g => ARCADE.includes(g));
  spellArcade.forEach(g => arcade.splice(arcade.indexOf(g), 1));
  // questions: every typed question, plus reading checks that don't set a type (those are multiple choice)
  const qs = types.filter(t => QUESTIONS.includes(t));
  const plainChecks = [...src.matchAll(/(?:check|q|solve): \{(?![^{}]*\btype:)/g)].length; // case clues and solves are questions too
  for (let k = 0; k < plainChecks; k++) qs.push('mcq');
  return { file, stages, games, arcade, qs };
}

const warnOnly = process.argv.includes('--warn');
let total = 0;
for (const w of worlds) {
  let prev = null;
  const out = [];
  for (const file of w.files) {
    if (!fs.existsSync(path.join(ROOT, file))) continue;
    const a = audit(file), warn = [];
    const puzzles = a.games.filter(g => PUZZLES.includes(g));
    if (puzzles.length > 1) warn.push(`${puzzles.length} word puzzles (max 1)`);
    if (puzzles.length && prev && prev.games.some(g => PUZZLES.includes(g))) warn.push('word puzzle again (the lesson before had one too)');
    const repeat = [...new Set(a.arcade.filter(g => prev && prev.arcade.includes(g)))];
    if (repeat.length) warn.push(`same arcade game as the lesson before: ${repeat.join(', ')}`);
    const mcq = a.qs.filter(t => t === 'mcq').length;
    if (a.qs.length && mcq / a.qs.length > MCQ_LIMIT) warn.push(`multiple choice is ${Math.round(mcq / a.qs.length * 100)}% of questions (max ${MCQ_LIMIT * 100}%)`);
    if (prev && prev.stages.join() === a.stages.join()) warn.push('same stage order as the lesson before');
    total += warn.length;
    if (!warnOnly || warn.length) {
      out.push(`  ${file}`,
        `    stages:    ${a.stages.join(' → ')}`,
        `    games:     ${show(count(a.games))}`,
        `    questions: ${show(count(a.qs))}`,
        ...warn.map(x => `    ⚠️  ${x}`));
    }
    prev = a;
  }
  if (out.length) console.log(`\n${w.label}\n${out.join('\n')}`);
}
console.log(`\n${total} warning${total === 1 ? '' : 's'}.`);
