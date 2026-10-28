#!/usr/bin/env node
/* Smoke test: opens every lesson in a simulated browser (jsdom) and checks that every stage and every game round
 * renders without a script error. Stages made of questions (recap, quiz / boss, video quest, reading pages, teach, case,
 * investigate) are also played to the end with the right answers, so a stage that can't be finished is caught too.
 * Also opens the home page, the wardrobe and the parent page.
 *   npm install            (once: installs jsdom, which is only needed for this test)
 *   node tools/smoke.js [lesson files…] [--verbose]
 * Run it after changing shared/engine.js or any shared file. It takes a few minutes for every lesson.
 */
'use strict';
const fs = require('fs');
const path = require('path');
let JSDOM, VirtualConsole, ResourceLoader;
try { ({ JSDOM, VirtualConsole, ResourceLoader } = require('jsdom')); } catch (e) { console.error('jsdom is missing: run `npm install` first.'); process.exit(2); }
const ROOT = path.join(__dirname, '..');
const ORIGIN = 'http://pixelkid.test/';
const args = process.argv.slice(2), verbose = args.includes('--verbose');
const wait = ms => new Promise(r => setTimeout(r, ms));

// serve the site's own files to jsdom (no web server needed); anything outside the site (YouTube thumbnails…) is skipped
class Files extends ResourceLoader {
  fetch(url, opts) {
    if (!url.startsWith(ORIGIN)) return null;
    const file = path.join(ROOT, decodeURIComponent(url.slice(ORIGIN.length).split(/[?#]/)[0]));
    if (!fs.existsSync(file)) { missing.add(url.slice(ORIGIN.length)); return null; }
    return super.fetch('file://' + file, opts);
  }
}
const missing = new Set();
const loader = new Files();

// a page with stand-ins for what jsdom doesn't do (canvas drawing, media queries, scrolling, speech)
async function open(file, { setup, lesson } = {}) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/Not implemented/.test(e.message)) errors.push(e.message + (e.detail && e.detail.stack ? ' @ ' + String(e.detail.stack).split('\n')[1] : '')); });
  vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));
  const dom = await JSDOM.fromFile(path.join(ROOT, file), {
    url: ORIGIN + file, runScripts: 'dangerously', resources: loader, pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      const any = new Proxy(function () {}, { get: (t, k) => (k === 'data' ? [0, 0, 0, 0] : k === Symbol.toPrimitive ? () => 0 : any), apply: () => any, set: () => true });
      w.HTMLCanvasElement.prototype.getContext = () => any;
      w.HTMLCanvasElement.prototype.toDataURL = () => 'data:,';
      w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
      w.scrollTo = w.scrollBy = () => {}; w.Element.prototype.scrollIntoView = () => {};
      w.Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {}, finish() {}, addEventListener() {}, set onfinish(f) { setTimeout(f, 0); } });
      w.HTMLMediaElement.prototype.play = () => Promise.resolve(); w.HTMLMediaElement.prototype.pause = () => {};
      w.localStorage.setItem('y3:settings', JSON.stringify({ name: 'Tester', muted: true }));
      w.localStorage.setItem('y3:avatar', JSON.stringify({ look: {}, owned: [], starter: true }));
      if (lesson) { // the lesson data can be trimmed before the engine reads it
        let L;
        Object.defineProperty(w, 'LESSON', { configurable: true, get: () => L, set: v => { L = lesson(v); } });
      }
      if (setup) setup(w);
    },
  });
  const w = dom.window;
  await new Promise(r => (w.document.readyState === 'complete' ? r() : w.addEventListener('load', r)));
  await wait(150);
  return { w, d: w.document, errors, close: () => w.close() };
}

// ---------- answering questions the way a child would (tapping the right thing) ----------
const plain = s => String(s).replace(/<[^>]+>/g, '').replace(/\*\*/g, '').replace(/\[\[([^\]|]+)(\|[^\]]*)?\]\]/g, '$1')
  .replace(/[\p{Extended_Pictographic}️‍]/gu, '').replace(/\s+/g, ' ').trim();
async function answer(page, area, q) {
  const { w } = page, t = q.type || 'mcq';
  // wait for the question to be on screen (a boss's dodge round can take over for a few seconds first)
  for (let k = 0; k < 150 && !area.querySelector('.q-text, .opts, input, .sl-knob, .bld-pool, .ev-sent, .q-tag'); k++) await wait(100);
  const btn = re => [...area.querySelectorAll('button')].find(b => re.test(b.textContent) && !b.disabled && !b.hidden);
  if (t === 'type') {
    const inp = [...area.querySelectorAll('input')].pop();
    if (!page.triedReveal && area.querySelector('.q-reveal')) {
      // the first typed question on a page: two wrong tries, then "Use it and carry on" must get past it
      page.triedReveal = true;
      for (let k = 0; k < 2; k++) { inp.value = 'zzz'; inp.dispatchEvent(new w.Event('input')); btn(/check/i).click(); await wait(30); }
      const use = btn(/use it and carry on/i);
      if (!use) throw new Error('no way past a typed question after two wrong tries');
      use.click(); await wait(60);
      if (!inp.classList.contains('right')) throw new Error('"Use it and carry on" did not accept the answer');
      return;
    }
    inp.value = [].concat(q.answer)[0]; inp.dispatchEvent(new w.Event('input'));
    (btn(/check|ok/i) || {}).click && btn(/check|ok/i).click();
  } else if (t === 'slider') {
    const knob = area.querySelector('.sl-knob');
    for (let k = 0; k < 400; k++) knob.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    for (let v = q.min ?? 0; v < q.answer - 1e-9; v += q.step || 1) knob.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    btn(/lock it in/i).click();
  } else if (t === 'build') {
    for (const tile of q.answer) [...area.querySelectorAll('.bld-pool .bld-tile')].find(x => x._t === tile).click();
    btn(/check/i).click();
  } else if (t === 'oddone') {
    [...area.querySelectorAll('.opts .opt')].find(o => plain(o.textContent) === plain(q.items[q.answer])).click();
    await wait(30);
    [...area.querySelectorAll('.odd-why .opt')].find(o => plain(o.textContent) === plain(q.reasons[q.reason])).click();
  } else if (t === 'evidence') {
    const want = [].concat(q.answer).map(a => plain(a).toLowerCase());
    const sents = [...page.d.querySelectorAll('.ev-sent')];
    const hit = sents.find(s => want.some(a => plain(s.textContent).toLowerCase().includes(a)));
    if (!hit) throw new Error(`evidence sentence not found: ${want[0]}`);
    hit.click();
  } else if (t === 'setclock') {
    // the first one on a page: a wrong try first (the hint must appear); then the right time through the face's _test hook
    const face = area.querySelector('.clk-q .clk-face');
    if (!page.triedClock) {
      page.triedClock = true;
      btn(/check/i).click(); await wait(30);
      if (!/should|careful|close/i.test((area.querySelector('.sl-note') || {}).textContent || '')) throw new Error('setclock: no hint after a wrong try');
    }
    face._test.set(q.time);
    btn(/check/i).click();
  } else if (t === 'hotspot') {
    const k = [].concat(q.answer)[0];
    area.querySelectorAll('.hs-spot, .hotspot button, [class*="spot"]')[k].click();
  } else if (t === 'predict') {
    area.querySelectorAll('.opts .opt')[0].click(); await wait(60);
    const nx = btn(/see what happens|reveal|next|why/i); if (nx) nx.click(); await wait(60);
    if (q.then) return answer(page, area, q.then);
  } else if (t === 'order') {
    // put-in-order questions are dragged; tap the items in order (the widget accepts taps)
    for (const it of q.items) { const b = [...area.querySelectorAll('button, .chip-item, [role=button]')].find(x => plain(x.textContent) === plain(it) && !x.classList.contains('placed')); if (b) b.click(); await wait(20); }
  } else {
    const opts = [...area.querySelectorAll('.opts .opt:not([disabled])')];
    let want, o;
    if (q.optionsHtml) { // picture answers: match the picture itself
      const tmp = page.d.createElement('div'); tmp.innerHTML = q.options[q.answer]; want = 'picture ' + (q.answer + 1);
      o = opts.find(x => x.innerHTML === tmp.innerHTML);
    } else {
      want = t === 'tf' ? (q.answer ? 'True' : 'False') : plain(q.options[q.answer]);
      o = opts.find(x => plain(x.textContent) === want);
    }
    if (!o) throw new Error(`option "${want}" not found among: ${[...area.querySelectorAll('.opts .opt')].map(x => plain(x.textContent)).join(' / ') || 'no options'} | buttons: ${[...area.querySelectorAll('button')].filter(b => !b.hidden).map(b => plain(b.textContent)).join(' / ')}`);
    o.click();
  }
  await wait(60);
}
// after an answer: the Next / Done button (some wait for a tap, the rest move on by themselves after 1.5 s)
async function moveOn(area) {
  for (let k = 0; k < 40; k++) {
    const b = [...area.querySelectorAll('button')].find(x => /Next question|Finish|See my score|Final blow|DODGE|Done|Uncover|Close the case|found out|Reveal/.test(x.textContent) && !x.hidden && !x.disabled);
    if (b) { b.click(); await wait(120); return; }
    await wait(60);
  }
}

// ---------- one lesson ----------
async function lessonFile(file) {
  const fails = [];
  // read the lesson once to know its stages
  const first = await open(file);
  const L = first.w.LESSON;
  first.errors.forEach(e => fails.push(`opening: ${e}`));
  first.close();
  if (!L) return [`no LESSON`];
  for (let si = 0; si < L.stages.length; si++) {
    const S = L.stages[si];
    const rounds = S.type === 'game' && S.rounds ? S.rounds.length : 1;
    for (let ri = 0; ri < rounds; ri++) {
      const where = `stage ${si + 1} (${S.type}: ${S.title || ''})${rounds > 1 ? ` round ${ri + 1}` : ''}`;
      let page;
      try {
        page = await open(file, {
          lesson: v => Object.assign({}, v, { midBreak: false, stages: [S.type === 'game' && S.rounds ? Object.assign({}, S, { rounds: [S.rounds[ri]], pick: false }) : S] }),
          setup: w => w.localStorage.setItem('y3:progress:' + L.id, JSON.stringify({ stage: 0, maxStage: 0, mid: true })),
        });
        const card = page.d.querySelector('.stage-card');
        if (!card) throw new Error('nothing rendered');
        await wait(250); // let game loops run a few frames
        await play(page, card, S);
      } catch (e) { fails.push(`${where}: ${e.message}`); }
      if (page) { page.errors.forEach(e => fails.push(`${where}: ${e}`)); page.close(); }
    }
  }
  return fails;
}
// play a question stage to the end and check it says it is complete
async function play(page, card, S) {
  const area = card;
  const btn = re => [...card.querySelectorAll('button')].find(b => re.test(b.textContent) && !b.disabled && !b.hidden);
  const nextReady = () => { const b = [...card.querySelectorAll('.navrow button')].pop(); return b && !b.disabled; };
  if (S.type === 'review' || S.type === 'quiz' || S.type === 'video') {
    // the start button – never an answer option that happens to say "let's go" or "start"
    const go = [...card.querySelectorAll('button')].find(b => /test my memory|warm|fight|start|let.s go|ready|watched|begin/i.test(b.textContent) && !b.disabled && !b.hidden && !b.closest('.opts, .enc-box'));
    if (go) { go.click(); await wait(120); }
    for (const q of S.questions || []) { await answer(page, area, q); await moveOn(area); }
    await wait(200);
    if (S.type === 'review' && S.game) return; // the recap ends with a mini game: rendering it is the check
    if (S.type === 'quiz') { const fin = btn(/finish|see my score|final blow|results/i); if (fin) { fin.click(); await wait(300); } }
  } else if (S.type === 'read') {
    for (let ci = 0; ci < S.cards.length; ci++) {
      const c = S.cards[ci];
      if (c.check) { await answer(page, area, c.check); await wait(120); }
      const nx = [...card.querySelectorAll('.navrow button')].pop();
      if (!nx || nx.disabled) throw new Error(`page ${ci + 1}: can't move on after the check`);
      if (ci < S.cards.length - 1) { nx.click(); await wait(120); }
    }
    return;
  } else if (S.type === 'teach') {
    const game = card.querySelector('.fixit');
    for (let k = 0; k < S.lines.length; k++) {
      const l = S.lines[k], T = game._test; // a fresh set of controls for every sentence
      if (l.ok) T.okBtn.click();
      else {
        const toks = l.text.split(/\s+/), bare = x => x.toLowerCase().replace(/^[^a-z']+|[^a-z']+$/gi, '');
        const wi = l.wrongAt != null ? l.wrongAt : toks.findIndex(t => bare(t) === l.wrong.toLowerCase());
        T.words[wi].click(); await wait(20);
        [...T.tray.children].find(c => c.textContent.trim() === l.fix).dispatchEvent(new page.w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      }
      await wait(40);
      if (!T.over) throw new Error(`teach line ${k + 1} didn't finish`);
      if (k < S.lines.length - 1) { T.next(); await wait(40); }
    }
    btn(/fixed notes/).click(); await wait(100);
  } else if (S.type === 'case') {
    for (const c of S.clues) { await answer(page, area, c.q); await moveOn(area); await wait(80); btn(/Next clue|Solve the case/).click(); await wait(80); }
    await answer(page, area, S.solve); await moveOn(area); await wait(200);
  } else if (S.type === 'investigate') {
    card.querySelectorAll('.opts .opt')[0].click(); await wait(800);
    const T = card.querySelector('.game')._test;
    for (const m of S.test.missions || []) {
      if (S.test.game === 'timehops') {
        const tm = x => { const [a, b] = x.split(':').map(Number); return a * 60 + b; };
        let left = m.add != null ? m.add : tm(m.to) - tm(m.from);
        for (const n of [60, 10, 5, 1]) while (left >= n) { T.hop(n); left -= n; }
        await wait(100);
        for (const o of card.querySelectorAll('.lab-ask .opts .opt')) { if (o.disabled) continue; o.click(); await wait(40); if (o.classList.contains('right')) break; }
        await wait(100); const dn = btn(/^Done/); if (dn) dn.click(); await wait(100);
      } else if (T.pick) { for (const id of m.need || []) { T.pick(id); T.blow(); T.frames(60 * 6); await wait(750); } }
      else break; // other simulations: rendering is checked, not the missions
      for (const q of m.ask || []) { await answer(page, card.querySelector('.lab-ask'), q); await moveOn(card.querySelector('.lab-ask')); }
      const nm = btn(/Next mission|Finish/); if (nm) { nm.click(); await wait(100); }
    }
    const ex = btn(/Explain what happened/);
    if (!ex) return; // a simulation the test can't drive
    ex.click(); await wait(100);
    for (const q of S.explain) { await answer(page, area, q); await moveOn(area); }
    await wait(150);
  } else return; // games, breaks, welcome: rendering without errors is the check
  if (!nextReady() && S.type !== 'quiz') throw new Error('played to the end, but the stage did not finish');
}
// other test scripts can borrow the simulated browser: const { open, answer, moveOn, wait } = require('./smoke.js')
module.exports = { open, answer, moveOn, wait };

if (require.main === module) (async () => {
  const index = fs.readFileSync(path.join(ROOT, 'shared/library.js'), 'utf8');
  let files = args.filter(a => !a.startsWith('--'));
  const pages = !files.length;
  if (!files.length) files = [...index.matchAll(/file: '([^']+)'/g)].map(m => m[1]).filter(f => fs.existsSync(path.join(ROOT, f)));
  let bad = 0;
  if (pages) for (const p of ['index.html', 'avatar.html', 'parents.html']) {
    const page = await open(p); await wait(300);
    if (page.errors.length) { bad++; console.log(`✘ ${p}\n  ${page.errors.join('\n  ')}`); } else console.log(`✅ ${p}`);
    page.close();
  }
  if (pages) { // the home page's Lesson mode: tiles instead of the map, and a locked tile has no Play button
    const page = await open('index.html', { setup: w => w.localStorage.setItem('y3:mode', '"lessons"') }); await wait(300);
    const locked = page.d.querySelector('.ltile.locked');
    if (!page.d.querySelector('.ltile')) page.errors.push('no lesson tiles');
    if (locked) { locked.click(); if (page.d.querySelector('.qcard a.btn')) page.errors.push('a locked tile can be played'); }
    if (page.errors.length) { bad++; console.log(`✘ index.html (Lesson mode)\n  ${page.errors.join('\n  ')}`); } else console.log('✅ index.html (Lesson mode)');
    page.close();
  }
  if (files.length === 1 || args.includes('--child')) {
    for (const f of files) {
      const t = Date.now(), fails = await lessonFile(f);
      if (fails.length) { bad++; console.log(`✘ ${f}\n  ${fails.join('\n  ')}`); } else console.log(`✅ ${f}${verbose ? ` (${((Date.now() - t) / 1000).toFixed(1)} s)` : ''}`);
    }
  } else {
    // several lessons: four at a time, each in its own process
    const { execFile } = require('child_process');
    const queue = files.slice();
    const worker = async () => {
      for (let f; (f = queue.shift());) {
        const out = await new Promise(r => execFile(process.execPath, [__filename, f, '--child', ...(verbose ? ['--verbose'] : [])], { maxBuffer: 1 << 24 }, (err, so) => r({ err, so })));
        process.stdout.write(out.so.replace(/\n*(All good\.|\d+ page\(s\) with problems\.)\n*$/, '\n'));
        if (out.err) bad++;
      }
    };
    await Promise.all([1, 2, 3, 4].map(worker));
  }
  if (missing.size) { bad++; console.log(`\nMissing files: ${[...missing].join(', ')}`); }
  console.log(bad ? `\n${bad} page(s) with problems.` : '\nAll good.');
  process.exit(bad ? 1 : 0);
})();
