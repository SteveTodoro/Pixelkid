/* Pixelkid lesson engine – Around the World games: Map Explorer, Chef and Say it! (the map needs shared/world-map.js + shared/world.js).
 * One part of shared/engine.js, which loads it only when a lesson uses it. E is the engine's shared helpers
 * (E.state and E.stageCard are live). See the top of shared/engine.js for how the parts fit together.
 */
PixelkidEngine.part('world', E => {
  'use strict';
  const { GAMES, arcadeCanvas, award, confetti, draggable, emojiAt, esc, fmt, gameLoop, h, heroImg, pic, pick,
    praise, put, pxText, questionWidget, runQuestions, say, sfx, shake, shuffle, speak, toGame } = E;

  // ===== Map Explorer: find places on the pixel world map (needs shared/world-map.js + shared/world.js) =====
  // r.view: world | europe | asia | eastasia | uk | ukfrance | japan | home | thailand | usa (see World.VIEWS)
  // r.colour: 'continents' (default) or 'countries' · r.colours: { ENG: '#e8584e', … } gives places their own colour · r.labels: places labelled from the start · r.equator: true draws the equator
  // r.compass: true shows a compass rose · r.home: false hides the 🏠 home pin
  // r.tasks: { find: target, ask, yes, hint } – tap the place
  //          { place: target, pin: '🇯🇵', ask, yes, hint } – drag the pin onto the place
  //          { fly: target, hours, ask, yes, hint } – drag the ✈️ from home to the place and see how far it is
  //   target = a continent ('asia'), an ocean ('pacific'), a map unit ('JPN', 'ENG'), 'GBR', or an array of them.
  //   Any task can add from: 'ENG', dir: 'S' (draws a compass arrow from a place), then: [questions] (asked after it)
  //   and zoom: [lon, lat, 2] (starts zoomed in there).
  // The map fills the screen width; children can zoom with ➕ / ➖ or a pinch, and drag to look around.
  GAMES.worldmap = function (r, key, done) {
    const WD = window.World;
    if (!WD) return h('p', null, 'This game needs shared/world-map.js and shared/world.js.');
    const tasks = r.tasks || [];
    const view = r.view || 'world';
    const showHome = r.home !== false;
    const homeLL = WD.capitalOf(WD.HOME);
    const lit = []; // countries found so far get painted gold
    let base = null, flashMap = null, flashUntil = 0, time = 0;
    const SIZE = { width: 960, maxHeight: 720 }; // drawn sharp, then shown as big as the screen allows
    function repaint() {
      const own = r.colours || {};
      base = WD.render(view, Object.assign({ colour: r.colour, paint: v => (lit.some(t => WD.matches(v, t)) ? (v < 10 ? '#7fd0ff' : '#ffd43b') : (v >= 10 && own[WD.info(v).id]) || null) }, SIZE));
    }
    repaint();
    const W = base.W, H = base.H;
    const { cv, ctx } = arcadeCanvas(W, H);
    const dpr = cv.width / W;
    const labels = (r.labels || []).slice();
    let ti = -1, task = null, misses = 0, finished = false, locked = false;
    let pin = null; // the draggable pin / plane: { emoji, size, home() → [x, y], x, y, placed }
    let flight = null; // { from, to, t }
    let marks = []; // little name tags where the child tapped: { x, y, text, t, bad }
    let trail = []; // finished flight paths
    // zoom: z = how much bigger, (ox, oy) = the map point at the top-left of the screen
    let z = 1, ox = 0, oy = 0;
    const kpx = () => W / (cv.clientWidth || W); // canvas pixels per screen pixel
    const u = n => n * kpx() / z; // n screen pixels, in map units (so labels and pins stay the same size on any screen and zoom)
    const clampView = () => { ox = Math.max(0, Math.min(W - W / z, ox)); oy = Math.max(0, Math.min(H - H / z, oy)); };
    const zoomTo = (nz, sx = W / 2, sy = H / 2) => {
      const mx = sx / z + ox, my = sy / z + oy;
      z = Math.max(1, Math.min(4, nz)); ox = mx - sx / z; oy = my - sy / z; clampView(); paintZoom();
    };
    const zoomLbl = h('span', { class: 'map-zoom-lbl' });
    const paintZoom = () => { zoomLbl.textContent = z > 1.01 ? `🔍 ×${z.toFixed(1)}` : '🔍 ×1'; };
    const zbtn = (label, aria, fn) => h('button', { class: 'btn ghost map-zoom', type: 'button', 'aria-label': aria, onclick() { sfx.tap(); fn(); } }, label);
    const zoomBar = h('div', { class: 'map-zoom-bar' },
      zbtn('➖', 'Zoom out', () => zoomTo(z / 1.5)), zoomLbl, zbtn('➕', 'Zoom in', () => zoomTo(z * 1.5)), zbtn('⟲', 'Show the whole map', () => zoomTo(1)),
      h('span', { class: 'map-zoom-tip' }, 'Pinch or ➕ to zoom · drag to move'));
    paintZoom();
    const banner = h('div', { class: 'lab-mission' });
    const fb = h('div', { class: 'feedback', hidden: true });
    const askBox = h('div', { class: 'lab-ask' });
    const nextBtn = h('button', { class: 'btn big ready', type: 'button', hidden: true, onclick() { sfx.tap(); next(); } }, 'Next ▶');
    const targetOf = t => t.find || t.place || t.fly;
    const inView = ([x, y]) => x >= 0 && y >= 0 && x <= W && y <= H;

    function next() {
      ti++; misses = 0; locked = false; nextBtn.hidden = true; fb.hidden = true; put(askBox); flight = null; flashMap = null;
      if (ti >= tasks.length) {
        task = null; pin = null; finished = true;
        put(banner, h('span', { class: 'lab-mission-tag' }, 'EXPLORE'), ' 🔍 Map complete! Tap anywhere on the map to see what is there.');
        done(); return;
      }
      task = tasks[ti];
      put(banner, h('span', { class: 'lab-mission-tag' }, `${task.fly ? '✈️' : task.place ? '📍' : '👆'} ${ti + 1}/${tasks.length}`), ' ',
        h('span', { html: fmt(task.ask || (task.fly ? `Fly the plane from home to ${WD.nameOf(task.fly)}!` : task.place ? `Drag the pin onto ${WD.nameOf(task.place)}!` : `Tap ${WD.nameOf(task.find)}!`), false) }));
      // task.zoom: [lon, lat, zoom] – starts the task zoomed in on that spot (handy for small countries)
      if (task.zoom) { const [mx, my] = base.toXY(task.zoom); z = Math.max(1, Math.min(4, task.zoom[2] || 2)); ox = mx - W / (2 * z); oy = my - H / (2 * z); clampView(); paintZoom(); }
      // the pin waits in the bottom-right corner of the screen; the plane waits at home
      if (task.place) pin = { emoji: task.pin || '📍', size: 44, home: () => [ox + (W - 42 * kpx()) / z, oy + (H - 14 * kpx()) / z] };
      else if (task.fly) pin = { emoji: '✈️', size: 38, plane: true, home: () => { const [hx, hy] = base.toXY(homeLL); return [hx, hy - u(4)]; } };
      else pin = null;
      if (ti > 0) say(task.say || (task.fly ? 'Drag the plane ✈️ from your home 🏠 to the right place!' : task.place ? 'Drag the pin onto the map!' : 'Tap the right place on the map!'));
    }

    function check(x, y) {
      const t = targetOf(task), v = base.at(x, y);
      // a little help for small islands: near enough (on the sea) still counts, and pins/planes are forgiving
      return WD.matches(v, t) || base.near(x, y, v < 10 ? u(24) : u(task.find ? 6 : 14), t);
    }
    function right(x, y) {
      const t = targetOf(task), name = WD.nameOf(t);
      locked = true;
      if (misses === 0) award(`${key}:${ti}`, cv);
      sfx.good(); confetti(30);
      const t0 = Array.isArray(t) ? t[0] : t;
      if (!WD.CONTINENTS[t0] && !WD.OCEANS[t0]) { lit.push(t); repaint(); } // countries turn gold; continents and oceans just get a label
      if (!labels.includes(t)) labels.push(t);
      flashMap = null;
      say(task.yes || `Yes! That's ${name}! ${praise()}`);
      const finish = () => {
        if (task.then && task.then.length) runQuestions(askBox, task.then, { key: `${key}:q${ti}`, lastLabel: 'Done ✔', done: () => { put(askBox); showNext(); } });
        else showNext();
      };
      if (task.fly) {
        const to = base.toXY(WD.capitalOf(Array.isArray(t) ? t[0] : t)), hm = base.toXY(homeLL), from = [hm[0], hm[1]];
        flight = { from, to, t: 0, onLand() {
          const km = WD.distanceKm(homeLL, WD.capitalOf(Array.isArray(t) ? t[0] : t)), hrs = task.hours || WD.flightHours(km);
          trail.push({ from, to });
          fb.className = 'feedback good'; fb.hidden = false;
          fb.innerHTML = `✈️ Home 🏠 → ${esc(name)}: about <b>${(Math.round(km / 100) * 100).toLocaleString('en-GB')} km</b> – that's about <b>${hrs} hours</b> on a plane!`;
          finish();
        } };
        pin = null; sfx.launch();
      } else {
        if (pin) { pin.x = x; pin.y = y; pin.placed = true; }
        finish();
      }
    }
    function showNext() { nextBtn.textContent = ti < tasks.length - 1 ? 'Next ▶' : 'Finish map ✔'; nextBtn.hidden = false; }
    function wrong(x, y) {
      const v = base.at(x, y), it = v < 0 ? null : WD.info(v);
      misses++; sfx.bad();
      const what = !it ? '' : it.kind === 'land' ? `That's ${it.name}. ` : it.kind === 'ocean' ? `That's the ${it.name}. ` : 'That\'s the sea. ';
      if (it) marks.push({ x, y, text: it.kind === 'land' ? it.name : it.kind === 'ocean' ? it.name : 'sea', t: 1.6, bad: true });
      const hint = task.hint || 'Look again carefully!';
      say('💡 ' + what + hint);
      fb.className = 'feedback try'; fb.hidden = false;
      fb.innerHTML = '💡 ' + esc(what + hint) + (misses >= 2 ? ' Look for the flashing place!' : '');
      if (misses >= 2) {
        const t = targetOf(task);
        flashMap = WD.render(view, Object.assign({ mask: vv => (WD.matches(vv, t) ? '#ffffff' : null) }, SIZE));
        flashUntil = time + 4;
      }
    }
    function tapAt(x, y) {
      if (finished) {
        const v = base.at(x, y);
        if (v >= 0) { const it = WD.info(v); marks.push({ x, y, text: it.kind === 'water' ? 'sea' : it.name, t: 2.2 }); sfx.tap(); }
        return;
      }
      if (!task || locked) return;
      if (pin && !pin.placed) { say(task.fly ? 'Grab the plane ✈️ at your home 🏠 and drag it!' : 'Grab the pin in the corner and drag it onto the map!'); return; }
      if (check(x, y)) right(x, y); else wrong(x, y);
    }

    // ---------- pointer: tap places, drag the pin / plane, drag to pan, pinch to zoom ----------
    const pts = new Map();
    let gest = null; // { mode: 'pin' | 'pan' | 'pinch', sx, sy, moved }
    const scr = e => toGame(cv, W, H, e); // screen position in canvas pixels
    const toMap = ([sx, sy]) => [sx / z + ox, sy / z + oy];
    cv.addEventListener('pointerdown', e => {
      e.preventDefault();
      try { cv.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      pts.set(e.pointerId, scr(e));
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        if (gest && gest.mode === 'pin' && pin) { const hm = pin.home(); pin.x = hm[0]; pin.y = hm[1]; }
        gest = { mode: 'pinch', d0: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, z0: z, mid: toMap([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]) };
        return;
      }
      if (pts.size > 2) return;
      const s = scr(e), [mx, my] = toMap(s);
      if (!finished && task && !locked && pin && !pin.placed) {
        const [px, py] = pin.home();
        if (Math.hypot(mx - px, my - (py - u(pin.size / 2))) < u(50)) { gest = { mode: 'pin' }; sfx.tap(); return; }
      }
      gest = { mode: 'pan', sx: s[0], sy: s[1], ox, oy, moved: false };
    });
    cv.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, scr(e));
      if (!gest) return;
      if (gest.mode === 'pinch' && pts.size >= 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]), mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        z = Math.max(1, Math.min(4, gest.z0 * d / gest.d0)); ox = gest.mid[0] - mid[0] / z; oy = gest.mid[1] - mid[1] / z; clampView(); paintZoom();
      } else if (gest.mode === 'pin') {
        const [mx, my] = toMap(scr(e)); pin.x = mx; pin.y = my + u(pin.size / 3); pin.dragging = true;
      } else if (gest.mode === 'pan') {
        const [sx, sy] = scr(e), dx = sx - gest.sx, dy = sy - gest.sy;
        if (!gest.moved && Math.hypot(dx, dy) > 12 * kpx()) gest.moved = true;
        if (gest.moved && z > 1) { ox = gest.ox - dx / z; oy = gest.oy - dy / z; clampView(); }
      }
    });
    const up = e => {
      if (!pts.has(e.pointerId)) return;
      const s = scr(e);
      pts.delete(e.pointerId);
      if (!gest) return;
      if (gest.mode === 'pinch') { if (!pts.size) gest = null; return; }
      const g = gest; gest = null;
      if (g.mode === 'pin') {
        pin.dragging = false;
        const hm = pin.home();
        if (e.type !== 'pointerup' || !task || locked) { pin.x = hm[0]; pin.y = hm[1]; return; }
        const [x, y] = toMap(s);
        if (check(x, y)) right(x, y); else { wrong(x, y); pin.x = hm[0]; pin.y = hm[1]; }
      } else if (g.mode === 'pan' && !g.moved && e.type === 'pointerup') { const [x, y] = toMap(s); tapAt(x, y); }
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);

    // ---------- drawing (in map units, through the zoom) ----------
    function arrow(from, dir) {
      const [x, y] = base.toXY(WD.labelAt(from));
      const d = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0], NE: [0.7, -0.7], NW: [-0.7, -0.7], SE: [0.7, 0.7], SW: [-0.7, 0.7] }[dir] || [0, 1];
      const L = Math.min(W, H) * 0.22, ex = x + d[0] * L, ey = y + d[1] * L, a = Math.atan2(d[1], d[0]), hd = u(18);
      ctx.save(); ctx.lineCap = 'square';
      ctx.strokeStyle = '#000'; ctx.lineWidth = u(11); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = u(6); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = '#ffd43b'; ctx.strokeStyle = '#000'; ctx.lineWidth = u(3);
      ctx.beginPath(); ctx.moveTo(ex + Math.cos(a) * hd, ey + Math.sin(a) * hd);
      ctx.lineTo(ex + Math.cos(a + 2.4) * hd, ey + Math.sin(a + 2.4) * hd); ctx.lineTo(ex + Math.cos(a - 2.4) * hd, ey + Math.sin(a - 2.4) * hd);
      ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      pxText(ctx, dir, ex + Math.cos(a) * u(34), ey + Math.sin(a) * u(34), u(20), '#ffd43b');
    }
    function compass() { // fixed in the bottom-left corner of the screen
      const k = kpx(), R = 36 * k, x = R + 12 * k, y = H - R - 18 * k;
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e53935'; ctx.beginPath(); ctx.moveTo(x, y - R * 0.72); ctx.lineTo(x - R * 0.2, y); ctx.lineTo(x + R * 0.2, y); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x, y + R * 0.72); ctx.lineTo(x - R * 0.2, y); ctx.lineTo(x + R * 0.2, y); ctx.fill();
      pxText(ctx, 'N', x, y - R - 9 * k, 16 * k, '#ffd43b'); pxText(ctx, 'S', x, y + R + 9 * k, 14 * k); pxText(ctx, 'E', x + R + 10 * k, y, 14 * k); pxText(ctx, 'W', x - R - 10 * k, y, 14 * k);
    }
    function step(dt) {
      time += dt;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.setTransform(dpr * z, 0, 0, dpr * z, -ox * z * dpr, -oy * z * dpr);
      ctx.drawImage(base.canvas, 0, 0, W, H);
      if (flashMap && time < flashUntil) { ctx.globalAlpha = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(time * 9)); ctx.drawImage(flashMap.canvas, 0, 0, W, H); ctx.globalAlpha = 1; }
      if (r.equator) {
        const y = base.toXY([0, 0])[1];
        if (y > 0 && y < H) {
          ctx.fillStyle = '#e53935'; for (let x = 0; x < W; x += u(16)) ctx.fillRect(x, y - u(2), u(9), u(4));
          pxText(ctx, 'EQUATOR', ox + W / z - u(62), y - u(14), u(15), '#ffd4d4');
        }
      }
      trail.forEach(({ from, to }) => { ctx.fillStyle = '#fff'; for (let k = 0; k <= 1; k += 0.04) ctx.fillRect(from[0] + (to[0] - from[0]) * k - u(2), from[1] + (to[1] - from[1]) * k - u(2), u(4), u(4)); });
      labels.forEach(t => { const p = base.toXY(WD.labelAt(t)); if (inView(p)) pxText(ctx, WD.nameOf(t).replace(/^the /, ''), p[0], p[1], u(17), '#fff'); });
      if (task && task.from) arrow(task.from, task.dir);
      if (showHome) {
        const p = base.toXY(homeLL);
        if (inView(p)) {
          const bob = Math.sin(time * 3) * u(2);
          ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.arc(p[0], p[1], u(10) + u(5) * (0.5 + 0.5 * Math.sin(time * 4)), 0, Math.PI * 2); ctx.fill();
          emojiAt(ctx, '🏠', p[0], p[1] - u(2) + bob, u(28));
          pxText(ctx, 'HOME', p[0], p[1] + u(13), u(12), '#ffd43b');
        }
      }
      if (flight) {
        flight.t = Math.min(1, flight.t + dt / 1.6);
        const { from, to } = flight, k = flight.t;
        ctx.fillStyle = '#fff'; for (let q = 0; q <= k; q += 0.04) ctx.fillRect(from[0] + (to[0] - from[0]) * q - u(2), from[1] + (to[1] - from[1]) * q - u(2), u(4), u(4));
        const x = from[0] + (to[0] - from[0]) * k, y = from[1] + (to[1] - from[1]) * k - Math.sin(k * Math.PI) * u(32);
        emojiAt(ctx, '✈️', x, y + u(12), u(36), Math.atan2(to[1] - from[1], to[0] - from[0]) + Math.PI / 4);
        if (k >= 1) { const f = flight; flight = null; sfx.ding(); f.onLand(); }
      }
      if (pin) {
        if (!pin.dragging && !pin.placed) { const hm = pin.home(); pin.x = hm[0]; pin.y = hm[1]; }
        if (!pin.placed && !pin.dragging && task && task.place) {
          ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(pin.x - u(32), pin.y - u(54), u(64), u(60)); pxText(ctx, 'DRAG', pin.x, pin.y - u(60), u(12), '#ffd43b');
        }
        emojiAt(ctx, pin.emoji, pin.x, pin.y + (pin.dragging || pin.placed ? 0 : Math.sin(time * 5) * u(3)), u(pin.size));
      }
      marks = marks.filter(m => (m.t -= dt) > 0);
      marks.forEach(m => {
        ctx.fillStyle = m.bad ? '#e53935' : '#ffd43b'; ctx.fillRect(m.x - u(4), m.y - u(4), u(8), u(8));
        pxText(ctx, m.text, Math.max(ox + u(60), Math.min(ox + W / z - u(60), m.x)), m.y - u(18), u(16), m.bad ? '#ffd4d4' : '#fff');
      });
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (r.compass) compass();
    }
    const stopLoop = gameLoop(cv, step);
    // fill the width, but keep tall maps (like the UK) to about three quarters of the screen height
    const screen = h('div', { class: 'arc-screen', style: `max-width:min(100%, calc(${(W / H).toFixed(3)} * 74vh))` }, cv);
    const root = h('div', { class: 'game arcade worldmap' }, banner, screen, zoomBar, fb, askBox, h('div', { class: 'btn-row' }, nextBtn));
    root._test = {
      frames(n) { for (let i = 0; i < n; i++) step(1 / 60); },
      // tap (or drop the pin / plane) at a [lon, lat] or at the task's target
      tap(ll) { const [x, y] = base.toXY(ll || WD.labelAt(targetOf(task))); if (check(x, y)) right(x, y); else wrong(x, y); },
      zoom: n => zoomTo(n),
      next: () => nextBtn.click(),
      get task() { return ti; }, get finished() { return finished; }, get flying() { return !!flight; }, get misses() { return misses; }, get z() { return z; },
    };
    root._stop = stopLoop;
    next();
    return root;
  };

  // ===== Chef: make dishes from around the world – add the ingredients in order, then roll, slice, pour, stir or squeeze =====
  // r.recipes: [{ name, emoji (the finished dish – an emoji or a Pixel.svg picture), customer: '🧒', fact,
  //   steps: [{ add: 'rice', label: 'sushi rice', emoji: '🍚' } | { do: 'roll' | 'slice' | 'pour' | 'stir' | 'squeeze', label, emoji, makes }] }]
  //   `makes` (optional) changes what is on the board after an action, e.g. a rolled-up maki.
  // r.pantry: extra ingredients that are not needed: [{ add: 'chocolate', label, emoji, why }]
  // r.memory: true hides the recipe card (a 💡 Peek button shows it for a moment) · r.yum: what happy customers say ('Oishii!')
  // r.par: seconds – a stopwatch runs, and finishing every order faster than this earns a bonus gem
  GAMES.cook = function (r, key, done) {
    const recipes = r.recipes;
    const ACT = {
      roll: { hint: '👉 Swipe across the mat to ROLL it!', icon: '🌀' },
      slice: { hint: '🔪 Tap the board 3 times to SLICE it!', icon: '🔪' },
      pour: { hint: '👇 Press and HOLD to POUR!', icon: '🫗' },
      squeeze: { hint: '✊ Press and HOLD to SQUEEZE it into shape!', icon: '✊' },
      stir: { hint: '🥄 Draw circles on the pan to STIR!', icon: '🥄' },
    };
    // every ingredient used by any recipe, plus decoys
    const pantry = new Map();
    recipes.forEach(rc => rc.steps.forEach(st => { if (st.add && !pantry.has(st.add)) pantry.set(st.add, { add: st.add, label: st.label || st.add, emoji: st.emoji }); }));
    (r.pantry || []).forEach(p => pantry.set(p.add, p));
    let ri = -1, si = 0, rc = null, slips = 0, busy = false, peekT = 0, startT = 0, finished = false;
    let actAmt = 0; // progress through the current action (0–1)
    const ticket = h('div', { class: 'cook-ticket' });
    const card = h('div', { class: 'cook-card' });
    const board = h('div', { class: 'cook-board', 'data-drop': 'board', role: 'button', 'aria-label': 'The chopping board' });
    const meter = h('div', { class: 'cook-meter', hidden: true }, h('div'));
    const actTip = h('div', { class: 'cook-tip', hidden: true });
    const fb = h('div', { class: 'feedback', hidden: true });
    const clock = h('span', { class: 'cook-clock', hidden: !r.par });
    const nextBtn = h('button', { class: 'btn big ready', type: 'button', hidden: true, onclick() { sfx.tap(); nextOrder(); } }, 'Next order ▶');
    const serveBtn = h('button', { class: 'btn big gold', type: 'button', hidden: true, onclick: serve }, '🛎️ Serve it!');
    const peekBtn = r.memory && h('button', { class: 'btn ghost', type: 'button', onclick() { sfx.tap(); peekT = 3; drawCard(); setTimeout(() => { peekT = 0; drawCard(); }, 3000); } }, '💡 Peek at the recipe');
    const step = () => rc && rc.steps[si];
    const picOf = (p, cls) => pic(p, cls) || h('span');

    function drawCard() {
      if (!rc) return;
      const hide = r.memory && !peekT;
      put(card, h('h3', null, '📜 ' + rc.name),
        hide ? h('p', { class: 'cook-memory' }, '🧠 Cook it from memory!')
          : h('ol', null, rc.steps.map((st, k) => h('li', { class: k < si ? 'done' : k === si ? 'now' : '' },
            st.add ? `${st.emoji && !String(st.emoji).startsWith('<') ? st.emoji + ' ' : ''}Add the ${st.label || st.add}` : `${ACT[st.do].icon} ${st.label || st.do}`))));
    }
    function addLayer(content, cls = '') {
      const k = board.querySelectorAll('.cook-layer').length;
      const el = picOf(content, 'cook-layer ' + cls);
      el.classList.add('cook-layer');
      el.style.setProperty('--k', k);
      el.style.setProperty('--dx', ((k * 37) % 5 - 2) * 4 + 'px');
      board.append(el);
    }
    function setBoard(content) { board.querySelectorAll('.cook-layer').forEach(e => e.remove()); addLayer(content, 'made'); }
    function nextOrder() {
      ri++; si = 0; slips = 0; busy = false; fb.hidden = true; nextBtn.hidden = true; serveBtn.hidden = true;
      if (ri >= recipes.length) return finish();
      rc = recipes[ri];
      board.querySelectorAll('.cook-layer').forEach(e => e.remove());
      put(ticket, h('span', { class: 'cook-cust' }, rc.customer || pick(['🧒', '👧', '👦', '👵', '👴', '🧑'])),
        h('div', { class: 'cook-order' }, h('span', { class: 'lab-mission-tag' }, `ORDER ${ri + 1}/${recipes.length}`), ' ', rc.order || `One ${rc.name}, please!`));
      drawCard(); prepAction();
      if (ri === 0) startT = performance.now();
      if (ri > 0) say(rc.say || (r.memory ? `New order: ${rc.name}! Can you remember the recipe?` : `New order: ${rc.name}! Follow the recipe card.`));
    }
    function prepAction() {
      const st = step();
      actAmt = 0; meter.hidden = true; meter.firstChild.style.width = '0%';
      board.classList.remove('act', 'act-roll', 'act-slice', 'act-pour', 'act-squeeze', 'act-stir');
      if (st && st.do) {
        board.classList.add('act', 'act-' + st.do);
        actTip.textContent = st.tip || ACT[st.do].hint; actTip.hidden = false;
        if (st.do !== 'roll') meter.hidden = false;
        say(st.tip || ACT[st.do].hint);
      } else actTip.hidden = true;
      drawCard();
    }
    function advance() {
      si++;
      if (si >= rc.steps.length) {
        board.classList.remove('act'); actTip.hidden = true; meter.hidden = true;
        setBoard(rc.emoji); board.classList.add('ready');
        serveBtn.hidden = false; drawCard();
        say(`${rc.name} is ready! Serve it! 🛎️`);
        return;
      }
      prepAction();
    }
    function slip(msg) { slips++; sfx.bad(); shake(board); say('💡 ' + msg); }
    // an ingredient was dropped on the board (or tapped)
    function addItem(it, chip) {
      if (busy || !rc) return;
      const st = step();
      if (!st) return say('It is ready – press 🛎️ Serve it!');
      if (st.do) { shake(chip); return say(`First, ${(st.label || st.do).toLowerCase()}! ${ACT[st.do].hint}`); }
      if (it.add !== st.add) { shake(chip); return slip(it.why || (rc.steps.some(s => s.add === it.add) ? `Not yet! What comes next in the ${rc.name}?` : `There's no ${it.label} in ${rc.name}!`)); }
      sfx.good(); addLayer(it.emoji);
      if (st.makes) setBoard(st.makes);
      advance();
    }
    function actionDone() {
      const st = step();
      sfx.good(); confetti(16);
      if (st.makes) setBoard(st.makes); else board.querySelectorAll('.cook-layer').forEach(e => e.classList.add('done-' + st.do));
      advance();
    }
    function bump(amount) {
      actAmt = Math.min(1, actAmt + amount);
      meter.firstChild.style.width = actAmt * 100 + '%';
      if (actAmt >= 1) actionDone();
    }
    function serve() {
      if (!rc || si < rc.steps.length) return;
      sfx.win(); confetti(50);
      award(`${key}:${ri}`, serveBtn);
      if (slips === 0) award(`${key}:${ri}:clean`, serveBtn);
      serveBtn.hidden = true; board.classList.remove('ready');
      ticket.querySelector('.cook-cust').classList.add('happy');
      put(ticket.querySelector('.cook-order'), h('b', null, `😋 ${r.yum || 'Yum!'}`), ' ', slips === 0 ? 'Perfect cooking – no slips!' : 'Delicious!');
      say(`${r.yum || 'Yum!'} ${praise()}`);
      fb.className = 'feedback good'; fb.hidden = !rc.fact;
      if (rc.fact) fb.innerHTML = '🌏 ' + fmt(rc.fact, false);
      nextBtn.textContent = ri < recipes.length - 1 ? 'Next order ▶' : 'Close the kitchen ✔';
      nextBtn.hidden = false;
    }
    function finish() {
      finished = true;
      const secs = Math.round((performance.now() - startT) / 1000);
      put(ticket, h('span', { class: 'cook-cust happy' }, '👨‍🍳'), h('div', { class: 'cook-order' }, h('b', null, 'KITCHEN CLOSED!'), ` You cooked ${recipes.length} dishes${r.par ? ` in ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : ''}.`));
      if (r.par && secs <= r.par) { award(`${key}:speed`, ticket); say('SPEEDY CHEF! You beat the clock – bonus gem!'); }
      put(card); board.querySelectorAll('.cook-layer').forEach(e => e.remove()); actTip.hidden = true;
      done();
    }

    // ---------- gestures on the board ----------
    let gest = null;
    board.addEventListener('pointerdown', e => {
      const st = step();
      if (!st || !st.do || busy) return;
      e.preventDefault();
      try { board.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      const b = board.getBoundingClientRect();
      gest = { x: e.clientX, y: e.clientY, cx: b.left + b.width / 2, cy: b.top + b.height / 2, ang: null, hold: null };
      if (st.do === 'slice') { sfx.zap(); board.append(h('div', { class: 'cook-cut', style: `left:${e.clientX - b.left}px` })); bump(0.34); }
      if (st.do === 'pour' || st.do === 'squeeze') {
        const tick = () => { if (!gest || step() !== st) return; sfx.tap(); bump(0.06); if (step() === st) gest.hold = setTimeout(tick, 70); };
        tick();
      }
    });
    board.addEventListener('pointermove', e => {
      const st = step();
      if (!gest || !st || !st.do) return;
      if (st.do === 'roll') {
        const d = Math.hypot(e.clientX - gest.x, e.clientY - gest.y);
        board.style.setProperty('--roll', Math.min(1, d / 120));
        if (d > 120) { gest = null; board.style.removeProperty('--roll'); sfx.whoosh(); bump(1); }
      } else if (st.do === 'stir') {
        const a = Math.atan2(e.clientY - gest.cy, e.clientX - gest.cx);
        if (gest.ang != null) {
          let da = a - gest.ang; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
          bump(Math.abs(da) / (Math.PI * 4)); // two full circles
          board.style.setProperty('--spin', (parseFloat(board.style.getPropertyValue('--spin') || 0) + da * 57.3) + 'deg');
        }
        gest.ang = a;
      }
    });
    const end = () => { if (gest && gest.hold) clearTimeout(gest.hold); gest = null; board.style.removeProperty('--roll'); };
    board.addEventListener('pointerup', end); board.addEventListener('pointercancel', end);

    const chips = shuffle([...pantry.values()]).map(it => {
      const chip = h('div', { class: 'cook-item chip-item', role: 'button', tabindex: '0' }, picOf(it.emoji, 'ci-emoji'), h('span', null, it.label));
      draggable(chip, { tap: () => addItem(it, chip), drop: z => { if (z && z.dataset.drop === 'board') addItem(it, chip); } });
      return chip;
    });
    const tickClock = () => {
      if (!root.isConnected || finished) return;
      const s = Math.round((performance.now() - startT) / 1000);
      clock.textContent = `⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      setTimeout(tickClock, 500);
    };
    const root = h('div', { class: 'game cook' },
      ticket,
      h('div', { class: 'cook-wrap' },
        h('div', { class: 'cook-side' }, card, peekBtn, clock),
        h('div', { class: 'cook-main' }, actTip, board, meter, h('div', { class: 'btn-row' }, serveBtn))),
      h('div', { class: 'tray-wrap' }, h('div', { class: 'tray-label' }, '👇 Drag an ingredient onto the board (or tap it)'), h('div', { class: 'tray cook-pantry' }, chips)),
      fb, h('div', { class: 'btn-row' }, nextBtn));
    root._test = {
      add(id) { const it = pantry.get(id); addItem(it, chips.find(c => c.textContent.includes(it.label)) || board); },
      act() { const st = step(); if (st && st.do) bump(1); },
      // do the whole current recipe correctly, then serve
      cook() { while (step()) { const st = step(); if (st.add) this.add(st.add); else this.act(); } serve(); },
      next: () => nextBtn.click(),
      get recipe() { return ri; }, get step() { return si; }, get finished() { return finished; }, get slips() { return slips; },
    };
    nextOrder();
    if (r.par) tickClock();
    return root;
  };

  // ===== Say it! Learn to say hello (and more) in another language =====
  // r.lang: 'ja-JP' / 'th-TH' (the 🔊 button uses a voice for it when the device has one)
  // r.phrases: [{ text: 'こんにちは', roman: 'konnichiwa', means: 'Hello', emoji: '👋', sound: 'kon-nee-chee-wah', note }]
  // r.quiz: [questions] – situation questions asked after the listening game
  // r.gesture: { kind: 'bow' | 'wai', text } – finish with a tactile bow (swipe down) or wai (bring your hands together)
  GAMES.phrases = function (r, key, done) {
    const P = r.phrases;
    const area = h('div');
    const said = new Set();
    let part = 0, cur = null;
    const listen = (p, force = true) => {
      const ok = speak(p.text || p.roman, { lang: r.lang, force, rate: 0.75 });
      if (!ok && force) say(`Say it like this: “${p.sound || p.roman}” – try it with a grown-up!`);
      return ok;
    };
    // part 1: learn each phrase – listen, then say it out loud
    function learn() {
      const count = h('div', { class: 'q-count' });
      const go = h('button', { class: 'btn big ready', type: 'button', hidden: true, onclick() { sfx.tap(); quiz(); } }, 'Test my ears ▶');
      const paint = () => { count.textContent = `🗣️ ${said.size} of ${P.length} phrases said out loud`; go.hidden = said.size < P.length; };
      const cards = P.map((p, k) => {
        const sayBtn = h('button', { class: 'btn green', type: 'button', onclick(e) {
          if (said.has(k)) return;
          said.add(k); sfx.good(); award(`${key}:say${k}`, e.currentTarget);
          e.currentTarget.textContent = '✔ Said it!'; e.currentTarget.disabled = true;
          say(pick(['Brilliant accent!', 'Wonderful!', 'You sound like a local!', praise()])); paint();
          if (said.size === P.length) { confetti(50); say('You can say them all! Now let\'s test your ears!'); }
        } }, '🗣️ I said it!');
        return h('div', { class: 'phrase-card' },
          h('div', { class: 'phrase-emoji' }, p.emoji || '💬'),
          p.text && h('div', { class: 'phrase-native', lang: r.lang }, p.text),
          h('div', { class: 'phrase-roman' }, p.roman),
          h('div', { class: 'phrase-means' }, `= “${p.means}”`),
          p.sound && h('div', { class: 'phrase-sound' }, '🗣️ say: ' + p.sound),
          p.note && h('div', { class: 'phrase-note', html: fmt(p.note, false) }),
          h('div', { class: 'btn-row' }, h('button', { class: 'btn', type: 'button', onclick() { sfx.tap(); listen(p); } }, '🔊 Listen'), sayBtn));
      });
      paint();
      put(area, h('p', { class: 'instr' }, 'Tap 🔊 to hear each phrase. Copy it out loud, then tap 🗣️ I said it!'), h('div', { class: 'phrase-grid' }, cards), count, h('div', { class: 'btn-row' }, go));
    }
    // part 2: listen and pick the meaning
    function quiz() {
      part = 2;
      const qs = shuffle(P.map((p, k) => k));
      let qi = 0;
      const box = h('div');
      const show = () => {
        if (qi >= qs.length) return situations();
        const p = cur = P[qs[qi]];
        const others = shuffle(P.filter(x => x !== p)).slice(0, 2).map(x => x.means);
        const q = { type: 'mcq', q: `What does “${p.roman}” mean?`, options: [p.means, ...others], answer: 0 };
        const fbx = h('div', { class: 'feedback', hidden: true });
        const nxt = h('button', { class: 'btn', type: 'button', hidden: true, onclick() { sfx.tap(); qi++; show(); } }, 'Next ▶');
        put(box,
          h('div', { class: 'q-count' }, `👂 Listening ${qi + 1} of ${qs.length}`),
          h('div', { class: 'btn-row' }, h('button', { class: 'btn gold big', type: 'button', onclick() { listen(p); } }, '🔊 Play it again')),
          questionWidget(q, (el, first) => { if (first) award(`${key}:ear${qs[qi]}`, el); sfx.good(); say(praise()); fbx.className = 'feedback good'; fbx.hidden = false; fbx.textContent = `✔ ${p.roman} = “${p.means}” ${p.emoji || ''}`; nxt.hidden = false; },
            () => say(`💡 Listen again. Which one did you hear?`)),
          fbx, h('div', { class: 'btn-row' }, nxt));
        listen(p, false);
      };
      put(area, h('p', { class: 'instr' }, 'Listen to the phrase, then pick what it means.'), box);
      say('Listen carefully! What does it mean?');
      show();
    }
    // part 3: which phrase fits? (situations)
    function situations() {
      if (!r.quiz || !r.quiz.length) return gesture();
      const box = h('div');
      put(area, h('p', { class: 'instr' }, 'What would you say? Choose the right phrase.'), box);
      say('Now – what would you say in each of these moments?');
      runQuestions(box, r.quiz, { key: `${key}:sit`, lastLabel: r.gesture ? 'One last thing ▶' : 'Done ✔', done: () => gesture() });
    }
    // part 4: the bow or the wai
    function gesture() {
      const g = r.gesture;
      if (!g) { put(area, h('p', { class: 'lead' }, '🎉 You can greet people like a local!')); return done(); }
      const hero = heroImg('phrase-hero');
      const stage = h('div', { class: 'phrase-stage ' + g.kind });
      const tip = h('p', { class: 'instr' });
      let reps = 0;
      const need = g.times || 2;
      const success = () => {
        reps++; sfx.good();
        if (g.say) speak(g.say, { lang: r.lang, force: true, rate: 0.8 });
        if (reps >= need) {
          award(`${key}:gesture`, stage); confetti(70);
          say(g.yes || 'Perfect manners!');
          put(tip, '🎉 ' + (g.yes || 'Perfect manners!'));
          done();
        } else say(`Lovely! Do it ${need - reps} more time${need - reps > 1 ? 's' : ''}!`);
      };
      if (g.kind === 'bow') {
        let y0 = null;
        put(stage, hero, h('div', { class: 'phrase-arrow' }, '⬇'));
        stage.addEventListener('pointerdown', e => { e.preventDefault(); y0 = e.clientY; try { stage.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } });
        stage.addEventListener('pointermove', e => { if (y0 == null) return; const d = Math.max(0, Math.min(1, (e.clientY - y0) / 90)); hero.style.transform = `rotate(${d * 35}deg)`; });
        const up = e => {
          if (y0 == null) return;
          const d = e.clientY - y0; y0 = null; hero.style.transform = '';
          if (d > 70) { hero.classList.remove('bowed'); void hero.offsetWidth; hero.classList.add('bowed'); success(); } else say('Swipe further DOWN to bow!');
        };
        stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', () => { y0 = null; hero.style.transform = ''; });
        put(tip, g.text || '🙇 Swipe DOWN on your character to bow.');
      } else {
        // wai: drag the right hand across to meet the left hand
        const left = h('div', { class: 'wai-hand left' }, '🫸');
        const right = h('div', { class: 'wai-hand right' }, '🫷');
        const join = h('div', { class: 'wai-join', hidden: true }, '🙏');
        put(stage, hero, left, right, join);
        let x0 = null;
        right.addEventListener('pointerdown', e => { e.preventDefault(); x0 = e.clientX; try { right.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } });
        right.addEventListener('pointermove', e => { if (x0 == null) return; right.style.transform = `translateX(${Math.min(0, e.clientX - x0)}px)`; });
        const up = () => {
          if (x0 == null) return;
          x0 = null;
          // touching? (measured before the hand springs back)
          const touching = right.getBoundingClientRect().left <= left.getBoundingClientRect().right + 24;
          right.style.transform = '';
          if (touching) {
            left.hidden = right.hidden = true; join.hidden = false; join.classList.remove('pop'); void join.offsetWidth; join.classList.add('pop');
            success();
            setTimeout(() => { if (reps < need) { left.hidden = right.hidden = false; join.hidden = true; } }, 1200);
          } else say('Slide the hand all the way across until your palms touch!');
        };
        right.addEventListener('pointerup', up); right.addEventListener('pointercancel', up);
        put(tip, g.text || '🙏 Slide the right hand across to press your palms together.');
      }
      put(area, tip, stage);
      say(g.say ? `${g.intro || 'Now with manners!'}` : (g.intro || 'Now with manners!'));
    }
    learn();
    const root = h('div', { class: 'game phrases' }, area);
    root._test = {
      sayAll() { area.querySelectorAll('.phrase-card .btn.green').forEach(b => b.click()); },
      go() { area.querySelector('.btn.ready').click(); },
      // answer the current listening question correctly
      answer() { const b = cur && [...area.querySelectorAll('.opt')].find(x => x.textContent === cur.means); if (b) b.click(); return !!b; },
      next() { const b = [...area.querySelectorAll('.btn')].find(x => !x.hidden && /Next|One last|Done/.test(x.textContent)); if (b) b.click(); },
      gesture(n = 2) { for (let k = 0; k < n; k++) { const ev = (t, y) => new PointerEvent(t, { clientX: 100, clientY: y, bubbles: true }); const st = area.querySelector('.phrase-stage'); if (!st) return; if (st.classList.contains('bow')) { st.dispatchEvent(ev('pointerdown', 0)); st.dispatchEvent(ev('pointerup', 120)); } else { const rh = st.querySelector('.wai-hand.right'), lh = st.querySelector('.wai-hand.left'); const a = rh.getBoundingClientRect(), b = lh.getBoundingClientRect(); rh.hidden = false; rh.dispatchEvent(new PointerEvent('pointerdown', { clientX: a.left, clientY: a.top, bubbles: true })); rh.dispatchEvent(new PointerEvent('pointermove', { clientX: b.right - (a.left - a.left), clientY: a.top, bubbles: true })); rh.dispatchEvent(new PointerEvent('pointerup', { clientX: b.right, clientY: a.top, bubbles: true })); } } },
      get part() { return part; },
    };
    return root;
  };

  // Places words in a grid (left→right and top→bottom; diagonals optional) and fills the gaps.
});
