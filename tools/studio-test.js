#!/usr/bin/env node
/* Plays the Game Builder lessons' pretend studio (studiosim) and Studio missions (studiotask) to the end through their
 * _test hooks, in the same simulated browser as smoke.js. Run after changing shared/engine/studio.js or a Game Builder
 * lesson:  node tools/studio-test.js
 * Each studiosim round has a driver below that does what its missions ask (move, scale, play…). A new lesson round needs one.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { open, answer, moveOn, wait } = require('./smoke.js');

const ROOT = path.join(__dirname, '..');
const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };

// what to do for each mission, by lesson file and round title
const DRIVERS = {
  'future/studio-explore.html': {
    'Camera Training': [
      T => { T.key('w'); T.key('s'); },
      T => { T.key('e'); T.key('q'); },
      T => { T.turn(180); T.frames(2); },
      T => { T.select('tree'); T.focus(); },
      T => { T.insert(); },
    ],
  },
  'future/studio-tools.html': {
    'Build Lab': [
      T => { T.select('box'); T.move('y', 4); },
      T => { T.move('x', 8); },
      T => { T.select('plat'); T.scale('x', 8); },
      T => { T.select('wall'); T.scale('y', 5); },
      T => { T.select('ramp'); T.rotate(180); },
    ],
  },
  'future/studio-paint.html': {
    'Paint & Anchor Lab': [
      T => T.prop('plat', 'color', 'Bright red'),
      T => T.prop('bridge', 'material', 'Wood'),
      T => T.prop('window', 'transparency', 0.5),
      T => T.run(2),
      T => { T.stop(); T.prop('float', 'anchored', true); T.run(2); },
      T => { T.stop(); T.prop('pillar', 'material', 'Neon'); },
    ],
  },
  'future/studio-obby.html': {
    'Jump Lab': [
      T => T.run(6),
      T => {
        T.stop();
        T.select('step'); T.duplicate(); T.moveTo(T.selected, { x: -1 });
        T.select('step'); T.duplicate(); T.moveTo(T.selected, { x: 7 });
        T.run(10);
      },
      T => { T.select('step'); T.duplicate(); T.moveTo(T.selected, { x: -1, y: 8.5 }); T.run(10); },
      T => { T.stop(); T.select('step'); T.del(); T.undo(); },
    ],
  },
  'future/studio-script.html': {
    'See-through script': [
      T => { T.slot('t', '0.5'); T.start(); },
      T => { T.stop(); T.slot('t', '1'); T.start(); },
    ],
    'Lava script': [
      T => T.run(6),
      T => { T.stop(); T.slot('hp', '0'); T.run(6); },
    ],
    'The AI\'s spinner': [
      T => T.start(),
      T => { T.stop(); T.slot('speed', '20'); T.start(); },
    ],
  },
};

function lessonData(file) { // the LESSON object, read the same way lesson-check.js does
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const code = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n;\n');
  const stub = new Proxy(function () {}, { get: (_, k) => (k === Symbol.toPrimitive ? () => '' : stub), apply: () => stub });
  const window = {};
  vm.runInNewContext(`with (sb) { ${code} }`, { sb: new Proxy({ window, Math, JSON, Array, Object, String }, { has: () => true, get: (t, k) => (k === Symbol.unscopables ? undefined : k in t ? t[k] : k in window ? window[k] : stub), set: (t, k, v) => { window[k] = v; return true; } }) });
  return window.LESSON;
}
const one = (L, round) => ({
  lesson: v => Object.assign({}, v, { midBreak: false, stages: [{ type: 'game', title: 'test', rounds: [round] }] }),
  setup: w => w.localStorage.setItem('y3:progress:' + L.id, JSON.stringify({ stage: 0, maxStage: 0, mid: true, layout: v(L) })),
});
const v = L => L.layout || 1;
const btn = (root, re) => [...root.querySelectorAll('button')].find(b => re.test(b.textContent) && !b.disabled && !b.hidden);

async function sim(file, L, round) {
  const where = `${file} · ${round.title}`, drive = (DRIVERS[file] || {})[round.title];
  if (!drive) return fails.push(`${where}: no driver in tools/studio-test.js`);
  if (drive.length !== round.missions.length) fails.push(`${where}: ${round.missions.length} missions but ${drive.length} drivers`);
  const page = await open(file, one(L, round));
  try {
    const card = page.d.querySelector('.stage-card'), g = card.querySelector('.studiosim'), T = g && g._test;
    if (!T) throw new Error('no studiosim or no _test hook');
    for (let mi = 0; mi < round.missions.length; mi++) {
      ok(T.mission === mi, `${where}: expected mission ${mi + 1}, on ${T.mission + 1}`);
      await drive[mi](T);
      await wait(30);
      const ask = card.querySelector('.lab-ask');
      for (const q of round.missions[mi].ask || []) { await answer(page, ask, q); await moveOn(ask); }
      const go = btn(ask, /Next mission|Finish/);
      if (!go) { fails.push(`${where}: mission ${mi + 1} not won (did: ${T.did.join(' ')})`); break; }
      go.click(); await wait(30);
    }
    const nx = [...card.querySelectorAll('.navrow button')].pop();
    ok(nx && !nx.disabled, `${where}: the stage did not finish`);
  } catch (e) { fails.push(`${where}: ${e.stack}`); }
  page.errors.forEach(e => fails.push(`${where}: ${e}`));
  page.close();
}

async function task(file, L, round) {
  const where = `${file} · ${round.title}`;
  const page = await open(file, one(L, round));
  try {
    const card = page.d.querySelector('.stage-card'), g = card.querySelector('.studiotask'), T = g && g._test;
    if (!T) throw new Error('no studiotask or no _test hook');
    for (let si = 0; si < round.steps.length; si++) {
      const s = round.steps[si], box = card.querySelector('.stk-card');
      ok(T.step === si, `${where}: expected step ${si + 1}, on ${T.step + 1}`);
      ok(box.textContent.includes(s.title), `${where}: step ${si + 1} doesn't show its title`);
      if (s.where || s.tip || s.clip) {
        btn(box, /Show me/).click(); await wait(10);
        if (s.where) ok(box.querySelector('.stk-map svg'), `${where}: step ${si + 1} has no Studio map`);
      }
      if (s.check) {
        await answer(page, box.querySelector('.stk-check'), s.check); await wait(30);
        const go = btn(box, /Next step|Mission complete/);
        if (!go) { fails.push(`${where}: step ${si + 1} check didn't unlock the next step`); break; }
        go.click();
      } else btn(box, /Done!|Mission complete/).click();
      await wait(30);
    }
    ok(card.textContent.includes('STUDIO MISSION COMPLETE'), `${where}: no mission complete screen`);
    const nx = [...card.querySelectorAll('.navrow button')].pop();
    ok(nx && !nx.disabled, `${where}: the stage did not finish`);
  } catch (e) { fails.push(`${where}: ${e.stack}`); }
  page.errors.forEach(e => fails.push(`${where}: ${e}`));
  page.close();
}

// the mission's place is saved: a page reopened after two steps carries on at step 3
async function resume(file, L, round) {
  const page = await open(file, one(L, round));
  const box = () => page.d.querySelector('.stk-card');
  for (let k = 0; k < 2; k++) {
    const s = round.steps[k];
    if (s.check) { await answer(page, box().querySelector('.stk-check'), s.check); await wait(20); btn(box(), /Next step/).click(); } else btn(box(), /Done!/).click();
    await wait(20);
  }
  const saved = page.w.localStorage.getItem(`y3:studio:${L.id}:s0r0`);
  page.close();
  ok(saved === '2', `${file}: the mission step wasn't saved (got ${saved})`);
}

(async () => {
  const files = Object.keys(DRIVERS);
  for (const file of files) {
    const L = lessonData(file);
    for (const s of L.stages) for (const r of s.rounds || []) {
      if (r.game === 'studiosim') await sim(file, L, r);
      if (r.game === 'studiotask') await task(file, L, r);
    }
  }
  const L1 = lessonData(files[0]), r1 = L1.stages.flatMap(s => s.rounds || []).find(r => r.game === 'studiotask');
  await resume(files[0], L1, r1);
  console.log(fails.length ? '❌ ' + fails.join('\n❌ ') : `✅ Game Builder: every Studio sim and Studio mission played to the end (${files.length} lessons).`);
  process.exit(fails.length ? 1 : 0);
})();
