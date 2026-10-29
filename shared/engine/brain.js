/* Pixelkid lesson engine – Brain Dojo games for memory and focus: the Memory Palace, Note Block Echo (and its digit
 * chunking mode), Kim's Game (spotter), Ninja Reflex (go / no-go), Colour Clash and Box Breathing.
 * Eagle Eye adds Spot the Difference (spotdiff), Eagle Search (seek) and the Blink Test (flicker, a change-blindness experiment).
 * One part of shared/engine.js, which loads it only when a lesson uses it. E is the engine's shared helpers
 * (E.state is live). See the top of shared/engine.js for how the parts fit together.
 * Every game keeps a personal best in y3:brain (E.brainRecord), so he can watch his brain get stronger.
 */
PixelkidEngine.part('brain', E => {
  'use strict';
  const { GAMES, award, confetti, draggable, fmt, gameLoop, h, missionRunner, popText, put, resultsTable, say, sfx, shake, shuffle, store, toast, tone } = E;

  // Brain records (Brain Dojo games): his personal bests, kept across lessons in y3:brain = { [id]: { best, label, at } }.
  // brainRecord(id, value, label) saves a new best and cheers it; returns { best, old, isNew }.
  // low: true for times, where a smaller number is the better record.
  function brainRecord(id, value, label, low) {
    const all = store.get('y3:brain', {}), old = (all[id] && all[id].best) || 0;
    const isNew = low ? value > 0 && (!old || value < old) : value > old;
    if (isNew) {
      all[id] = { best: value, label, at: Date.now() }; store.set('y3:brain', all);
      if (old) setTimeout(() => { sfx.achieve(); confetti(70); toast('NEW BRAIN RECORD!', `${label}: ${old} → ${value}`, '🧠', 'level'); }, 300);
    }
    return { best: isNew ? value : old, old, isNew };
  }
  const brainBest = id => (store.get('y3:brain', {})[id] || {}).best || 0;

  // Other worlds use brain games too (Note Block Echo is an Arcade choice in every lesson), so bring brain.css along.
  if (![...document.querySelectorAll('link[rel=stylesheet]')].some(l => /brain\.css$/.test(l.href))) {
    const here = [...document.scripts].map(s => s.src).find(s => /engine\/brain\.js/.test(s));
    if (here) document.head.append(h('link', { rel: 'stylesheet', href: new URL('../brain.css', here).href }));
  }


  // '🍌 banana' → { icon: '🍌', name: 'banana' }
  const split = t => { const m = String(t).match(/^(\S+)\s+(.+)$/); return m && /\p{Extended_Pictographic}/u.test(m[1]) ? { icon: m[1], name: m[2] } : { icon: '', name: String(t) }; };
  const recordLine = (id, label) => h('div', { class: 'bd-record' }, `🧠 Your record: ${brainBest(id) || '–'}`, h('small', null, ' · ' + label));
  const later = (fn, ms, root) => setTimeout(() => { if (root.isConnected || root._test) fn(); }, ms);

  // ===== the Memory Key (L.memoryKey = { items: ['🗝️ a gold key', …], seconds, say }) =====
  // PLAY on the Start stage flashes the items up for a few seconds, then locks them away and starts the lesson.
  // The boss asks for them at the very end (delayed recall).
  function showMemoryKey(box, startBtn, begin, setCleanup) {
    const K = E.L.memoryKey;
    let left = K.seconds || 10;
    const count = h('div', { class: 'mk-count' }, String(left));
    startBtn.disabled = true;
    say(K.say || 'Guard the Memory Key! Look carefully – the boss will try to steal it at the end.');
    put(box, h('div', { class: 'mk-tag' }, '🔐 MEMORY KEY: remember all of these!'),
      h('div', { class: 'mk-items' }, K.items.map(t => h('div', { class: 'mk-item', html: fmt(t, false) }))), count);
    box.hidden = false; if (box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const tick = setInterval(() => {
      left--; count.textContent = String(left);
      if (left > 0 || !box.isConnected) return;
      clearInterval(tick); sfx.good();
      put(box, h('div', { class: 'mk-locked' }, '🔒 Locked in your brain! Keep it safe until the boss…'));
      setTimeout(begin, 1400);
    }, 1000);
    setCleanup(() => clearInterval(tick));
  }

  // ===== Memory Palace: put each thing in a room, walk through, then remember them room by room =====
  // r.rooms: ['🚪 front door', '🛋️ sofa', …] (in walking order) · r.decoys: extra things for the recall grid
  // r.missions: [{ text, items: ['🍌 banana', …], mode: 'palace' (default) | 'list', seconds (list mode), yes, ask }]
  // list mode is the experiment's control: read a plain list, it hides, pick the things you remember.
  // A results table compares the two ("Just reading: 5/8 · Memory palace: 8/8").
  const SILLY = ['is doing a handstand on', 'is snoring loudly on', 'is dancing on', 'is eating jelly on', 'is bouncing on',
    'is singing opera on', 'is juggling on', 'is having a bubble bath on', 'is wearing a crown on', 'is sneezing all over'];
  GAMES.palace = function (r, key, done) {
    const rooms = r.rooms.map(split);
    const table = resultsTable(r.caption || '🧠 How many did you remember first time?', ['#', 'Way of remembering', 'Things', 'Remembered']);
    const stage = h('div', { class: 'bd-stage' });
    const rec = h('div');
    let m = null, runN = 0, test = null;
    const missions = missionRunner(r, key, done, mm => { m = mm; (mm.mode === 'list' ? listTest : palaceTest)(mm); });

    function finish(label, score, total) {
      runN++;
      table.add([runN, label, total, `${score} / ${total}`]);
      const best = brainRecord('palace', score, 'Things remembered in one go');
      put(rec, recordLine('palace', 'things remembered in one go'));
      say(best.isNew && best.old ? `NEW RECORD! You remembered ${score}!` : `You remembered ${score} out of ${total} first time!`);
      missions.win(stage);
    }

    // the recall grid: the real things + decoys, shuffled; returns the grid element
    function grid(items, onPick) {
      const pool = shuffle(items.concat(shuffle((r.decoys || []).filter(d => !items.includes(d))).slice(0, Math.max(3, Math.ceil(items.length * 0.75)))));
      return h('div', { class: 'bd-grid' }, pool.map(t => {
        const b = h('button', { class: 'bd-thing', type: 'button', 'data-t': t, html: fmt(t, false) });
        b.onclick = () => onPick(t, b);
        return b;
      }));
    }

    // ---- control test: just read the list ----
    function listTest(mm) {
      const items = mm.items;
      let left = mm.seconds || 20;
      const count = h('span', { class: 'bd-count' }, String(left));
      put(stage, h('div', { class: 'bd-card' }, h('div', { class: 'bd-tag' }, '📝 READ THE LIST ', count),
        h('ol', { class: 'bd-list' }, items.map(t => h('li', { html: fmt(t, false) })))));
      say(`Read the list. In ${left} seconds it will vanish!`);
      const tick = setInterval(() => {
        left--; count.textContent = String(left);
        if (left > 0) return;
        clearInterval(tick); pick();
      }, 1000);
      function pick() {
        clearInterval(tick);
        if (test.phase !== 'read') return;
        test.phase = 'pick';
        let got = 0, picks = 0;
        const doneBtn = h('button', { class: 'btn', type: 'button', onclick() { sfx.tap(); end(); } }, '✔ That\'s all I remember');
        const status = h('div', { class: 'bd-status' }, `Tap the things that were on the list. Found: 0 / ${items.length}`);
        const end = () => { if (test.phase !== 'pick') return; test.phase = 'done'; finish('Just reading the list', got, items.length); };
        put(stage, h('div', { class: 'bd-card' }, h('div', { class: 'bd-tag' }, '💨 THE LIST HAS VANISHED!'), status,
          grid(items, (t, b) => {
            if (b.disabled) return;
            b.disabled = true; picks++;
            if (items.includes(t)) { got++; b.classList.add('right'); sfx.good(); } else { b.classList.add('wrong'); sfx.bad(); }
            status.textContent = `Tap the things that were on the list. Found: ${got} / ${items.length}`;
            if (got === items.length || picks >= items.length + 3) end();
          }), h('div', { class: 'btn-row' }, doneBtn)));
        say('Gone! Tap everything you remember from the list.');
      }
      test = { phase: 'read', skip: pick, stop: () => clearInterval(tick) };
    }

    // ---- the memory palace: place, walk, recall ----
    function palaceTest(mm) {
      const items = mm.items, used = rooms.slice(0, items.length);
      const placed = new Array(used.length).fill(null), silly = used.map(() => Math.floor(Math.random() * SILLY.length));
      let phase = 'place', walkAt = 0, recallAt = 0, score = 0, misses = 0;
      test = { get phase() { return phase; } };
      const caption = k => `${placed[k]} ${SILLY[silly[k]]} the ${used[k].name}!`;
      const roomEls = used.map((rm, k) => {
        const el = h('div', { class: 'bd-room', 'data-drop': String(k) },
          h('span', { class: 'bd-room-n' }, String(k + 1)), h('span', { class: 'bd-room-icon' }, rm.icon), h('span', { class: 'bd-room-name' }, rm.name),
          h('span', { class: 'bd-room-thing' }), h('span', { class: 'bd-room-silly' }));
        el.onclick = () => roomTap(k);
        return el;
      });
      const house = h('div', { class: 'bd-house' }, h('div', { class: 'bd-roof' }, '🏠 YOUR MEMORY PALACE'), h('div', { class: 'bd-rooms' }, roomEls));
      const tray = h('div', { class: 'bd-tray' });
      const panel = h('div', { class: 'bd-panel' });
      let chosen = null;
      const trayEls = items.map(t => {
        const b = h('button', { class: 'bd-thing', type: 'button', html: fmt(t, false) });
        draggable(b, {
          tap() { if (phase !== 'place') return; chosen = chosen === t ? null : t; trayEls.forEach(x => x.classList.toggle('selected', x === b && chosen === t)); sfx.tap(); },
          drop(z) { if (z && phase === 'place') place(+z.dataset.drop, t); },
        });
        return b;
      });
      function drawRoom(k) {
        const el = roomEls[k];
        el.querySelector('.bd-room-thing').innerHTML = placed[k] && (phase !== 'recall' || el.classList.contains('got')) ? fmt(split(placed[k]).icon || placed[k], false) : '';
        el.querySelector('.bd-room-silly').textContent = placed[k] && phase === 'place' ? caption(k) : '';
        el.classList.toggle('full', !!placed[k]);
      }
      function place(k, t) {
        if (placed[k]) { // swap out what was there
          const old = placed[k]; trayEls[items.indexOf(old)].classList.remove('placed');
        }
        const was = placed.indexOf(t); if (was >= 0) { placed[was] = null; drawRoom(was); }
        placed[k] = t; silly[k] = Math.floor(Math.random() * SILLY.length);
        trayEls[items.indexOf(t)].classList.add('placed'); trayEls.forEach(x => x.classList.remove('selected')); chosen = null;
        sfx.good(); drawRoom(k); popText(roomEls[k], '✨', 'combo');
        say(`Picture it: ${caption(k)}`);
        if (placed.every(Boolean)) {
          put(panel, h('p', { class: 'bd-status' }, 'Every room has something silly in it! Tap 🎲 to make one sillier, or start your walk.'),
            h('div', { class: 'btn-row' }, h('button', { class: 'btn big green ready', type: 'button', onclick() { sfx.tap(); walk(); } }, '🚶 Walk through my palace ▶')));
        }
      }
      function roomTap(k) {
        if (phase === 'place') {
          if (chosen) place(k, chosen);
          else if (placed[k]) { silly[k] = (silly[k] + 1) % SILLY.length; drawRoom(k); sfx.tap(); say(`Even sillier: ${caption(k)}`); }
        } else if (phase === 'walk' && k === walkAt) stepWalk();
      }
      function walk() {
        phase = 'walk'; walkAt = 0; tray.hidden = true;
        used.forEach((_, k) => drawRoom(k));
        put(panel, h('p', { class: 'bd-status' }, 'Tap each room in order and SEE the silly picture in your head.'));
        light(); say(`Start at room 1. Tap it and picture ${caption(0)}`);
      }
      const light = () => roomEls.forEach((el, k) => el.classList.toggle('now', (phase === 'walk' && k === walkAt) || (phase === 'recall' && k === recallAt)));
      function stepWalk() {
        sfx.tap(); tone(392 + walkAt * 60, 0, 0.12, 'triangle', 0.05);
        roomEls[walkAt].classList.add('walked');
        walkAt++;
        if (walkAt < used.length) { light(); say(`Room ${walkAt + 1}: ${caption(walkAt)}`); return; }
        // everything vanishes
        phase = 'recall'; recallAt = 0;
        roomEls.forEach(el => el.classList.remove('walked'));
        used.forEach((_, k) => drawRoom(k));
        say('💨 Poof! Everything vanished. Walk through again – what was in each room?');
        ask();
      }
      function ask() {
        light();
        let tries = 0;
        put(panel, h('p', { class: 'bd-status' }, h('b', null, `Room ${recallAt + 1}: ${used[recallAt].icon} ${used[recallAt].name}. `), 'What was here?'),
          grid(items, (t, b) => {
            if (phase !== 'recall' || b.disabled) return;
            if (t === placed[recallAt]) {
              sfx.good(); if (tries === 0) score++;
              roomEls[recallAt].classList.add('got'); drawRoom(recallAt);
              recallAt++;
              if (recallAt >= used.length) { phase = 'done'; light(); finish('Memory palace', score, used.length); }
              else ask();
            } else {
              tries++; misses++; sfx.bad(); shake(b); b.disabled = true;
              say(tries >= 2 ? `It was ${placed[recallAt]}! ${caption(recallAt)}` : `Not that one. Picture the ${used[recallAt].name}… what silly thing was there?`);
              if (tries >= 2) { roomEls[recallAt].classList.add('got'); drawRoom(recallAt); recallAt++; if (recallAt >= used.length) { phase = 'done'; light(); finish('Memory palace', score, used.length); } else later(ask, 1600, stage); }
            }
          }));
      }
      put(tray, trayEls);
      put(stage, house, h('div', { class: 'bd-tag' }, '🎒 Drag each thing into a room (or tap it, then tap a room)'), tray, panel);
      say(mm.say || 'Put each thing in a room. The sillier the picture, the better you remember it!');
      test.place = (k, t) => place(k, t); test.walkAll = () => { walk(); while (phase === 'walk') stepWalk(); };
      test.answer = () => { [...panel.querySelectorAll('.bd-thing')].find(x => x.dataset.t === placed[recallAt]).click(); };
      test.items = items;
    }

    const root = h('div', { class: 'game bd palace' }, missions.box, rec, stage, missions.ask, table.el);
    put(rec, recordLine('palace', 'things remembered in one go'));
    root._test = {
      get mission() { return missions.i; }, get phase() { return test && test.phase; },
      skipRead() { test.skip(); }, place(k, t) { test.place(k, t); }, walkAll() { test.walkAll(); }, answer() { test.answer(); },
      get items() { return m && m.items; },
      pickAll() { [...stage.querySelectorAll('.bd-thing')].filter(b => m.items.includes(b.dataset.t)).forEach(b => b.click()); },
    };
    root._stop = () => test && test.stop && test.stop();
    missions.next();
    return root;
  };

  // ===== Note Block Echo: watch the note blocks light up, then play them back. One longer each time. =====
  // r.blocks (3–6, default 4) · r.start (default 2) · r.target: the length that wins the round (default 6)
  // r.mode: 'digits' – a number flashes up (r.chunk: true shows it in chunks, like 482 · 917), then type it on the keypad;
  //   r.lengths: [4, 5, 6, 7] (one turn each). Records: 'echo' (longest tune) and 'digits' (longest number).
  const NOTES = [{ c: '#e53935', f: 523, n: 'red' }, { c: '#1e88e5', f: 587, n: 'blue' }, { c: '#43a047', f: 659, n: 'green' },
    { c: '#fdd835', f: 784, n: 'yellow' }, { c: '#8e24aa', f: 880, n: 'purple' }, { c: '#fb8c00', f: 988, n: 'orange' }];
  GAMES.sequence = function (r, key, done) {
    if (r.mode === 'digits') return digits(r, key, done);
    if (r.tunes) return themed(r, key, done);
    const n = Math.max(3, Math.min(6, r.blocks || 4)), target = r.target || 6;
    let len = r.start || 2, tune = [], at = 0, busy = true, misses = 0, finished = false, timers = [];
    const blocks = NOTES.slice(0, n).map((N, k) => {
      const b = h('button', { class: 'bd-note', type: 'button', style: `--note:${N.c}`, 'aria-label': N.n + ' note block' });
      b.addEventListener('pointerdown', e => { e.preventDefault(); press(k); });
      return b;
    });
    const status = h('div', { class: 'bd-status' });
    const meter = h('div', { class: 'bd-len' });
    const rec = h('div');
    const flash = k => { const b = blocks[k]; b.classList.add('lit'); tone(NOTES[k].f, 0, 0.3, 'square', 0.05); setTimeout(() => b.classList.remove('lit'), 320); };
    function play() {
      busy = true; at = 0;
      status.textContent = '👀 Watch and listen…';
      const gap = Math.max(380, 650 - len * 25);
      tune.forEach((k, j) => timers.push(setTimeout(() => flash(k), 500 + j * gap)));
      timers.push(setTimeout(() => { busy = false; status.textContent = '👉 Your turn! Play it back.'; }, 500 + tune.length * gap));
    }
    function newTune() { while (tune.length < len) tune.push(Math.floor(Math.random() * n)); meter.textContent = `TUNE LENGTH: ${len} / ${target}`; play(); }
    function press(k) {
      if (busy || finished) return;
      flash(k);
      if (k !== tune[at]) {
        misses++; sfx.bad(); busy = true; shake(blocks[k]);
        status.textContent = misses % 2 ? '❌ Oops! Watch it again…' : '❌ Again! I\'ll play it slower…';
        say('No problem – watch it again. Focus on the colours AND the sounds!');
        timers.push(setTimeout(play, 1200));
        return;
      }
      at++;
      if (at < tune.length) return;
      // got the whole tune
      busy = true; sfx.good();
      const best = brainRecord('echo', len, 'Longest tune remembered');
      put(rec, recordLine('echo', 'longest tune'));
      award(`${key}:L${len}`, blocks[k]);
      if (len >= target) {
        finished = true; status.textContent = `🏆 You remembered a tune of ${len} notes!`;
        say(best.isNew && best.old ? 'A NEW RECORD! Your memory is getting stronger!' : 'Brilliant focus!');
        timers.push(setTimeout(done, 600));
        return;
      }
      len++; status.textContent = `✔ Yes! Now ${len} notes…`; say(`Yes! Now it gets one note longer: ${len} notes.`);
      timers.push(setTimeout(newTune, 1100));
    }
    const root = h('div', { class: 'game bd echo' }, rec, meter, h('div', { class: 'bd-notes n' + n }, blocks), status);
    put(rec, recordLine('echo', 'longest tune'));
    timers.push(setTimeout(newTune, 600));
    root._stop = () => timers.forEach(clearTimeout);
    root._test = { get tune() { return tune.slice(); }, get busy() { return busy; }, get len() { return len; }, press, unbusy() { busy = false; }, get finished() { return finished; } };
    return root;
  };

  // Themed echo (r.tunes): the blocks carry the lesson's letters, numbers or words, so the tune means something.
  // r.tunes: [{ text, notes: ['4', '8', '12', '16', '20'] (in the right order), show: how many notes it plays first
  //   (default all; he works out the rest, e.g. carries on the counting pattern), decoys: ['10'] (extra blocks), hint, yes }]
  // The blocks are shuffled. A wrong note in the part he watched replays the tune; after two misses the right block glows.
  const SCALE = [523, 587, 659, 698, 784, 880, 988, 1047], COLOURS = [...NOTES.map(N => N.c), '#00897b', '#d81b60'];
  function themed(r, key, done) {
    let ti = -1, T, show, labels = [], blocks = [], at = 0, busy = true, misses = 0, finished = false;
    const timers = [], wait = (fn, ms) => timers.push(setTimeout(fn, ms));
    const meter = h('div', { class: 'bd-len' }), task = h('div', { class: 'bd-tag' });
    const grid = h('div'), status = h('div', { class: 'bd-status' });
    const flash = k => { const b = blocks[k]; b.classList.add('lit'); tone(SCALE[k % 8], 0, 0.3, 'square', 0.05); setTimeout(() => b.classList.remove('lit'), 320); };
    const unhint = () => blocks.forEach(b => b.classList.remove('hint'));
    function next() {
      ti++;
      if (ti >= r.tunes.length) { finished = true; status.textContent = '🏆 Every tune played back!'; return void wait(done, 600); }
      T = r.tunes[ti]; show = Math.min(T.show == null ? T.notes.length : T.show, T.notes.length); misses = 0; at = 0;
      labels = shuffle([...new Set([...T.notes, ...(T.decoys || [])])]);
      blocks = labels.map((t, k) => {
        const b = h('button', { class: 'bd-note', type: 'button', style: `--note:${COLOURS[k % 8]}` }, h('span', { class: 'bd-note-label', html: fmt(t, false) }));
        b.addEventListener('pointerdown', e => { e.preventDefault(); press(k); });
        return b;
      });
      grid.className = `bd-notes labelled n${Math.min(labels.length, 8)}`;
      put(grid, blocks);
      meter.textContent = `TUNE ${ti + 1} / ${r.tunes.length}`;
      task.innerHTML = fmt(T.text || 'Watch and listen, then play it back!', false);
      say(T.say || (show < T.notes.length ? 'Watch the first notes – then you work out the rest!' : 'Watch and listen!'));
      wait(play, 700);
    }
    function play() {
      busy = true; at = 0; unhint();
      status.textContent = '👀 Watch and listen…';
      const gap = 700, now = ti;
      T.notes.slice(0, show).forEach((t, j) => wait(() => now === ti && flash(labels.indexOf(t)), 400 + j * gap));
      wait(() => {
        if (now !== ti) return;
        busy = false;
        const rest = T.notes.length - show;
        status.textContent = !show ? `👉 Play all ${rest} notes in order!` : rest ? `👉 Play it back – then carry on with ${rest} more!` : '👉 Your turn! Play it back.';
      }, 400 + show * gap);
    }
    function press(k) {
      if (busy || finished) return;
      flash(k);
      if (labels[k] !== T.notes[at]) {
        misses++; sfx.bad(); shake(blocks[k]);
        if (misses >= 2) {
          blocks[labels.indexOf(T.notes[at])].classList.add('hint');
          status.textContent = '💡 The glowing block comes next.';
          say(T.hint || 'Here\'s a clue – the glowing block is next.');
        } else if (at < show) {
          busy = true; status.textContent = '❌ Oops! Watch it again…';
          say('No problem – watch it again!');
          wait(play, 1200);
        } else {
          status.textContent = '❌ Not that one. What comes next?';
          say(T.hint || 'Think about the pattern. What comes next?');
        }
        return;
      }
      unhint(); at++;
      if (at < T.notes.length) return;
      busy = true; sfx.good(); award(`${key}:t${ti}`, blocks[k]);
      status.textContent = '✔ ' + (T.yes ? T.yes.replace(/<[^>]+>/g, '') : 'Yes! You got the whole tune!');
      say(T.yes || 'Brilliant!');
      wait(next, 1400);
    }
    const root = h('div', { class: 'game bd echo' }, meter, task, grid, status);
    next();
    root._stop = () => timers.forEach(clearTimeout);
    root._test = { get notes() { return T.notes.slice(); }, get labels() { return labels.slice(); }, get busy() { return busy; },
      get ti() { return ti; }, get finished() { return finished; }, press: t => press(labels.indexOf(t)), unbusy() { busy = false; } };
    return root;
  }

  function digits(r, key, done) {
    const lengths = r.lengths || [4, 5, 6, 7];
    let li = 0, num = '', typed = '', phase = 'show', misses = 0, timers = [];
    const show = h('div', { class: 'bd-digits' }), status = h('div', { class: 'bd-status' }), rec = h('div');
    const out = h('div', { class: 'bd-typed' });
    const chunked = s => r.chunk ? s.match(/.{1,3}/g).join(' · ') : s.split('').join(' ');
    const pad = h('div', { class: 'bd-pad' }, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✔'].map(d =>
      h('button', { class: 'bd-key' + (d === '✔' ? ' ok' : ''), type: 'button', onclick() { key9(d); } }, d)));
    function next() {
      if (li >= lengths.length) { phase = 'done'; status.textContent = '🏆 Number memory complete!'; return void timers.push(setTimeout(done, 500)); }
      num = ''; while (num.length < lengths[li]) num += String(Math.floor(Math.random() * 10));
      if (num[0] === '0') num = '7' + num.slice(1);
      typed = ''; out.textContent = ''; phase = 'show'; pad.hidden = true;
      show.textContent = chunked(num); show.hidden = false;
      const secs = r.seconds || Math.max(3, Math.ceil(lengths[li] * 0.8));
      status.textContent = `👀 Remember this ${lengths[li]}-digit number! (${secs} seconds)`;
      say(r.chunk ? 'Say it in chunks in your head – like a phone number!' : 'Remember the number!');
      timers.push(setTimeout(hide, secs * 1000));
    }
    function hide() { if (phase !== 'show') return; phase = 'type'; show.hidden = true; pad.hidden = false; status.textContent = '👉 Type the number you saw.'; }
    function key9(d) {
      if (phase !== 'type') return;
      sfx.tap();
      if (d === '⌫') typed = typed.slice(0, -1);
      else if (d === '✔') return check();
      else if (typed.length < num.length) typed += d;
      out.textContent = typed || ' ';
    }
    function check() {
      if (typed === num) {
        sfx.good(); award(`${key}:d${li}`, out);
        const best = brainRecord('digits', num.length, 'Longest number remembered');
        put(rec, recordLine('digits', 'longest number'));
        say(best.isNew && best.old ? 'NEW RECORD!' : 'Perfect!');
        li++; misses = 0; phase = 'wait'; timers.push(setTimeout(next, 900));
      } else {
        misses++; sfx.bad(); shake(out);
        if (misses >= 2) { say(`It was ${chunked(num)}. Let's try a new one the same length.`); misses = 0; phase = 'wait'; show.textContent = chunked(num); show.hidden = false; timers.push(setTimeout(next, 2400)); }
        else { say('Not quite! Here it is again for 2 seconds…'); typed = ''; out.textContent = ''; phase = 'show'; show.hidden = false; timers.push(setTimeout(hide, 2000)); }
      }
    }
    const root = h('div', { class: 'game bd digits-game' }, rec, show, status, out, pad);
    put(rec, recordLine('digits', 'longest number'));
    next();
    root._stop = () => timers.forEach(clearTimeout);
    root._test = { get num() { return num; }, get phase() { return phase; }, hide, type(s) { typed = s; check(); } };
    return root;
  }

  // ===== Kim's Game: look at the shelf, it gets covered, then spot what changed =====
  // r.turns: [{ items: ['🍎 apple', …], seconds: 8, change: 'missing' | 'new' | 'swap', extra: '🦆 duck' (for new) }]
  // missing: one thing is taken away – pick it from the options. new: one thing is added – tap it. swap: two things
  // swap places – tap both. A wrong answer shows the first shelf again for 3 seconds, so he's never stuck.
  GAMES.spotter = function (r, key, done) {
    const turns = r.turns;
    let ti = 0, phase = 'look', timers = [], first = true, before = [], after = [], ans = null, picked = [];
    const shelf = h('div', { class: 'bd-shelf' }), status = h('div', { class: 'bd-status' }), opts = h('div', { class: 'bd-grid' });
    const tag = h('div', { class: 'bd-tag' });
    const drawShelf = (list, tap) => put(shelf, list.map((t, k) => {
      const b = h(tap ? 'button' : 'div', { class: 'bd-slot' + (t ? '' : ' gap'), type: tap ? 'button' : null, html: t ? fmt(split(t).icon || t, false) : '' });
      if (tap && t) b.onclick = () => tap(k, b);
      return b;
    }));
    function turn() {
      if (ti >= turns.length) { phase = 'done'; status.textContent = '🏆 Eagle eyes! Every change spotted.'; return void timers.push(setTimeout(done, 500)); }
      const T = turns[ti];
      first = true; picked = []; phase = 'look';
      before = shuffle(T.items.slice()); after = before.slice();
      const ch = T.change || 'missing';
      if (ch === 'missing') { const k = Math.floor(Math.random() * after.length); ans = after[k]; after[k] = null; }
      else if (ch === 'new') { const k = Math.floor(Math.random() * (after.length + 1)); after.splice(k, 0, T.extra); ans = k; }
      else { const a = Math.floor(Math.random() * after.length); let b = (a + 1 + Math.floor(Math.random() * (after.length - 1))) % after.length; [after[a], after[b]] = [after[b], after[a]]; ans = [a, b].sort(); }
      put(opts); drawShelf(before);
      let left = T.seconds || 8;
      tag.textContent = `👀 LOOK CAREFULLY · ${left}`;
      status.textContent = ch === 'missing' ? 'Something will disappear…' : ch === 'new' ? 'Something new will sneak in…' : 'Two things will swap places…';
      say('Look carefully at the shelf. Remember everything – and where it is!');
      const tick = setInterval(() => { left--; tag.textContent = `👀 LOOK CAREFULLY · ${left}`; if (left <= 0) { clearInterval(tick); cover(); } }, 1000);
      timers.push(tick);
    }
    function cover() {
      if (phase !== 'look') return;
      phase = 'cover'; tag.textContent = '🧺 COVERED!'; shelf.classList.add('covered');
      timers.push(setTimeout(reveal, 1200));
    }
    function reveal() {
      phase = 'spot'; shelf.classList.remove('covered');
      const ch = turns[ti].change || 'missing';
      if (ch === 'missing') {
        drawShelf(after);
        tag.textContent = '❓ WHAT IS MISSING?'; status.textContent = 'Which thing disappeared?';
        const choices = shuffle([ans].concat(shuffle(after.filter(Boolean)).slice(0, 3)));
        put(opts, choices.map(t => { const b = h('button', { class: 'bd-thing', type: 'button', 'data-t': t, html: fmt(t, false) }); b.onclick = () => pick(t === ans, b); return b; }));
      } else if (ch === 'new') {
        tag.textContent = '❓ WHAT IS NEW?'; status.textContent = 'Tap the thing that wasn\'t there before.';
        drawShelf(after, (k, b) => pick(k === ans, b));
      } else {
        tag.textContent = '❓ WHAT SWAPPED?'; status.textContent = 'Tap the TWO things that swapped places.';
        drawShelf(after, (k, b) => {
          if (picked.includes(k)) return;
          if (!ans.includes(k)) return pick(false, b);
          picked.push(k); b.classList.add('right'); sfx.tap();
          if (picked.length === 2) pick(true, b);
        });
      }
    }
    function pick(ok, b) {
      if (phase !== 'spot') return;
      if (ok) {
        phase = 'wait'; b.classList.add('right'); sfx.good();
        if (first) award(`${key}:t${ti}`, b);
        say(first ? 'Spotted it first time!' : 'You got it!');
        ti++; timers.push(setTimeout(turn, 1100));
      } else {
        first = false; sfx.bad(); shake(b); phase = 'peek';
        say('Not that one! Here is the shelf from before – look again…');
        tag.textContent = '👀 LOOK AGAIN'; drawShelf(before); put(opts);
        timers.push(setTimeout(() => { phase = 'cover'; reveal(); picked = []; }, 3000));
      }
    }
    const root = h('div', { class: 'game bd spotter' }, tag, shelf, status, opts);
    turn();
    root._stop = () => timers.forEach(t => { clearTimeout(t); clearInterval(t); });
    root._test = {
      get phase() { return phase; }, get turn() { return ti; }, cover() { cover(); timers.push(setTimeout(() => {}, 0)); }, reveal() { phase = 'cover'; reveal(); },
      solve() {
        const ch = turns[ti].change || 'missing';
        if (ch === 'missing') [...opts.children].find(b => b.dataset.t === ans).click();
        else if (ch === 'new') shelf.children[ans].click();
        else ans.forEach(k => shelf.children[k].click());
      },
    };
    return root;
  };

  // ===== Ninja Reflex: tap only the things that match the rule – and ignore the distractions =====
  // r.phases: [{ rule: 'Tap only the ⭐ stars!', go: ['⭐'], nogo: ['💣', '🍄'], count: 10, speed: 1 }]
  // (the rule switches between phases). r.distract: true – fake 🔔 pings and 📱 pop-ups to ignore.
  // Record: 'reflex' (the longest focus streak). Every phase finishes, whatever the score: any attempt counts.
  GAMES.gonogo = function (r, key, done) {
    const phases = r.phases;
    let pi = -1, spawned = 0, things = [], t = 0, nextAt = 0.6, streak = 0, bestRun = 0, hits = 0, slips = 0, paused = true, finished = false;
    const arena = h('div', { class: 'bd-arena' });
    const rule = h('div', { class: 'bd-rule' }), status = h('div', { class: 'bd-status' }), rec = h('div');
    const streakEl = h('div', { class: 'bd-streak' });
    const showStreak = () => { streakEl.textContent = `🔥 FOCUS STREAK: ${streak}`; streakEl.classList.toggle('hot', streak >= 5); };
    function phase() {
      pi++; spawned = 0;
      if (pi >= phases.length) {
        finished = true; paused = true;
        const best = brainRecord('reflex', bestRun, 'Longest focus streak');
        put(rec, recordLine('reflex', 'longest focus streak'));
        status.textContent = `🏆 Done! ${hits} right taps, ${slips} slips. Best streak: ${bestRun}.`;
        say(best.isNew && best.old ? 'NEW FOCUS RECORD!' : 'Ninja focus!');
        return void setTimeout(done, 500);
      }
      const P = phases[pi];
      paused = true; things.forEach(o => o.el.remove()); things = [];
      put(rule, pi ? '⚠️ NEW RULE! ' : '🎯 RULE: ', h('span', { html: fmt(P.rule, false) }));
      rule.classList.remove('flash'); void rule.offsetWidth; rule.classList.add('flash');
      sfx.charge(); say(pi ? 'The rule has CHANGED! Read it carefully…' : 'Read the rule. Then only tap the right things!');
      setTimeout(() => { paused = false; nextAt = t + 0.4; }, 1800);
    }
    function spawn() {
      const P = phases[pi], wantGo = spawned < P.count && (Math.random() < 0.55 || !P.nogo || !P.nogo.length);
      const distract = r.distract && Math.random() < 0.18;
      if (distract) {
        const el = h('button', { class: 'bd-ping', type: 'button' }, Math.random() < 0.5 ? '🔔 PING!' : '📱 New message!');
        el.style.left = (10 + Math.random() * 55) + '%'; el.style.top = (10 + Math.random() * 60) + '%';
        el.addEventListener('pointerdown', e => { e.preventDefault(); slip(el, 'That was a distraction – ignore it!'); el.remove(); });
        arena.append(el); setTimeout(() => el.remove(), 1500);
        return;
      }
      const go = wantGo, icon = go ? P.go[Math.floor(Math.random() * P.go.length)] : P.nogo[Math.floor(Math.random() * P.nogo.length)];
      if (go) spawned++;
      const el = h('button', { class: 'bd-target', type: 'button' }, icon);
      const fromLeft = Math.random() < 0.5, y = 8 + Math.random() * 70;
      const o = { el, go, x: fromLeft ? -12 : 106, vx: (fromLeft ? 1 : -1) * (32 + Math.random() * 14) * (P.speed || 1), y, wob: Math.random() * 6 };
      el.style.top = y + '%';
      el.addEventListener('pointerdown', e => { e.preventDefault(); tap(o); });
      arena.append(el); things.push(o);
    }
    function tap(o) {
      if (o.done) return;
      o.done = true;
      if (o.go) {
        hits++; streak++; bestRun = Math.max(bestRun, streak); showStreak();
        sfx.good(); if (streak > 1 && streak % 3 === 0) sfx.combo(streak / 3);
        o.el.classList.add('pop'); popText(arena, streak >= 3 ? `x${streak}` : '✔', 'combo');
      } else slip(o.el, 'Careful – that one breaks the rule!');
      setTimeout(() => o.el.remove(), 250);
    }
    function slip(el, msg) { slips++; streak = 0; showStreak(); sfx.bad(); shake(el); say(msg); }
    function step(dt) {
      if (paused || finished) return;
      t += dt;
      const P = phases[pi];
      if (t >= nextAt && (spawned < P.count)) { spawn(); nextAt = t + Math.max(0.45, (0.95 - pi * 0.1) / (P.speed || 1)); }
      things.forEach(o => {
        o.x += o.vx * dt;
        o.el.style.left = o.x + '%';
        o.el.style.transform = `translateY(${Math.sin(t * 3 + o.wob) * 6}px)`;
        if (!o.done && (o.x < -14 || o.x > 108)) { o.done = true; o.el.remove(); }
      });
      things = things.filter(o => !o.done && o.el.isConnected);
      if (spawned >= P.count && !things.length) phase();
    }
    const root = h('div', { class: 'game bd gonogo' }, rec, rule, streakEl, arena, status);
    put(rec, recordLine('reflex', 'longest focus streak')); showStreak();
    const stopLoop = gameLoop(root, step);
    phase();
    root._stop = stopLoop;
    root._test = {
      frames(n) { for (let k = 0; k < n; k++) step(1 / 30); }, start() { paused = false; },
      tapAllGo() { things.filter(o => o.go && !o.done).forEach(tap); }, tapNoGo() { const o = things.find(x => !x.go && !x.done); if (o) tap(o); return !!o; },
      get phase() { return pi; }, get finished() { return finished; }, get streak() { return streak; },
    };
    return root;
  };

  // ===== Colour Clash: tap the colour of the INK, not the word (the rule can flip to the word) =====
  // r.turns (default 12) · r.flip: after how many turns the rule flips to "tap the WORD" (optional)
  // Record: 'clash' (longest run of right answers).
  const INKS = [{ n: 'RED', c: '#e53935' }, { n: 'BLUE', c: '#1e88e5' }, { n: 'GREEN', c: '#2e9e3e' }, { n: 'YELLOW', c: '#f2c200' }];
  GAMES.clash = function (r, key, done) {
    const turns = r.turns || 12;
    let k = 0, word = null, ink = null, run = 0, best = 0, right = 0, mode = 'ink', locked = false;
    const card = h('div', { class: 'bd-clash' }), rule = h('div', { class: 'bd-rule' }), status = h('div', { class: 'bd-status' }), rec = h('div');
    const btns = INKS.map(I => h('button', { class: 'bd-ink', type: 'button', style: `--ink:${I.c}`, onclick() { answer(I); } }, I.n));
    const setRule = () => put(rule, mode === 'ink' ? '🎯 Tap the colour of the INK – not what the word says!' : '⚠️ NEW RULE: tap what the WORD says!');
    function deal() {
      if (k >= turns) {
        const b = brainRecord('clash', best, 'Colour Clash run');
        put(rec, recordLine('clash', 'Colour Clash run'));
        status.textContent = `🏆 ${right} / ${turns} right. Best run: ${best}.`;
        say(b.isNew && b.old ? 'NEW RECORD! Your brain beat the clash!' : 'Your brain beat the clash!');
        locked = true; return void setTimeout(done, 500);
      }
      if (r.flip && k === r.flip) { mode = 'word'; setRule(); rule.classList.remove('flash'); void rule.offsetWidth; rule.classList.add('flash'); sfx.charge(); say('The rule has flipped! Now tap what the WORD says.'); }
      word = INKS[Math.floor(Math.random() * INKS.length)];
      do { ink = INKS[Math.floor(Math.random() * INKS.length)]; } while (ink === word && Math.random() < 0.85);
      card.textContent = word.n; card.style.color = ink.c;
      locked = false;
    }
    function answer(I) {
      if (locked) return;
      const want = mode === 'ink' ? ink : word;
      if (I === want) { run++; right++; best = Math.max(best, run); sfx.good(); if (run % 3 === 0) award(`${key}:run${run}`, card); status.textContent = `✔ Right! Run: ${run}`; }
      else { run = 0; sfx.bad(); shake(card); status.textContent = `❌ That was the ${mode === 'ink' ? 'word' : 'ink'}! The ${mode} was ${want.n}.`; say(mode === 'ink' ? 'Look at the COLOUR, not the word!' : 'Read the WORD this time!'); }
      locked = true; k++; setTimeout(deal, 700);
    }
    const root = h('div', { class: 'game bd clash' }, rec, rule, card, h('div', { class: 'bd-inks' }, btns), status);
    put(rec, recordLine('clash', 'Colour Clash run')); setRule(); deal();
    root._test = { answerRight() { answer(mode === 'ink' ? ink : word); }, unlock() { locked = false; }, get turn() { return k; }, get done() { return k >= turns; } };
    return root;
  };

  // ===== Box Breathing: trace the square with your finger, in time with the dot =====
  // r.breaths (default 3) · r.side (seconds per side, default 4). Breathe in up the side, hold along the top,
  // out down the other side, hold along the bottom. The heart slows down as he keeps his finger on the dot.
  // No fail state: the round ends after the breaths, finger or not.
  GAMES.breathe = function (r, key, done) {
    const breaths = r.breaths || 3, side = r.side || 4, lap = side * 4;
    const STEPS = ['Breathe IN…', 'HOLD…', 'Breathe OUT…', 'HOLD…'];
    let t = 0, on = 0, touching = false, finished = false, started = false, fx = 0, fy = 0;
    const dot = h('div', { class: 'bd-dot' }), box = h('div', { class: 'bd-box' }, dot);
    const word = h('div', { class: 'bd-breath' }, 'Touch the yellow dot ●'), count = h('div', { class: 'bd-count big' });
    const heart = h('div', { class: 'bd-heart' }, '❤️'), calm = h('div', { class: 'bd-calm' }, h('div', { class: 'bd-calm-fill' }));
    const lapEl = h('div', { class: 'bd-status' });
    // where the dot is: 0–1 around the square, starting bottom-left, going up first
    const at = p => { const s = Math.floor(p * 4) % 4, f = p * 4 - Math.floor(p * 4); return [[0, 1 - f], [f, 0], [1, f], [1 - f, 1]][s]; };
    function track(e) {
      const R = box.getBoundingClientRect();
      fx = (e.clientX - R.left) / (R.width || 1); fy = (e.clientY - R.top) / (R.height || 1);
    }
    box.addEventListener('pointerdown', e => { e.preventDefault(); try { box.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } touching = true; started = true; track(e); });
    box.addEventListener('pointermove', e => { if (touching) track(e); });
    const up = () => { touching = false; };
    box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
    function step(dt) {
      if (finished || !started) return;
      t += dt;
      const p = (t % lap) / lap, [x, y] = at(p);
      dot.style.left = (x * 100) + '%'; dot.style.top = (y * 100) + '%';
      const close = touching && Math.hypot(fx - x, fy - y) < 0.22;
      if (close) on += dt;
      dot.classList.toggle('held', close);
      const si = Math.floor(p * 4) % 4;
      word.textContent = STEPS[si]; count.textContent = String(Math.min(side, Math.floor((p * 4 - si) * side) + 1));
      const calmness = Math.min(1, on / (lap * breaths * 0.7));
      calm.firstChild.style.width = (calmness * 100) + '%';
      heart.style.animationDuration = (0.45 + calmness * 0.9) + 's';
      const laps = Math.floor(t / lap);
      lapEl.textContent = `Breath ${Math.min(breaths, laps + 1)} of ${breaths}`;
      if (laps >= breaths) {
        finished = true; award(`${key}:calm`, heart);
        word.textContent = '😌 Calm and ready!'; count.textContent = '';
        say(on > lap * breaths * 0.5 ? 'Your heart has slowed down. That is how ninjas get ready to focus!' : 'Well done! Next time, keep your finger on the dot all the way round.');
        setTimeout(done, 600);
      }
    }
    const root = h('div', { class: 'game bd breathe' }, h('div', { class: 'bd-breath-row' }, heart, calm), word, count, box, lapEl);
    const stopLoop = gameLoop(root, step);
    say(r.say || 'Put your finger on the dot and follow it round the square. Breathe with it.');
    root._stop = stopLoop;
    root._test = { frames(n) { started = true; for (let k = 0; k < n; k++) step(1 / 30); }, hold() { touching = true; started = true; }, get finished() { return finished; } };
    return root;
  };
  // ---------- Eagle Eye: helpers ----------
  const iconOf = t => split(t).icon || String(t);
  // does this icon have enough colour for a hue shift to show? (a grey or white icon wouldn't change)
  const colourful = e => {
    const rows = window.Pixel && Pixel._tools && Pixel._tools.get(e);
    return !rows || rows.join('').replace(/[kwWgG.]/g, '').length >= 30;
  };
  const secsSince = t0 => Math.max(1, Math.round((Date.now() - t0) / 1000));

  // ===== Spot the Difference: two pictures side by side – tap everything that's different =====
  // r.scenes: [{ items: ['🌳', '🏠', '', …] (row by row, '' = an empty spot), cols: 4, diffs: 4, extras: ['🐸', …] }]
  // The differences are picked fresh every time: something gone, something swapped, a new colour or a smaller size.
  // Tap either picture. 💡 Hint lights up the row of one difference (scan row by row!). Record: 'spotdiff', fastest scene (seconds).
  const SWAPS = ['🐸', '🍄', '🎈', '⭐', '🍎', '🐟', '🌸', '🔑', '🧦', '🎩', '🐌', '🍩'];
  GAMES.spotdiff = function (r, key, done) {
    const scenes = r.scenes;
    let si = -1, diffs = null, found = 0, misses = 0, t0 = 0, cellsA = [], cellsB = [], finished = false;
    const timers = [];
    const rec = h('div'), status = h('div', { class: 'bd-status' }), tag = h('div', { class: 'bd-tag' });
    const pics = h('div', { class: 'bd-pics' });
    const hint = h('button', { class: 'btn', type: 'button', onclick() { sfx.tap(); showHint(); } }, '💡 Eagle hint');
    const tick = setInterval(() => { if (diffs && !finished) showStatus(); }, 1000); timers.push(tick);
    function showStatus() { status.textContent = `Found ${found} / ${diffs.size} · ⏱ ${secsSince(t0)} s`; }
    function scene() {
      si++;
      if (si >= scenes.length) {
        finished = true; status.textContent = '🏆 Eagle eyes! Every difference spotted.';
        return void timers.push(setTimeout(done, 600));
      }
      const S = scenes[si], cols = S.cols || 4, items = S.items.map(iconOf);
      const spots = shuffle(items.map((t, k) => k).filter(k => items[k]));
      const want = Math.min(S.diffs || 4, spots.length);
      const extras = shuffle((S.extras || r.extras || SWAPS).filter(e => !items.includes(e)));
      diffs = new Map();
      const kinds = shuffle(['gone', 'swap', 'colour', 'size']);
      for (const k of spots) {
        if (diffs.size >= want) break;
        const kind = kinds[diffs.size % kinds.length];
        if (kind === 'colour' && !colourful(items[k])) diffs.set(k, { kind: 'swap', to: extras.pop() || '🐸' });
        else diffs.set(k, { kind, to: kind === 'swap' ? extras.pop() || '🐸' : null });
      }
      found = 0; misses = 0; t0 = Date.now();
      const panel = (which) => {
        const cells = items.map((t, k) => {
          const d = which === 'B' && diffs.get(k);
          const icon = d ? (d.kind === 'gone' ? '' : d.kind === 'swap' ? d.to : t) : t;
          const c = h('button', { class: 'bd-dcell', type: 'button', 'data-k': k, html: icon ? fmt(icon, false) : '' });
          if (d && d.kind === 'colour') c.classList.add('recol'); // the icon only, so the cell itself gives nothing away
          if (d && d.kind === 'size') c.classList.add('small');
          c.addEventListener('pointerdown', e => { e.preventDefault(); tap(k, c); });
          return c;
        });
        const grid = h('div', { class: 'bd-dgrid' }, cells);
        grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        return { el: h('div', { class: 'bd-pic' }, h('div', { class: 'bd-pic-name' }, which === 'A' ? '🖼️ Picture A' : '🖼️ Picture B'), grid), cells };
      };
      const A = panel('A'), B = panel('B');
      cellsA = A.cells; cellsB = B.cells;
      put(pics, A.el, B.el);
      tag.textContent = `🦅 PICTURE ${si + 1} / ${scenes.length} · FIND ${diffs.size} DIFFERENCES`;
      showStatus();
      say(si ? 'New pictures! Scan them row by row, like reading.' : 'Look at both pictures. Scan row by row – and tap everything that is different!');
    }
    function tap(k, cell) {
      if (finished || !diffs) return;
      const d = diffs.get(k);
      if (d && !d.found) {
        d.found = true; found++;
        cellsA[k].classList.add('found'); cellsB[k].classList.add('found');
        sfx.good(); popText(cell.parentNode, '✔', 'combo');
        showStatus();
        if (found === diffs.size) {
          const secs = secsSince(t0), best = brainRecord('spotdiff', secs, 'Fastest spot the difference (seconds)', true);
          put(rec, recordLine('spotdiff', 'fastest picture, in seconds'));
          award(`${key}:s${si}`, cell);
          say(best.isNew && best.old ? `NEW RECORD! All found in ${secs} seconds!` : `All ${found} found in ${secs} seconds${misses ? '' : ' – and not one wrong tap'}!`);
          diffs = null;
          timers.push(setTimeout(scene, 1500));
        }
      } else if (!d) {
        misses++; sfx.bad(); shake(cell);
        say(misses >= 3 ? 'Try the 💡 hint – or scan one row at a time, left to right.' : 'That one is the same in both. Keep scanning!');
      }
    }
    function showHint() {
      if (!diffs) return;
      const left = [...diffs].filter(([, d]) => !d.found);
      if (!left.length) return;
      const cols = scenes[si].cols || 4, row = Math.floor(left[0][0] / cols);
      [cellsA, cellsB].forEach(cs => cs.forEach((c, k) => { if (Math.floor(k / cols) === row) { c.classList.remove('hint'); void c.offsetWidth; c.classList.add('hint'); } }));
      say(`Look along row ${row + 1}… check each thing in Picture A, then the same spot in Picture B.`);
    }
    const root = h('div', { class: 'game bd spotdiff' }, rec, tag, pics, status, h('div', { class: 'btn-row' }, hint));
    put(rec, recordLine('spotdiff', 'fastest picture, in seconds'));
    scene();
    root._stop = () => timers.forEach(t => { clearTimeout(t); clearInterval(t); });
    root._test = {
      get scene() { return si; }, get finished() { return finished; }, get diffs() { return diffs && [...diffs]; },
      solve() { if (diffs) [...diffs].filter(([, d]) => !d.found).forEach(([k]) => tap(k, cellsB[k])); },
      miss() { const k = cellsA.findIndex((c, i) => diffs && !diffs.has(i)); if (k >= 0) tap(k, cellsA[k]); },
      hint: showHint,
    };
    return root;
  };

  // ===== Eagle Search: a crowded picture – find the hidden things =====
  // r.hunts: [{ text, find: ['🔑 key', '🐸 frog', …] (one of each is hidden), crowd: ['🍎', '🎈', …] (the clutter), n: 40 }]
  // Look-alikes in the crowd make it harder. 💡 Hint lights up the strip one of them is hiding in.
  // Record: 'seek', the fastest search (seconds).
  GAMES.seek = function (r, key, done) {
    const hunts = r.hunts;
    let hi = -1, targets = [], t0 = 0, finished = false, busy = false;
    const timers = [];
    const rec = h('div'), tag = h('div', { class: 'bd-tag' }), status = h('div', { class: 'bd-status' });
    const list = h('div', { class: 'bd-finds' }), field = h('div', { class: 'bd-field' });
    const hint = h('button', { class: 'btn', type: 'button', onclick() { sfx.tap(); showHint(); } }, '💡 Eagle hint');
    function hunt() {
      hi++;
      if (hi >= hunts.length) { finished = true; status.textContent = '🏆 Nothing can hide from your eagle eyes!'; return void timers.push(setTimeout(done, 600)); }
      const H = hunts[hi], finds = H.find.map(split), icons = finds.map(f => f.icon);
      const crowd = (H.crowd || r.crowd).map(iconOf).filter(e => !icons.includes(e));
      const n = H.n || 36, all = [];
      for (let k = 0; k < n; k++) all.push({ icon: crowd[k % crowd.length] });
      finds.forEach((f, k) => all.push({ icon: f.icon, target: k }));
      // a jittered grid, so things spread out and never pile on top of each other
      const cols = Math.ceil(Math.sqrt(all.length * 1.4)), rows = Math.ceil(all.length / cols);
      const cells = shuffle([...Array(cols * rows).keys()]);
      targets = finds.map(f => ({ name: f.name, icon: f.icon, found: false, el: null, chip: null, y: 0 }));
      put(field);
      shuffle(all).forEach((o, k) => {
        const c = cells[k], x = (c % cols + 0.5 + (Math.random() - 0.5) * 0.5) / cols * 100, y = (Math.floor(c / cols) + 0.5 + (Math.random() - 0.5) * 0.4) / rows * 100;
        const el = h('button', { class: 'bd-hide', type: 'button', html: fmt(o.icon, false) });
        el.style.left = x + '%'; el.style.top = y + '%';
        el.style.transform = `translate(-50%, -50%) rotate(${Math.round((Math.random() - 0.5) * 60)}deg) scale(${(0.8 + Math.random() * 0.45).toFixed(2)})`;
        el.addEventListener('pointerdown', e => { e.preventDefault(); tap(o, el); });
        if (o.target != null) { targets[o.target].el = el; targets[o.target].y = y; }
        field.append(el);
      });
      put(list, targets.map(t => (t.chip = h('span', { class: 'bd-find', html: fmt(`${t.icon} ${t.name}`, false) }))));
      tag.textContent = `🦅 SEARCH ${hi + 1} / ${hunts.length}`;
      status.innerHTML = fmt(H.text || 'Find every thing on the list!', false);
      t0 = Date.now(); busy = false;
      say(hi ? 'Another one! Sweep your eyes in strips, top to bottom.' : 'Find everything on the list! Sweep your eyes across in strips, like an eagle over a field.');
    }
    function tap(o, el) {
      if (finished || busy) return;
      const t = o.target != null && targets[o.target];
      if (t && !t.found) {
        t.found = true; el.classList.add('found'); t.chip.classList.add('got'); sfx.good(); popText(field, '✔', 'combo');
        if (targets.every(x => x.found)) {
          busy = true;
          const secs = secsSince(t0), best = brainRecord('seek', secs, 'Fastest eagle search (seconds)', true);
          put(rec, recordLine('seek', 'fastest search, in seconds'));
          award(`${key}:h${hi}`, el);
          say(best.isNew && best.old ? `NEW RECORD! Found in ${secs} seconds!` : `All found in ${secs} seconds!`);
          timers.push(setTimeout(hunt, 1500));
        } else say(`Got the ${t.name}! Keep sweeping…`);
      } else if (!t) { sfx.bad(); shake(el); say('Not on the list – look closely, some things are look-alikes!'); }
    }
    function showHint() {
      const t = targets.find(x => !x.found);
      if (!t || finished) return;
      const band = h('div', { class: 'bd-band' });
      band.style.top = Math.max(0, t.y - 13) + '%';
      field.append(band); timers.push(setTimeout(() => band.remove(), 2600));
      say(`The ${t.name} is somewhere in the glowing strip. Sweep along it slowly!`);
    }
    const root = h('div', { class: 'game bd seek' }, rec, tag, status, list, field, h('div', { class: 'btn-row' }, hint));
    put(rec, recordLine('seek', 'fastest search, in seconds'));
    hunt();
    root._stop = () => timers.forEach(t => clearTimeout(t));
    root._test = {
      get hunt() { return hi; }, get finished() { return finished; },
      findAll() { targets.filter(t => !t.found).forEach(t => t.el.dispatchEvent(new window.Event('pointerdown'))); }, hint: showHint,
    };
    return root;
  };

  // ===== The Blink Test: a change-blindness experiment =====
  // Two pictures take turns, and one thing appears and disappears. mode 'plain': they swap straight over, so the change
  // flickers and pops out. mode 'blink': a grey flash goes between them, like a blink – and the change gets much harder to see.
  // r.missions: [{ mode: 'plain' | 'blink', text, items: [12 emoji], yes, ask }] · r.cols (default 4) · r.caption
  // The time to spot each change goes in a results table, so it works as an `investigate` test.
  GAMES.flicker = function (r, key, done) {
    const table = resultsTable(r.caption || '🧪 Blink test results', ['Test', 'Between the pictures', 'Time to spot it']);
    const stage = h('div', { class: 'bd-stage' });
    let m = null, runN = 0, phase = 'ready', loop = 0, t0 = 0, k = -1, cells = [], shown = [], hinted = false, hintT = 0;
    const missions = missionRunner(r, key, done, mm => { m = mm; ready(); });
    const stopLoop = () => { clearInterval(loop); clearTimeout(hintT); loop = 0; };
    function ready() {
      phase = 'ready'; stopLoop();
      const go = h('button', { class: 'btn big ready', type: 'button', onclick() { sfx.tap(); start(); } }, '▶ Start the clock');
      put(stage, h('div', { class: 'bd-card bd-center' },
        h('p', null, m.mode === 'blink' ? '⚫ This time a quick grey BLINK comes between the pictures.' : '⚡ The pictures swap straight over – no blink.'),
        h('p', null, 'One thing keeps vanishing and coming back. Tap it as soon as you spot it!'), go));
      say('Press start when you are ready. Then find the thing that keeps vanishing!');
    }
    function start() {
      const items = shown = shuffle(m.items.map(iconOf)), cols = r.cols || 4;
      k = Math.floor(Math.random() * items.length); hinted = false;
      cells = items.map((t, j) => {
        const c = h('button', { class: 'bd-dcell', type: 'button', html: fmt(t, false) });
        c.addEventListener('pointerdown', e => { e.preventDefault(); tap(j, c); });
        return c;
      });
      const grid = h('div', { class: 'bd-dgrid bd-flick' }, cells);
      grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
      put(stage, h('div', { class: 'bd-tag' }, m.mode === 'blink' ? '⚫ BLINK MODE' : '⚡ NO BLINK'), grid);
      phase = 'spot'; t0 = Date.now();
      // A 700 ms, (blink 250 ms), B 700 ms, (blink 250 ms), …
      const blink = m.mode === 'blink', seq = blink ? ['A', '-', 'B', '-'] : ['A', 'B'];
      let n = 0;
      const show = () => {
        const f = seq[n++ % seq.length];
        grid.classList.toggle('blank', f === '-');
        cells[k].style.visibility = f === 'B' ? 'hidden' : '';
      };
      show();
      let acc = 0;
      loop = setInterval(() => { acc += 50; const need = seq[(n - 1) % seq.length] === '-' ? 250 : 700; if (acc >= need) { acc = 0; show(); } }, 50);
      hintT = setTimeout(() => { if (phase !== 'spot') return; hinted = true; const row = Math.floor(k / cols); cells.forEach((c, j) => { if (Math.floor(j / cols) === row) c.classList.add('hint'); }); say('Hint: it is somewhere in the glowing row!'); }, 25000);
      say(blink ? 'Watch closely… blink… blink…' : 'Watch closely! What keeps vanishing?');
    }
    function tap(j, c) {
      if (phase !== 'spot') return;
      if (j !== k) { sfx.bad(); shake(c); say('That one stays put. Keep watching!'); return; }
      phase = 'done'; stopLoop();
      runN++;
      const secs = Math.max(1, Math.round((Date.now() - t0) / 1000));
      table.add([runN, m.mode === 'blink' ? '⚫ a blink' : '⚡ no blink', `${secs} s${hinted ? ' (with a hint)' : ''}`]);
      put(stage, h('div', { class: 'bd-card bd-center' }, h('div', { class: 'bd-count big' }, `${secs} s`),
        h('p', { html: fmt(`You spotted the vanishing ${shown[k]} in ${secs} seconds.`, false) })));
      say(`Found it in ${secs} seconds!`);
      missions.win(stage);
    }
    const root = h('div', { class: 'game bd flicker' }, missions.box, stage, missions.ask, table.el);
    root._stop = stopLoop;
    root._test = {
      get phase() { return phase; }, get mission() { return missions.i; },
      start() { start(); }, solve() { tap(k, cells[k]); }, miss() { const j = (k + 1) % cells.length; tap(j, cells[j]); },
    };
    missions.next();
    return root;
  };

  return { showMemoryKey };
});
