#!/usr/bin/env node
/* Plays the human body sims (shared/engine/body.js: gut = Food Journey, muscles = Muscle Lab) through their _test hooks,
 * in the same simulated browser as smoke.js. Run after changing body.js:  node tools/body-test.js
 */
const { open, wait } = require('./smoke.js');

const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };
const stub = round => ({
  lesson: v => Object.assign({}, v, { id: 'body-test', layout: 2, midBreak: false, stages: [{ type: 'game', title: 'test', rounds: [round] }] }),
  setup: w => w.localStorage.setItem('y3:progress:body-test', JSON.stringify({ stage: 0, maxStage: 0, mid: true, layout: 2 })),
});
// press Next mission / Finish (the test missions have no questions; smoke.js plays the lessons' real ones)
async function nextMission(card, name) {
  const go = [...card.querySelectorAll('.lab-ask button')].find(b => /Next mission|Finish/.test(b.textContent));
  if (go) { go.click(); await wait(30); } else fails.push(`${name}: no Next mission button`);
}
async function game(name, file, round, drive) {
  let page;
  try {
    page = await open(file, stub(round));
    const card = page.d.querySelector('.stage-card');
    const g = card.querySelector('.game');
    ok(g && g._test, `${name}: no game or no _test hook`);
    if (g && g._test) await drive(g._test, card);
    const nx = [...card.querySelectorAll('.navrow button')].pop();
    ok(nx && !nx.disabled, `${name}: the stage did not finish`);
    page.errors.forEach(e => fails.push(`${name}: ${e}`));
  } catch (e) { fails.push(`${name}: ${e.stack}`); }
  if (page) page.close();
}

(async () => {
  const L1 = 'science/fuel-your-body.html';
  await game('gut', L1, { game: 'gut', foods: ['bread', 'egg', 'sweets'], missions: [
    { text: 'bread', need: ['bread'] }, { text: 'egg + sweets', need: ['egg', 'sweets'] },
  ] }, async (T, card) => {
    ok(T.station === 'mouth', 'gut: should start at the mouth');
    T.help(); T.frames(5); ok(T.station === 'pipe', `gut: chewing should lead to the food pipe, got ${T.station}`);
    T.trip(); ok(T.did.includes('bread'), 'gut: the bread journey did not finish');
    ok(T.got.energy === 3 && T.got.grow === 1, `gut: bread goodness wrong ${JSON.stringify(T.got)}`);
    ok(card.querySelectorAll('.data-box tbody tr').length === 1, 'gut: no results row');
    await nextMission(card, 'gut');
    T.pick('egg'); T.trip(); ok(T.mission === 1, 'gut: one food should not finish mission 2');
    T.pick('sweets'); T.trip();
    ok(T.did.includes('egg') && T.did.includes('sweets'), 'gut: egg + sweets not recorded');
    await nextMission(card, 'gut');
  });
  await game('muscles', 'science/bones-muscles.html', { game: 'muscles', missions: [
    { text: 'apple', need: ['apple:bend', 'apple:straighten'] }, { text: 'bag', need: ['bag:bend'] }, { text: 'lock', need: ['locked'] },
  ] }, async (T, card) => {
    T.lift(); ok(T.bend > 110, `muscles: lift only reached ${T.bend}`);
    T.lower(); ok(T.bend < 15, 'muscles: lower did not straighten');
    ok(T.did.includes('apple:bend') && T.did.includes('apple:straighten'), `muscles: apple tests ${T.did}`);
    await nextMission(card, 'muscles');
    T.pick('bag'); T.lift(); ok(T.did.includes('bag:bend'), 'muscles: heavy lift not recorded');
    await nextMission(card, 'muscles');
    T.lower(); T.lock(true); const b = T.bend; T.lift(); ok(Math.abs(T.bend - b) < 1, 'muscles: a locked elbow bent');
    ok(T.did.includes('locked'), 'muscles: locked try not recorded');
    await nextMission(card, 'muscles');
  });
  console.log(fails.length ? '❌ ' + fails.join('\n❌ ') : '✅ Food Journey and Muscle Lab played to the end.');
  process.exit(fails.length ? 1 : 0);
})();
