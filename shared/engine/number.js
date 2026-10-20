/* Pixelkid lesson engine – number games: Place Value Blocks (hundreds, tens and ones on a place value mat).
 * One part of shared/engine.js, which loads it only when a lesson uses it. E is the engine's shared helpers
 * (E.state and E.stageCard are live). See the top of shared/engine.js for how the parts fit together.
 */
PixelkidEngine.part('number', E => {
  'use strict';
  const { GAMES, draggable, h, missionRunner, put, say, sfx, shake } = E;

  // ===== Place Value Blocks: build numbers from hundreds, tens and ones =====
  // r.cols: ['h', 't', 'o'] (default) or ['t', 'o'] for 2-digit warm-ups.
  // r.missions: [{ text, yes, ask: [questions], and one of:
  //   make: 347 – build the number (a column can't hold more than 9 unless the mission says need)
  //   need: { h: 2, t: 16, o: 5 } (with make) – build it with exactly these blocks (non-standard partitioning: break a ten!)
  //   read: 253 – the blocks are laid out for you: type the number they show
  //   start: { h: 1, t: 3, o: 14 } + goal: 'tidy' – swap 10 ones for a ten (or 10 tens for a hundred) until every column is 9 or less
  //   start: 347 (or { h, t, o }) + make: 357 – start from a number and change it (e.g. 10 more) }]
  // Tap (or drag) a block in the supply to put it on the mat; tap a block on the mat to take it off.
  // When a column has 10 or more, a button swaps ten of them for one block in the next column; break: true lets you break
  // a ten into 10 ones (or a hundred into 10 tens). The mat shows each column's digit and the total (hidden in read missions).
  const COL = {
    h: { name: 'Hundreds', short: 'H', value: 100, one: 'hundred' },
    t: { name: 'Tens', short: 'T', value: 10, one: 'ten' },
    o: { name: 'Ones', short: 'O', value: 1, one: 'one' },
  };
  const NEXT = { o: 't', t: 'h' }, DOWN = { h: 't', t: 'o' };
  const asCounts = v => (typeof v === 'number' ? { h: Math.floor(v / 100), t: Math.floor(v / 10) % 10, o: v % 10 } : Object.assign({ h: 0, t: 0, o: 0 }, v));
  const blockEl = c => h('i', { class: 'pv-block pv-' + c, 'aria-hidden': 'true' });

  GAMES.placeblocks = function (r, key, done) {
    const cols = r.cols || ['h', 't', 'o'];
    let n = { h: 0, t: 0, o: 0 }, locked = false, won = false, tries = 0;
    const value = () => n.h * 100 + n.t * 10 + n.o;
    const columns = {}, piles = {}, digits = {};
    const total = h('div', { class: 'pv-total' });
    const swaps = h('div', { class: 'btn-row pv-swaps' });
    const readBox = h('div', { class: 'pv-read' });
    const supply = h('div', { class: 'pv-supply' });
    const missions = missionRunner(Object.assign({ finish: '🏆 All missions complete – brilliant maths!' }, r), key, done, m => {
      n = asCounts(m.read != null ? m.read : m.start || 0);
      locked = m.read != null; won = false; tries = 0;
      put(readBox);
      if (locked) {
        const inp = h('input', { class: 'pv-input', type: 'text', inputmode: 'numeric', maxlength: 4, 'aria-label': 'The number', placeholder: '?' });
        const go = h('button', { class: 'btn green', type: 'button', onclick: () => check(inp) }, '✔ Check');
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') check(inp); });
        put(readBox, h('label', { class: 'pv-read-q' }, '🔢 What number do the blocks show? ', inp), go);
        say(m.say || 'Count the hundreds, then the tens, then the ones. What number is it?');
      } else say(m.say || 'Tap a block to put it on the mat. Tap a block on the mat to take it off.');
      sync();
    });

    function check(inp) {
      const m = missions.m;
      if (won) return;
      const got = parseInt(String(inp.value).replace(/[^0-9]/g, ''), 10);
      if (got === m.read) { won = true; inp.disabled = true; sync(); missions.win(inp); return; }
      sfx.bad(); shake(inp);
      if (isNaN(got)) { say('Type the number with digits, like 245.'); return; }
      tries++;
      say(tries < 2 ? 'Not quite. Count the blocks in each column, one column at a time. Watch out for an empty column!'
        : 'Look under each column: that is how many there are. Write those digits in order, hundreds first.');
      sync(); // after two tries, each column's digit shows as a hint
    }
    function add(c) {
      if (locked || won) return;
      const m = missions.m || {};
      if (n[c] >= (m.need ? 30 : 9) && !(m.goal === 'tidy')) { sfx.bad(); shake(columns[c]); say(m.need ? 'That is plenty! Check the mission.' : `A column can only hold 9 – ten ${COL[c].name.toLowerCase()} would need the next column!`); return; }
      n[c]++; sfx.tap(); sync(true, c);
    }
    function remove(c) {
      if (locked || won || !n[c]) return;
      n[c]--; sfx.tap(); sync();
    }
    function swapUp(c) { // ten of these → one of the next column
      if (locked || won || n[c] < 10 || !NEXT[c]) return;
      n[c] -= 10; n[NEXT[c]]++; sfx.zap();
      say(`Swap! 10 ${COL[c].name.toLowerCase()} make 1 ${COL[NEXT[c]].one}. The number stays the same: ${value()}.`);
      sync(true, NEXT[c]);
    }
    function breakDown(c) { // one of these → ten of the column below
      if (locked || won || !n[c] || !DOWN[c]) return;
      n[c]--; n[DOWN[c]] += 10; sfx.zap();
      say(`Smash! 1 ${COL[c].one} breaks into 10 ${COL[DOWN[c]].name.toLowerCase()}. Still ${value()}!`);
      sync(true, DOWN[c]);
    }
    function sync(changed, pop) {
      const m = missions.m || {};
      cols.forEach(c => {
        put(piles[c], Array.from({ length: n[c] }, (_, k) => {
          const b = blockEl(c);
          if (pop === c && k === n[c] - 1) b.classList.add('pop');
          return b;
        }));
        piles[c].classList.toggle('many', n[c] > 9);
        columns[c].classList.toggle('full', n[c] > 9);
        digits[c].textContent = locked && tries < 2 && !won ? '?' : n[c] > 9 ? `${n[c]}!` : n[c];
      });
      total.textContent = locked && !won ? '= ?' : `= ${value()}`;
      const ups = cols.filter(c => NEXT[c] && cols.includes(NEXT[c]) && n[c] >= 10).map(c =>
        h('button', { class: 'btn gold', type: 'button', onclick: () => swapUp(c) }, `🔁 Swap 10 ${COL[c].name.toLowerCase()} for 1 ${COL[NEXT[c]].one}`));
      const downs = (r.break || m.need) ? cols.filter(c => DOWN[c] && cols.includes(DOWN[c]) && n[c] > 0).map(c =>
        h('button', { class: 'btn', type: 'button', onclick: () => breakDown(c) }, `🔨 Break 1 ${COL[c].one} into 10 ${COL[DOWN[c]].name.toLowerCase()}`)) : [];
      put(swaps, locked || won ? [] : [...ups, ...downs]);
      supply.hidden = locked;
      if (changed && !won && !locked) goalCheck();
    }
    function goalCheck() {
      const m = missions.m;
      if (!m) return;
      let ok = false;
      if (m.goal === 'tidy') ok = cols.every(c => n[c] <= 9);
      else if (m.need) ok = value() === m.make && cols.every(c => n[c] === (m.need[c] || 0));
      else if (m.make != null) ok = value() === m.make && cols.every(c => n[c] <= 9);
      if (ok) { won = true; setTimeout(() => missions.win(total), 250); sync(); return; }
      if (m.make != null && value() === m.make && m.need) say('That makes the right number – but the mission wants different blocks. Try breaking one!');
    }

    const mat = h('div', { class: 'pv-mat', style: `--cols:${cols.length}` }, cols.map(c => {
      piles[c] = h('div', { class: 'pv-pile' });
      digits[c] = h('div', { class: 'pv-digit' });
      columns[c] = h('div', { class: 'pv-col pv-col-' + c, 'data-drop': c },
        h('div', { class: 'pv-head' }, COL[c].name), piles[c], digits[c]);
      piles[c].addEventListener('click', e => { if (e.target.closest('.pv-block')) remove(c); });
      return columns[c];
    }));
    put(supply, h('div', { class: 'lab-label' }, '🧺 Blocks:'), cols.map(c => {
      const b = h('button', { class: 'pv-take', type: 'button', 'aria-label': `Add a ${COL[c].one}` }, blockEl(c), h('span', null, `+1 ${COL[c].one} (${COL[c].value})`));
      draggable(b, { tap: () => add(c), drop: zone => { if (zone && zone.closest('.pv-mat')) add(c); } });
      return b;
    }));
    const root = h('div', { class: 'game pvblocks' },
      missions.box, mat, h('div', { class: 'pv-sum' }, total), readBox, swaps, supply,
      h('p', { class: 'arc-tip' }, '👆 Tap or drag a block onto the mat · tap a block on the mat to take it off'),
      missions.ask);
    root._test = {
      add, remove, swapUp, breakDown,
      type(v) { const inp = readBox.querySelector('input'); inp.value = String(v); check(inp); },
      get value() { return value(); }, get counts() { return Object.assign({}, n); }, get mission() { return missions.i; }, get won() { return won; },
    };
    missions.next();
    return root;
  };
});
