/* Pixelkid lesson engine – Future Skills games: Train the AI, pixel art (copy + studio) and the poster designer.
 * One part of shared/engine.js, which loads it only when a lesson uses it. E is the engine's shared helpers
 * (E.state and E.stageCard are live). See the top of shared/engine.js for how the parts fit together.
 */
PixelkidEngine.part('future', E => {
  'use strict';
  const { GAMES, M, achieve, award, confetti, esc, fmt, h, pic, praise, put, pxDraw, say, settings, sfx, shake, store } = E;

  // Teach the robot: the child labels training examples, then judges the robot's guesses on new things.
  // The robot guesses by finding the taught example with the most matching features (a tiny "nearest neighbour" AI).
  GAMES.trainai = function (r, key, done) {
    const box = h('div', { class: 'game trainai' });
    const memory = [];
    const memEl = h('div', { class: 'ai-memory' });
    const labelOf = id => r.labels[id] || id;
    const feats = it => r.features.map(f => h('span', { class: 'ai-feat' }, `${f}: ${it[f]}`));
    const memPanel = () => h('div', { class: 'panel-inner ai-mem-panel' },
      h('h3', null, `🧠 ${M.name}'s memory (training data)`), memEl);
    function drawMemory() {
      put(memEl, memory.length ? memory.map(m => h('div', { class: 'ai-mem-row' },
        h('span', { class: 'ai-emoji' }, m.emoji), feats(m), h('b', null, '→ ' + labelOf(m.label))))
        : h('p', { class: 'ai-empty' }, 'Empty! Teach me some examples…'));
    }
    function guess(it) {
      let best = null;
      memory.forEach(m => {
        const same = r.features.filter(f => m[f] === it[f]);
        if (!best || same.length > best.same.length) best = { m, same };
      });
      return best;
    }

    // Phase 1: teaching
    let ti = 0;
    function teach() {
      const it = r.train[ti];
      const btns = Object.keys(r.labels).map(id => h('button', {
        class: 'opt', type: 'button',
        onclick(e) {
          if (id !== it.label) {
            shake(e.currentTarget); sfx.bad();
            say(r.wrongTeach || "Oops! If you teach me the wrong answer, I'll learn the wrong thing!");
            return;
          }
          memory.push(it); drawMemory(); sfx.good(); award(`${key}:t${ti}`, e.currentTarget);
          say(`Saved to my memory: ${it.name} = ${labelOf(id)}!`);
          ti++;
          if (ti < r.train.length) teach(); else testIntro();
        },
      }, labelOf(id)));
      put(box,
        h('div', { class: 'ai-phase' }, `STEP 1: TEACH ME · example ${ti + 1} of ${r.train.length}`),
        h('div', { class: 'ai-card' }, h('div', { class: 'ai-big' }, it.emoji), h('div', { class: 'ai-name' }, it.name), h('div', null, feats(it))),
        h('p', { class: 'instr' }, 'What is it? Tap the right label to teach me:'),
        h('div', { class: 'opts' }, btns),
        memPanel());
      drawMemory();
    }

    // Phase 2: testing
    function testIntro() {
      sfx.win();
      say("Training complete! Now I'll guess some NEW things. You decide if I'm right!");
      put(box,
        h('div', { class: 'ai-phase' }, 'TRAINING COMPLETE!'),
        h('p', { class: 'lead' }, `${M.name} has learned from ${memory.length} examples. Now let's test the AI on things it has never seen before…`),
        memPanel(),
        h('div', { class: 'btn-row' }, h('button', { class: 'btn big green ready', type: 'button', onclick: () => test(0) }, '🧪 Test the AI!')));
      drawMemory();
    }
    function test(qi) {
      const it = r.test[qi];
      const g = guess(it);
      const robotRight = g.m.label === it.is;
      const why = h('div', { class: 'why', hidden: true });
      const nextBtn = h('button', { class: 'btn', type: 'button', hidden: true, onclick() { sfx.tap(); if (qi + 1 < r.test.length) test(qi + 1); else done(); } },
        qi + 1 < r.test.length ? 'Next test ▶' : 'Finish ✔');
      const judge = (sayRight, btn) => {
        bY.disabled = bN.disabled = true;
        const correct = sayRight === robotRight;
        if (correct) { btn.classList.add('right'); sfx.good(); award(`${key}:j${qi}`, btn); say(praise()); }
        else { btn.classList.add('wrong'); shake(btn); sfx.bad(); say('Look again – what is it REALLY?'); }
        why.innerHTML = (robotRight ? `✅ ${M.name} was RIGHT. ` : `❌ ${M.name} was WRONG – it's ${esc(it.truth || labelOf(it.is))}! `) + fmt(it.why || '', false);
        why.hidden = false; nextBtn.hidden = false;
      };
      const bY = h('button', { class: 'opt', type: 'button', onclick: e => judge(true, e.currentTarget) }, `✅ ${M.name} is right`);
      const bN = h('button', { class: 'opt', type: 'button', onclick: e => judge(false, e.currentTarget) }, `❌ ${M.name} is wrong`);
      put(box,
        h('div', { class: 'ai-phase' }, `STEP 2: TEST THE AI · ${qi + 1} of ${r.test.length}`),
        h('div', { class: 'ai-card' }, h('div', { class: 'ai-big' }, it.emoji), h('div', { class: 'ai-name' }, 'New thing!'), h('div', null, feats(it))),
        h('div', { class: 'ai-think' },
          h('div', null, `🤖 Thinking… ${g.same.length ? 'it has the same ' + g.same.join(' and ') + ' as my ' + g.m.name : 'nothing matches, so I will just guess'}…`),
          h('div', { class: 'ai-guess' }, `I'm SURE it's: ${labelOf(g.m.label).toUpperCase()}!`)),
        h('p', { class: 'instr' }, `Is ${M.name} right?`),
        h('div', { class: 'tf-row' }, bY, bN), why,
        h('div', { class: 'btn-row' }, nextBtn));
      say('Hmm, let me check my memory…');
    }

    teach();
    return box;
  };

  // ---------- pixel art editor (shared by the pixelcopy + pixelstudio games) ----------
  const DEFAULT_PALETTE = [
    ['#1b1b1b', 'black'], ['#ffffff', 'white'], ['#c6c6c6', 'light grey'], ['#6f6f6f', 'dark grey'],
    ['#e53935', 'red'], ['#ff8c1a', 'orange'], ['#ffd43b', 'yellow'], ['#7cfc3a', 'lime'],
    ['#2e9e3e', 'green'], ['#2ee6d6', 'aqua'], ['#1e6fd9', 'blue'], ['#1f2a6b', 'navy'],
    ['#8e5cff', 'purple'], ['#ff7eb6', 'pink'], ['#8a5a32', 'brown'], ['#f2c79b', 'peach'],
  ];
  function pixelEditor({ w, h: rows, palette = DEFAULT_PALETTE, mirror = false, mirrorToggle = true, onStroke }) {
    let cells = Array(w * rows).fill(null), color = palette[0][0], tool = 'pencil', mirrorOn = mirror;
    const undo = [];
    const cellEls = [];
    const grid = h('div', { class: 'px-grid', style: `--w:${w};--h:${rows}`, 'aria-label': 'Drawing grid' });
    for (let i = 0; i < w * rows; i++) { const c = h('div', { class: 'px-cell' }); cellEls.push(c); grid.append(c); }
    const mirrorLine = h('div', { class: 'px-mirror-line', hidden: !mirrorOn });
    const draw = () => cells.forEach((c, i) => { cellEls[i].style.background = c || ''; cellEls[i].classList.toggle('empty', !c); });
    const setCell = (x, y, c) => {
      if (x < 0 || y < 0 || x >= w || y >= rows) return;
      cells[y * w + x] = c;
      if (mirrorOn) cells[y * w + (w - 1 - x)] = c;
    };
    const fill = (x, y, c) => {
      const target = cells[y * w + x];
      if (target === c) return;
      const stack = [[x, y]];
      while (stack.length) {
        const [cx, cy] = stack.pop();
        if (cx < 0 || cy < 0 || cx >= w || cy >= rows || cells[cy * w + cx] !== target) continue;
        cells[cy * w + cx] = c;
        stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
      }
    };
    const at = (px, py) => {
      const r = grid.getBoundingClientRect();
      return [Math.floor((px - r.left) / r.width * w), Math.floor((py - r.top) / r.height * rows)];
    };
    let last = null, painting = false;
    const paintTo = ([x, y]) => {
      const c = tool === 'eraser' ? null : color;
      // fill in any squares skipped by a quick finger swipe
      const [x0, y0] = last || [x, y];
      const steps = Math.max(Math.abs(x - x0), Math.abs(y - y0), 1);
      for (let k = 0; k <= steps; k++) setCell(Math.round(x0 + (x - x0) * k / steps), Math.round(y0 + (y - y0) * k / steps), c);
      last = [x, y]; draw();
    };
    grid.addEventListener('pointerdown', e => {
      e.preventDefault();
      const p = at(e.clientX, e.clientY);
      if (p[0] < 0 || p[1] < 0 || p[0] >= w || p[1] >= rows) return;
      undo.push(cells.slice()); if (undo.length > 50) undo.shift();
      if (tool === 'fill') { fill(p[0], p[1], color); draw(); sfx.tap(); if (onStroke) onStroke(); return; }
      try { grid.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      painting = true; last = null; paintTo(p); sfx.tap();
    });
    grid.addEventListener('pointermove', e => { if (painting) paintTo(at(e.clientX, e.clientY)); });
    const end = () => { if (!painting) return; painting = false; last = null; if (onStroke) onStroke(); };
    grid.addEventListener('pointerup', end);
    grid.addEventListener('pointercancel', end);

    const swatches = palette.map(([c, name]) => h('button', {
      class: 'px-swatch', type: 'button', title: name, 'aria-label': name, style: `background:${c}`,
      onclick(e) { color = c; if (tool === 'eraser') setTool('pencil'); swatches.forEach(s => s.classList.remove('on')); e.currentTarget.classList.add('on'); sfx.tap(); },
    }));
    swatches[0].classList.add('on');
    const toolBtns = {};
    const setTool = t => { tool = t; Object.entries(toolBtns).forEach(([k, b]) => b.classList.toggle('on', k === t)); };
    const mkTool = (id, label) => (toolBtns[id] = h('button', { class: 'px-tool', type: 'button', onclick() { setTool(id); sfx.tap(); } }, label));
    const mirrorBtn = mirrorToggle && h('button', {
      class: 'px-tool' + (mirrorOn ? ' on' : ''), type: 'button',
      onclick(e) { mirrorOn = !mirrorOn; e.currentTarget.classList.toggle('on', mirrorOn); mirrorLine.hidden = !mirrorOn; sfx.tap(); say(mirrorOn ? 'Mirror ON – whatever you draw on one side appears on the other!' : 'Mirror off.'); },
    }, '🪞 Mirror');
    const tools = h('div', { class: 'px-tools' },
      mkTool('pencil', '✏️ Pencil'), mkTool('fill', '🪣 Fill'), mkTool('eraser', '🧽 Eraser'), mirrorBtn,
      h('button', { class: 'px-tool', type: 'button', onclick() { if (undo.length) { cells = undo.pop(); draw(); sfx.tap(); if (onStroke) onStroke(); } } }, '↶ Undo'),
      h('button', { class: 'px-tool', type: 'button', onclick() { if (!cells.some(Boolean) || confirm('Clear the whole picture?')) { undo.push(cells.slice()); cells.fill(null); draw(); if (onStroke) onStroke(); } } }, '🗑️ Clear'));
    setTool('pencil');
    draw();
    return {
      el: h('div', { class: 'px-editor' }, tools, h('div', { class: 'px-palette' }, swatches), pxAxes(h('div', { class: 'px-board' }, grid, mirrorLine), w, rows)),
      get cells() { return cells; },
      load(c) { undo.push(cells.slice()); cells = c.slice(); draw(); },
      flash(indexes) { indexes.forEach(i => cellEls[i].classList.add('px-wrong')); setTimeout(() => indexes.forEach(i => cellEls[i].classList.remove('px-wrong')), 1600); },
    };
  }
  // Map-style labels round a pixel board: letters along the top (A, B, C…) and numbers down the side (1, 2, 3…),
  // on both the drawing grid and the example, so "row 3, column D" is easy to find on each.
  function pxAxes(board, w, rows) {
    return h('div', { class: 'px-axes', style: `--w:${w};--h:${rows}` },
      h('span', { class: 'px-corner' }),
      h('div', { class: 'px-ax-top', 'aria-hidden': 'true' }, Array.from({ length: w }, (_, i) => h('span', null, String.fromCharCode(65 + i)))),
      h('div', { class: 'px-ax-left', 'aria-hidden': 'true' }, Array.from({ length: rows }, (_, i) => h('span', null, String(i + 1)))),
      board);
  }
  // the example as a grid of squares that looks like the drawing grid (empty squares show the same blue checks)
  function pxExample(rowsT, colors, w) {
    const cells = [];
    rowsT.forEach(row => { for (let x = 0; x < w; x++) { const c = colors[row[x]]; cells.push(h('div', { class: 'px-cell' + (c ? '' : ' empty'), style: c ? `background:${c}` : null })); } });
    return h('div', { class: 'px-grid px-static', style: `--w:${w};--h:${rowsT.length}`, role: 'img', 'aria-label': 'The picture to copy' }, cells);
  }
  // Pixel art → PNG data URL (transparent background)
  function pixelPNG(cells, w, rows, scale = 24) {
    const c = document.createElement('canvas');
    c.width = w * scale; c.height = rows * scale;
    const ctx = c.getContext('2d');
    cells.forEach((col, i) => { if (col) { ctx.fillStyle = col; ctx.fillRect((i % w) * scale, Math.floor(i / w) * scale, scale, scale); } });
    return c.toDataURL('image/png');
  }
  const GKEY = 'y3:gallery';

  // Copy the picture. The live meter shows the match; tapping "I'm finished!" scores it as a percentage and unlocks the
  // next round, so a perfect copy is a bonus, not a wall. A perfect copy celebrates on its own.
  // r.choices: [{ label, level (1–3), target, colors, names, tips, intro, say, mirror, done }] lets the player pick what to draw.
  GAMES.pixelcopy = function (r, key, done) {
    if (!r.choices) return h('div', { class: 'game pixelcopy' }, pixelCopy(r, key, done));
    let finished = false;
    const finish = () => { if (!finished) { finished = true; done(); } };
    const box = h('div', { class: 'game pixelcopy' });
    const stars = n => '★'.repeat(n) + '☆'.repeat(3 - n);
    const levelOfPic = c => c.level || (c.target.join('').replace(/\./g, '').length > 140 ? 3 : new Set(c.target.join('').replace(/\./g, '')).size > 3 ? 2 : 1);
    function menu() {
      say(r.pick || 'Pick a picture to draw! The more stars, the trickier it is.');
      put(box, h('h3', { class: 'px-pick-title' }, r.pickTitle || '🎨 What would you like to draw?'),
        h('div', { class: 'px-choices' }, r.choices.map((c, ci) => {
          const lv = levelOfPic(c);
          return h('button', { class: 'px-choice', type: 'button', onclick() { sfx.tap(); play(ci); } },
            pic(Pixel.svg(c.target, c.colors), 'px-choice-pic'),
            h('span', { class: 'px-choice-name' }, c.label),
            h('span', { class: 'px-choice-level', 'aria-label': `difficulty ${lv} of 3` }, stars(lv), ' ', ['', 'Easy', 'Medium', 'Tricky'][lv]),
            E.state.awarded[`${key}:${ci}:perfect`] ? h('span', { class: 'px-choice-done' }, '💯') : E.state.awarded[`${key}:${ci}:done`] && h('span', { class: 'px-choice-done' }, '✔'));
        })));
    }
    function play(ci) {
      const c = Object.assign({}, r, r.choices[ci]);
      delete c.choices;
      if (c.say) say(c.say);
      put(box, h('div', { class: 'btn-row px-back' }, h('button', { class: 'btn', type: 'button', onclick() { sfx.tap(); menu(); } }, '↩ Pick a different picture')),
        c.intro && h('p', { class: 'instr', html: fmt(c.intro) }),
        pixelCopy(c, `${key}:${ci}`, finish));
    }
    menu();
    return box;
  };
  function pixelCopy(r, key, done) {
    const rowsT = r.target, w = Math.max(...rowsT.map(x => x.length)), rows = rowsT.length;
    const want = [];
    rowsT.forEach(row => { for (let x = 0; x < w; x++) want.push(r.colors[row[x]] || null); });
    const used = [...new Set(want.filter(Boolean))];
    const names = r.names || {};
    const palette = used.map(c => [c, names[c] || 'colour']);
    const meter = h('div', { class: 'px-meter' });
    const result = h('div', { class: 'px-result', hidden: true });
    let submitted = false, perfect = false;
    const wrongIdx = () => want.map((c, i) => (ed.cells[i] || null) === c ? -1 : i).filter(i => i >= 0);
    // accuracy: of all the squares that are painted in the picture OR on your grid, how many are right?
    const accuracy = () => {
      let both = 0, right = 0;
      want.forEach((c, i) => { const mine = ed.cells[i] || null; if (c || mine) { both++; if (mine === c) right++; } });
      return both ? Math.round(right / both * 100) : 0;
    };
    const showMeter = () => {
      const pct = accuracy();
      put(meter, h('div', { class: 'px-meter-bar' }, h('div', { style: `width:${pct}%` })), `Match: ${pct}%`);
      return pct;
    };
    const celebratePerfect = () => {
      if (perfect) return;
      perfect = true; sfx.win(); confetti(80);
      award(key + ':done', meter); award(key + ':perfect', meter);
      showResult(100);
      say(r.done || 'PERFECT COPY! You are a real pixel artist!');
      if (!submitted) { submitted = true; done(); }
    };
    function showResult(pct) {
      const [stars, msg] = pct === 100 ? [3, 'PERFECT! Every square is right!']
        : pct >= 85 ? [3, 'Amazing! Nearly perfect.'] : pct >= 65 ? [2, 'Great job – it really looks like it!']
        : pct >= 40 ? [1, 'Good start! Keep painting to make it match.'] : [0, 'Keep going – paint more of the picture!'];
      result.hidden = false;
      put(result, h('div', { class: 'px-score' }, `${pct}%`),
        h('div', { class: 'px-stars' }, '★'.repeat(stars) + '☆'.repeat(3 - stars)),
        h('p', null, msg),
        pct < 100 && h('p', { class: 'px-result-tip' }, 'You can keep fixing it to reach 100% – or carry on to the next round. Your choice!'));
    }
    const check = () => {
      const pct = showMeter();
      if (pct === 100) celebratePerfect();
      else if (!result.hidden && submitted) result.classList.add('stale');
    };
    const ed = pixelEditor({ w, h: rows, palette, mirror: !!r.mirror, mirrorToggle: true, onStroke: check });
    const hintBtn = h('button', { class: 'btn gold', type: 'button', onclick() { const wr = wrongIdx(); ed.flash(wr); sfx.tap(); const empties = wr.filter(i => !ed.cells[i] || !want[i]).length;
      say(!wr.length ? 'Everything matches!' : `${wr.length} square${wr.length > 1 ? 's need' : ' needs'} fixing – look for the flashing red!` + (empties ? ' Blue-checked squares are empty – they are not white!' : '')); } }, '🔍 Show mistakes');
    const submitBtn = h('button', { class: 'btn', type: 'button', onclick() {
      const pct = showMeter();
      if (!ed.cells.some(Boolean)) { sfx.bad(); say('Paint something first!'); return; }
      result.classList.remove('stale');
      if (pct === 100) { celebratePerfect(); return; }
      showResult(pct);
      if (pct >= 40) { sfx.good(); award(key + ':done', submitBtn); } else sfx.tap();
      say(pct >= 85 ? `${pct}%! Brilliant copying!` : pct >= 40 ? `${pct}% – nice work! Fix the rest for 100%, or move on.` : `${pct}% so far. Want to keep going? You can still move on if you like.`);
      if (!submitted) { submitted = true; done(); }
    } }, "✅ I'm finished!");
    showMeter();
    return h('div', { class: 'px-copy' },
      h('div', { class: 'px-wrap' },
        h('div', { class: 'panel-inner px-target' }, h('h3', null, '🎯 Copy this'), h('div', { class: 'px-target-pic' }, pxAxes(pxExample(rowsT, r.colors, w), w, rows)),
          r.tips && h('ul', { class: 'px-tips' }, r.tips.map(t => h('li', { html: fmt(t, false) })))),
        h('div', null, ed.el, meter, h('div', { class: 'btn-row' }, submitBtn, hintBtn), result)));
  }

  // Free studio: draw anything; save to the gallery, download as a picture.
  GAMES.pixelstudio = function (r, key, done) {
    const w = r.size || 16, rows = r.size || 16, min = r.minPixels || 30;
    let finished = false;
    const status = h('div', { class: 'px-meter' });
    const count = () => ed.cells.filter(Boolean).length;
    const update = () => {
      const n = count();
      finishBtn.disabled = n < min && !finished;
      put(status, n < min ? `🎨 ${n} squares painted – paint at least ${min} to finish` : `🎨 ${n} squares painted – looking great!`);
    };
    const ed = pixelEditor({ w, h: rows, palette: r.palette, mirror: false, onStroke: update });
    const gallery = h('div', { class: 'px-gallery' });
    const loadGallery = () => store.get(GKEY, []);
    function drawGallery() {
      const items = loadGallery();
      put(gallery, items.length ? items.map((g, gi) => h('div', { class: 'px-thumb' },
        h('img', { src: pixelPNG(g.cells, g.w, g.h, 4), alt: g.title || 'pixel art', title: 'Tap to open', onclick() { ed.load(g.cells); update(); sfx.tap(); } }),
        h('button', { class: 'px-del', type: 'button', 'aria-label': 'Delete', onclick() { if (!confirm('Delete this picture from your gallery?')) return; const all = loadGallery(); all.splice(gi, 1); store.set(GKEY, all); drawGallery(); } }, '✕')))
        : h('p', { class: 'ai-empty' }, 'No pictures yet – your saved art will appear here!'));
    }
    const saveArt = () => {
      if (!count()) { say('Paint something first!'); return false; }
      const all = loadGallery();
      all.unshift({ w, h: rows, cells: ed.cells.slice(), date: Date.now(), title: r.title || 'My art' });
      store.set(GKEY, all.slice(0, 24)); drawGallery();
      return true;
    };
    const download = () => {
      if (!count()) { say('Paint something first!'); return; }
      const a = h('a', { href: pixelPNG(ed.cells, w, rows, 24), download: `pixelkid-${(settings.name || 'art').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png` });
      document.body.append(a); a.click(); a.remove(); sfx.good(); say('Downloading your picture! Ask a grown-up to help you print or share it.');
    };
    const finishBtn = h('button', {
      class: 'btn big green', type: 'button',
      onclick() {
        if (finished) return;
        finished = true; saveArt(); sfx.win(); confetti(120); award(key + ':done', finishBtn); achieve('artist');
        say(r.done || 'WOW! Your masterpiece is saved in your gallery!'); finishBtn.textContent = '✔ Saved!'; done();
      },
    }, "✔ I'm finished!");
    drawGallery(); update();
    return h('div', { class: 'game pixelstudio' },
      r.brief && h('div', { class: 'panel-inner px-brief' }, h('h3', null, r.briefTitle || '📋 Design brief'), h('ol', null, r.brief.map(b => h('li', { html: fmt(b, false) })))),
      ed.el, status,
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', type: 'button', onclick() { if (saveArt()) { sfx.good(); say('Saved to your gallery!'); } } }, '💾 Save to gallery'),
        h('button', { class: 'btn ghost', type: 'button', onclick: download }, '⬇️ Download picture'),
        finishBtn),
      h('div', { class: 'panel-inner px-gallery-wrap' }, h('h3', null, '🖼️ My Gallery'), gallery));
  };

  // ---------- poster editor (graphic design) ----------
  // Elements: { t:'text', text, x, y, size, color, font } · { t:'sticker', emoji, x, y, size } · { t:'shape', shape:'rect'|'circle'|'star', x, y, w, h, color }
  // x / y are the centre in % of the poster; size is a % of the poster width; w / h are % of the width / height.
  const POSTER_FONTS = {
    pixel: { label: 'Pixel', css: '"Pixelify Sans", monospace' },
    clean: { label: 'Clean', css: 'Lexend, system-ui, sans-serif' },
    fun: { label: 'Fun', css: '"Chalkboard SE", "Comic Sans MS", "Marker Felt", cursive' },
    bold: { label: 'Bold', css: '"Arial Black", Impact, "Helvetica Neue", sans-serif' },
  };
  const POSTER_STICKERS = ['⭐', '🎉', '🤖', '🐶', '🐱', '🎮', '🚀', '🎈', '🍕', '🎵', '⚽', '🏆', '🌈', '🦖', '🎂', '🍿', '🎨', '❤️', '👾', '☀️'];
  const POSTER_COLORS = ['#1b1b1b', '#ffffff', '#e53935', '#ff8c1a', '#ffd43b', '#7cfc3a', '#2e9e3e', '#2ee6d6', '#1e6fd9', '#1f2a6b', '#8e5cff', '#ff7eb6', '#8a5a32', '#fff3a8'];
  const lum = hex => {
    const v = hex.replace('#', '').match(/../g).map(x => parseInt(x, 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const PKEY_POSTERS = 'y3:posters';

  function posterPNG(model, W = 600) {
    const H = W * 4 / 3, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = model.bg; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    model.items.forEach(e => {
      const cx = e.x / 100 * W, cy = e.y / 100 * H;
      if (e.t === 'shape') {
        const w = e.w / 100 * W, hh = e.h / 100 * H;
        ctx.fillStyle = e.color; ctx.beginPath();
        if (e.shape === 'circle') ctx.ellipse(cx, cy, w / 2, hh / 2, 0, 0, Math.PI * 2);
        else if (e.shape === 'star') {
          for (let k = 0; k < 10; k++) {
            const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? 0.4 : 1;
            ctx.lineTo(cx + Math.cos(a) * w / 2 * rr, cy + Math.sin(a) * hh / 2 * rr);
          }
        } else ctx.rect(cx - w / 2, cy - hh / 2, w, hh);
        ctx.fill();
      } else {
        const px = e.size / 100 * W;
        const lines = (e.t === 'sticker' ? e.emoji : e.text).split('\n');
        ctx.fillStyle = e.color || '#000';
        ctx.font = e.t === 'sticker' ? `${px}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`
          : `700 ${px}px ${(POSTER_FONTS[e.font] || POSTER_FONTS.clean).css}`;
        lines.forEach((ln, i) => {
          const ly = cy + (i - (lines.length - 1) / 2) * px * 1.15;
          if (!(e.t === 'sticker' && pxDraw(ctx, ln.trim(), cx, ly, px, { baseline: 'middle' }))) ctx.fillText(ln, cx, ly);
        });
      }
    });
    return c.toDataURL('image/png');
  }

  GAMES.poster = function (r, key, done) {
    const clone = o => JSON.parse(JSON.stringify(o));
    let model = clone(r.start || { bg: '#ffffff', items: [] });
    let sel = null, finished = false;
    const posterEl = h('div', { class: 'poster' });
    const elOf = new Map();
    const ticks = {};

    const bgUnder = e => {
      // the colour behind a text: the top-most shape under its centre, otherwise the poster background
      const idx = model.items.indexOf(e);
      for (let i = idx - 1; i >= 0; i--) {
        const s = model.items[i];
        if (s.t === 'shape' && Math.abs(e.x - s.x) <= s.w / 2 && Math.abs(e.y - s.y) <= s.h / 2) return s.color;
      }
      return model.bg;
    };
    const lowContrast = e => e.t === 'text' && contrast(e.color, bgUnder(e)) < 3;
    const AUTO = {
      bigTitle: () => model.items.some(e => e.t === 'text' && e.size >= 10),
      contrast: () => model.items.filter(e => e.t === 'text').length > 0 && !model.items.some(lowContrast),
      clutter: () => model.items.filter(e => e.t === 'sticker').length <= (r.maxStickers || 4),
      picture: () => model.items.some(e => e.t === 'sticker' || e.t === 'shape'),
      inside: () => model.items.every(e => e.x >= 5 && e.x <= 95 && e.y >= 4 && e.y <= 96),
    };

    function renderPoster() {
      posterEl.style.background = model.bg;
      posterEl.replaceChildren();
      elOf.clear();
      model.items.forEach(e => {
        const d = h('div', { class: 'pe pe-' + e.t + (e === sel ? ' sel' : '') });
        d.style.left = e.x + '%'; d.style.top = e.y + '%';
        if (e.t === 'shape') {
          Object.assign(d.style, { width: e.w + '%', height: e.h + '%', background: e.color });
          d.classList.add('pe-' + e.shape);
        } else {
          d.style.fontSize = `calc(${e.size} * 1cqw)`;
          d.textContent = e.t === 'sticker' ? e.emoji : e.text;
          if (e.t === 'text') { d.style.color = e.color; d.style.fontFamily = (POSTER_FONTS[e.font] || POSTER_FONTS.clean).css; }
          if (lowContrast(e)) d.append(h('span', { class: 'pe-warn', title: 'Hard to read!' }, '⚠️'));
        }
        drag(d, e);
        elOf.set(e, d);
        posterEl.append(d);
      });
      renderTools(); renderChecks();
    }
    function drag(d, e) {
      d.addEventListener('pointerdown', ev => {
        ev.preventDefault(); ev.stopPropagation();
        if (sel !== e) { sel = e; renderPoster(); d = elOf.get(e); }
        const rect = posterEl.getBoundingClientRect(), sx = ev.clientX, sy = ev.clientY, ox = e.x, oy = e.y;
        try { d.setPointerCapture(ev.pointerId); } catch (_) { /* ignore */ }
        const move = m => {
          e.x = Math.max(0, Math.min(100, ox + (m.clientX - sx) / rect.width * 100));
          e.y = Math.max(0, Math.min(100, oy + (m.clientY - sy) / rect.height * 100));
          d.style.left = e.x + '%'; d.style.top = e.y + '%';
        };
        const up = () => { d.removeEventListener('pointermove', move); d.removeEventListener('pointerup', up); d.removeEventListener('pointercancel', up); renderPoster(); };
        d.addEventListener('pointermove', move); d.addEventListener('pointerup', up); d.addEventListener('pointercancel', up);
      });
    }
    posterEl.addEventListener('pointerdown', () => { if (sel) { sel = null; renderPoster(); } });

    // ----- toolbar -----
    const tools = h('div', { class: 'pe-tools' });
    const swatchRow = (colors, current, onPick) => h('div', { class: 'pe-swatches' }, colors.map(c => h('button', {
      class: 'px-swatch' + (c === current ? ' on' : ''), type: 'button', style: `background:${c}`, 'aria-label': c,
      onclick() { onPick(c); sfx.tap(); },
    })));
    const add = item => { model.items.push(item); sel = item; sfx.good(); renderPoster(); };
    let trayOpen = false;
    function renderTools() {
      const s = sel;
      const addRow = h('div', { class: 'pe-row' },
        h('b', null, 'Add: '),
        h('button', { class: 'px-tool', type: 'button', onclick: () => add({ t: 'text', text: 'Your text', x: 50, y: 50, size: 8, color: '#1b1b1b', font: 'clean' }) }, '🔤 Text'),
        h('button', { class: 'px-tool' + (trayOpen ? ' on' : ''), type: 'button', onclick() { trayOpen = !trayOpen; renderTools(); } }, '😀 Sticker'),
        h('button', { class: 'px-tool', type: 'button', onclick: () => add({ t: 'shape', shape: 'rect', x: 50, y: 50, w: 80, h: 18, color: '#ffd43b' }) }, '▬ Banner'),
        h('button', { class: 'px-tool', type: 'button', onclick: () => add({ t: 'shape', shape: 'circle', x: 50, y: 50, w: 40, h: 30, color: '#2ee6d6' }) }, '⬤ Circle'),
        h('button', { class: 'px-tool', type: 'button', onclick: () => add({ t: 'shape', shape: 'star', x: 50, y: 50, w: 40, h: 30, color: '#ff8c1a' }) }, '★ Star'));
      const tray = trayOpen && h('div', { class: 'pe-tray' }, (r.stickers || POSTER_STICKERS).map(em => h('button', {
        class: 'pe-sticker', type: 'button', onclick() { trayOpen = false; add({ t: 'sticker', emoji: em, x: 50, y: 50, size: 14 }); },
      }, em)));
      let selPanel;
      if (!s) selPanel = h('p', { class: 'pe-hint' }, '👆 Tap something on the poster to change it. Drag it to move it.');
      else {
        const resize = f => { if (s.t === 'shape') { s.w = Math.max(5, Math.min(100, s.w * f)); s.h = Math.max(4, Math.min(100, s.h * f)); } else s.size = Math.max(2, Math.min(40, Math.round(s.size * f * 10) / 10)); sfx.tap(); renderPoster(); };
        const textIn = s.t === 'text' && h('input', { class: 'pe-input', type: 'text', value: s.text, maxlength: '40', 'aria-label': 'Edit text' });
        if (textIn) textIn.addEventListener('input', () => { s.text = textIn.value || ' '; const d = elOf.get(s); if (d) d.firstChild.textContent = s.text; renderChecks(); });
        selPanel = h('div', { class: 'pe-sel' },
          h('div', { class: 'pe-row' }, h('b', null, s.t === 'text' ? 'Text: ' : s.t === 'sticker' ? 'Sticker: ' : 'Shape: '),
            h('button', { class: 'px-tool', type: 'button', onclick: () => resize(1 / 1.2) }, '➖ Smaller'),
            h('button', { class: 'px-tool', type: 'button', onclick: () => resize(1.2) }, '➕ Bigger'),
            h('button', { class: 'px-tool', type: 'button', onclick() { model.items.splice(model.items.indexOf(s), 1); model.items.push(s); sfx.tap(); renderPoster(); } }, '⬆️ Front'),
            h('button', { class: 'px-tool', type: 'button', onclick() { model.items.splice(model.items.indexOf(s), 1); sel = null; sfx.tap(); renderPoster(); } }, '🗑️ Delete')),
          textIn && h('div', { class: 'pe-row' }, textIn),
          s.t === 'text' && h('div', { class: 'pe-row' }, h('b', null, 'Font: '), Object.entries(POSTER_FONTS).map(([id, f]) => h('button', {
            class: 'px-tool' + (s.font === id ? ' on' : ''), type: 'button', style: `font-family:${f.css}`, onclick() { s.font = id; sfx.tap(); renderPoster(); },
          }, f.label))),
          s.t !== 'sticker' && h('div', { class: 'pe-row' }, h('b', null, 'Colour: '), swatchRow(r.colors || POSTER_COLORS, s.color, c => { s.color = c; renderPoster(); })),
          lowContrast(s) && h('p', { class: 'pe-warn-text' }, '⚠️ Hard to read! Pick a colour that stands out from what is behind it.'));
      }
      put(tools, addRow, tray, selPanel,
        h('div', { class: 'pe-row' }, h('b', null, 'Background: '), swatchRow(r.colors || POSTER_COLORS, model.bg, c => { model.bg = c; renderPoster(); })));
    }

    // ----- checklist -----
    const checksEl = h('div', { class: 'panel-inner pe-checks' });
    const finishBtn = h('button', {
      class: 'btn big green', type: 'button',
      onclick() {
        if (finished) return;
        finished = true; sel = null; renderPoster(); savePoster();
        sfx.win(); confetti(120); award(key + ':done', finishBtn); achieve('designer');
        say(r.done || 'WOW! That is a real designer\'s poster! It is saved in your gallery.');
        finishBtn.textContent = '✔ Saved!'; done();
      },
    }, "✔ I'm finished!");
    function renderChecks() {
      let all = true;
      const list = (r.checklist || []).map((c, i) => {
        const auto = c.auto && AUTO[c.auto];
        const ok = auto ? auto() : !!ticks[i];
        if (!ok) all = false;
        return h('li', { class: ok ? 'ok' : '' },
          auto ? h('span', { class: 'pe-box' }, ok ? '✅' : '⬜')
            : h('button', { class: 'pe-box', type: 'button', onclick() { ticks[i] = !ticks[i]; sfx.tap(); renderChecks(); } }, ok ? '✅' : '⬜'),
          h('span', { html: fmt(c.text, false) }), auto && h('small', null, ' (auto-check)'));
      });
      const enough = model.items.length >= (r.minItems || 3);
      finishBtn.disabled = !finished && !(all && enough);
      put(checksEl, h('h3', null, r.checkTitle || '✅ Designer checklist'), h('ul', null, list),
        !enough && h('p', { class: 'pe-hint' }, `Add at least ${r.minItems || 3} things to your poster.`));
    }

    // ----- gallery -----
    const gallery = h('div', { class: 'px-gallery' });
    function drawGallery() {
      const items = store.get(PKEY_POSTERS, []);
      put(gallery, items.length ? items.map((m, gi) => h('div', { class: 'px-thumb pe-thumb' },
        h('img', { src: posterPNG(m, 150), alt: 'poster', title: 'Tap to open', onclick() { model = clone(m); sel = null; renderPoster(); sfx.tap(); } }),
        h('button', { class: 'px-del', type: 'button', 'aria-label': 'Delete', onclick() { if (!confirm('Delete this poster?')) return; const all = store.get(PKEY_POSTERS, []); all.splice(gi, 1); store.set(PKEY_POSTERS, all); drawGallery(); } }, '✕')))
        : h('p', { class: 'ai-empty' }, 'No posters yet – your saved posters will appear here!'));
    }
    const savePoster = () => {
      const all = store.get(PKEY_POSTERS, []);
      all.unshift(clone(model)); store.set(PKEY_POSTERS, all.slice(0, 12)); drawGallery();
    };
    const download = () => {
      sel = null; renderPoster();
      const a = h('a', { href: posterPNG(model, 900), download: `pixelkid-poster-${(settings.name || 'design').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png` });
      document.body.append(a); a.click(); a.remove(); sfx.good(); say('Downloading your poster! Ask a grown-up to help you print it.');
    };

    renderPoster(); drawGallery();
    return h('div', { class: 'game poster-game' },
      r.brief && h('div', { class: 'panel-inner px-brief' }, h('h3', null, r.briefTitle || '📋 Design brief'), h('ol', null, r.brief.map(b => h('li', { html: fmt(b, false) })))),
      h('div', { class: 'pe-wrap' }, h('div', { class: 'pe-stage' }, posterEl), h('div', null, tools, checksEl)),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', type: 'button', onclick() { savePoster(); sfx.good(); say('Saved to your gallery!'); } }, '💾 Save to gallery'),
        h('button', { class: 'btn ghost', type: 'button', onclick: download }, '⬇️ Download poster'),
        finishBtn),
      h('div', { class: 'panel-inner px-gallery-wrap' }, h('h3', null, '🖼️ My Posters'), gallery));
  };
});
