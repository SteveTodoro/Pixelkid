#!/usr/bin/env node
/* Plays every Brain Dojo game to the end through its _test hook, in the same simulated browser as smoke.js, plus the
 * vanishing page and the Memory Key. Run after changing shared/engine/brain.js:  node tools/brain-test.js
 */
const { open, wait } = require('./smoke.js');

const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };
const stub = (stage, extra = {}) => ({
  lesson: v => Object.assign({}, v, { midBreak: false, stages: [stage] }, extra),
  setup: w => w.localStorage.setItem('y3:progress:' + 'brain-test', JSON.stringify({ stage: 0, maxStage: 0, mid: true, layout: 2 })),
});
const ROOMS = ['🚪 front door', '👟 shoe rack', '🛋️ sofa', '📺 TV', '🛏️ bed'];
const DECOYS = ['🥕 carrot', '🍕 pizza', '🎈 balloon', '🧢 cap', '📕 book'];

async function game(name, round, drive, file = 'brain/memory-palace.html') {
  let page;
  try {
    page = await open(file, stub({ type: 'game', title: name, rounds: [round] }, { id: 'brain-test', layout: 2 }));
    const card = page.d.querySelector('.stage-card');
    const g = card.querySelector('.game');
    ok(g && g._test, `${name}: no game or no _test hook`);
    if (g && g._test) await drive(g._test, card, page);
    const nx = [...card.querySelectorAll('.navrow button')].pop();
    ok(nx && !nx.disabled, `${name}: the stage did not finish`);
    page.errors.forEach(e => fails.push(`${name}: ${e}`));
  } catch (e) { fails.push(`${name}: ${e.message}`); }
  if (page) page.close();
}

(async () => {
  await game('palace', { game: 'palace', rooms: ROOMS, decoys: DECOYS, missions: [
    { mode: 'list', seconds: 1, text: 'list', items: ['🦆 duck', '🎸 guitar', '🍉 melon'] },
    { text: 'palace', items: ['🍌 banana', '🧀 cheese', '🥚 eggs', '🍞 bread'] },
  ] }, async (T, card) => {
    T.skipRead(); await wait(50);
    ok(T.phase === 'pick', 'palace: the list did not vanish');
    T.pickAll(); await wait(50);
    [...card.querySelectorAll('.lab-ask button')].find(b => /Next mission/.test(b.textContent)).click(); await wait(50);
    T.items.forEach((t, k) => T.place(k, t));
    T.walkAll(); ok(T.phase === 'recall', 'palace: the walk did not end in recall');
    for (let k = 0; k < 4; k++) { T.answer(); await wait(20); }
    ok(T.phase === 'done', 'palace: recall did not finish');
    ok(/4 \/ 4/.test(card.querySelector('.data-box').textContent), 'palace: results table has no 4 / 4');
    [...card.querySelectorAll('.lab-ask button')].find(b => /Finish/.test(b.textContent)).click(); await wait(50);
  });

  await game('sequence', { game: 'sequence', blocks: 4, start: 2, target: 3 }, async T => {
    await wait(700);
    for (let k = 0; k < 2 && !T.finished; k++) {
      T.unbusy(); const len = T.len; T.tune.forEach(n => T.press(n));
      ok(T.finished || T.len === len + 1, 'sequence: the tune did not get longer');
      await wait(1200);
    }
    ok(T.finished, 'sequence: did not finish');
    await wait(700);
  });

  await game('themed echo', { game: 'sequence', tunes: [
    { text: 'Count in 4s!', notes: ['4', '8', '12', '16', '20'], show: 3, decoys: ['10', '14'] },
    { text: 'Spell it', notes: ['l', 'e', 't', 't', 'e', 'r'] },
  ] }, async (T, card) => {
    await wait(800);
    T.unbusy(); T.press('10'); await wait(1300); T.unbusy(); T.press('14');
    ok(card.querySelector('.bd-note.hint'), 'themed echo: no hint glow after two misses');
    T.unbusy(); T.notes.forEach(n => T.press(n));
    ok(!card.querySelector('.bd-note.hint'), 'themed echo: the hint glow stayed on');
    await wait(1500);
    ok(T.ti === 1 && T.labels.length === 4, 'themed echo: the second tune did not start with 4 unique letters');
    T.unbusy(); T.notes.forEach(n => T.press(n));
    await wait(2300);
    ok(T.finished, 'themed echo: did not finish');
  });

  await game('echo outside the Dojo', { game: 'sequence', blocks: 4, start: 2, target: 2 }, async (T, card, page) => {
    ok([...page.d.querySelectorAll('link[rel=stylesheet]')].some(l => /brain\.css$/.test(l.href)), 'echo outside the Dojo: brain.css was not loaded');
    await wait(700); T.unbusy(); T.tune.forEach(n => T.press(n)); await wait(700);
    ok(T.finished, 'echo outside the Dojo: did not finish');
  }, 'maths/money.html');

  await game('digits', { game: 'sequence', mode: 'digits', chunk: true, lengths: [4, 5] }, async T => {
    for (let k = 0; k < 2; k++) { T.hide(); T.type(T.num); await wait(1000); }
    await wait(600);
  });

  await game('spotter', { game: 'spotter', turns: [
    { items: ['🍎 apple', '🧸 teddy', '⚽ ball', '📕 book'], seconds: 1, change: 'missing' },
    { items: ['🦆 duck', '🎺 trumpet', '🍩 doughnut'], seconds: 1, change: 'new', extra: '🐸 frog' },
    { items: ['🐙 octopus', '🚀 rocket', '🍕 pizza', '🎩 top hat'], seconds: 1, change: 'swap' },
  ] }, async T => {
    for (let k = 0; k < 3; k++) { T.reveal(); T.solve(); await wait(1200); }
    ok(T.phase === 'done', 'spotter: did not finish');
    await wait(600);
  });

  await game('gonogo', { game: 'gonogo', distract: true, phases: [
    { rule: 'Tap only the ⭐ stars!', go: ['⭐'], nogo: ['💣'], count: 4 },
    { rule: 'Now only the 🍎 apples!', go: ['🍎'], nogo: ['⭐'], count: 4 },
  ] }, async T => {
    for (let p = 0; p < 2; p++) {
      T.start();
      for (let k = 0; k < 400 && T.phase === p; k++) { T.frames(3); T.tapAllGo(); }
    }
    ok(T.finished, 'gonogo: did not finish');
    await wait(600);
  });

  await game('clash', { game: 'clash', turns: 6, flip: 3 }, async T => {
    for (let k = 0; k < 6; k++) { T.unlock(); T.answerRight(); }
    ok(T.done, 'clash: did not finish');
    await wait(1300);
  });

  await game('breathe', { game: 'breathe', breaths: 2, side: 1 }, async T => {
    T.hold(); T.frames(30 * 9); ok(T.finished, 'breathe: did not finish');
    await wait(700);
  });

  await game('spotdiff', { game: 'spotdiff', scenes: [
    { cols: 4, diffs: 3, items: ['🌳', '☀️', '', '🎈', '🐕', '🚲', '🌸', '', '🦆'] },
    { cols: 3, diffs: 4, items: ['🛏️', '🧸', '📚', '⏰', '🎸', '🧦', '🎒', '👟', '🚀'] },
  ] }, async T => {
    T.miss(); T.hint();
    ok(T.diffs.length === 3, 'spotdiff: scene 1 did not get 3 differences');
    T.solve(); await wait(1700);
    ok(T.scene === 1 && T.diffs.length === 4, 'spotdiff: did not move on to scene 2');
    T.solve(); await wait(2300);
    ok(T.finished, 'spotdiff: did not finish');
  });

  await game('seek', { game: 'seek', hunts: [
    { text: 'Find them!', find: ['🔑 key', '🐸 frog'], crowd: ['🍎', '🎈', '⚽', '🔑'], n: 12 },
    { find: ['🦅 eagle'], crowd: ['🐦', '🦆'], n: 20 },
  ] }, async (T, card) => {
    ok(card.querySelectorAll('.bd-hide').length === 14, 'seek: the field should hold 12 crowd + 2 hidden things');
    T.hint(); T.findAll(); await wait(1700);
    ok(T.hunt === 1, 'seek: did not move on to hunt 2');
    T.findAll(); await wait(2300);
    ok(T.finished, 'seek: did not finish');
  });

  await game('flicker', { game: 'flicker', missions: [
    { mode: 'plain', text: 'no blink', items: ['🍎', '🚗', '🐱', '⚽', '🎈', '🌳', '🎩', '🐟'] },
    { mode: 'blink', text: 'blink', items: ['🍓', '🚲', '🐶', '🏀', '🪁', '🌸', '👑', '🐢'] },
  ] }, async (T, card) => {
    T.start(); await wait(1200); T.miss(); T.solve(); await wait(50);
    ok(T.phase === 'done', 'flicker: test 1 did not end');
    [...card.querySelectorAll('.lab-ask button')].find(b => /Next mission/.test(b.textContent)).click(); await wait(50);
    T.start(); await wait(1200);
    ok(card.querySelector('.bd-flick'), 'flicker: test 2 shows no pictures');
    T.solve(); await wait(50);
    ok(card.querySelectorAll('.data-box tbody tr').length === 2, 'flicker: the results table should have 2 rows');
    [...card.querySelectorAll('.lab-ask button')].find(b => /Finish/.test(b.textContent)).click(); await wait(50);
  });

  // a vanishing page: the check stays hidden until "Got it", then 👀 Peek brings the words back
  {
    const page = await open('brain/memory-palace.html', stub({ type: 'read', title: 'v', cards: [{ title: 'T', text: ['A cat sat on a mat.'], vanish: true, check: { q: 'Where?', options: ['mat', 'hat', 'bat'], answer: 0 } }] }, { id: 'brain-test', layout: 2 }));
    const card = page.d.querySelector('.stage-card');
    ok(card.querySelector('.check').hidden, 'vanish: the check shows before Got it');
    [...card.querySelectorAll('button')].find(b => /Got it/.test(b.textContent)).click();
    ok(card.querySelector('.story').closest('.panel-inner').hidden && !card.querySelector('.check').hidden, 'vanish: the page did not vanish');
    [...card.querySelectorAll('button')].find(b => /Peek/.test(b.textContent)).click();
    ok(!card.querySelector('.story').closest('.panel-inner').hidden, 'vanish: Peek did not bring the page back');
    page.errors.forEach(e => fails.push('vanish: ' + e)); page.close();
  }

  // the Memory Key: PLAY shows it, then it locks and the lesson starts
  {
    const page = await open('brain/memory-palace.html', { setup: w => w.localStorage.setItem('y3:progress:brain-memory-palace', JSON.stringify({ stage: 0, maxStage: 0, mid: true, layout: 2 })) });
    const card = page.d.querySelector('.stage-card');
    [...card.querySelectorAll('button')].find(b => /PLAY/.test(b.textContent)).click();
    ok(card.querySelectorAll('.mk-item').length === 4, 'memory key: the items did not show');
    page.errors.forEach(e => fails.push('memory key: ' + e)); page.close();
  }

  console.log(fails.length ? '✘ ' + fails.join('\n✘ ') : '✅ All brain games played to the end.');
  process.exit(fails.length ? 1 : 0);
})();
