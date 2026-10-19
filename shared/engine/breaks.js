/* Pixelkid lesson engine – brain-break mini games: boss tic-tac-toe, steady hand, maze escape and hangman.
 * One part of shared/engine.js, which loads it only when a lesson uses it. E is the engine's shared helpers
 * (E.state and E.stageCard are live). See the top of shared/engine.js for how the parts fit together.
 */
PixelkidEngine.part('breaks', E => {
  'use strict';
  const { AV, L, award, confetti, h, pic, pick, put, pxDraw, say, sfx, shake, shuffle } = E;

  // ---------- brain-break mini games: boss tic-tac-toe, steady hand, maze escape, hangman ----------
  // In every brain break unless the stage sets games: false (or a list, e.g. games: ['maze']).
  // Winning each game earns one gem per lesson.
  const BREAK_GAMES = {
    ttt: { name: '❌⭕ Boss Tic-Tac-Toe', run: ticTacToe },
    wire: { name: '✏️ Steady Hand', run: steadyHand },
    maze: { name: '🌀 Maze Escape', run: mazeEscape },
    hangman: { name: '🎈 Hangman', run: hangman },
  };
  function brainGames(list) {
    const ids = (Array.isArray(list) ? list : Object.keys(BREAK_GAMES)).filter(id => BREAK_GAMES[id]);
    const area = h('div', { class: 'bg-area' }, h('p', { class: 'bg-status' }, '👆 Pick a game! Win each one to earn a 💎.'));
    const tabs = h('div', { class: 'bg-tabs' });
    let stop = null;
    const open = id => {
      if (stop) stop();
      sfx.tap();
      tabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.id === id));
      stop = BREAK_GAMES[id].run(area) || null;
    };
    ids.forEach(id => tabs.append(h('button', { class: 'bg-tab', type: 'button', 'data-id': id, onclick: () => open(id) }, BREAK_GAMES[id].name)));
    return { el: h('div', { class: 'panel brain-games' }, h('h2', null, '🕹️ Brain Games'), tabs, area), stop: () => stop && stop() };
  }
  const levelTabs = (names, onPick) => {
    const btns = names.map((n, k) => h('button', { class: 'bg-tab small', type: 'button', onclick() { sfx.tap(); onPick(k); } }, n));
    return { el: h('div', { class: 'bg-tabs center' }, btns), set: k => btns.forEach((b, j) => b.classList.toggle('on', j === k)) };
  };

  // Tic-tac-toe against this lesson's boss. The boss always takes a win, usually blocks, and sometimes slips up.
  function ticTacToe(area) {
    const boss = (L.stages.find(st => st.boss) || {}).boss || { name: 'Boss Bot', emoji: '👾' };
    const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    const winner = b => LINES.find(l => b[l[0]] && b[l[0]] === b[l[1]] && b[l[0]] === b[l[2]]);
    const score = { you: 0, boss: 0, draw: 0 };
    let board, over, busy, timer = 0;
    const cells = Array.from({ length: 9 }, (_, k) => h('button', { class: 'ttt-cell', type: 'button', 'aria-label': 'square ' + (k + 1), onclick: () => play(k) }));
    const status = h('div', { class: 'bg-status' }), tally = h('div', { class: 'ttt-score' });
    const again = h('button', { class: 'btn gold', type: 'button', onclick: reset }, '↺ Play again');
    function draw() {
      cells.forEach((c, k) => { c.textContent = board[k] === 'X' ? '❌' : board[k] === 'O' ? '⭕' : ''; c.disabled = over || busy || !!board[k]; });
      tally.textContent = `You ${score.you} · ${boss.name} ${score.boss} · Draws ${score.draw}`;
    }
    function check() {
      const l = winner(board);
      if (!l && board.some(v => !v)) return false;
      over = true; again.hidden = false;
      if (l) l.forEach(k => cells[k].classList.add('win'));
      if (l && board[l[0]] === 'X') {
        score.you++; sfx.win(); confetti(80);
        const gem = award('break:ttt', cells[4]);
        status.textContent = `You beat ${boss.name}!` + (gem ? ' +1 💎' : '');
        say(`${boss.name} is defeated! Three in a row!`);
      } else if (l) {
        score.boss++; sfx.hit();
        status.textContent = `${boss.name} wins this time…`;
        say('Watch out for the boss making a line – block it!');
      } else {
        score.draw++; sfx.tap();
        status.textContent = "It's a draw!";
        say('A draw! Can you trick the boss next time?');
      }
      draw();
      return true;
    }
    function bossMove() {
      const free = board.flatMap((v, k) => v ? [] : [k]);
      const lineFor = mark => free.find(k => { const b = board.slice(); b[k] = mark; return winner(b); });
      let k = lineFor('O');
      if (k === undefined && Math.random() < 0.75) k = lineFor('X');
      if (k === undefined && !board[4] && Math.random() < 0.6) k = 4;
      if (k === undefined) k = pick(free);
      board[k] = 'O'; cells[k].classList.add('placed'); sfx.zap();
      if (!check()) { status.textContent = 'Your turn – you are ❌'; draw(); }
    }
    function play(k) {
      if (over || busy || board[k]) return;
      board[k] = 'X'; cells[k].classList.add('placed'); sfx.tap();
      if (check()) return;
      busy = true; status.textContent = `${boss.name} is thinking…`; draw();
      timer = setTimeout(() => { busy = false; bossMove(); }, 650);
    }
    function reset() {
      clearTimeout(timer);
      board = Array(9).fill(''); over = false; busy = false; again.hidden = true;
      cells.forEach(c => c.classList.remove('win', 'placed'));
      status.textContent = 'Your turn – you are ❌'; draw();
    }
    put(area,
      h('div', { class: 'ttt-head' }, pic(boss.sprite || boss.emoji || '👾', 'ttt-boss'),
        h('div', null, h('div', { class: 'boss-name' }, boss.name), h('div', null, 'challenges you to Tic-Tac-Toe! Get three in a row to win.'))),
      h('div', { class: 'ttt-grid' }, cells), status, tally, h('div', { class: 'btn-row' }, again));
    reset();
    say(`${boss.name} wants a rematch… at Tic-Tac-Toe!`);
    return () => clearTimeout(timer);
  }

  // Steady hand: drag along a wiggly path to the flag without touching the sides.
  function steadyHand(area) {
    const W = 640, H = 320;
    const LEVELS = [{ r: 28, amp: 60, name: 'Easy' }, { r: 21, amp: 90, name: 'Medium' }, { r: 15, amp: 110, name: 'Hard' }];
    const cv = h('canvas', { class: 'bg-canvas', width: W, height: H, 'aria-label': 'Steady hand path' });
    const status = h('div', { class: 'bg-status' });
    let lv = 0, pts = [], trail = [], mode = 'ready', redTimer = 0;
    const tabs = levelTabs(LEVELS.map(l => l.name), k => { lv = k; build(); });
    const r = () => LEVELS[lv].r;
    function build() {
      const amp = LEVELS[lv].amp, p1 = Math.random() * 6, p2 = Math.random() * 6;
      pts = [];
      for (let x = 50; x <= W - 50; x += 8) { const t = (x - 50) / (W - 100); pts.push([x, H / 2 + Math.sin(t * 7 + p1) * amp * 0.6 + Math.sin(t * 13 + p2) * amp * 0.4]); }
      trail = []; mode = 'ready'; tabs.set(lv);
      status.textContent = 'Press on the green dot, then follow the path to the 🏁. Don\'t touch the sides!';
      paint();
    }
    const segDist = (x, y, [ax, ay], [bx, by]) => {
      const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
      return Math.hypot(x - ax - t * dx, y - ay - t * dy);
    };
    const distToPath = (x, y) => pts.reduce((d, p, k) => k ? Math.min(d, segDist(x, y, pts[k - 1], p)) : d, Infinity);
    function paint(red) {
      const c = cv.getContext('2d');
      const line = (ps, col, w) => { c.beginPath(); ps.forEach(([x, y], k) => k ? c.lineTo(x, y) : c.moveTo(x, y)); c.strokeStyle = col; c.lineWidth = w; c.stroke(); };
      c.fillStyle = '#1d1630'; c.fillRect(0, 0, W, H);
      c.lineCap = 'round'; c.lineJoin = 'round';
      line(pts, red ? '#e53935' : '#000', r() * 2 + 8);
      line(pts, red ? '#ffb3ad' : '#ffd43b', r() * 2);
      if (trail.length > 1) line(trail, '#1e6fd9', 6);
      const [sx, sy] = pts[0], [ex, ey] = pts[pts.length - 1];
      c.fillStyle = '#4caf2a'; c.beginPath(); c.arc(sx, sy, r() - 5, 0, 7); c.fill();
      c.font = `${Math.round(r() * 1.5)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; if (!pxDraw(c, '🏁', ex, ey, r() * 1.5, { baseline: 'middle' })) c.fillText('🏁', ex, ey);
    }
    const pos = e => { const b = cv.getBoundingClientRect(); return [(e.clientX - b.left) * W / b.width, (e.clientY - b.top) * H / b.height]; };
    function fail() {
      mode = 'ready'; trail = []; sfx.hit(); shake(cv);
      status.textContent = 'BZZZT! You touched the side. Back to the green dot!';
      paint(true); clearTimeout(redTimer); redTimer = setTimeout(() => paint(), 350);
    }
    function win() {
      mode = 'won'; sfx.win(); confetti(80); paint();
      const gem = award('break:wire', cv);
      status.textContent = (lv < LEVELS.length - 1 ? `You made it! Try ${LEVELS[lv + 1].name} next.` : 'WOW! The steadiest hands ever!') + (gem ? ' +1 💎' : '');
      say('What a steady hand!');
    }
    cv.addEventListener('pointerdown', e => {
      const [x, y] = pos(e);
      if (mode === 'won') { build(); return; }
      if (Math.hypot(x - pts[0][0], y - pts[0][1]) > r()) { status.textContent = 'Start on the green dot!'; return; }
      e.preventDefault(); cv.setPointerCapture(e.pointerId);
      mode = 'go'; trail = [[x, y]]; sfx.tap(); status.textContent = 'Steady… steady…'; paint();
    });
    cv.addEventListener('pointermove', e => {
      if (mode !== 'go') return;
      const [x, y] = pos(e), [lx, ly] = trail[trail.length - 1], n = Math.ceil(Math.hypot(x - lx, y - ly) / 4);
      // check every few pixels along the move, so a quick swipe can't jump over a wall
      for (let k = 1; k <= n; k++) {
        const px = lx + (x - lx) * k / n, py = ly + (y - ly) * k / n;
        if (distToPath(px, py) > r()) return fail();
        trail.push([px, py]);
        if (Math.hypot(px - pts[pts.length - 1][0], py - pts[pts.length - 1][1]) < r()) return win();
      }
      paint();
    });
    const lift = () => { if (mode === 'go') { mode = 'ready'; trail = []; status.textContent = 'You let go! Start again from the green dot.'; paint(); } };
    cv.addEventListener('pointerup', lift); cv.addEventListener('pointercancel', lift);
    put(area, tabs.el, cv, status, h('div', { class: 'btn-row' }, h('button', { class: 'btn gold', type: 'button', onclick() { sfx.tap(); build(); } }, '↺ New path')));
    build();
    say('Steady hands, {name}! Don\'t touch the sides!');
    return () => clearTimeout(redTimer);
  }

  // Maze escape: walk your avatar to the gem. Arrow keys / WASD, the arrow buttons, or tap where you want to go.
  function mazeEscape(area) {
    const SIZES = [{ n: 7, name: 'Easy' }, { n: 10, name: 'Medium' }, { n: 13, name: 'Hard' }];
    const D = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // up, right, down, left
    const S = 520, M = 6;
    const cv = h('canvas', { class: 'bg-canvas maze-canvas', width: S, height: S, 'aria-label': 'Maze – use the arrow keys or buttons to move' });
    const status = h('div', { class: 'bg-status' });
    const hero = AV ? AV.draw(undefined, { scale: 4 }) : null;
    let lv = 0, n, walls, me, seen, moves, won, t0;
    const tabs = levelTabs(SIZES.map(s => s.name), k => { lv = k; build(); });
    function build() {
      n = SIZES[lv].n;
      walls = Array.from({ length: n * n }, () => [true, true, true, true]);
      const visited = new Set([0]), stack = [0];
      while (stack.length) {
        const c = stack[stack.length - 1], x = c % n, y = (c - x) / n;
        const opts = D.map((d, k) => [k, x + d[0], y + d[1]]).filter(([, nx, ny]) => nx >= 0 && ny >= 0 && nx < n && ny < n && !visited.has(ny * n + nx));
        if (!opts.length) { stack.pop(); continue; }
        const [k, nx, ny] = pick(opts), nc = ny * n + nx;
        walls[c][k] = false; walls[nc][(k + 2) % 4] = false;
        visited.add(nc); stack.push(nc);
      }
      me = [0, 0]; seen = new Set([0]); moves = 0; won = false; t0 = Date.now(); tabs.set(lv);
      status.textContent = 'Find your way to the 💎!';
      paint();
    }
    function paint() {
      const c = cv.getContext('2d'), cs = (S - M * 2) / n;
      c.fillStyle = '#f4ecd2'; c.fillRect(0, 0, S, S);
      c.fillStyle = '#c6f6ef';
      seen.forEach(k => c.fillRect(M + (k % n) * cs, M + Math.floor(k / n) * cs, cs, cs));
      c.strokeStyle = '#2b2b2b'; c.lineWidth = Math.max(3, cs / 7); c.lineCap = 'square';
      c.beginPath();
      for (let k = 0; k < n * n; k++) {
        const x = M + (k % n) * cs, y = M + Math.floor(k / n) * cs, w = walls[k];
        if (w[0]) { c.moveTo(x, y); c.lineTo(x + cs, y); }
        if (w[1]) { c.moveTo(x + cs, y); c.lineTo(x + cs, y + cs); }
        if (w[2]) { c.moveTo(x, y + cs); c.lineTo(x + cs, y + cs); }
        if (w[3]) { c.moveTo(x, y); c.lineTo(x, y + cs); }
      }
      c.stroke();
      c.font = `${Math.round(cs * 0.6)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      if (!pxDraw(c, '💎', M + (n - 0.5) * cs, M + (n - 0.5) * cs, cs * 0.7, { baseline: 'middle' })) c.fillText('💎', M + (n - 0.5) * cs, M + (n - 0.5) * cs);
      const px = M + me[0] * cs, py = M + me[1] * cs;
      if (hero) {
        const hh = cs * 0.84, hw = hh * hero.width / hero.height;
        c.imageSmoothingEnabled = false; c.drawImage(hero, px + (cs - hw) / 2, py + (cs - hh) / 2, hw, hh);
      } else if (!pxDraw(c, '🙂', px + cs / 2, py + cs / 2, cs * 0.8, { baseline: 'middle' })) c.fillText('🙂', px + cs / 2, py + cs / 2);
    }
    function move(k) {
      if (won) return;
      const [x, y] = me;
      if (walls[y * n + x][k]) { sfx.tap(); shake(cv); return; }
      me = [x + D[k][0], y + D[k][1]]; seen.add(me[1] * n + me[0]); moves++;
      if (me[0] === n - 1 && me[1] === n - 1) {
        won = true; sfx.win(); confetti(80);
        const gem = award('break:maze', cv), secs = Math.round((Date.now() - t0) / 1000);
        status.textContent = `You escaped in ${moves} moves and ${secs} seconds!` + (gem ? ' +1 💎' : '');
        say(lv < SIZES.length - 1 ? `Maze master! Try ${SIZES[lv + 1].name} next.` : 'You beat the hardest maze! Amazing!');
      }
      paint();
    }
    // tap the maze: step towards the tapped spot
    cv.addEventListener('pointerdown', e => {
      const b = cv.getBoundingClientRect(), cs = (b.width - M * 2 * b.width / S) / n;
      const dx = (e.clientX - b.left) - (M * b.width / S + (me[0] + 0.5) * cs), dy = (e.clientY - b.top) - (M * b.width / S + (me[1] + 0.5) * cs);
      if (Math.max(Math.abs(dx), Math.abs(dy)) < cs / 2) return;
      move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
    });
    const KEYS = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, d: 1, s: 2, a: 3 };
    const onKey = e => {
      const k = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
      if (k === undefined || e.target.closest && e.target.closest('input, textarea')) return;
      e.preventDefault(); move(k);
    };
    document.addEventListener('keydown', onKey);
    const pad = (k, label) => h('button', { class: 'dpad-btn', type: 'button', 'aria-label': ['up', 'right', 'down', 'left'][k], onclick: () => move(k) }, label);
    put(area, tabs.el, cv, status,
      h('div', { class: 'dpad' }, h('span'), pad(0, '⬆️'), h('span'), pad(3, '⬅️'), pad(2, '⬇️'), pad(1, '➡️')),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn gold', type: 'button', onclick() { sfx.tap(); build(); } }, '↺ New maze')));
    build();
    say('Help your hero escape the maze! Use the arrows.');
    return () => document.removeEventListener('keydown', onKey);
  }

  // Hangman (with balloons): guess the word letter by letter; each wrong letter pops a balloon.
  // Themes: this lesson's glossary words (with their meaning as a hint) plus a few general ones.
  const HANGMAN_THEMES = {
    '🐾 Animals': ['tiger', 'rabbit', 'penguin', 'giraffe', 'dolphin', 'monkey', 'spider', 'elephant', 'hamster', 'parrot', 'zebra', 'octopus'],
    '🍕 Food': ['pizza', 'banana', 'carrot', 'sandwich', 'pancake', 'apple', 'noodles', 'cheese', 'biscuit', 'yoghurt', 'popcorn', 'strawberry'],
    '🚀 Space': ['planet', 'rocket', 'comet', 'astronaut', 'moon', 'galaxy', 'alien', 'meteor', 'orbit', 'saturn', 'telescope', 'star'],
    '⚽ Sport': ['football', 'tennis', 'swimming', 'cricket', 'netball', 'skipping', 'rugby', 'cycling', 'hockey', 'karate', 'gymnastics', 'running'],
  };
  function hangman(area) {
    const LIVES = 6;
    const themes = {};
    const lessonWords = Object.entries(L.glossary || {}).map(([k, d]) => {
      d = typeof d === 'string' ? { def: d } : d;
      const w = (d.word || k).toLowerCase();
      const plain = String(d.def || '').replace(/\[\[(.+?)(?:\|.+?)?\]\]/g, '$1').replace(/\*\*/g, '');
      return { w, hint: (d.emoji ? d.emoji + ' ' : '') + plain.replace(new RegExp(w, 'gi'), '____') };
    }).filter(o => /^[a-z ]{3,16}$/.test(o.w));
    if (lessonWords.length >= 3) themes['📖 This lesson'] = lessonWords;
    Object.entries(HANGMAN_THEMES).forEach(([t, ws]) => { themes[t] = ws.map(w => ({ w })); });
    const names = Object.keys(themes);
    let theme = names[0], queue = [], word, guessed, wrong, over;
    const status = h('div', { class: 'bg-status' }), hintEl = h('p', { class: 'hm-hint' });
    const balloons = h('div', { class: 'hm-balloons', 'aria-label': 'balloons left' });
    const slots = h('div', { class: 'hm-word' });
    const keys = {};
    const board = h('div', { class: 'hm-keys' }, [...'abcdefghijklmnopqrstuvwxyz'].map(ch => (keys[ch] = h('button', { class: 'hm-key', type: 'button', onclick: () => guess(ch) }, ch.toUpperCase()))));
    const hintBtn = h('button', { class: 'btn ghost', type: 'button', onclick() { sfx.tap(); hintEl.hidden = false; hintBtn.hidden = true; } }, '💡 Hint');
    const tabs = levelTabs(names, k => { theme = names[k]; queue = []; next(); });
    function next() {
      if (!queue.length) queue = shuffle(themes[theme]);
      ({ w: word } = queue[0]);
      hintEl.textContent = queue[0].hint ? 'Hint: ' + queue[0].hint : ''; hintEl.hidden = true; hintBtn.hidden = !queue[0].hint;
      queue.shift();
      guessed = new Set(); wrong = 0; over = false;
      tabs.set(names.indexOf(theme));
      Object.values(keys).forEach(b => { b.disabled = false; b.className = 'hm-key'; });
      status.textContent = `Theme: ${theme.replace(/^\S+ /, '')} – guess a letter!`;
      draw();
    }
    function draw() {
      balloons.replaceChildren(...Array.from({ length: LIVES }, (_, k) => h('span', { class: k < LIVES - wrong ? 'hm-balloon' : 'hm-balloon popped' }, k < LIVES - wrong ? '🎈' : '💥')));
      slots.replaceChildren(...[...word].map(ch => ch === ' ' ? h('span', { class: 'hm-gap' })
        : h('span', { class: 'hm-slot' + (over && !guessed.has(ch) ? ' missed' : '') }, guessed.has(ch) || over ? ch.toUpperCase() : '')));
    }
    function guess(ch) {
      if (over || guessed.has(ch)) return;
      guessed.add(ch); keys[ch].disabled = true;
      if (word.includes(ch)) {
        keys[ch].classList.add('hit'); sfx.good();
        if ([...word].every(c => c === ' ' || guessed.has(c))) {
          over = true; sfx.win(); confetti(80);
          const gem = award('break:hangman', slots);
          status.textContent = `You got it – ${word.toUpperCase()}!` + (gem ? ' +1 💎' : '');
          say(wrong ? 'Word wizard! You saved the balloons!' : 'WOW! Not a single balloon popped!');
        }
      } else {
        keys[ch].classList.add('miss'); wrong++; sfx.hit();
        if (wrong >= LIVES) {
          over = true;
          status.textContent = `All the balloons popped! The word was ${word.toUpperCase()}.`;
          say('So close! Try another word.');
        } else status.textContent = `No ${ch.toUpperCase()} in this word. ${LIVES - wrong} balloon${LIVES - wrong > 1 ? 's' : ''} left!`;
      }
      if (over) Object.values(keys).forEach(b => { b.disabled = true; });
      draw();
    }
    const onKey = e => {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.target.closest && e.target.closest('input, textarea'))) return;
      const ch = e.key.length === 1 && e.key.toLowerCase();
      if (ch && keys[ch]) { e.preventDefault(); guess(ch); }
    };
    document.addEventListener('keydown', onKey);
    put(area, tabs.el, balloons, slots, status, board, hintEl,
      h('div', { class: 'btn-row' }, hintBtn, h('button', { class: 'btn gold', type: 'button', onclick() { sfx.tap(); next(); } }, '↺ New word')));
    next();
    say('Guess the word one letter at a time. Don\'t let the balloons pop!');
    return () => document.removeEventListener('keydown', onKey);
  }

  return { brainGames };
});
