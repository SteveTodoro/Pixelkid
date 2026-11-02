/* Pixelkid lesson engine – Human body sims: the Food Journey (digestion) and the Muscle Lab (muscles pull in pairs).
 * One part of shared/engine.js, which loads it only when a lesson uses it. E is the engine's shared helpers
 * (E.state and E.stageCard are live). See the top of shared/engine.js for how the parts fit together.
 */
PixelkidEngine.part('body', E => {
  'use strict';
  const { GAMES, arcadeCanvas, emojiAt, gameLoop, h, missionRunner, pxText, resultsTable, say, sfx, toGame } = E;

  // a point along a polyline, t from 0 to 1 (by length)
  function along(pts, t) {
    const segs = []; let total = 0;
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(l); total += l; }
    let d = Math.max(0, Math.min(1, t)) * total;
    for (let i = 0; i < segs.length; i++) {
      if (d <= segs[i] || i === segs.length - 1) { const f = segs[i] ? Math.min(1, d / segs[i]) : 0; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f]; }
      d -= segs[i];
    }
    return pts[pts.length - 1];
  }
  function tube(ctx, pts, width, color) {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = width + 6; ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }
  const mix = (a, b, f) => { // blend two #rrggbb colours
    const p = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
    const A = p(a), B = p(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * f).toString(16).padStart(2, '0')).join('');
  };
  function wrap(ctx, text, x, y, maxW, size, color) { // left-aligned wrapped reading text (Lexend); returns the next y
    const font = `600 ${size}px Lexend, "Trebuchet MS", sans-serif`, words = String(text).split(' ');
    const put = t => { ctx.font = font; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(t, x, y); ctx.fillStyle = color; ctx.fillText(t, x, y); y += size + 7; };
    let line = '';
    ctx.font = font;
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { put(line); ctx.font = font; line = w; } else line = test;
    }
    if (line) put(line);
    return y;
  }

  // ===== Food Journey: follow a bite of food all the way through the digestive system =====
  // r.foods: ids from FOODS (default all) · r.caption
  // r.missions: [{ text, need: ['bread', 'egg'] (foods to send all the way through), yes, ask: [questions] }]
  // Each part needs the child to do its job: tap to chew (mouth), drag the food down (food pipe), rub to churn (stomach),
  // tap the goodness to send it into the blood (small intestine), rub to squeeze the water out (large intestine),
  // then drag the poo down to the toilet. Each finished journey adds a row to the results table.
  const GOOD = { energy: { icon: '⚡', name: 'energy' }, grow: { icon: '💪', name: 'growing' }, vit: { icon: '🛡️', name: 'vitamins' } };
  const FOODS = {
    bread: { name: 'Bread', emoji: '🍞', good: { energy: 3, grow: 1 }, fibre: 1, col: '#e8c27a' },
    apple: { name: 'Apple', emoji: '🍎', good: { vit: 3, energy: 1 }, fibre: 2, col: '#f3e3a3' },
    egg: { name: 'Egg', emoji: '🥚', good: { grow: 3, energy: 1, vit: 1 }, fibre: 0, col: '#ffe08a' },
    broccoli: { name: 'Broccoli', emoji: '🥦', good: { vit: 3, grow: 1 }, fibre: 2, col: '#9be15d' },
    sweets: { name: 'Sweets', emoji: '🍬', good: { energy: 2 }, fibre: 0, col: '#ff8fb1' },
    fish: { name: 'Fish', emoji: '🐟', good: { grow: 3, energy: 1 }, fibre: 0, col: '#f2d0b0' },
  };
  const STATIONS = [
    { id: 'mouth', name: 'Mouth', job: 'Teeth cut and grind the food. Saliva makes it soft and slippery.', act: 'TAP to chew!', help: '🦷 Chew it for me' },
    { id: 'pipe', name: 'Food pipe', job: 'Muscles squeeze the food down to your stomach.', act: 'DRAG the food down!', help: '⬇ Swallow it for me' },
    { id: 'stomach', name: 'Stomach', job: 'It churns the food into soup. Its acid kills germs.', act: 'RUB the stomach to churn!', help: '🌀 Churn it for me' },
    { id: 'small', name: 'Small intestine', job: 'The goodness (nutrients) soaks into your blood.', act: 'TAP the goodness to send it into your blood!', help: '✨ Grab it for me' },
    { id: 'large', name: 'Large intestine', job: 'It takes the water back out. What is left becomes poo.', act: 'RUB to squeeze the water out!', help: '💧 Squeeze it for me' },
    { id: 'out', name: 'Out it goes!', job: 'The waste leaves your body. Flush!', act: 'DRAG the poo down to the toilet!', help: '🚽 Flush it for me' },
  ];
  const MOUTH = [230, 74], PIPE = [[230, 80], [230, 168]], STOM = { x: 262, y: 192, rx: 42, ry: 28 };
  const SMALL = [[288, 212], [290, 236], [200, 246], [276, 258], [200, 270], [276, 282], [200, 294], [276, 306], [205, 318], [282, 326]];
  const LARGE = [[282, 326], [314, 326], [314, 228], [148, 228], [148, 340], [230, 350], [230, 380]];
  const TOILET = [230, 424];
  const CHEWS = 6;

  GAMES.gut = function (r, key, done) {
    const W = 640, H = 450;
    const { cv, ctx } = arcadeCanvas(W, H);
    const foods = (r.foods || Object.keys(FOODS)).map(id => Object.assign({ id }, FOODS[id]));
    let food = foods[0], si = 0, time = 0, busy = false, did = new Set(), runN = 0;
    let j = null; // this journey: { chew, t (food pipe / small / large progress), churn, squeeze, tokens, fibre, got, crumbs, drops, germs, flush, pooY }
    const table = resultsTable(r.caption || '🍽️ Our food journeys', ['Trip', 'Food', 'Goodness into the blood', 'Fibre (helps make poo)']);
    const missions = missionRunner(r, key, done, () => { did = new Set(); fresh(); });

    function fresh() {
      si = 0; busy = false;
      const tokens = [];
      Object.entries(food.good).forEach(([g, n]) => { for (let k = 0; k < n; k++) tokens.push({ g }); });
      tokens.sort(() => Math.random() - 0.5).forEach((tk, k) => { tk.at = 0.12 + 0.76 * (k + 0.5) / tokens.length; tk.side = k % 2 ? 1 : -1; tk.state = 'hidden'; tk.bob = Math.random() * 6; });
      const fibre = []; for (let k = 0; k < food.fibre; k++) fibre.push({ at: 0.3 + 0.4 * k, state: 'hidden' });
      j = { chew: 0, t: 0, churn: 0, squeeze: 0, tokens, fibre, got: {}, crumbs: [], drops: [], germs: [0.3, 0.6, 0.9].map(at => ({ at, zap: 0 })), flush: 0, pooY: 0, chomp: 0 };
      sync();
    }
    const st = () => STATIONS[si];
    function next() {
      si++; sfx.good();
      if (si >= STATIONS.length) return finished();
      say(`${st().name}: ${st().job}`);
      sync();
    }
    function finished() {
      busy = false; runN++; did.add(food.id);
      const got = Object.entries(food.good).map(([g, n]) => GOOD[g].icon.repeat(n) + ' ' + GOOD[g].name).join(', ');
      table.add([runN, `${food.emoji} ${food.name}`, got, food.fibre >= 2 ? 'lots' : food.fibre ? 'some' : 'none']);
      const m = missions.m, need = (m && m.need) || [], left = need.filter(n => !did.has(n));
      if (m && !left.length) missions.win(cv);
      else if (left.length) say(`Journey complete! Now pick the ${FOODS[left[0]].emoji} ${FOODS[left[0]].name.toLowerCase()} and send it through.`);
      else say('Journey complete! Pick another food to try.');
      sync();
    }

    // ---- each part's job ----
    function chew() {
      if (st().id !== 'mouth') return;
      busy = true; j.chew++; j.chomp = 0.2; sfx.tap();
      for (let k = 0; k < 5; k++) j.crumbs.push({ x: MOUTH[0] + (Math.random() - 0.5) * 30, y: MOUTH[1], vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 60, life: 0.7, c: k % 2 ? food.col : '#8fdcff' });
      if (j.chew >= CHEWS) { say('Chewed into soft, slippery mush! Now swallow it.'); next(); }
      sync();
    }
    function swallowTo(t) { if (st().id !== 'pipe') return; j.t = Math.max(j.t, Math.min(1, t)); if (j.t >= 1) { j.t = 0; next(); } }
    function churn(amount) {
      if (st().id !== 'stomach') return;
      j.churn = Math.min(1, j.churn + amount);
      j.germs.forEach(g => { if (!g.zap && j.churn >= g.at) { g.zap = 1; sfx.good(); } });
      if (j.churn >= 1) { say('Food soup! And the acid zapped the germs.'); j.t = 0; next(); }
    }
    function grab(tk) {
      if (tk.state !== 'out') return;
      tk.state = 'fly'; tk.fly = 0; j.got[tk.g] = (j.got[tk.g] || 0) + 1; sfx.good();
    }
    function squeeze(amount) {
      if (st().id !== 'large') return;
      const before = j.squeeze;
      j.squeeze = Math.min(1, j.squeeze + amount);
      if (Math.floor(j.squeeze * 8) > Math.floor(before * 8)) { const [x, y] = along(LARGE, Math.random() * 0.8); j.drops.push({ x, y, life: 1 }); }
      if (j.squeeze >= 1) { say('The water went back into your body. What is left is poo!'); j.pooY = 0; next(); }
    }
    function pooTo(t) { if (st().id !== 'out' || j.flush) return; j.pooY = Math.max(j.pooY, Math.min(1, t)); if (j.pooY >= 1) { j.flush = 0.01; sfx.good(); } }
    function popOut(tk) { tk.state = 'out'; const [x, y] = along(SMALL, tk.at); tk.x = Math.max(70, Math.min(350, x + (tk.side || 1) * 50)); tk.y = y; }
    function helpMe() {
      const id = st().id;
      if (id === 'mouth') { while (st().id === 'mouth') chew(); }
      else if (id === 'pipe') swallowTo(1);
      else if (id === 'stomach') churn(1);
      else if (id === 'small') { j.t = 1; [...j.tokens, ...j.fibre].forEach(tk => { if (tk.state === 'hidden') popOut(tk); }); j.tokens.forEach(grab); }
      else if (id === 'large') squeeze(1);
      else if (id === 'out') pooTo(1);
    }

    // ---- fingers ----
    let finger = null;
    cv.addEventListener('pointerdown', e => {
      e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      const [x, y] = toGame(cv, W, H, e);
      finger = { x, y, lx: x, ly: y };
      const id = st().id;
      if (id === 'mouth') chew();
      else if (id === 'small') {
        const tk = j.tokens.find(t => t.state === 'out' && Math.hypot(t.x - x, t.y - y) < 34);
        if (tk) grab(tk);
        else {
          const fb = j.fibre.find(f => f.state === 'out' && Math.hypot(f.x - x, f.y - y) < 30);
          if (fb) { fb.state = 'told'; say('That brown bit is fibre. Your body can\'t take it in, but it helps push food along – and it helps make poo!'); }
        }
      }
    });
    cv.addEventListener('pointermove', e => {
      if (!finger) return;
      const [x, y] = toGame(cv, W, H, e);
      const moved = Math.hypot(x - finger.lx, y - finger.ly); finger.lx = x; finger.ly = y;
      const id = st().id;
      if (id === 'pipe') { busy = true; swallowTo((y - PIPE[0][1]) / (PIPE[1][1] - PIPE[0][1])); }
      else if (id === 'stomach') churn(moved / 1400);
      else if (id === 'large') squeeze(moved / 1600);
      else if (id === 'out') pooTo((y - 370) / 50);
    });
    const up = () => { finger = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);

    function step(dt) {
      time += dt;
      j.chomp = Math.max(0, j.chomp - dt);
      j.crumbs.forEach(c => { c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 300 * dt; c.life -= dt; });
      j.crumbs = j.crumbs.filter(c => c.life > 0);
      j.drops.forEach(d => { d.x += (560 - d.x) * dt * 1.5; d.y += (300 - d.y) * dt * 1.5; d.life -= dt * 0.8; });
      j.drops = j.drops.filter(d => d.life > 0);
      j.germs.forEach(g => { if (g.zap) g.zap += dt; });
      if (st().id === 'small') {
        j.t = Math.min(1, j.t + dt * 0.09);
        [...j.tokens, ...j.fibre].forEach(tk => {
          if (tk.state === 'hidden' && j.t >= tk.at) popOut(tk);
        });
        j.tokens.forEach(tk => { if (tk.state === 'fly') { tk.fly += dt * 1.6; if (tk.fly >= 1) tk.state = 'got'; } });
        if (j.t >= 1 && j.tokens.every(tk => tk.state === 'got')) { say('All the goodness is in your blood!'); j.t = 0; next(); }
        else if (j.t >= 1 && (j.nag = (j.nag || 0) + dt) > 4) { j.nag = 0; say('Tap the goodness that\'s still floating!'); }
      }
      if (j.flush && j.flush < 1) { j.flush += dt * 0.8; if (j.flush >= 1 && !j.recorded) { j.recorded = true; finished(); } }
      draw();
    }

    // ---- drawing ----
    function body() {
      ctx.fillStyle = '#2b3a4a'; ctx.fillRect(0, 0, W, H);
      const skin = '#f2c39b', out = '#1b1b1b';
      const box = (x, y, w, hh, c) => { ctx.fillStyle = out; ctx.fillRect(x - 3, y - 3, w + 6, hh + 6); ctx.fillStyle = c; ctx.fillRect(x, y, w, hh); };
      box(110, 112, 240, 285, skin); box(212, 92, 36, 24, skin); box(180, 12, 100, 82, skin);
      ctx.fillStyle = skin; ctx.fillRect(212, 100, 36, 20);
      ctx.fillStyle = out; ctx.fillRect(203, 38, 10, 10); ctx.fillRect(247, 38, 10, 10); // eyes
      const open = j.chomp > 0.1 ? 10 : st().id === 'mouth' ? 5 : 3;
      ctx.fillStyle = '#9e1c1a'; ctx.fillRect(212, MOUTH[1] - open / 2 - 2, 36, open + 4);
      if (open > 5) { ctx.fillStyle = '#fff'; for (let k = 0; k < 4; k++) { ctx.fillRect(215 + k * 8, MOUTH[1] - open / 2 - 2, 5, 4); ctx.fillRect(215 + k * 8, MOUTH[1] + open / 2 - 2, 5, 4); } }
      // the digestive system
      tube(ctx, LARGE, 18, mix('#c98a5a', '#8a5a32', j && st().id === 'large' ? j.squeeze : 0));
      tube(ctx, SMALL, 10, '#ffb38a');
      tube(ctx, PIPE, 12, '#e57373');
      ctx.fillStyle = out; ctx.beginPath(); ctx.ellipse(STOM.x, STOM.y, STOM.rx + 3, STOM.ry + 3, 0.3, 0, Math.PI * 2); ctx.fill();
      const wob = st().id === 'stomach' && finger ? Math.sin(time * 30) * 3 : 0;
      ctx.fillStyle = '#ff8fb1'; ctx.beginPath(); ctx.ellipse(STOM.x + wob, STOM.y, STOM.rx, STOM.ry, 0.3, 0, Math.PI * 2); ctx.fill();
    }
    function draw() {
      body();
      const id = st().id, soupC = mix(food.col, '#d9a441', 0.6);
      // the food, wherever it is
      if (id === 'mouth') {
        const s = 46 - j.chew * 4;
        emojiAt(ctx, food.emoji, MOUTH[0] + 52, MOUTH[1] + s * 0.35, s);
        pxText(ctx, `CHOMP ${j.chew}/${CHEWS}`, MOUTH[0] + 52, MOUTH[1] - 36, 15, '#ffd43b');
      } else if (id === 'pipe') {
        const [x, y] = along(PIPE, j.t);
        ctx.fillStyle = '#1b1b1b'; ctx.fillRect(x - 12, y - 12, 24, 24); ctx.fillStyle = food.col; ctx.fillRect(x - 9, y - 9, 18, 18);
        ctx.fillStyle = '#9e1c1a'; ctx.fillRect(x - 10, y - 22, 20, 4); // the muscle squeezing behind it
      } else if (id === 'stomach') {
        ctx.fillStyle = mix(food.col, '#d9a441', j.churn * 0.6);
        for (let k = 0; k < 10; k++) {
          const a = time * (2 + j.churn * 6) + k * 0.63, rr = 12 + (k % 3) * 8;
          ctx.fillRect(STOM.x + Math.cos(a) * rr - 5, STOM.y + Math.sin(a) * rr * 0.6 - 5, 10, 10);
        }
        for (let k = 0; k < 4; k++) { ctx.fillStyle = '#c8f7a0'; const bx = STOM.x - 24 + k * 16, by = STOM.y + 18 - ((time * 30 + k * 13) % 36); ctx.fillRect(bx, by, 4, 4); } // acid bubbles
        j.germs.forEach((g, k) => {
          const gx = STOM.x - 26 + k * 26, gy = STOM.y - 2;
          if (!g.zap) emojiAt(ctx, '🦠', gx, gy + 8, 22);
          else if (g.zap < 0.8) pxText(ctx, 'ZAP!', gx, gy - 6 - g.zap * 30, 14, '#7cfc3a');
        });
        ctx.fillStyle = '#000'; ctx.fillRect(STOM.x - 50, STOM.y + 40, 100, 12); ctx.fillStyle = '#7cfc3a'; ctx.fillRect(STOM.x - 48, STOM.y + 42, 96 * j.churn, 8);
      } else if (id === 'small') {
        const [x, y] = along(SMALL, j.t);
        ctx.fillStyle = '#1b1b1b'; ctx.fillRect(x - 9, y - 9, 18, 18); ctx.fillStyle = soupC; ctx.fillRect(x - 7, y - 7, 14, 14);
        j.fibre.forEach(f => { if (f.state === 'out' || f.state === 'told') { ctx.fillStyle = '#1b1b1b'; ctx.fillRect(f.x - 8, f.y - 5, 16, 10); ctx.fillStyle = '#8a5a32'; ctx.fillRect(f.x - 6, f.y - 3, 12, 6); } });
        j.tokens.forEach(tk => {
          if (tk.state === 'out') {
            const by = Math.sin(time * 4 + tk.bob) * 3;
            ctx.fillStyle = 'rgba(255, 212, 59, 0.35)'; ctx.beginPath(); ctx.arc(tk.x, tk.y + by, 20, 0, Math.PI * 2); ctx.fill();
            emojiAt(ctx, GOOD[tk.g].icon, tk.x, tk.y + by + 9, 26);
          } else if (tk.state === 'fly') {
            const fx = tk.x + (520 - tk.x) * tk.fly, fy = tk.y + (330 - tk.y) * tk.fly;
            ctx.strokeStyle = '#e53935'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(tk.x, tk.y); ctx.lineTo(fx, fy); ctx.stroke();
            emojiAt(ctx, GOOD[tk.g].icon, fx, fy + 8, 22);
          }
        });
      } else if (id === 'large' || (id === 'out' && !j.flush)) {
        const [x, y] = id === 'large' ? along(LARGE, 0.55 + j.squeeze * 0.4) : [TOILET[0], 372 + j.pooY * 34];
        if (id === 'large') { ctx.fillStyle = '#1b1b1b'; ctx.fillRect(x - 10, y - 10, 20, 20); ctx.fillStyle = mix(soupC, '#6b4425', j.squeeze); ctx.fillRect(x - 8, y - 8, 16, 16); }
        else emojiAt(ctx, '💩', x, y + 12, 32);
        if (id === 'large') { ctx.fillStyle = '#000'; ctx.fillRect(180, 384, 100, 12); ctx.fillStyle = '#4f9cf0'; ctx.fillRect(182, 386, 96 * j.squeeze, 8); }
      }
      j.crumbs.forEach(c => { ctx.fillStyle = c.c; ctx.fillRect(c.x - 3, c.y - 3, 6, 6); });
      j.drops.forEach(d => emojiAt(ctx, '💧', d.x, d.y + 8, 20));
      if (id === 'out') {
        const spin = j.flush ? j.flush * 12 : 0;
        emojiAt(ctx, '🚽', TOILET[0], TOILET[1] + 14, 44);
        if (j.flush && j.flush < 1) emojiAt(ctx, '💩', TOILET[0], TOILET[1] + 4, 26 * (1 - j.flush), spin);
      }
      // the info panel: which part, its job, what to do, and the goodness the blood has carried off
      ctx.fillStyle = '#1b1b1b'; ctx.fillRect(374, 10, 258, H - 20); ctx.fillStyle = '#3d4f63'; ctx.fillRect(377, 13, 252, H - 26);
      emojiAt(ctx, food.emoji, 400, 46, 30);
      pxText(ctx, `${Math.min(si + 1, STATIONS.length)}. ${st().name}`, 422, 36, 18, '#ffd43b', 'left');
      let y = wrap(ctx, st().job, 390, 74, 228, 14, '#ffffff');
      y = wrap(ctx, '👉 ' + st().act, 390, y + 8, 228, 15, '#7cfc3a');
      pxText(ctx, 'Into the blood:', 390, 300, 14, '#ff8fb1', 'left');
      Object.keys(GOOD).forEach((g, k) => {
        emojiAt(ctx, GOOD[g].icon, 404, 334 + k * 30, 22);
        pxText(ctx, `${GOOD[g].name}: ${j.got[g] || 0}`, 422, 326 + k * 30, 14, '#fff', 'left');
      });
      if (id === 'large' || j.drops.length) pxText(ctx, '💧 water back to the body', 500, 280, 12, '#8fdcff');
    }

    // ---- controls ----
    const foodBtns = foods.map(f => h('button', { class: 'lab-chip', type: 'button', onclick() { if (busy) return; food = f; sfx.tap(); fresh(); } }, `${f.emoji} ${f.name}`));
    const strip = STATIONS.map(s => h('span', { class: 'lab-chip' }, s.name));
    const helpBtn = h('button', { class: 'btn green', type: 'button', onclick() { sfx.tap(); busy = true; helpMe(); sync(); } }, '');
    const againBtn = h('button', { class: 'btn ghost', type: 'button', onclick() { sfx.tap(); fresh(); } }, '↺ Start this food again');
    function sync() {
      const finishedTrip = j && j.recorded;
      foodBtns.forEach((b, k) => { b.classList.toggle('on', foods[k] === food); b.disabled = busy && !finishedTrip; });
      strip.forEach((b, k) => { b.classList.toggle('on', k === si); b.style.opacity = k < si ? 0.55 : 1; });
      helpBtn.textContent = st().help; helpBtn.hidden = !!finishedTrip;
    }
    fresh();
    say(`Pick a food and send it on its journey! ${STATIONS[0].name}: ${STATIONS[0].job}`);
    const stopLoop = gameLoop(cv, step);
    const root = h('div', { class: 'game arcade lab gut' },
      missions.box,
      h('div', { class: 'arc-screen' }, cv),
      h('div', { class: 'lab-controls' }, h('span', { class: 'lab-label' }, 'Journey:'), ...strip),
      h('div', { class: 'lab-controls' }, h('span', { class: 'lab-label' }, 'Food:'), ...foodBtns),
      h('div', { class: 'btn-row' }, againBtn, helpBtn),
      missions.ask, table.el);
    root._test = {
      frames(n) { for (let i = 0; i < n; i++) step(1 / 60); },
      pick(id) { food = foods.find(f => f.id === id); fresh(); },
      help() { busy = true; helpMe(); sync(); },
      trip() { for (let k = 0; k < 40 && !j.recorded; k++) { if (!j.flush) { busy = true; helpMe(); } for (let f = 0; f < 90; f++) step(1 / 60); } },
      play(need) { need.forEach(id => { this.pick(id); this.trip(); }); }, // do each food's whole journey
      get station() { return st().id; }, get busy() { return busy; }, get mission() { return missions.i; }, get did() { return [...did]; }, get got() { return Object.assign({}, j.got); },
    };
    root._stop = stopLoop;
    missions.next();
    return root;
  };

  // ===== Muscle Lab: an X-ray arm whose muscles pull in pairs =====
  // r.things: ids from THINGS (default all) · r.lock (default true: shows the 🔒 Lock the elbow switch) · r.caption
  // r.missions: [{ text, need: ['apple:bend', 'apple:straighten', 'bag:bend', 'locked'], yes, ask }]
  // Drag the hand to bend and straighten the arm at the elbow joint. The muscle doing the pulling contracts (gets
  // shorter and fatter, and glows); the other relaxes (longer and thinner). Heavy things move slower and need more
  // effort from the biceps. With the elbow locked, the arm can't bend at all.
  const THINGS = {
    apple: { name: 'Apple', emoji: '🍎', kg: 1 },
    books: { name: 'Books', emoji: '📚', kg: 3 },
    bag: { name: 'Heavy bag', emoji: '🎒', kg: 5 },
  };
  GAMES.muscles = function (r, key, done) {
    const W = 640, H = 400;
    const { cv, ctx } = arcadeCanvas(W, H);
    const things = (r.things || Object.keys(THINGS)).map(id => Object.assign({ id }, THINGS[id]));
    let thing = things[0], bend = 5, target = 5, vel = 0, locked = false, time = 0, did = new Set(), runN = 0;
    let wasDown = true, wasUp = false, active = null, signal = 0, lockTry = 0, shakeT = 0;
    const table = resultsTable(r.caption || '💪 Our muscle tests', ['Test', 'Holding', 'Move', 'Muscle that pulled', 'Effort']);
    const missions = missionRunner(r, key, done, () => { did = new Set(); });
    const S = [190, 92], EL = [190, 246], ARM = 150, MAXB = 145;
    const dir = b => { const a = b * Math.PI / 180; return [Math.sin(a), Math.cos(a)]; };
    const front = b => { const a = b * Math.PI / 180; return [Math.cos(a), -Math.sin(a)]; };
    const hand = () => { const d = dir(bend); return [EL[0] + d[0] * ARM, EL[1] + d[1] * ARM]; };
    const effort = () => Math.round(thing.kg * (0.4 + Math.sin(bend * Math.PI / 180)) * 10) / 10;

    function record(kind, move, muscle, eff) {
      runN++; did.add(kind === 'locked' ? 'locked' : `${thing.id}:${kind}`);
      table.add([runN, `${thing.emoji} ${thing.name}`, move, muscle, eff]);
      const m = missions.m, need = (m && m.need) || [], left = need.filter(n => !did.has(n));
      if (m && !left.length) missions.win(cv);
      else if (left.length) {
        const [tid, k] = left[0].split(':');
        say(tid === 'locked' ? 'Now lock the elbow and try to bend the arm.' : `Now ${k === 'bend' ? 'bend' : 'straighten'} the arm holding the ${THINGS[tid].name.toLowerCase()}.`);
      }
    }
    function step(dt) {
      time += dt;
      if (locked) { target = bend; }
      const rate = 260 / thing.kg + 40; // heavy things move slower
      const before = bend;
      bend += Math.max(-rate * dt, Math.min(rate * dt, target - bend));
      const v = dt ? (bend - before) / dt : 0;
      vel = vel * 0.8 + v * 0.2;
      const was = active;
      active = vel > 8 ? 'biceps' : vel < -8 ? 'triceps' : (bend > 20 ? 'hold' : null);
      if ((active === 'biceps' || active === 'triceps') && was !== active) signal = 0.01;
      if (signal) { signal += dt * 2.5; if (signal > 1) signal = 0; }
      shakeT = Math.max(0, shakeT - dt);
      // a whole lift or a whole straighten counts as a test
      if (bend <= 15) { if (wasUp) { wasUp = false; record('straighten', 'Straighten the arm ⬇', 'triceps (back)', '–'); } wasDown = true; }
      if (bend >= 110) { if (wasDown) { wasDown = false; record('bend', 'Bend the arm ⬆', 'biceps (front)', '💪'.repeat(Math.min(5, Math.max(1, Math.round(thing.kg))))); } wasUp = true; }
      draw();
    }

    // ---- fingers ----
    let finger = null;
    cv.addEventListener('pointerdown', e => {
      e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      const [x, y] = toGame(cv, W, H, e);
      finger = { x, y, sx: x, sy: y };
      aim(x, y);
    });
    cv.addEventListener('pointermove', e => { if (finger) { const [x, y] = toGame(cv, W, H, e); finger.x = x; finger.y = y; aim(x, y); } });
    const up = () => { finger = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    function aim(x, y) {
      const dx = x - EL[0], dy = y - EL[1];
      if (Math.hypot(dx, dy) < 20) return;
      let b = Math.atan2(dx, dy) * 180 / Math.PI; // 0 = hanging straight down, 90 = pointing forward
      if (b < -20) b = b < -100 ? MAXB : 0; // behind the arm: elbows don't bend backwards
      b = Math.max(0, Math.min(MAXB, b));
      if (locked) {
        if (Math.abs(b - bend) > 25) { shakeT = 0.4; lockTry++; if (lockTry === 1 || lockTry % 40 === 0) { sfx.bad && sfx.bad(); say('The elbow joint is locked, so the arm can\'t bend! Bones can only bend where there is a working joint.'); } if (lockTry === 1) record('locked', 'Tried to bend a locked elbow', 'none: it can\'t move', '–'); }
        return;
      }
      target = b;
    }

    // ---- drawing ----
    function muscle(a, b, thick, color, label, side) {
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, len = Math.hypot(b[0] - a[0], b[1] - a[1]), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      ctx.strokeStyle = '#f5e6c8'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); // the tendons at each end
      ctx.save(); ctx.translate(mx, my); ctx.rotate(ang);
      ctx.fillStyle = '#1b1b1b'; ctx.beginPath(); ctx.ellipse(0, 0, Math.max(10, len / 2 - 10) + 3, thick / 2 + 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, 0, Math.max(10, len / 2 - 10), thick / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-len / 4, -thick / 4, len / 2, 3);
      ctx.restore();
      pxText(ctx, label, mx + side * (thick / 2 + 44), my, 14, '#fff');
    }
    function draw() {
      ctx.fillStyle = '#2b3a4a'; ctx.fillRect(0, 0, W, H);
      const jig = shakeT ? Math.sin(time * 80) * 3 : 0;
      const d = dir(bend), n = front(bend), Hd = hand();
      // the brain sends the message
      emojiAt(ctx, '🧠', 60, 56, 34);
      ctx.setLineDash([4, 4]); ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(78, 44); ctx.lineTo(S[0], S[1] - 20); ctx.stroke(); ctx.setLineDash([]);
      // the arm's skin (x-ray see-through)
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(242, 195, 155, 0.28)'; ctx.lineWidth = 78;
      ctx.beginPath(); ctx.moveTo(S[0], S[1] - 10); ctx.lineTo(EL[0], EL[1]); ctx.lineTo(Hd[0] + jig, Hd[1]); ctx.stroke();
      // bones
      const bone = (a, b, w) => { ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = w + 6; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.strokeStyle = '#f4f1e6'; ctx.lineWidth = w; ctx.stroke(); };
      bone([S[0], S[1]], EL, 16);
      bone(EL, [Hd[0] + jig, Hd[1]], 12);
      ctx.fillStyle = '#1b1b1b'; ctx.beginPath(); ctx.arc(S[0], S[1], 17, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#f4f1e6'; ctx.beginPath(); ctx.arc(S[0], S[1], 14, 0, Math.PI * 2); ctx.fill();
      // muscles: the biceps (front) runs from the shoulder to just past the elbow; the triceps (back) to the elbow's point
      const bIns = [EL[0] + d[0] * 30 + n[0] * 9 + jig, EL[1] + d[1] * 30 + n[1] * 9];
      const bOrg = [S[0] + 16, S[1] + 14], tOrg = [S[0] - 16, S[1] + 14];
      const tIns = [EL[0] - d[0] * 14 - n[0] * 11, EL[1] - d[1] * 14 - n[1] * 11];
      const bLen = Math.hypot(bIns[0] - bOrg[0], bIns[1] - bOrg[1]), tLen = Math.hypot(tIns[0] - tOrg[0], tIns[1] - tOrg[1]);
      const bThick = Math.max(12, Math.min(44, 12 + (180 - bLen) * 0.26)), tThick = Math.max(10, Math.min(30, 10 + (175 - tLen) * 0.4));
      const bOn = active === 'biceps' || active === 'hold', tOn = active === 'triceps';
      muscle(bOrg, bIns, bThick, bOn ? '#ff4d4d' : '#b84a4a', 'biceps', 1);
      muscle(tOrg, tIns, tThick, tOn ? '#ff4d4d' : '#b84a4a', 'triceps', -1);
      // the elbow joint
      ctx.fillStyle = '#1b1b1b'; ctx.beginPath(); ctx.arc(EL[0], EL[1], 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = locked ? '#9aa3ad' : '#ffd43b'; ctx.beginPath(); ctx.arc(EL[0], EL[1], 10, 0, Math.PI * 2); ctx.fill();
      if (locked) emojiAt(ctx, '🔒', EL[0] - 34, EL[1] + 10, 24);
      pxText(ctx, 'elbow joint', EL[0] - 70, EL[1] + 26, 13, '#ffd43b');
      // the hand and what it holds
      ctx.fillStyle = '#1b1b1b'; ctx.fillRect(Hd[0] + jig - 13, Hd[1] - 13, 26, 26); ctx.fillStyle = '#f2c39b'; ctx.fillRect(Hd[0] + jig - 10, Hd[1] - 10, 20, 20);
      emojiAt(ctx, thing.emoji, Hd[0] + jig + n[0] * 26, Hd[1] + n[1] * 26 + 12, 34);
      if (!finger && bend < 10 && !runN) pxText(ctx, 'drag the hand up ⬆', Hd[0] + 80, Hd[1], 15, '#ffd43b');
      // the message from the brain racing to the muscle that pulls
      if (signal && active && active !== 'hold') {
        const to = active === 'biceps' ? bOrg : tOrg, from = [78, 44];
        const p = [from[0] + (to[0] - from[0]) * signal, from[1] + (to[1] - from[1]) * signal];
        emojiAt(ctx, '⚡', p[0], p[1] + 8, 20);
      }
      // the panel
      ctx.fillStyle = '#1b1b1b'; ctx.fillRect(394, 10, 238, H - 20); ctx.fillStyle = '#3d4f63'; ctx.fillRect(397, 13, 232, H - 26);
      const row = (y, name, on, side) => {
        pxText(ctx, name, 412, y, 17, on ? '#ff8f8f' : '#ffffff', 'left');
        wrap(ctx, side, 412, y + 21, 210, 12, '#c9d3dd');
        wrap(ctx, on ? 'CONTRACTS: shorter and fatter, pulling!' : 'relaxes: longer and thinner', 412, y + 41, 210, 12, on ? '#7cfc3a' : '#c9d3dd');
      };
      row(40, 'Biceps', bOn, 'front of the upper arm');
      row(118, 'Triceps', tOn, 'back of the upper arm');
      pxText(ctx, `Holding: ${thing.name}`, 412, 206, 14, '#ffd43b', 'left');
      pxText(ctx, 'Biceps effort:', 412, 232, 13, '#fff', 'left');
      const ef = bend > 8 ? effort() / 6.5 : 0;
      ctx.fillStyle = '#000'; ctx.fillRect(412, 246, 200, 16); ctx.fillStyle = ef > 0.66 ? '#ff4d4d' : ef > 0.33 ? '#ffb800' : '#7cfc3a'; ctx.fillRect(414, 248, 196 * Math.min(1, ef), 12);
      pxText(ctx, `Elbow bend: ${Math.round(bend)}°`, 412, 286, 13, '#fff', 'left');
      pxText(ctx, locked ? '🔒 Elbow joint LOCKED' : 'Elbow joint: free to bend', 412, 312, 13, locked ? '#ff8f8f' : '#7cfc3a', 'left');
      wrap(ctx, 'Muscles can only PULL, so they work in pairs!', 412, 348, 205, 13, '#ffd43b');
    }

    // ---- controls ----
    const thingBtns = things.map(t => h('button', { class: 'lab-chip', type: 'button', onclick() { thing = t; sfx.tap(); sync(); } }, `${t.emoji} ${t.name}`));
    const lockBtn = h('button', { class: 'lab-chip', type: 'button', onclick() { locked = !locked; lockTry = 0; sfx.tap(); if (!locked) target = bend; say(locked ? 'Elbow locked! Now try to bend the arm.' : 'Elbow unlocked – it can bend again.'); sync(); } }, '');
    const helpBtn = h('button', { class: 'btn green', type: 'button', onclick() { sfx.tap(); if (locked) { aim(EL[0] + 150, EL[1]); return; } target = bend < 60 ? MAXB - 5 : 0; } }, '💪 Move it for me');
    function sync() {
      thingBtns.forEach((b, k) => b.classList.toggle('on', things[k] === thing));
      lockBtn.textContent = locked ? '🔓 Unlock the elbow' : '🔒 Lock the elbow';
      lockBtn.classList.toggle('on', locked);
    }
    sync();
    say('Drag the hand to bend and straighten the arm. Watch the two muscles!');
    const stopLoop = gameLoop(cv, step);
    const root = h('div', { class: 'game arcade lab muscles' },
      missions.box,
      h('div', { class: 'arc-screen' }, cv),
      h('div', { class: 'lab-controls' }, h('span', { class: 'lab-label' }, 'Hold:'), ...thingBtns, r.lock !== false && lockBtn),
      h('div', { class: 'btn-row' }, helpBtn),
      missions.ask, table.el);
    root._test = {
      frames(n) { for (let i = 0; i < n; i++) step(1 / 60); },
      pick(id) { thing = things.find(t => t.id === id); sync(); },
      lock(on) { locked = on; lockTry = 0; target = bend; sync(); },
      lift() { if (locked) aim(EL[0] + 150, EL[1]); else target = MAXB - 5; for (let i = 0; i < 300; i++) step(1 / 60); },
      lower() { target = 0; for (let i = 0; i < 300; i++) step(1 / 60); },
      play(need) { // do each test a mission needs: 'apple:bend', 'bag:straighten', 'locked'
        need.forEach(n => {
          const [id, kind] = n.split(':');
          if (id === 'locked') { this.lower(); this.lock(true); this.lift(); this.lock(false); return; }
          this.pick(id);
          if (kind === 'bend') { this.lower(); this.lift(); } else { this.lift(); this.lower(); }
        });
      },
      get bend() { return bend; }, get mission() { return missions.i; }, get did() { return [...did]; },
    };
    root._stop = stopLoop;
    missions.next();
    return root;
  };
});
