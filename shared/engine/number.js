/* Pixelkid lesson engine – number games: Place Value Blocks (hundreds, tens and ones on a place value mat) and Column Sums
 * (the written column method for adding and subtracting, with exchanging) and the Shop Till (pay with coins, give change).
 * One part of shared/engine.js, which loads it only when a lesson uses it. E is the engine's shared helpers
 * (E.state and E.stageCard are live). See the top of shared/engine.js for how the parts fit together.
 */
PixelkidEngine.part('number', E => {
  'use strict';
  const { GAMES, award, confetti, draggable, h, missionRunner, praise, put, say, sfx, shake, track } = E;

  // ===== Place Value Blocks: build numbers from hundreds, tens and ones =====
  // r.cols: ['h', 't', 'o'] (default) or ['t', 'o'] for 2-digit warm-ups.
  // r.missions: [{ text, yes, ask: [questions], and one of:
  //   make: 347 – build the number (a column can't hold more than 9 unless the mission says need)
  //   need: { h: 2, t: 16, o: 5 } (with make) – build it with exactly these blocks (non-standard partitioning: break a ten!)
  //   read: 253 – the blocks are laid out for you: type the number they show
  //   start: { h: 1, t: 3, o: 14 } + goal: 'tidy' – swap 10 ones for a ten (or 10 tens for a hundred) until every column is 9 or less
  //   start: 347 (or { h, t, o }) + make: 357 – start from a number and change it (e.g. 10 more); add: true lets a column
  //     go past 9 while adding (so 8 + 5 ones makes 13 ones, to swap for a ten) }]
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
    let n = { h: 0, t: 0, o: 0 }, locked = false, won = false, tries = 0, keep = 0;
    const value = () => n.h * 100 + n.t * 10 + n.o;
    const columns = {}, piles = {}, digits = {};
    const total = h('div', { class: 'pv-total' });
    const swaps = h('div', { class: 'btn-row pv-swaps' });
    const readBox = h('div', { class: 'pv-read' });
    const supply = h('div', { class: 'pv-supply' });
    const missions = missionRunner(Object.assign({ finish: '🏆 All missions complete – brilliant maths!' }, r), key, done, m => {
      n = asCounts(m.read != null ? m.read : m.start || 0);
      locked = m.read != null; won = false; tries = 0; keep = value(); // keep: a tidy-up must keep the same number
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
      if (n[c] >= (m.need ? 30 : m.add ? 19 : 9) && !(m.goal === 'tidy')) { sfx.bad(); shake(columns[c]); say(m.need ? 'That is plenty! Check the mission.' : `A column can only hold 9 – ten ${COL[c].name.toLowerCase()} would need the next column!`); return; }
      n[c]++; sfx.tap(); sync(true, c);
    }
    function remove(c) {
      if (locked || won || !n[c]) return;
      n[c]--; sfx.tap(); sync(true); // (taking blocks away can finish a take-away mission)
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
      if (m.goal === 'tidy') ok = value() === keep && cols.every(c => n[c] <= 9);
      else if (m.need) ok = value() === m.make && cols.every(c => n[c] === (m.need[c] || 0));
      else if (m.make != null) ok = value() === m.make && cols.every(c => n[c] <= 9);
      if (ok) { won = true; setTimeout(() => missions.win(total), 250); sync(); return; }
      if (m.make != null && value() === m.make && m.need) say('That makes the right number – but the mission wants different blocks. Try breaking one!');
      else if (m.make != null && value() === m.make && cols.some(c => n[c] > 9)) say('That\'s the right amount! Now tidy up: swap 10 of them for 1 of the next block.');
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

  // ===== Column Sums: the written column method, with exchanging =====
  // r.sums: [{ a: 268, b: 145, op: '+' | '-' }] (answers up to 999; in a subtraction a ≥ b, and never exchange from a 0).
  // Work from the ones column: tap the answer digit on the keypad. Adding: when a column makes 10 or more, write the ones
  // and tap the little box above the next column to carry the ten. Subtracting: when the top digit is too small, tap the
  // top digit of the next column to exchange one of its tens (or hundreds): it goes down by one and this column gets 10 more.
  GAMES.columnsum = function (r, key, done) {
    const root = h('div', { class: 'game colsum' });
    let si = 0;
    function show() {
      const q = r.sums[si], add = q.op !== '-', N = 3;
      const dig = v => [v % 10, Math.floor(v / 10) % 10, Math.floor(v / 100) % 10]; // ones, tens, hundreds
      const A = dig(q.a), B = dig(q.b), ans = add ? q.a + q.b : q.a - q.b, R = dig(ans);
      const width = Math.max(String(q.a).length, String(q.b).length, String(ans).length);
      let c = 0, slips = 0, over = false, want = null; // want: 'carry' (tap the carry box over column c) before carrying on
      const carry = [0, 0, 0], top = A.slice(), plus10 = [false, false, false], took = [false, false, false]; // the exchanges so far
      const cells = { carry: [], a: [], b: [], r: [] };
      const why = h('div', { class: 'why', hidden: true });
      const nextBtn = h('button', { class: 'btn big ready', type: 'button', hidden: true, onclick() { sfx.tap(); si++; show(); } }, 'Next sum ▶');
      const grid = h('div', { class: 'cs-grid', style: `--n:${width + 1}` });
      const hint = msg => { slips++; sfx.bad(); say('💡 ' + msg); };
      // the sum, laid out in columns: carry boxes, the top number, the bottom number, the answer
      const colHead = k => h('div', { class: 'cs-head' }, ['O', 'T', 'H'][k]);
      const row = (cls, make) => { grid.append(h('div', { class: 'cs-op' }, cls === 'b' ? (add ? '+' : '−') : '')); for (let k = width - 1; k >= 0; k--) grid.append(make(k)); };
      row('h', colHead);
      row('carry', k => { const b = h('button', { class: 'cs-carry', type: 'button', 'aria-label': `carry box over the ${['ones', 'tens', 'hundreds'][k]}`, disabled: !add || !k }); b.onclick = () => tapCarry(k); cells.carry[k] = b; return b; });
      row('a', k => { const b = h('button', { class: 'cs-digit top', type: 'button', disabled: add }); b.onclick = () => tapTop(k); cells.a[k] = b; return b; });
      row('b', k => (cells.b[k] = h('div', { class: 'cs-digit' })));
      grid.append(h('div', { class: 'cs-line' }));
      row('r', k => (cells.r[k] = h('div', { class: 'cs-ans' })));
      function paint() {
        for (let k = 0; k < width; k++) {
          const shownA = k < String(q.a).length, shownB = k < String(q.b).length;
          cells.a[k].innerHTML = !shownA ? '' : took[k] ? `<s>${A[k]}</s><sup>${top[k] - (plus10[k] ? 10 : 0)}</sup>` : plus10[k] ? `<sup>1</sup>${A[k]}` : String(A[k]);
          if (took[k] && plus10[k]) cells.a[k].innerHTML = `<s>${A[k]}</s><sup>1${top[k] - 10}</sup>`;
          cells.b[k].textContent = shownB ? B[k] : '';
          cells.carry[k].textContent = carry[k] ? '1' : '';
          cells.carry[k].classList.toggle('want', want === 'carry' && k === c);
          cells.r[k].classList.toggle('now', !over && k === c && !want);
        }
      }
      function enter(d) {
        if (over || want) { if (want) hint(`First carry the ten: tap the little box above the ${['ones', 'tens', 'hundreds'][c]}.`); return; }
        if (add) {
          const s = A[c] + B[c] + carry[c];
          if (d !== s % 10) return hint(c && carry[c] ? `${A[c]} + ${B[c]} + the 1 you carried = ${s}. Which digit goes in the ${['ones', 'tens', 'hundreds'][c]}?`
            : `${A[c]} + ${B[c]} = ${s}.${s >= 10 ? ` That is ${s >= 10 ? '1 ten and ' + (s % 10) : ''} – write the ${s % 10}.` : ''}`);
          cells.r[c].textContent = d; sfx.tap();
          if (s >= 10 && c + 1 < width) { want = 'carry'; c++; say(`${s} is too big for one column! Exchange 10 ${['ones', 'tens'][c - 1]} for 1 ${['ten', 'hundred'][c - 1]}: tap the box above the ${['tens', 'hundreds'][c - 1]}.`); paint(); return; }
        } else {
          if (top[c] < B[c]) return hint(`${top[c]} take away ${B[c]}? The top digit is too small – exchange: tap the ${['tens', 'hundreds'][c]} digit to swap one for 10 ${['ones', 'tens'][c]}.`);
          const s = top[c] - B[c];
          if (d !== s) return hint(`${top[c]} take away ${B[c]} = ?`);
          cells.r[c].textContent = d; sfx.tap();
        }
        c++;
        if (c >= width || c >= String(ans).length) return finish(); // (no leading zeros to write)
        paint();
      }
      function tapCarry(k) {
        if (!add || over) return;
        if (want === 'carry' && k === c) { carry[k] = 1; want = null; sfx.zap(); say(`Carried! Now add the ${['ones', 'tens', 'hundreds'][k]} – don't forget the 1.`); paint(); return; }
        hint(want ? 'Carry it into the very next column along.' : 'Only carry when a column adds up to 10 or more.');
      }
      function tapTop(k) {
        if (add || over) return;
        if (k !== c + 1 || top[c] >= B[c] || plus10[c]) return hint(k === c + 1 ? 'No need to exchange – the top digit is big enough.' : 'Exchange from the column just to the left of the one you are working on.');
        if (top[k] === 0) return hint('That column is empty – there is nothing to exchange.');
        top[k]--; took[k] = true; top[c] += 10; plus10[c] = true; sfx.zap();
        say(`Exchanged! One ${['ten', 'hundred'][c]} became 10 ${['ones', 'tens'][c]}: now it is ${top[c]} take away ${B[c]}.`);
        paint();
      }
      function finish() {
        over = true; paint();
        const first = slips === 0;
        track('Column sums', { q: `${q.a} ${add ? '+' : '−'} ${q.b}`, type: 'type', answer: String(ans) }, first);
        if (first) { sfx.good(); award(`${key}:${si}`, grid); say(praise()); } else say(`${ans}! You got there.`);
        why.innerHTML = `✔ ${q.a} ${add ? '+' : '−'} ${q.b} = <b>${ans}</b>` + (add ? '' : ` · Check: ${ans} + ${q.b} = ${q.a}`);
        why.hidden = false;
        if (si < r.sums.length - 1) nextBtn.hidden = false; else { confetti(80); done(); }
      }
      const keypad = h('div', { class: 'cs-keys' }, [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(d => h('button', { class: 'cw-key', type: 'button', onclick: () => enter(d) }, String(d))));
      put(root, h('div', { class: 'tf-count' }, `${si + 1} of ${r.sums.length}`),
        h('div', { class: 'fx-label' }, add ? '➕ Start with the ones. Carry when a column makes 10 or more.' : '➖ Start with the ones. Exchange when the top digit is too small.'),
        grid, keypad, why, h('div', { class: 'btn-row' }, nextBtn));
      paint();
      say(add ? `Add the ones first: ${A[0]} + ${B[0]}.` : `Ones first: ${A[0]} take away ${B[0]}.`);
      root._test = {
        solve() { // plays the sum the right way: exchanging and carrying when needed
          for (let k = 0; k < 4 && !over; k++) {
            if (want) tapCarry(c);
            if (!add && top[c] < B[c] && !plus10[c]) tapTop(c + 1);
            enter(add ? (A[c] + B[c] + carry[c]) % 10 : top[c] - B[c]);
          }
        },
        enter, get over() { return over; }, next: () => nextBtn.click(),
      };
    }
    show();
    return root;
  };

  // ===== Shop Till: pay with coins, and give change =====
  // r.coins: the coins (and notes) in the till, in pence (default 1p, 2p, 5p, 10p, 20p, 50p, £1, £2; add 500 / 1000 for notes).
  // r.missions: [{ text, customer (emoji), yes, ask: [questions], and one of:
  //   pay: 75 – put coins on the counter that make exactly 75p (fewest: true – and use as few coins as you can)
  //   buy: [{ name, emoji, price }] – add up the shopping, then pay the total exactly
  //   buy + given: 100 – the customer pays with £1: give them the right change }]
  // Tap or drag a coin onto the counter; tap a coin on the counter to put it back. The counter's total only shows after a
  // miss (so the child does the counting), and hints for change count on from the price to what was paid.
  const money = p => (p < 100 ? `${p}p` : `£${p % 100 ? (p / 100).toFixed(2) : p / 100}`);
  const coinEl = v => h('i', { class: `coin coin-${v}${v >= 500 ? ' note' : ''}`, 'aria-label': money(v) }, h('b', null, money(v)));
  const fewestCoins = (p, coins) => { let n = 0; coins.slice().sort((a, b) => b - a).forEach(c => { n += Math.floor(p / c); p %= c; }); return n; };
  GAMES.shop = function (r, key, done) {
    const coins = r.coins || [1, 2, 5, 10, 20, 50, 100, 200];
    let onCounter = [], target = 0, tries = 0, won = false, showTotal = false;
    const customer = h('div', { class: 'shop-customer' });
    const counter = h('div', { class: 'shop-counter', 'data-drop': 'counter' });
    const counterHead = h('div', { class: 'shop-counter-head' });
    const totalEl = h('div', { class: 'shop-total' });
    const checkBtn = h('button', { class: 'btn big green', type: 'button', onclick: () => check() }, '✔ Check');
    const value = () => onCounter.reduce((a, b) => a + b, 0);
    const missions = missionRunner(Object.assign({ finish: '🏆 Shop closed – brilliant maths!' }, r), key, done, m => {
      onCounter = []; tries = 0; won = false; showTotal = false;
      const cost = m.buy ? m.buy.reduce((a, it) => a + it.price, 0) : m.pay;
      target = m.given ? m.given - cost : cost;
      const items = (m.buy || []).map(it => h('div', { class: 'shop-item' }, h('span', { class: 'shop-item-pic' }, it.emoji || '🛍️'), h('span', null, it.name), h('b', { class: 'shop-price' }, money(it.price))));
      put(customer, h('div', { class: 'shop-who' }, m.customer || '🙂'),
        h('div', { class: 'shop-order' }, items.length ? items : h('div', { class: 'shop-item' }, h('b', { class: 'shop-price' }, money(m.pay))),
          m.given ? h('div', { class: 'shop-given' }, 'They pay with ', coinEl(m.given)) : null));
      counterHead.textContent = m.given ? '🪙 Your change for the customer:' : '🪙 Put the money on the counter:';
      say(m.say || (m.given ? 'Count on from the price to what they paid. That\'s the change!' : m.buy ? 'Add up the prices, then pay exactly that much.' : `Make exactly ${money(m.pay)}.`));
      sync();
    });
    function add(v) { if (won) return; if (onCounter.length >= 20) { say('That\'s a lot of coins! Try some bigger ones.'); return; } onCounter.push(v); sfx.tap(); sync(); }
    function remove(i) { if (won) return; onCounter.splice(i, 1); sfx.tap(); sync(); }
    function check() {
      const m = missions.m;
      if (won || !m) return;
      const got = value();
      if (!onCounter.length) { say('Put some coins on the counter first!'); return; }
      if (got === target && (!m.fewest || onCounter.length <= fewestCoins(target, coins))) {
        won = true;
        if (tries === 0) { track('Shop', { q: m.text, type: 'type', answer: money(target) }, true); say(praise()); } // a miss was already tracked
        sync(); missions.win(totalEl); return;
      }
      tries++; sfx.bad(); shake(counter);
      if (got === target) { say(`That's exactly ${money(target)}! But can you do it with fewer coins? Swap some small coins for a bigger one.`); return; }
      if (tries === 1) say(got < target ? 'Not enough! Count your coins again – start with the biggest.' : 'Too much! Count your coins again – start with the biggest.');
      else {
        showTotal = true;
        const diff = Math.abs(target - got);
        if (m.given) {
          const cost = m.given - target;
          say(`💡 Count on from ${money(cost)} to ${money(m.given)}. You've given ${money(got)} – that's ${money(diff)} too ${got < target ? 'little' : 'much'}.`);
        } else say(`💡 You've put ${money(got)}. That's ${money(diff)} too ${got < target ? 'little' : 'much'}.`);
      }
      if (tries === 1) track('Shop', { q: m.text, type: 'type', answer: money(target) }, false);
      sync();
    }
    function sync() {
      put(counter, onCounter.length ? onCounter.slice().sort((a, b) => b - a).map(v => {
        const c = coinEl(v); c.setAttribute('role', 'button');
        c.addEventListener('click', () => remove(onCounter.indexOf(v)));
        return c;
      }) : h('span', { class: 'shop-empty' }, 'Drag coins here'));
      totalEl.textContent = won ? `✔ ${money(value())}` : showTotal ? `On the counter: ${money(value())}` : '';
      checkBtn.hidden = won;
    }
    const till = h('div', { class: 'shop-till' }, coins.map(v => {
      const c = coinEl(v); c.setAttribute('role', 'button'); c.tabIndex = 0;
      draggable(c, { tap: () => add(v), drop: z => { if (z === counter) add(v); } });
      c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); add(v); } });
      return c;
    }));
    const root = h('div', { class: 'game shop' }, missions.box, customer,
      h('div', { class: 'shop-desk' }, counterHead, counter, totalEl),
      h('div', { class: 'lab-label' }, '💰 The till: tap or drag a coin'), till,
      h('div', { class: 'btn-row' }, h('button', { class: 'btn ghost', type: 'button', onclick() { if (!won) { onCounter = []; sfx.tap(); sync(); } } }, '↺ Clear the counter'), checkBtn),
      missions.ask);
    root._test = { add, remove, check, get total() { return value(); }, get target() { return target; }, get mission() { return missions.i; }, get won() { return won; } };
    missions.next();
    return root;
  };
});
