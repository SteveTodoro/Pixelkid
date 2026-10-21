/* Pixelkid lesson engine – the everyday games: sort, label, match, order, truefalse, fixit, questions, wordsearch,
 * crossword and mystery. One part of shared/engine.js, loaded by every lesson (order and fixit also run inside
 * order questions and teach stages). E is the engine's shared helpers. See the top of shared/engine.js.
 */
PixelkidEngine.part('games', E => {
  'use strict';
  const { GAMES, award, dropGame, fmt, h, oops, pic, pick, praise, put, runQuestions, say, sfx, shake, shuffle } = E;

  // ---------- games ----------
  // Each game: (round, gemKeyPrefix, done, hooks) → element.
  Object.assign(GAMES, {
    sort(r, key, done) {
      let placed = 0;
      const lists = {};
      const targets = r.buckets.map(b => {
        lists[b.id] = h('div', { class: 'bucket-items' });
        return h('div', { class: 'bucket', 'data-drop': b.id },
          h('div', { class: 'bucket-head' }, b.emoji && h('span', { class: 'bucket-emoji' }, b.emoji), b.label),
          lists[b.id]);
      });
      const chips = dropGame({
        items: r.items, targets, tapHint: r.tapHint || 'Now tap the chest it belongs in!',
        makeChip: it => h('div', null, it.emoji && h('span', { class: 'ci-emoji' }, it.emoji), h('span', null, it.label)),
        check: (chip, t) => chip._it.bucket === t.dataset.drop,
        onRight(chip, t) {
          chip.classList.add('placed'); chip.removeAttribute('tabindex');
          lists[t.dataset.drop].append(chip);
          sfx.good(); award(key + ':' + chip._it.label, chip); say(chip._it.yes || praise());
          if (++placed === r.items.length) done();
        },
        onWrong(chip) { say(chip._it.hint || oops()); },
      });
      return h('div', { class: 'game sort' },
        h('div', { class: 'tray-wrap' },
          h('div', { class: 'tray-label' }, '👇 Drag each item into the right chest (or tap it, then tap the chest)'),
          h('div', { class: 'tray' }, chips)),
        h('div', { class: 'buckets', style: `--n:${r.buckets.length}` }, targets));
    },

    label(r, key, done) {
      let placed = 0;
      const board = h('div', { class: 'label-board' }, pic(r.pic, 'label-pic'));
      const targets = r.spots.map((sp, idx) => {
        const t = h('div', { class: 'spot', 'data-drop': String(idx), style: `left:${sp.x}%;top:${sp.y}%` }, '?');
        board.append(t);
        return t;
      });
      const words = r.spots.map(sp => sp.answer).concat(r.extra || []);
      const chips = dropGame({
        items: words, targets, tapHint: 'Now tap the ? where it goes!',
        makeChip: w => h('div', null, w),
        check: (chip, t) => !t.classList.contains('filled') && r.spots[+t.dataset.drop].answer === chip._it,
        onRight(chip, t) {
          const idx = t.dataset.drop;
          t.textContent = chip._it; t.classList.add('filled'); t.removeAttribute('data-drop');
          chip.remove();
          sfx.good(); award(key + ':' + idx, t); say(praise());
          if (++placed === r.spots.length) done();
        },
        onWrong() { say(r.hint || oops()); },
      });
      return h('div', { class: 'game label' }, board,
        h('div', { class: 'tray-wrap' },
          h('div', { class: 'tray-label' }, '👇 Drag each label onto a ? (or tap it, then tap the ?)'),
          h('div', { class: 'tray' }, chips)));
    },

    match(r, key, done) {
      let sel = null, matched = 0;
      const colors = ['#ffe66b', '#b9f29a', '#a8dcff', '#ffc2e2', '#d6c4ff', '#ffcf99', '#9ff2e6'];
      const mk = (idx, side) => {
        const b = h('button', { class: 'match-item', type: 'button', html: r.html ? r.pairs[idx][side] : fmt(r.pairs[idx][side], false) });
        b._idx = idx; b._side = side;
        b.addEventListener('click', () => choose(b));
        return b;
      };
      const idxs = r.pairs.map((_, i) => i);
      const left = (r.shuffleLeft === false ? idxs : shuffle(idxs)).map(i => mk(i, 'a'));
      const right = shuffle(idxs).map(i => mk(i, 'b'));
      function choose(b) {
        if (b.classList.contains('matched')) return;
        if (!sel || sel._side === b._side) {
          if (sel) sel.classList.remove('selected');
          sel = sel === b ? null : b;
          if (sel) { sel.classList.add('selected'); sfx.tap(); say(sel._side === 'a' ? 'Now tap its partner on the right!' : 'Now tap its partner on the left!'); }
          return;
        }
        const a = sel; sel = null; a.classList.remove('selected');
        const [pa, pb] = a._side === 'a' ? [a, b] : [b, a];
        if (r.pairs[pa._idx].b === r.pairs[pb._idx].b) {
          const c = colors[matched % colors.length];
          [pa, pb].forEach(x => { x.classList.add('matched'); x.style.background = c; x.disabled = true; });
          sfx.good(); award(key + ':' + pa._idx, pb); say(praise());
          if (++matched === r.pairs.length) done();
        } else {
          shake(a); shake(b); sfx.bad(); say(r.hint || oops());
        }
      }
      return h('div', { class: 'game match' },
        h('div', { class: 'match-grid' },
          h('div', { class: 'match-col left' }, left),
          h('div', { class: 'match-col right' }, right)));
    },

    // Tap the items into the numbered boxes in order. r.ends: labels for the two ends (default FIRST / LAST),
    // e.g. ['MOST friction', 'LEAST friction'] or ['SHORTEST', 'LONGEST']. r.start: true puts the first item in already.
    order(r, key, done, hooks = {}) {
      let n = r.start ? 1 : 0;
      const ends = r.ends || ['FIRST', 'LAST'];
      const slots = r.items.map((t, k) => h('li', null,
        h('span', { class: 'ord-text' }, k < n ? t : '…'),
        (k === 0 || k === r.items.length - 1) && h('span', { class: 'ord-end' }, k === 0 ? ends[0] : ends[1])));
      slots.slice(0, n).forEach(li => li.classList.add('filled', 'given'));
      const point = () => slots.forEach((li, k) => li.classList.toggle('next', k === n));
      const pool = shuffle(r.items.slice(n)).map(t => h('button', {
        class: 'opt', type: 'button', html: fmt(t, false),
        onclick(e) {
          const b = e.currentTarget;
          if (t === r.items[n]) {
            slots[n].querySelector('.ord-text').textContent = t; slots[n].classList.add('filled');
            b.remove();
            if (!hooks.noStars) award(key + ':' + n, slots[n]);
            n++; point();
            if (n === r.items.length) done();
            else if (hooks.quiet) sfx.tap(); else { sfx.good(); say(n === 1 ? 'Great start! What comes next?' : praise()); }
          } else {
            shake(b); sfx.bad();
            if (hooks.wrong) hooks.wrong(b);
            else say(r.hint || (n === 0 ? 'Hmm, what happens first?' : 'What happens next?'));
          }
        },
      }));
      point();
      return h('div', { class: 'game order' },
        h('ol', { class: 'order-list' }, slots),
        h('div', { class: 'tray-label' }, `👇 Tap them in order – start with the ${ends[0].toLowerCase()} one`),
        h('div', { class: 'order-pool' }, pool));
    },

    truefalse(r, key, done) {
      let si = 0;
      const box = h('div', { class: 'game tf' });
      function show() {
        const st = r.statements[si];
        const why = h('div', { class: 'why', hidden: true });
        const nextBtn = h('button', { class: 'btn', type: 'button', hidden: true, onclick() { sfx.tap(); si++; show(); } }, 'Next one ▶');
        const answer = (val, btn, other) => {
          bT.disabled = bF.disabled = true;
          if (val === st.answer) { btn.classList.add('right'); sfx.good(); award(`${key}:${si}`, btn); say(praise()); }
          else { btn.classList.add('wrong'); other.classList.add('right'); shake(btn); sfx.bad(); say('Not this time – read why below!'); }
          if (st.why) { why.innerHTML = (val === st.answer ? '✔ ' : '💡 ') + fmt(st.why, false); why.hidden = false; }
          if (si < r.statements.length - 1) nextBtn.hidden = false; else done();
        };
        const bT = h('button', { class: 'opt', type: 'button', onclick: () => answer(true, bT, bF) }, '✅ True');
        const bF = h('button', { class: 'opt', type: 'button', onclick: () => answer(false, bF, bT) }, '❌ False');
        box.replaceChildren(
          h('div', { class: 'tf-count' }, `${si + 1} of ${r.statements.length}`),
          h('p', { class: 'tf-q', html: fmt(st.text, false) }),
          h('div', { class: 'tf-row' }, bT, bF), why,
          h('div', { class: 'btn-row' }, nextBtn));
      }
      show();
      return box;
    },

    // Proofreader: tap the goblin's wrong word in a sentence, then drag the right word onto it.
    // r.sentences: [{ text, wrong: 'here', fix: 'hear', options: ['hair'], why, hint }] or { text, ok: true, why } (nothing to fix).
    // r.noOk: hide the "No mistakes!" button when every sentence has a mistake. r.label / r.okLabel: the same prompt and
    // OK button for every sentence (so the prompt never gives away whether there is a mistake). r.onResult(index, firstTry).
    fixit(r, key, done) {
      let si = 0;
      const box = h('div', { class: 'game fixit' });
      const bare = w => w.toLowerCase().replace(/^[^a-z']+|[^a-z']+$/gi, '');
      function show() {
        const st = r.sentences[si];
        let slip = false, over = false;
        const tokens = st.text.split(/\s+/);
        const wi = st.ok ? -1 : st.wrongAt != null ? st.wrongAt : tokens.findIndex(t => bare(t) === st.wrong.toLowerCase());
        const why = h('div', { class: 'why', hidden: true });
        const tray = h('div', { class: 'tray' });
        const trayWrap = h('div', { class: 'tray-wrap', hidden: true }, h('div', { class: 'tray-label' }, '👇 Tap the right word to swap it in (or drag it onto the red one)'), tray);
        const nextBtn = h('button', { class: 'btn', type: 'button', hidden: true, onclick() { sfx.tap(); si++; show(); } }, 'Next sentence ▶');
        const finish = (el, text) => {
          over = true; sfx.good();
          if (!slip) award(`${key}:${si}`, el);
          if (r.onResult) r.onResult(si, !slip);
          say(praise());
          why.innerHTML = '✔ ' + fmt(text || 'Fixed!', false); why.hidden = false;
          okBtn.disabled = true;
          if (si < r.sentences.length - 1) nextBtn.hidden = false; else done();
        };
        const miss = (el, msg) => { slip = true; shake(el); sfx.bad(); say(msg); };
        const words = tokens.map((t, i) => {
          const b = h('button', { class: 'fx-word', type: 'button' }, t);
          b.addEventListener('click', () => {
            if (over || b.classList.contains('found')) return;
            if (i !== wi) return miss(b, st.ok ? 'Look again – is anything really wrong in this sentence?' : st.hint || 'That word is fine. Read the sentence aloud – which word has the wrong meaning?');
            sfx.zap(); b.classList.add('found'); b.setAttribute('data-drop', 'fix');
            say('Found it! Now tap the right word to swap it in.');
            const chips = dropGame({
              items: [st.fix, ...(st.options || []).filter(o => o !== st.fix)], targets: [b], tapPlaces: true,
              makeChip: w => h('div', null, w),
              check: chip => chip._it === st.fix,
              onRight(chip) {
                const [, pre, post] = t.match(/^([^a-z']*)[a-z']+(.*)$/i) || [, '', ''];
                const cap = /^[^a-z]*[A-Z]/.test(t) ? st.fix[0].toUpperCase() + st.fix.slice(1) : st.fix;
                b.textContent = pre + cap + post; b.classList.remove('found'); b.classList.add('fixed'); b.removeAttribute('data-drop');
                trayWrap.hidden = true;
                finish(b, st.why);
              },
              onWrong(chip) { slip = true; say(st.hint || `"${chip._it}" doesn't fit here. Think about what the word means!`); },
            });
            put(tray, chips); trayWrap.hidden = false;
          });
          return b;
        });
        const okBtn = h('button', { class: 'btn ghost', type: 'button', hidden: !!r.noOk, onclick() {
          if (over) return;
          if (st.ok) finish(okBtn, st.why || 'Every word is right!');
          else miss(okBtn, 'Hmm – a sneaky mistake is hiding in here. Hunt for it!');
        } }, r.okLabel || '✔ No mistakes!');
        put(box,
          h('div', { class: 'tf-count' }, `${si + 1} of ${r.sentences.length}`),
          h('div', { class: 'fx-label' }, r.label || (st.ok ? '🔍 Is there a mistake?' : '🔍 Tap the wrong word')),
          h('p', { class: 'fx-sentence' }, words),
          trayWrap, why,
          h('div', { class: 'btn-row' }, okBtn, nextBtn));
        box._test = { words, okBtn, tray, get over() { return over; }, next: () => nextBtn.click() };
      }
      show();
      return box;
    },

    // Read a picture / table, then answer questions about it.
    questions(r, key, done) {
      const area = h('div');
      runQuestions(area, r.questions, { key, done: () => done(), lastLabel: 'Done ✔' });
      return h('div', { class: 'game questions' },
        r.pic && pic(r.pic, 'data-pic'),
        r.html && h('div', { class: 'data-box', html: r.html }),
        area);
    },

    // Word hunt: find the hidden words. Drag across a word, or tap its first letter then its last letter.
    wordsearch(r, key, done) {
      const words = r.words.map(w => (typeof w === 'string' ? { word: w } : w))
        .map(w => Object.assign({}, w, { word: w.word.toUpperCase().replace(/[^A-Z]/g, '') }));
      const size = Math.max(r.size || 10, ...words.map(w => w.word.length));
      const { grid, placed } = buildWordsearch(words, size, r.diagonal);
      let found = 0, start = null, anchor = null, sel = [];
      const cellEls = [];
      const gridEl = h('div', { class: 'ws-grid', style: `--n:${size}`, 'aria-label': 'Word hunt grid' });
      grid.forEach((row, y) => row.forEach((ch, x) => {
        const c = h('div', { class: 'ws-cell' }, ch);
        c._x = x; c._y = y;
        cellEls.push(c); gridEl.append(c);
      }));
      const cellAt = (x, y) => cellEls[y * size + x];
      const listItems = placed.map(p => h('li', null, p.emoji && h('span', null, p.emoji + ' '), p.clue ? h('span', { html: fmt(p.clue, false) }) : p.word));
      const colors = ['#ffe66b', '#b9f29a', '#a8dcff', '#ffc2e2', '#d6c4ff', '#ffcf99', '#9ff2e6', '#ff9f9f'];

      const lineCells = (a, b) => {
        const dx = Math.sign(b._x - a._x), dy = Math.sign(b._y - a._y);
        const len = Math.max(Math.abs(b._x - a._x), Math.abs(b._y - a._y));
        const straight = a._x === b._x || a._y === b._y || Math.abs(b._x - a._x) === Math.abs(b._y - a._y);
        if (!straight) return [a];
        return Array.from({ length: len + 1 }, (_, k) => cellAt(a._x + dx * k, a._y + dy * k));
      };
      const paint = cells => { sel.forEach(c => c.classList.remove('sel')); sel = cells; sel.forEach(c => c.classList.add('sel')); };
      function check(cells) {
        const str = cells.map(c => c.textContent).join('');
        const hit = placed.findIndex(p => !p.found && (p.word === str || p.word === [...str].reverse().join('')) && p.cells.length === cells.length);
        paint([]);
        if (cells.length < 2) return;
        if (hit < 0) { sfx.bad(); say(r.hint || 'Not a hidden word – keep hunting!'); return; }
        const p = placed[hit]; p.found = true;
        const col = colors[found % colors.length];
        cells.forEach(c => { c.classList.add('found'); c.style.background = col; });
        listItems[hit].classList.add('done');
        sfx.good(); award(`${key}:${p.word}`, cells[cells.length - 1]); say(`You found ${p.word}! ${praise()}`);
        if (++found === placed.length) done();
      }
      const cellFromPoint = (x, y) => { const t = document.elementFromPoint(x, y); return t && t.classList.contains('ws-cell') && gridEl.contains(t) ? t : null; };
      gridEl.addEventListener('pointerdown', e => {
        const c = cellFromPoint(e.clientX, e.clientY);
        if (!c) return;
        e.preventDefault();
        try { gridEl.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        start = c; paint(anchor ? lineCells(anchor, c) : [c]);
      });
      gridEl.addEventListener('pointermove', e => {
        if (!start) return;
        const c = cellFromPoint(e.clientX, e.clientY);
        if (c && c !== start) { anchor = null; paint(lineCells(start, c)); }
      });
      const finish = e => {
        if (!start) return;
        const end = (e.type === 'pointerup' && cellFromPoint(e.clientX, e.clientY)) || sel[sel.length - 1] || start;
        if (end === start) {
          // a tap: first tap marks the start, second tap finishes the line
          if (anchor && anchor !== end) { check(lineCells(anchor, end)); anchor = null; }
          else if (anchor === end) { anchor = null; paint([]); }
          else { anchor = end; paint([end]); sfx.tap(); say('Now tap the LAST letter of the word!'); }
        } else check(lineCells(start, end));
        start = null;
      };
      gridEl.addEventListener('pointerup', finish);
      gridEl.addEventListener('pointercancel', finish);
      return h('div', { class: 'game wordsearch' },
        h('div', { class: 'ws-wrap' },
          h('div', { class: 'ws-board' }, gridEl),
          h('div', { class: 'panel-inner ws-list' },
            h('h3', null, `🔎 Find ${placed.length} words`),
            h('ul', null, listItems),
            h('p', { class: 'ws-tip' }, 'Drag across a word – or tap its first letter, then its last letter.'))));
    },

    // Crossword: tap a clue (or a square), then type with the letter keys.
    crossword(r, key, done) {
      const cw = buildCrossword(r.entries);
      let cur = null, pos = 0, solvedCount = 0;
      const cells = {}; // "x,y" -> { el, letter, val, locked, words: [] }
      const gridEl = h('div', { class: 'cw-grid', style: `--w:${cw.w};--h:${cw.h}` });
      for (let y = 0; y < cw.h; y++) for (let x = 0; x < cw.w; x++) {
        const k = x + ',' + y, letter = cw.grid[k];
        if (!letter) { gridEl.append(h('div', { class: 'cw-cell blank' })); continue; }
        const num = cw.numbers[k];
        const val = h('span', { class: 'cw-val' });
        const el = h('div', { class: 'cw-cell' }, num && h('span', { class: 'cw-num' }, num), val);
        cells[k] = { el, val, letter, locked: false, words: [] };
        el.addEventListener('click', () => {
          const ws = cells[k].words;
          const w = ws.length > 1 && cur && ws.includes(cur) ? ws.find(o => o !== cur) : (ws.find(o => !o.solved) || ws[0]);
          select(w, w.cells.indexOf(k));
        });
        gridEl.append(el);
      }
      cw.words.forEach(w => w.cells.forEach(k => cells[k].words.push(w)));
      const clueBtn = w => {
        w.btn = h('button', { class: 'cw-clue', type: 'button', onclick: () => select(w) },
          h('b', null, w.num + '. '), h('span', { html: fmt(w.clue, false) }), ` (${w.answer.length})`);
        return h('li', null, w.btn);
      };
      const across = cw.words.filter(w => w.dir === 'across').sort((a, b) => a.num - b.num);
      const down = cw.words.filter(w => w.dir === 'down').sort((a, b) => a.num - b.num);
      const banner = h('div', { class: 'cw-banner' }, '👆 Tap a clue or a square to start');
      const hintBtn = h('button', { class: 'btn gold', type: 'button', onclick: hint }, '💡 Hint');

      function select(w, at) {
        if (!w) return;
        cur = w;
        Object.values(cells).forEach(c => c.el.classList.remove('active', 'cursor'));
        cw.words.forEach(o => o.btn.classList.toggle('active', o === w));
        w.cells.forEach(k => cells[k].el.classList.add('active'));
        pos = at != null && at >= 0 ? at : 0;
        moveCursor(0);
        put(banner, h('b', null, `${w.num} ${w.dir === 'across' ? 'Across ➡' : 'Down ⬇'}: `), h('span', { html: fmt(w.clue, false) }), ` (${w.answer.length} letters)`);
        sfx.tap();
      }
      function moveCursor(step) {
        if (!cur) return;
        pos = Math.min(Math.max(pos + step, 0), cur.cells.length - 1);
        Object.values(cells).forEach(c => c.el.classList.remove('cursor'));
        cells[cur.cells[pos]].el.classList.add('cursor');
      }
      // Works whether the child types the whole word (solved squares are stepped over when the letter matches)
      // or only the missing letters (they skip ahead to the next empty square).
      function type(ch) {
        if (!cur || cur.solved) return;
        let c = cells[cur.cells[pos]];
        if (c.locked && c.letter !== ch) {
          while (pos < cur.cells.length - 1 && cells[cur.cells[pos]].locked) pos++;
          c = cells[cur.cells[pos]];
        }
        if (!c.locked) c.val.textContent = ch;
        sfx.tap();
        if (cur.cells.every(k => cells[k].val.textContent)) checkWord(cur);
        else moveCursor(1);
      }
      function back() {
        if (!cur) return;
        const c = cells[cur.cells[pos]];
        if (!c.locked && c.val.textContent) { c.val.textContent = ''; return; }
        moveCursor(-1);
        const p = cells[cur.cells[pos]];
        if (!p.locked) p.val.textContent = '';
      }
      function checkWord(w) {
        const guess = w.cells.map(k => cells[k].val.textContent).join('');
        if (guess === w.answer) {
          w.solved = true; solvedCount++; w.btn.classList.add('done');
          w.cells.forEach(k => { cells[k].locked = true; cells[k].el.classList.add('solved'); });
          sfx.good(); award(`${key}:${w.answer}`, cells[w.cells[w.cells.length - 1]].el); say(`${w.answer} – ${praise()}`);
          if (solvedCount === cw.words.length) { put(banner, '🎉 Crossword complete!'); done(); return; }
          // a crossing word might now be complete too
          const full = cw.words.find(o => !o.solved && o.cells.every(k => cells[k].val.textContent));
          if (full) { checkWord(full); return; }
          select(cw.words.find(o => !o.solved));
        } else {
          w.cells.forEach(k => { shake(cells[k].el); if (!cells[k].locked) cells[k].el.classList.add('wrong'); });
          sfx.bad(); say(r.hint || 'Not quite – read the clue again, or press 💡 Hint!');
          setTimeout(() => w.cells.forEach(k => { cells[k].el.classList.remove('wrong'); if (!cells[k].locked) cells[k].val.textContent = ''; }), 700);
          pos = 0; moveCursor(0);
        }
      }
      function hint() {
        const w = cur && !cur.solved ? cur : cw.words.find(o => !o.solved);
        if (!w) return;
        if (w !== cur) select(w);
        const k = w.cells.find(c => !cells[c].locked && cells[c].val.textContent !== cells[c].letter);
        if (!k) return;
        const c = cells[k];
        c.val.textContent = c.letter; c.locked = true; c.el.classList.add('given');
        sfx.tap(); say('Here is a letter to help you!');
        if (w.cells.every(o => cells[o].val.textContent)) checkWord(w); else moveCursor(0);
      }
      const keys = h('div', { class: 'cw-keys' }, ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'].map((row, ri) => h('div', { class: 'cw-row' },
        [...row].map(ch => h('button', { class: 'cw-key', type: 'button', onclick: () => type(ch) }, ch)),
        ri === 2 && h('button', { class: 'cw-key wide', type: 'button', onclick: back, 'aria-label': 'Delete' }, '⌫'))));
      const root = h('div', { class: 'game crossword' },
        h('div', { class: 'cw-wrap' },
          h('div', { class: 'cw-board' }, gridEl),
          h('div', { class: 'panel-inner cw-clues' },
            across.length > 0 && [h('h3', null, '➡ Across'), h('ol', null, across.map(clueBtn))],
            down.length > 0 && [h('h3', null, '⬇ Down'), h('ol', null, down.map(clueBtn))])),
        banner, keys, h('div', { class: 'btn-row' }, hintBtn));
      const onKey = e => {
        if (!root.isConnected) { document.removeEventListener('keydown', onKey); return; }
        if (e.ctrlKey || e.metaKey || e.altKey || document.activeElement && document.activeElement.tagName === 'INPUT') return;
        if (/^[a-z]$/i.test(e.key)) { e.preventDefault(); type(e.key.toUpperCase()); }
        else if (e.key === 'Backspace') { e.preventDefault(); back(); }
        else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') moveCursor(1);
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') moveCursor(-1);
      };
      document.addEventListener('keydown', onKey);
      setTimeout(() => select(across[0] || down[0]), 0);
      return root;
    },
  });

  // Mystery word: clues appear one at a time – work the word out as early as you can.
  // r.words: [{ word, clues: [hardest first, usually 3], options (optional: tap one instead of typing), explain }]
  // Solving on clue 1 earns 3 gems, on clue 2 earns 2, after that 1. A wrong guess shows the next clue,
  // and after two wrong guesses the first letter is given.
  GAMES.mystery = function (r, key, done) {
    const box = h('div', { class: 'game mystery' });
    const clean = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '');
    let wi = 0;
    function word() {
      const w = r.words[wi], last = wi === r.words.length - 1;
      let shown = 1, wrongs = 0, solved = false;
      const worth = () => Math.max(1, 4 - shown);
      const clues = h('ol', { class: 'my-clues' });
      const letters = h('div', { class: 'my-letters', 'aria-label': `${w.word.replace(/ /g, '').length} letters` });
      const worthEl = h('div', { class: 'my-worth' });
      const fb = h('div', { class: 'feedback', hidden: true });
      const moreBtn = h('button', { class: 'btn ghost', type: 'button', onclick() { reveal(); } }, '🔍 Another clue');
      const nextBtn = h('button', { class: 'btn', type: 'button', hidden: true, onclick() { sfx.tap(); wi++; word(); } }, 'Next mystery ▶');
      const answer = h('div', { class: 'my-answer' });
      const paint = () => {
        put(clues, w.clues.slice(0, shown).map((t, k) => h('li', { class: k === shown - 1 && !solved ? 'new' : '', html: fmt(t, false) })));
        put(letters, [...w.word].map((ch, k) => h('span', { class: ch === ' ' ? 'gap' : '' }, solved || (k === 0 && wrongs >= 2) ? ch.toUpperCase() : '')));
        worthEl.textContent = solved ? '' : `Solve it now for ${'💎'.repeat(worth())}`;
        moreBtn.disabled = solved || shown >= w.clues.length;
      };
      function reveal() { if (shown < w.clues.length) { shown++; sfx.tap(); paint(); } }
      function win(el) {
        const n = worth();
        solved = true;
        for (let k = 0; k < n; k++) award(`${key}:${wi}:${k}`, el);
        sfx.good(); say(n === 3 ? 'WOW – on the very first clue!' : praise());
        fb.className = 'feedback good'; fb.hidden = false; fb.innerHTML = '✔ ' + fmt(w.explain || `It's **${w.word}**!`, false);
        answer.hidden = true; paint();
        if (last) done(); else nextBtn.hidden = false;
      }
      function miss(el) {
        wrongs++; shake(el); sfx.bad();
        say(shown < w.clues.length ? 'Not that one – here is another clue!' : 'Not quite – look at the letters and try again!');
        if (shown < w.clues.length) reveal(); else paint();
      }
      if (w.options) {
        put(answer, h('div', { class: 'opts' }, shuffle(w.options).map(o => h('button', {
          class: 'opt', type: 'button',
          onclick(e) { const b = e.currentTarget; if (solved) return; if (clean(o) === clean(w.word)) { b.classList.add('right'); win(b); } else { b.classList.add('wrong'); b.disabled = true; miss(b); } },
        }, o))));
      } else {
        const input = h('input', { class: 'q-type', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Your guess', placeholder: 'Type the mystery word' });
        const guess = () => { if (solved || !input.value.trim()) return; if (clean(input.value) === clean(w.word)) { input.classList.add('right'); input.disabled = true; win(input); } else { miss(input); input.select(); } };
        input.addEventListener('keydown', e => { if (e.key === 'Enter') guess(); });
        put(answer, h('div', { class: 'q-type-row' }, input, h('button', { class: 'btn q-check', type: 'button', onclick: guess }, '✔ Guess')));
      }
      put(box,
        r.words.length > 1 && h('div', { class: 'q-count' }, `Mystery word ${wi + 1} of ${r.words.length}`),
        h('div', { class: 'my-card' }, h('div', { class: 'my-head' }, '🕵️ MYSTERY WORD'), letters, clues, h('div', { class: 'btn-row' }, moreBtn), worthEl),
        answer, fb, h('div', { class: 'btn-row' }, nextBtn));
      paint();
      box._test = { guess(t) { const inp = box.querySelector('input.q-type'); if (inp) { inp.value = t; box.querySelector('.q-check').click(); } else [...box.querySelectorAll('.opt')].find(b => b.textContent === t).click(); }, more: reveal, get shown() { return shown; } };
    }
    word();
    return box;
  };

  // ---------- word search and crossword grids ----------
  function buildWordsearch(words, size, diagonal) {
    const dirs = diagonal ? [[1, 0], [0, 1], [1, 1]] : [[1, 0], [0, 1]];
    for (let attempt = 0; attempt < 300; attempt++) {
      const grid = Array.from({ length: size }, () => Array(size).fill(''));
      const placed = [];
      const ok = words.slice().sort((a, b) => b.word.length - a.word.length).every(w => {
        for (let t = 0; t < 300; t++) {
          const [dx, dy] = pick(dirs);
          const x0 = Math.floor(Math.random() * (size - dx * (w.word.length - 1)));
          const y0 = Math.floor(Math.random() * (size - dy * (w.word.length - 1)));
          const cs = [...w.word].map((_, k) => [x0 + dx * k, y0 + dy * k]);
          if (cs.every(([x, y], k) => !grid[y][x] || grid[y][x] === w.word[k])) {
            cs.forEach(([x, y], k) => { grid[y][x] = w.word[k]; });
            placed.push(Object.assign({}, w, { cells: cs }));
            return true;
          }
        }
        return false;
      });
      if (!ok) continue;
      const ABC = 'ABCDEFGHIJKLMNOPRSTUVWY';
      grid.forEach(row => row.forEach((c, x) => { if (!c) row[x] = ABC[Math.floor(Math.random() * ABC.length)]; }));
      // keep the word list in the same order the lesson gave it
      placed.sort((a, b) => words.indexOf(words.find(w => w.word === a.word)) - words.indexOf(words.find(w => w.word === b.word)));
      return { grid, placed };
    }
    throw new Error('Word hunt: could not fit the words – make the grid bigger.');
  }

  // Builds a small interlocking crossword from {answer, clue} entries (tries many layouts, keeps the most compact).
  function buildCrossword(entries) {
    const words = entries.map(e => Object.assign({}, e, { answer: e.answer.toUpperCase().replace(/[^A-Z]/g, '') }));
    const K = (x, y) => x + ',' + y;
    let best = null;
    for (let attempt = 0; attempt < 400; attempt++) {
      const order = attempt === 0 ? words.slice().sort((a, b) => b.answer.length - a.answer.length) : shuffle(words);
      const grid = {}, dirsAt = {}, placed = [];
      const place = (w, x, y, dir) => {
        const dx = dir === 'across' ? 1 : 0, dy = 1 - dx, cs = [];
        for (let k = 0; k < w.answer.length; k++) {
          const key = K(x + dx * k, y + dy * k);
          grid[key] = w.answer[k]; (dirsAt[key] = dirsAt[key] || []).push(dir); cs.push(key);
        }
        placed.push(Object.assign({}, w, { x, y, dir, cells: cs }));
      };
      const fits = (word, x, y, dir) => {
        const dx = dir === 'across' ? 1 : 0, dy = 1 - dx;
        if (grid[K(x - dx, y - dy)] || grid[K(x + dx * word.length, y + dy * word.length)]) return 0;
        let cross = 0;
        for (let k = 0; k < word.length; k++) {
          const cx = x + dx * k, cy = y + dy * k, c = grid[K(cx, cy)];
          if (c) {
            if (c !== word[k] || (dirsAt[K(cx, cy)] || []).includes(dir)) return 0;
            cross++;
          } else if (grid[K(cx + dy, cy + dx)] || grid[K(cx - dy, cy - dx)]) return 0;
        }
        return cross;
      };
      place(order[0], 0, 0, 'across');
      const left = order.slice(1);
      let progress = true;
      while (left.length && progress) {
        progress = false;
        for (let i = 0; i < left.length; i++) {
          const w = left[i], options = [];
          for (const key of Object.keys(grid)) {
            const [cx, cy] = key.split(',').map(Number);
            if (dirsAt[key].length > 1) continue;
            const dir = dirsAt[key][0] === 'across' ? 'down' : 'across';
            for (let k = 0; k < w.answer.length; k++) {
              if (w.answer[k] !== grid[key]) continue;
              const x = dir === 'across' ? cx - k : cx, y = dir === 'down' ? cy - k : cy;
              const c = fits(w.answer, x, y, dir);
              if (c) options.push({ x, y, dir, c });
            }
          }
          if (options.length) {
            const o = pick(options);
            place(w, o.x, o.y, o.dir); left.splice(i, 1); i--; progress = true;
          }
        }
      }
      const xs = Object.keys(grid).map(k => +k.split(',')[0]), ys = Object.keys(grid).map(k => +k.split(',')[1]);
      const w = Math.max(...xs) - Math.min(...xs) + 1, hgt = Math.max(...ys) - Math.min(...ys) + 1;
      const score = placed.length * 1000 - w * hgt - Math.abs(w - hgt) * 3;
      if (!best || score > best.score) best = { score, placed, grid, minX: Math.min(...xs), minY: Math.min(...ys), w, h: hgt };
      if (attempt > 60 && best.placed.length === words.length) break;
    }
    // shift to start at 0,0 and number the starting squares
    const shift = key => { const [x, y] = key.split(',').map(Number); return K(x - best.minX, y - best.minY); };
    const grid = {};
    Object.entries(best.grid).forEach(([k, v]) => { grid[shift(k)] = v; });
    const ws = best.placed.map(p => Object.assign({}, p, { cells: p.cells.map(shift), x: p.x - best.minX, y: p.y - best.minY }));
    const numbers = {};
    let n = 0;
    ws.slice().sort((a, b) => a.y - b.y || a.x - b.x).forEach(p => {
      const k = K(p.x, p.y);
      if (!numbers[k]) numbers[k] = ++n;
      p.num = numbers[k];
    });
    return { grid, words: ws, numbers, w: best.w, h: best.h };
  }
});
