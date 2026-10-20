/* Pixelkid lesson engine – simulated science experiments: Force Lab, Ramp Lab, Seed Garden, Wind Test, Bee Flight, Rock Lab and Fossil Dig.
 * One part of shared/engine.js, which loads it only when a lesson uses it. E is the engine's shared helpers
 * (E.state and E.stageCard are live). See the top of shared/engine.js for how the parts fit together.
 */
PixelkidEngine.part('science', E => {
  'use strict';
  const { AV, GAMES, ROBOT_PAL, SPR, arcadeCanvas, award, emojiAt, gameLoop, h, keys, missionRunner, pxDraw, pxText,
    resultsTable, say, sfx, shuffle, skyAndGround, spriteCanvas, toGame } = E;

  // ===== Force Lab: hands-on pushes, pulls and friction =====
  // You stand on the left. A PUSH moves things away from you (swipe ▶ or tap to press), a PULL brings them towards you (swipe ◀).
  // r.tasks: [{ thing: '🔔', label: 'Ring the doorbell!', force: 'push' | 'pull', effect: 'DING DONG!', yes, why }]
  //   or slide tasks: [{ slide: 'ice' | 'wood' | 'carpet' | 'grass' | 'sand', thing: '🥌', label, zone: [x0, x1] }]
  //   – flick the thing so friction stops it inside the zone. Rough surfaces need a big push, smooth ones a gentle one.
  // Magnet mode: r.hold: '🧲' (you hold it), r.snap: true (pulled things speed up and snap on), r.noTap: true,
  //   r.words: { pull: 'ATTRACT', pullSub: '(comes to you)', push: 'REPEL', pushSub: '(flies away)' } relabels the arrows,
  //   and tasks can add holdTag / tag (e.g. 'N', 'S') shown above your magnet and above the thing.
  const SURFACES = {
    ice: { name: 'ICE', a: 70, c: ['#cfefff', '#ffffff'], tip: 'Ice is smooth – hardly any friction, so a GENTLE push goes a long way!' },
    wood: { name: 'WOODEN FLOOR', a: 260, c: ['#c08a52', '#9c6b3c'], tip: 'Wood is quite smooth – not much friction, so give it a medium push.' },
    carpet: { name: 'CARPET', a: 620, c: ['#b0413e', '#8c2f2c'], tip: 'Carpet is rough – lots of friction! It needs a BIG push.' },
    grass: { name: 'GRASS', a: 760, c: ['#5bbf3a', '#3d8a26'], tip: 'Grass is rough and bumpy – lots of friction! Push hard.' },
    sand: { name: 'SAND', a: 950, c: ['#f2d16b', '#d9b24a'], tip: 'Sand is very rough – loads of friction! Give it your BIGGEST push.' },
  };
  GAMES.forces = function (r, key, done) {
    const W = 640, H = 360, FLOOR = 288, HOME = 150, MID = 380;
    const { cv, ctx } = arcadeCanvas(W, H);
    const sceneD = AV ? AV.sceneDef() : null;
    const sky = sceneD ? sceneD.sky : ['#5fb8f5', '#c4e8ff'];
    const ground = sceneD ? sceneD.ground : ['#5bbf3a', '#3d8a26', '#8a5a32', '#6b4425'];
    const hero = AV ? AV.draw(AV.load().look, { scale: 3 }) : spriteCanvas(SPR.robot, ROBOT_PAL, 4);
    const tasks = r.shuffle ? shuffle(r.tasks) : r.tasks;
    const WORD = Object.assign({ push: 'PUSH', pull: 'PULL', pushSub: '(away from you)', pullSub: '(towards you)' }, r.words);
    const STOP = r.hold ? HOME - 6 : HOME;
    let ti = -1, task = null, obj = null, phase = 'ready', wrong = 0, helped = false, banner = null, later = null, finished = false, ptr = null, trail = [];
    const surf = () => SURFACES[task.slide] || SURFACES.wood;
    const zone = () => task.zone || [380, 560];
    const show = (text, color, t = 1.4) => { banner = { text, color, t }; };
    const after = (t, fn) => { later = { t, fn }; };

    function next() {
      ti++;
      if (ti >= tasks.length) { finished = true; phase = 'done'; show('FORCE LAB COMPLETE!', '#7cfc3a', 99); done(); return; }
      task = tasks[ti]; wrong = 0; helped = false; phase = 'ready'; banner = null;
      obj = { x: task.slide ? HOME + 20 : MID, vx: 0, a: 0, back: false };
      obj.home = obj.x;
      if (ti > 0) say(task.say || (task.slide ? `Flick it ▶ so it stops in the green box. The floor is ${surf().name.toLowerCase()}!` : 'Push or pull? Swipe it the right way!'));
    }
    function act(dir, speed, tapped) {
      if (phase !== 'ready' || !task) return;
      if (task.slide) {
        if (dir === 'pull') { wrong++; sfx.bad(); show('THAT\'S A PULL!', '#ff7a7a'); say('That brings it TOWARDS you. Push it AWAY ▶ to slide it!'); return; }
        phase = 'moving'; sfx.tap();
        obj.vx = Math.min(1300, Math.max(tapped ? 260 : 0, speed * 0.55)); obj.a = surf().a;
        if (obj.vx < 5) { obj.vx = 0; stopped(); }
        return;
      }
      if (dir === task.force) {
        phase = 'moving'; sfx.good();
        obj.vx = (dir === 'push' ? 1 : -1) * Math.min(900, Math.max(420, speed * 0.7)); obj.a = 650;
        // magnets: attraction gets stronger as things get closer, so they speed up and SNAP on; repelled things zoom off
        if (r.snap) { obj.vx = (dir === 'push' ? 1 : -1) * 160; obj.a = -1400; }
        if (!wrong) award(`${key}:${ti}`, cv);
        show(task.effect || (dir === 'push' ? 'PUSH!' : 'PULL!'), '#ffd43b', 1.6);
        say(task.yes || (dir === 'push' ? 'Yes – a PUSH! It moved away from you.' : 'Yes – a PULL! It came towards you.'));
      } else {
        wrong++; sfx.bad();
        obj.vx = (dir === 'push' ? 1 : -1) * 220; obj.a = 1100; obj.back = true;
        show(r.words ? 'NOT ' + WORD[dir] + '!' : dir === 'push' ? (tapped ? 'A PRESS IS A PUSH!' : 'THAT WAS A PUSH') : 'THAT WAS A PULL', '#ff7a7a');
        say(task.why || (task.force === 'push' ? 'Hmm! Does this one move AWAY from you? Try a push ▶' : 'Hmm! Does this one come TOWARDS you? Try a pull ◀'));
      }
    }
    function stopped() {
      if (!task.slide) { if (!obj.back) after(1.1, next); return; }
      const [z0, z1] = zone(), S = surf();
      if (obj.x >= z0 && obj.x <= z1) {
        phase = 'moving'; sfx.good();
        if (!helped) award(`${key}:${ti}`, cv);
        show(task.effect || 'PERFECT STOP!', '#7cfc3a', 1.6);
        say(helped ? 'There! See how far it needed to go? Next one!' : (task.yes || 'Perfect! ' + S.tip));
        after(1.6, next);
        return;
      }
      wrong++; sfx.bad();
      const tooHard = obj.x > z1;
      show(obj.bonk ? 'BONK! TOO HARD!' : tooHard ? 'TOO HARD!' : 'TOO GENTLE!', '#ff7a7a');
      if (wrong >= 4) {
        say('Let me help with this one!');
        after(1.2, () => {
          obj.x = obj.home; obj.bonk = false; helped = true;
          obj.a = S.a; obj.vx = Math.sqrt(2 * S.a * ((z0 + z1) / 2 - obj.x)); phase = 'moving';
        });
      } else {
        say((tooHard ? 'Whoa, too far! Push a bit more gently. ' : 'Not far enough! Push a bit harder. ') + S.tip);
        after(1.2, () => { obj.x = obj.home; obj.bonk = false; phase = 'ready'; });
      }
    }

    // ----- swipes and taps -----
    cv.addEventListener('pointerdown', e => {
      if (phase !== 'ready') return;
      e.preventDefault();
      try { cv.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      const [x, y] = toGame(cv, W, H, e);
      ptr = { id: e.pointerId, x0: x, y0: y, pts: [[performance.now(), x, y]] }; trail = [[x, y]];
    });
    cv.addEventListener('pointermove', e => {
      if (!ptr || e.pointerId !== ptr.id) return;
      const [x, y] = toGame(cv, W, H, e);
      ptr.pts.push([performance.now(), x, y]); trail.push([x, y]);
      if (trail.length > 24) trail.shift();
    });
    cv.addEventListener('pointerup', e => {
      if (!ptr || e.pointerId !== ptr.id) return;
      const p = ptr; ptr = null;
      const now = performance.now(), last = p.pts[p.pts.length - 1];
      const dx = last[1] - p.x0, dy = last[2] - p.y0;
      if (Math.abs(dx) < 14 && Math.abs(dy) < 14) {
        // a tap: pressing the thing is a push
        if (r.noTap) say(`Swipe it! ◀ ${WORD.pull.toLowerCase()}, or ${WORD.push.toLowerCase()} ▶`);
        else if (Math.abs(p.x0 - obj.x) < 55 && p.y0 > FLOOR - 90 && p.y0 < FLOOR + 10) act('push', 0, true);
        else say('Swipe the thing itself: ▶ away from you, or ◀ towards you.');
        return;
      }
      if (Math.abs(dx) < Math.abs(dy)) { say('Swipe sideways! ▶ away from you, or ◀ towards you.'); return; }
      // speed from the last part of the swipe, so a quick flick counts more than a slow drag
      const from = p.pts.find(q => now - q[0] < 120) || last;
      const speed = Math.abs(last[1] - from[1]) / Math.max(16, now - from[0]) * 1000;
      act(dx > 0 ? 'push' : 'pull', speed);
    });
    cv.addEventListener('pointercancel', () => { ptr = null; });

    // ----- physics -----
    let time = 0;
    function step(dt) {
      time += dt;
      if (banner && banner.t < 99) { banner.t -= dt; if (banner.t <= 0) banner = null; }
      if (later) { later.t -= dt; if (later.t <= 0) { const f = later.fn; later = null; f(); } }
      if (obj && obj.vx) {
        const s = Math.sign(obj.vx);
        obj.x += obj.vx * dt;
        obj.vx -= s * obj.a * dt;
        if (Math.sign(obj.vx) !== s) obj.vx = 0;
        if (task.slide && obj.x > W - 46) { obj.x = W - 46; obj.vx = 0; obj.bonk = true; sfx.hit(); }
        if (!task.slide && !obj.back && obj.vx < 0 && obj.x < STOP) { obj.x = STOP; obj.vx = 0; if (r.snap) { sfx.tap(); show(task.effect || 'CLICK!', '#ffd43b', 1.2); } }
        if (!task.slide && obj.x > W + 80) obj.vx = 0;
        if (!obj.vx) stopped();
      } else if (obj && obj.back) {
        obj.x += (obj.home - obj.x) * Math.min(1, dt * 8);
        if (Math.abs(obj.x - obj.home) < 1) { obj.x = obj.home; obj.back = false; }
      }
      if (!ptr && trail.length) trail.shift();
      draw();
    }
    function draw() {
      const g = ctx.createLinearGradient(0, 0, 0, FLOOR);
      g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, FLOOR);
      ctx.fillStyle = ground[2]; ctx.fillRect(0, FLOOR, W, H - FLOOR);
      ctx.fillStyle = ground[0]; ctx.fillRect(0, FLOOR, W, 10);
      ctx.fillStyle = ground[3]; for (let x = 8; x < W; x += 40) ctx.fillRect(x, FLOOR + 28 + (x % 80 ? 12 : 0), 8, 8);
      if (task && task.slide) {
        const S = surf(), [z0, z1] = zone();
        for (let x = 110; x < W; x += 16) { ctx.fillStyle = S.c[(x / 16) % 2 | 0]; ctx.fillRect(x, FLOOR, 16, 16); }
        ctx.fillStyle = '#000'; ctx.fillRect(110, FLOOR + 16, W - 110, 3);
        ctx.fillStyle = 'rgba(124,252,58,.35)'; ctx.fillRect(z0, FLOOR - 74, z1 - z0, 74);
        ctx.strokeStyle = '#7cfc3a'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.strokeRect(z0, FLOOR - 74, z1 - z0, 74); ctx.setLineDash([]);
        pxText(ctx, 'STOP HERE', (z0 + z1) / 2, FLOOR - 88, 15, '#7cfc3a');
        // a brick wall at the end of the track
        for (let y = FLOOR - 120; y < FLOOR; y += 12) for (let x = W - 24; x < W; x += 12) { ctx.fillStyle = (x + y) % 24 ? '#b5452f' : '#8c2f22'; ctx.fillRect(x, y, 11, 11); }
        pxText(ctx, 'FLOOR: ' + S.name, W / 2, H - 26, 16, '#fff');
      } else if (task) {
        pxText(ctx, '◀ ' + WORD.pull, 100, H - 34, 16, '#ffffff');
        pxText(ctx, WORD.pullSub, 100, H - 14, 11, '#dddddd');
        pxText(ctx, WORD.push + ' ▶', W - 100, H - 34, 16, '#ffffff');
        pxText(ctx, WORD.pushSub, W - 100, H - 14, 11, '#dddddd');
      }
      ctx.drawImage(hero, 46, FLOOR - hero.height + 2);
      const EMOJI = n => `${n}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      if (r.hold) {
        if (!pxDraw(ctx, r.hold, 104, FLOOR - 30, 40)) {
          ctx.font = EMOJI(40); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
          ctx.fillText(r.hold, 104, FLOOR - 30);
        }
        if (task && task.holdTag) pxText(ctx, task.holdTag, 104, FLOOR - 92, 22, '#ffffff');
      }
      if (task && phase !== 'done') {
        const wob = !task.slide && phase === 'ready' ? Math.sin(time * 4) * 3 : 0;
        emojiAt(ctx, task.thing, obj.x, FLOOR - 4 + wob, 60);
        if (task.tag) pxText(ctx, task.tag, obj.x, FLOOR - 92 + wob, 22, '#ffffff');
      }
      if (trail.length > 1) {
        ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); trail.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, 36);
      if (task) pxText(ctx, task.label, W / 2, 19, 18, '#ffd43b');
      pxText(ctx, `✔ ${Math.max(0, finished ? tasks.length : ti)}/${tasks.length}`, W - 12, 56, 18, '#7cfc3a', 'right');
      if (banner) pxText(ctx, banner.text, W / 2, 120, 32, banner.color);
    }

    const stopLoop = gameLoop(cv, step);
    const root = h('div', { class: 'game arcade forces' },
      h('div', { class: 'arc-screen' }, cv),
      h('p', { class: 'arc-tip' }, r.tip || 'You are on the left. Swipe ▶ to PUSH (away from you), swipe ◀ to PULL (towards you), or tap to PRESS.'));
    keys(root, {
      ArrowRight: [() => act('push', 1000)],
      ArrowLeft: [() => act('pull', 1000)],
    });
    root._test = {
      frames(n) { for (let i = 0; i < n; i++) step(1 / 60); },
      act, get task() { return task; }, get obj() { return obj; }, get phase() { return phase; }, get finished() { return finished; },
      // the push speed that would stop a slide task right in the middle of its zone
      perfect() { const [z0, z1] = zone(); return Math.sqrt(2 * surf().a * ((z0 + z1) / 2 - obj.home)) / 0.55; },
    };
    root._stop = stopLoop;
    next();
    return root;
  };

  // ===== Ramp Lab: roll a toy car down a ramp onto different floors and measure how far it goes =====
  // r.surfaces: ['carpet', 'wood', 'ice'] (towel, carpet, grass, sand, wood, tiles, ice) · r.thing: '🚗'
  // r.missions: [{ text, need: { surface, height }, yes, ask: [questions] }]
  // Drag the top of the ramp (or use − / +) to stack 1–4 books, pick a floor, then let the car go.
  const RAMP_FLOORS = {
    towel: { name: 'Towel', emoji: '🛁', a: 650, c: ['#f5f5f5', '#9ecbff'] },
    sand: { name: 'Sand', emoji: '🏖️', a: 800, c: ['#f2d16b', '#d9b24a'] },
    grass: { name: 'Grass', emoji: '🌱', a: 520, c: ['#5bbf3a', '#3d8a26'] },
    carpet: { name: 'Carpet', emoji: '🧶', a: 450, c: ['#b0413e', '#8c2f2c'] },
    wood: { name: 'Wooden floor', emoji: '🪵', a: 200, c: ['#c08a52', '#9c6b3c'] },
    tiles: { name: 'Shiny tiles', emoji: '🔲', a: 130, c: ['#e8eef2', '#b8c4cc'] },
    ice: { name: 'Ice', emoji: '🧊', a: 90, c: ['#cfefff', '#ffffff'] },
  };
  GAMES.ramp = function (r, key, done) {
    const W = 640, H = 330, FLOOR = 262, X0 = 40, XB = 200, BOOK = 30, CM = 0.5; // 1 pixel = half a centimetre
    const { cv, ctx } = arcadeCanvas(W, H);
    const floors = (r.surfaces || ['carpet', 'wood', 'ice']).filter(k => RAMP_FLOORS[k]);
    const thing = r.thing || '🚗';
    let height = 2, floor = floors[0], car = null, marks = [], busy = false, dragY = null, time = 0, runN = 0;
    const topY = () => FLOOR - height * BOOK;
    const slope = () => { const dx = XB - X0, dy = height * BOOK; return { len: Math.hypot(dx, dy), ang: Math.atan2(dy, dx) }; };
    const resetCar = () => { car = { phase: 'ready', s: 12, v: 0, x: 0 }; };
    const table = resultsTable(r.caption || '🚗 Our ramp results', ['Test', 'Ramp', 'Floor', 'Distance']);
    const missions = missionRunner(r, key, done, () => { busy = false; resetCar(); syncControls(); });

    function release() {
      if (busy || car.phase !== 'ready') return;
      busy = true; sfx.tap(); car.phase = 'ramp';
      say('Wheee! Watch how far it rolls…');
    }
    function stopped() {
      car.phase = 'stopped';
      const cm = Math.round((car.x - XB) * CM);
      runN++;
      marks.push({ x: car.x, cm, floor });
      if (marks.length > 4) marks.shift();
      table.add([runN, `📚 ${height} book${height > 1 ? 's' : ''}`, `${RAMP_FLOORS[floor].emoji} ${RAMP_FLOORS[floor].name}`, `${cm} cm`]);
      const m = missions.m, need = (m && m.need) || {};
      if (m && (!need.surface || need.surface === floor) && (!need.height || need.height === height)) {
        missions.win(cv);
      } else {
        const fix = [];
        if (need.height && need.height !== height) fix.push(`stack ${need.height} book${need.height > 1 ? 's' : ''}`);
        if (need.surface && need.surface !== floor) fix.push(`choose the ${RAMP_FLOORS[need.surface].name.toLowerCase()}`);
        say(`${cm} cm! ${fix.length ? 'Interesting test – but for this mission, ' + fix.join(' and ') + '.' : ''}`);
        setTimeout(() => { busy = false; resetCar(); syncControls(); }, 900);
      }
      syncControls();
    }
    function setHeight(n) {
      n = Math.max(1, Math.min(4, n));
      if (n === height || busy) return;
      height = n; sfx.tap(); resetCar(); syncControls();
    }

    // ----- dragging the ramp up and down, or tapping the car -----
    cv.addEventListener('pointerdown', e => {
      if (busy) return;
      const [x, y] = toGame(cv, W, H, e);
      e.preventDefault();
      if (x < XB - 40 && Math.abs(y - topY()) < 50) { dragY = y; try { cv.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } return; }
      const sl = slope(), cx = X0 + Math.cos(sl.ang) * car.s, cy = topY() + Math.sin(sl.ang) * car.s;
      if (Math.hypot(x - cx, y - cy) < 50) release();
    });
    cv.addEventListener('pointermove', e => {
      if (dragY == null) return;
      const [, y] = toGame(cv, W, H, e);
      setHeight(Math.round((FLOOR - y) / BOOK));
    });
    const endDrag = () => { dragY = null; };
    cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);

    function step(dt) {
      time += dt;
      const sl = slope();
      if (car.phase === 'ramp') {
        // speed at the bottom grows with the height of the ramp
        const vEnd = 135 * Math.sqrt(height);
        car.v += vEnd * vEnd / (2 * sl.len) * dt; car.s += car.v * dt;
        if (car.s >= sl.len) { car.phase = 'floor'; car.x = XB; car.v = vEnd; }
      } else if (car.phase === 'floor') {
        car.x += car.v * dt; car.v -= RAMP_FLOORS[floor].a * dt;
        if (car.v <= 0) { car.v = 0; stopped(); }
      }
      draw(sl);
    }
    function draw(sl) {
      skyAndGround(ctx, W, H, FLOOR);
      const F = RAMP_FLOORS[floor];
      for (let x = XB; x < W; x += 16) { ctx.fillStyle = F.c[((x - XB) / 16) % 2 | 0]; ctx.fillRect(x, FLOOR, 16, 14); }
      // measuring tape
      ctx.fillStyle = '#ffd43b'; ctx.fillRect(XB, FLOOR + 20, W - XB, 24); ctx.fillStyle = '#000'; ctx.fillRect(XB, FLOOR + 44, W - XB, 2);
      for (let x = XB, n = 0; x < W; x += 20, n++) {
        ctx.fillStyle = '#000'; ctx.fillRect(x, FLOOR + 20, 2, n % 5 ? 7 : 13);
        if (n % 5 === 0 && n) pxText(ctx, String(n * 20 * CM), x, FLOOR + 37, 10, '#fff');
      }
      pxText(ctx, 'cm', W - 16, FLOOR + 37, 10, '#fff');
      // stack of books under the ramp
      const BC = ['#e53935', '#2e7bd6', '#ffb800', '#7c4dff'];
      for (let i = 0; i < height; i++) {
        const y = FLOOR - (i + 1) * BOOK;
        ctx.fillStyle = '#000'; ctx.fillRect(X0 - 30, y, 52, BOOK);
        ctx.fillStyle = BC[i]; ctx.fillRect(X0 - 28, y + 2, 48, BOOK - 4);
        ctx.fillStyle = '#fff'; ctx.fillRect(X0 - 28, y + 8, 48, 3);
      }
      // the ramp board
      ctx.strokeStyle = '#000'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(X0 - 6, topY()); ctx.lineTo(XB + 4, FLOOR + 2); ctx.stroke();
      ctx.strokeStyle = '#c08a52'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(X0 - 4, topY()); ctx.lineTo(XB, FLOOR); ctx.stroke();
      if (!busy) pxText(ctx, '↕ drag', X0 - 4, topY() - 22 + Math.sin(time * 4) * 2, 13, '#ffd43b');
      // where earlier cars stopped
      marks.forEach((mk, k) => {
        const last = k === marks.length - 1;
        ctx.fillStyle = last ? '#e53935' : 'rgba(0,0,0,.35)'; ctx.fillRect(mk.x - 1, FLOOR - 40, 3, 40);
        if (last) { ctx.fillStyle = '#e53935'; ctx.fillRect(mk.x + 2, FLOOR - 40, 16, 10); }
        if (last) pxText(ctx, mk.cm + ' cm', mk.x, FLOOR - 52, 14, '#fff'); // only the newest run is labelled, the table has the rest
      });
      // the car
      if (car.phase === 'ready' || car.phase === 'ramp') {
        const cx = X0 + Math.cos(sl.ang) * car.s, cy = topY() + Math.sin(sl.ang) * car.s;
        emojiAt(ctx, thing, cx + Math.sin(sl.ang) * 2, cy - 4, 34, sl.ang);
      } else emojiAt(ctx, thing, car.x, FLOOR + 2, 34);
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, 30);
      pxText(ctx, `📚 ${height} book${height > 1 ? 's' : ''} high · ${F.name}`, W / 2, 16, 15, '#ffd43b');
      if (car.phase === 'ready' && !busy) pxText(ctx, 'TAP THE CAR TO LET IT GO!', W / 2, 60, 15, '#ffffff');
    }

    // ----- controls under the screen -----
    const hCount = h('span', { class: 'lab-count' });
    const minus = h('button', { class: 'lab-chip', type: 'button', 'aria-label': 'fewer books', onclick: () => setHeight(height - 1) }, '−');
    const plus = h('button', { class: 'lab-chip', type: 'button', 'aria-label': 'more books', onclick: () => setHeight(height + 1) }, '+');
    const floorBtns = floors.map(k => h('button', { class: 'lab-chip', type: 'button', onclick() { if (busy || floor === k) return; floor = k; sfx.tap(); resetCar(); syncControls(); } }, `${RAMP_FLOORS[k].emoji} ${RAMP_FLOORS[k].name}`));
    const goBtn = h('button', { class: 'btn big green', type: 'button', onclick: release }, `${thing} Let it go!`);
    function syncControls() {
      hCount.textContent = `📚 ${height}`;
      floorBtns.forEach((b, k) => { b.classList.toggle('on', floors[k] === floor); b.disabled = busy; });
      minus.disabled = plus.disabled = busy; goBtn.disabled = busy || !car || car.phase !== 'ready';
    }

    resetCar();
    const stopLoop = gameLoop(cv, step);
    const root = h('div', { class: 'game arcade lab ramp' },
      missions.box,
      h('div', { class: 'arc-screen' }, cv),
      h('div', { class: 'lab-controls' },
        h('span', { class: 'lab-label' }, 'Ramp:'), minus, hCount, plus,
        h('span', { class: 'lab-label' }, 'Floor:'), ...floorBtns),
      h('div', { class: 'btn-row' }, goBtn),
      missions.ask, table.el);
    root._test = {
      frames(n) { for (let i = 0; i < n; i++) step(1 / 60); },
      set(hh, f) { if (hh) setHeight(hh); if (f) { floor = f; resetCar(); syncControls(); } },
      release, get car() { return car; }, get busy() { return busy; }, get mission() { return missions.i; },
    };
    root._stop = stopLoop;
    missions.next();
    return root;
  };

  // ===== Seed Garden: plant seeds, choose sun or dark, water them, then fast-forward 2 weeks =====
  // r.missions: [{ text, pots: 1–3, goal: 'healthy' | 'lightTest' | 'waterTest' | 'dryTest', yes, fix, ask: [questions] }]
  // Drag a seed from the packet into each pot, drag pots between the sunny window and the dark cupboard,
  // and drag the watering can over a pot to pour. The meter shows too little, just right or too much.
  const GROW = {
    healthy: { h: 120, stem: '#2e9e3e', leaf: '#5bbf3a', bend: 0, look: 'green and strong' },
    pale: { h: 150, stem: '#d8d27a', leaf: '#f0eaa0', bend: 34, look: 'pale yellow and floppy' },
    dry: { h: 24, stem: '#8a6a3a', leaf: '#a0743a', bend: 12, look: 'brown and droopy' },
    rot: { h: 40, stem: '#9bb04a', leaf: '#d9c94a', bend: 6, look: 'yellow leaves, mushy roots' },
    asleep: { h: 0, look: 'nothing grew – no water' },
  };
  const waterCat = w => (w < 0.3 ? 'none' : w < 2 ? 'dry' : w <= 5 ? 'good' : 'soggy');
  const WATER_WORD = { none: 'no water', dry: 'too little', good: 'just right', soggy: 'too much' };
  GAMES.garden = function (r, key, done) {
    const W = 640, H = 400, SHELF = 318, MIDX = 330, POT_W = 64, POT_H = 52;
    const { cv, ctx } = arcadeCanvas(W, H);
    const PACKET = { x: 20, y: 44, w: 92, h: 58 }, CAN_HOME = { x: 560, y: 70 };
    const canSpr = spriteCanvas(['......kkkk....', '.....k....k...', 'k...kbbbbbbk..', 'kk.kbbbbbbbbk.', '.kkbbbbbbbbbk.', '..kbbBbbbbbbk.', '...kbbbbbbbk..', '...kbbbbbbbk..', '....kkkkkkk...'], { k: '#1b1b1b', b: '#4caf50', B: '#a5e08a' }, 4);
    let pots = [], phase = 'setup', drag = null, can = { ...CAN_HOME, pouring: false }, drops = [], growT = 0, time = 0;
    const table = resultsTable(r.caption || '🌱 Our growing results (after 2 weeks)', ['Pot', 'Place', 'Water', 'Height', 'How it looks']);
    const missions = missionRunner(r, key, done, m => setup(m.pots || 1));
    const place = p => (p.x < MIDX ? 'sun' : 'dark');
    function setup(n) {
      pots = Array.from({ length: n }, (_, i) => ({ id: 'ABC'[i], x: 90 + i * 85 + (n === 1 ? 70 : 0), seed: false, water: 0, res: null, plant: 0 }));
      phase = 'setup'; growT = 0; drops = []; can = { ...CAN_HOME, pouring: false }; syncControls();
    }
    function outcome(p) {
      const w = waterCat(p.water);
      if (w === 'none') return 'asleep';
      if (w === 'soggy') return 'rot';
      if (w === 'dry') return 'dry';
      return place(p) === 'sun' ? 'healthy' : 'pale';
    }
    const potAt = (x, y) => pots.find(p => Math.abs(x - p.x) < POT_W / 2 + 6 && y > SHELF - POT_H - 30 && y < SHELF + 6);

    // ----- dragging seeds, pots and the watering can -----
    cv.addEventListener('pointerdown', e => {
      if (phase !== 'setup') return;
      const [x, y] = toGame(cv, W, H, e);
      e.preventDefault();
      try { cv.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      if (x > PACKET.x && x < PACKET.x + PACKET.w && y > PACKET.y && y < PACKET.y + PACKET.h) { drag = { kind: 'seed', x, y }; sfx.tap(); return; }
      if (Math.abs(x - can.x) < 40 && Math.abs(y - can.y) < 30) { drag = { kind: 'can', dx: can.x - x, dy: can.y - y }; sfx.tap(); return; }
      const p = potAt(x, y);
      if (p) { drag = { kind: 'pot', p, dx: p.x - x }; return; }
    });
    cv.addEventListener('pointermove', e => {
      if (!drag) return;
      const [x, y] = toGame(cv, W, H, e);
      if (drag.kind === 'seed') { drag.x = x; drag.y = y; }
      if (drag.kind === 'can') { can.x = Math.max(30, Math.min(W - 30, x + drag.dx)); can.y = Math.max(40, Math.min(SHELF - 60, y + drag.dy)); }
      if (drag.kind === 'pot') drag.p.x = Math.max(44, Math.min(W - 44, x + drag.dx));
    });
    const drop = () => {
      if (!drag) return;
      if (drag.kind === 'seed') {
        const p = potAt(drag.x, drag.y + 30);
        if (p && !p.seed) { p.seed = true; sfx.good(); say(pots.every(q => q.seed) ? 'Planted! Now choose a spot and water it.' : 'Planted! Next pot!'); }
        else if (p) say('That pot already has a seed!');
        else say('Drop the seed right into a pot!');
      }
      if (drag.kind === 'pot') sfx.tap();
      if (drag.kind === 'can') { can.x = CAN_HOME.x; can.y = CAN_HOME.y; can.pouring = false; }
      drag = null; syncControls();
    };
    cv.addEventListener('pointerup', drop); cv.addEventListener('pointercancel', drop);

    function grow() {
      if (phase !== 'setup') return;
      if (!pots.every(p => p.seed)) { sfx.bad(); say('Plant a seed in every pot first! Drag one from the packet.'); return; }
      pots.forEach(p => { p.res = outcome(p); });
      phase = 'growing'; growT = 0; sfx.tap(); syncControls();
      say('Fast-forward! Watch them grow for two weeks…');
    }
    function grown() {
      phase = 'grown';
      pots.forEach(p => table.add([`${missions.i + 1}${p.id}`, place(p) === 'sun' ? '☀️ sunny window' : '🌑 dark cupboard', WATER_WORD[waterCat(p.water)],
        `${Math.round(GROW[p.res].h / 6)} cm`, GROW[p.res].look]));
      const R = pots.map(p => ({ sun: place(p) === 'sun', w: waterCat(p.water), res: p.res }));
      const m = missions.m;
      const ok = {
        healthy: () => R.some(q => q.res === 'healthy'),
        lightTest: () => R.some(q => q.sun) && R.some(q => !q.sun) && R.every(q => q.w === 'good'),
        waterTest: () => R.every(q => q.sun) && R.some(q => q.w === 'good') && R.some(q => q.w === 'soggy'),
        dryTest: () => R.every(q => q.sun) && R.some(q => q.w === 'good') && R.some(q => q.w === 'none' || q.w === 'dry'),
      }[m.goal] || (() => true);
      if (ok()) missions.win(cv);
      else {
        sfx.bad();
        say(m.fix || 'Interesting result! But that was not quite the mission. Read it again, then press Start again.');
      }
      syncControls();
    }

    function step(dt) {
      time += dt;
      if (drag && drag.kind === 'can') {
        // pour when the spout (left end of the can) is over a pot
        const sx = can.x - 30, p = pots.find(q => Math.abs(sx - q.x) < POT_W / 2);
        can.pouring = !!p;
        if (p) {
          p.water = Math.min(10, p.water + 2.2 * dt);
          if (Math.random() < 0.6) drops.push({ x: sx + (Math.random() - 0.5) * 8, y: can.y - 4, vy: 60 });
        }
      }
      drops.forEach(d => { d.vy += 600 * dt; d.y += d.vy * dt; });
      drops = drops.filter(d => d.y < SHELF - POT_H + 6);
      if (phase === 'growing') { growT += dt / 4; if (growT >= 1) { growT = 1; grown(); } }
      draw();
    }
    function drawPlant(p, prog) {
      const g = GROW[p.res], top = SHELF - POT_H;
      if (p.res === 'asleep') { pxText(ctx, 'z z z', p.x, top - 20 - Math.sin(time * 2) * 3, 14, '#ffffff'); return; }
      const hh = g.h * prog;
      for (let y = 0; y < hh; y += 4) {
        const f = y / Math.max(1, g.h), off = g.bend * f * f;
        ctx.fillStyle = g.stem; ctx.fillRect(p.x - 3 + off, top - y - 4, 6, 5);
        if (y > 14 && y % 28 < 4) {
          const side = (y / 28 | 0) % 2 ? 1 : -1;
          ctx.fillStyle = '#000'; ctx.fillRect(p.x + off + (side > 0 ? 2 : -20), top - y - 6, 20, 10);
          ctx.fillStyle = g.leaf; ctx.fillRect(p.x + off + (side > 0 ? 3 : -19), top - y - 5, 18, 8);
        }
      }
      if (p.res === 'rot') { ctx.fillStyle = '#5a4630'; ctx.fillRect(p.x - POT_W / 2 + 8, top - 2, POT_W - 16, 6); }
    }
    function draw() {
      // sunny window on the left, dark cupboard on the right
      skyAndGround(ctx, W, H, SHELF);
      ctx.fillStyle = '#fff3a8'; ctx.fillRect(130, 34, 150, 150);
      ctx.fillStyle = '#ffcc33'; ctx.fillRect(170, 64, 70, 70); ctx.fillStyle = '#fff6c2'; ctx.fillRect(184, 78, 42, 42);
      ctx.strokeStyle = '#6b4423'; ctx.lineWidth = 8; ctx.strokeRect(130, 34, 150, 150);
      ctx.beginPath(); ctx.moveTo(205, 34); ctx.lineTo(205, 184); ctx.moveTo(130, 109); ctx.lineTo(280, 109); ctx.stroke();
      ctx.fillStyle = 'rgba(255,230,107,.18)'; ctx.fillRect(0, 0, MIDX, SHELF);
      ctx.fillStyle = '#1a140f'; ctx.fillRect(MIDX, 20, W - MIDX, SHELF - 20);
      ctx.fillStyle = '#6b4423'; ctx.fillRect(MIDX - 8, 20, 8, SHELF - 20); ctx.fillRect(MIDX, 12, W - MIDX, 8);
      ctx.fillStyle = '#8a5a32'; ctx.fillRect(W - 26, 20, 26, SHELF - 20);
      pxText(ctx, '☀️ SUNNY WINDOW', 205, 206, 14, '#ffd43b');
      pxText(ctx, '🌑 DARK CUPBOARD', (MIDX + W) / 2, 40, 14, '#9fa8d9');
      // the shelf
      ctx.fillStyle = '#000'; ctx.fillRect(0, SHELF, W, 14); ctx.fillStyle = '#c08a52'; ctx.fillRect(0, SHELF + 2, W, 10);
      // seed packet
      ctx.fillStyle = '#000'; ctx.fillRect(PACKET.x - 3, PACKET.y - 3, PACKET.w + 6, PACKET.h + 6);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(PACKET.x, PACKET.y, PACKET.w, PACKET.h);
      ctx.fillStyle = '#5bbf3a'; ctx.fillRect(PACKET.x, PACKET.y, PACKET.w, 16);
      pxText(ctx, 'BEANS', PACKET.x + PACKET.w / 2, PACKET.y + 9, 11, '#ffffff');
      emojiAt(ctx, '🫘', PACKET.x + PACKET.w / 2, PACKET.y + 50, 28);
      // pots, plants and water meters
      pots.forEach(p => {
        const top = SHELF - POT_H;
        if (p.res) drawPlant(p, phase === 'growing' ? growT : 1);
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.moveTo(p.x - POT_W / 2 - 3, top - 3); ctx.lineTo(p.x + POT_W / 2 + 3, top - 3); ctx.lineTo(p.x + POT_W / 2 - 9, SHELF); ctx.lineTo(p.x - POT_W / 2 + 9, SHELF); ctx.fill();
        ctx.fillStyle = '#d9733b'; ctx.beginPath(); ctx.moveTo(p.x - POT_W / 2, top); ctx.lineTo(p.x + POT_W / 2, top); ctx.lineTo(p.x + POT_W / 2 - 11, SHELF - 3); ctx.lineTo(p.x - POT_W / 2 + 11, SHELF - 3); ctx.fill();
        ctx.fillStyle = '#b5552a'; ctx.fillRect(p.x - POT_W / 2, top, POT_W, 10);
        const wc = waterCat(p.water);
        ctx.fillStyle = wc === 'none' || wc === 'dry' ? '#8a5a32' : '#4a2f18'; ctx.fillRect(p.x - POT_W / 2 + 4, top + 1, POT_W - 8, 6);
        if (p.seed && !p.res) { ctx.fillStyle = '#000'; ctx.fillRect(p.x - 6, top - 3, 12, 7); ctx.fillStyle = '#c98a5a'; ctx.fillRect(p.x - 5, top - 2, 10, 5); }
        pxText(ctx, p.id, p.x, top + 28, 18, '#ffffff');
        if (phase === 'setup') {
          // water meter: brown = too little, green = just right, blue = too much
          const mx = p.x + POT_W / 2 + 6, my = top - 6, mh = 54;
          ctx.fillStyle = '#000'; ctx.fillRect(mx - 2, my - 2, 12, mh + 4);
          ctx.fillStyle = '#c6a06a'; ctx.fillRect(mx, my + mh * 0.8, 8, mh * 0.2);
          ctx.fillStyle = '#7cfc3a'; ctx.fillRect(mx, my + mh * 0.5, 8, mh * 0.3);
          ctx.fillStyle = '#5aa8f0'; ctx.fillRect(mx, my, 8, mh * 0.5);
          const lvl = my + mh - Math.min(10, p.water) / 10 * mh;
          ctx.fillStyle = '#ffffff'; ctx.fillRect(mx - 4, lvl - 2, 16, 4);
          pxText(ctx, WATER_WORD[wc], p.x, SHELF + 30, 11, wc === 'good' ? '#7cfc3a' : '#ffffff');
        } else if (p.res && phase === 'grown') pxText(ctx, `${Math.round(GROW[p.res].h / 6)} cm`, p.x, SHELF + 30, 13, '#ffd43b');
      });
      // falling water
      ctx.fillStyle = '#5aa8f0'; drops.forEach(d => ctx.fillRect(d.x, d.y, 3, 6));
      // the watering can (tilts while pouring)
      ctx.save(); ctx.translate(can.x, can.y); if (can.pouring) ctx.rotate(-0.45);
      ctx.drawImage(canSpr, -canSpr.width / 2, -canSpr.height / 2); ctx.restore();
      if (drag && drag.kind === 'seed') emojiAt(ctx, '🫘', drag.x, drag.y, 26);
      if (phase === 'growing') {
        ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(W / 2 - 110, 120, 220, 44);
        pxText(ctx, `⏩ DAY ${Math.min(14, 1 + Math.floor(growT * 14))}`, W / 2, 142, 22, '#ffd43b');
      }
    }

    const growBtn = h('button', { class: 'btn big green', type: 'button', onclick: grow }, '⏩ Grow for 2 weeks!');
    const againBtn = h('button', { class: 'btn ghost', type: 'button', onclick() { sfx.tap(); missions.ask.replaceChildren(); setup((missions.m && missions.m.pots) || 1); say('Fresh pots! Try again.'); } }, '↺ Start again');
    function syncControls() {
      growBtn.disabled = phase !== 'setup';
      growBtn.classList.toggle('ready', phase === 'setup' && pots.length > 0 && pots.every(p => p.seed && p.water > 0.3));
      againBtn.hidden = phase === 'growing';
    }
    const stopLoop = gameLoop(cv, step);
    const root = h('div', { class: 'game arcade lab garden' },
      missions.box,
      h('div', { class: 'arc-screen' }, cv),
      h('p', { class: 'arc-tip' }, '🫘 Drag a seed into each pot · 🪴 drag pots to the sun or the dark · 🚿 drag the green can over a pot to water it'),
      h('div', { class: 'btn-row' }, againBtn, growBtn),
      missions.ask, table.el);
    root._test = {
      frames(n) { for (let i = 0; i < n; i++) step(1 / 60); },
      plant(i) { pots[i].seed = true; syncControls(); }, move(i, x) { pots[i].x = x; }, water(i, w) { pots[i].water = w; syncControls(); },
      grow, get pots() { return pots; }, get phase() { return phase; }, get mission() { return missions.i; },
    };
    root._stop = stopLoop;
    missions.next();
    return root;
  };

  // ===== Wind Test: switch on the wind and see how far it carries each kind of seed =====
  // r.seeds: [{ id, name, look: 'parachute' | 'wing' | 'nut' | 'berry', m: metres the wind carries it }] · r.caption
  // r.missions: [{ text, need: [seed ids to test], yes, ask: [questions] }]
  // Pick a seed, then switch on the wind: a parachute floats, a wing spins, a heavy nut drops and rolls a little.
  GAMES.windtest = function (r, key, done) {
    const W = 640, H = 330, FLOOR = 270, X0 = 92, TOP = 108;
    const { cv, ctx } = arcadeCanvas(W, H);
    const seeds = r.seeds;
    const maxM = Math.max(...seeds.map(sd => sd.m)), PX = (W - X0 - 40) / maxM; // pixels per metre
    const STYLE = { // how long the flight lasts, how the seed falls (0–1 → 0–1), and when it moves sideways
      parachute: { T: 4.2, fall: t => t, side: t => t },
      wing: { T: 2.8, fall: t => t, side: t => t },
      nut: { T: 1.3, fall: t => Math.min(1, (t / 0.55) ** 2), side: t => (t < 0.55 ? t * 0.3 : 0.165 + (t - 0.55) / 0.45 * 0.835) },
      berry: { T: 1.1, fall: t => Math.min(1, (t / 0.7) ** 2), side: t => (t < 0.7 ? t * 0.4 : 0.28 + (t - 0.7) / 0.3 * 0.72) },
    };
    let pick = seeds[0], fly = null, marks = [], tested = new Set(), time = 0, busy = false;
    const table = resultsTable(r.caption || '🌬️ Our wind test results', ['Test', 'Seed', 'Distance']);
    let runN = 0;
    const missions = missionRunner(r, key, done, () => { tested = new Set(); busy = false; fly = null; sync(); });

    function blow() {
      if (busy) return;
      busy = true; sfx.zap();
      fly = { sd: pick, t: 0 };
      say('Whoosh! Watch where it lands…');
      sync();
    }
    function landed() {
      const sd = fly.sd;
      runN++; tested.add(sd.id);
      marks.push({ x: X0 + sd.m * PX, m: sd.m, sd });
      if (marks.length > 4) marks.shift();
      table.add([runN, sd.name, `${sd.m} m`]);
      const m = missions.m, need = (m && m.need) || [];
      const left = need.filter(id => !tested.has(id));
      if (m && !left.length) missions.win(cv);
      else {
        say(`${sd.m} m! ${left.length ? 'Now try the ' + left.map(id => seeds.find(x => x.id === id).name).join(' and the ') + '.' : ''}`);
        setTimeout(() => { busy = false; fly = null; sync(); }, 700);
      }
      sync();
    }
    function drawSeed(sd, x, y, t) {
      ctx.save(); ctx.translate(x, y);
      if (sd.look === 'parachute') { // a dandelion seed: a stalk with a fluffy umbrella of hairs
        ctx.rotate(Math.sin(t * 3) * 0.15);
        ctx.strokeStyle = '#6b4425'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, -6); ctx.stroke();
        ctx.fillStyle = '#6b4425'; ctx.fillRect(-2, 8, 4, 6);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
        for (let a = -2.6; a <= -0.5; a += 0.35) { ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(Math.cos(a) * 16, -6 + Math.sin(a) * 16); ctx.stroke(); }
      } else if (sd.look === 'wing') { // a sycamore seed: a round seed with one long wing, spinning
        ctx.rotate(t * 14);
        ctx.fillStyle = '#000'; ctx.fillRect(-3, -22, 14, 26); ctx.fillStyle = '#c9a25a'; ctx.fillRect(-1, -20, 10, 22);
        ctx.fillStyle = '#000'; ctx.fillRect(-8, -2, 14, 14); ctx.fillStyle = '#8a5a32'; ctx.fillRect(-6, 0, 10, 10);
      } else emojiAt(ctx, sd.look === 'berry' ? '🍒' : '🌰', 0, 12, 26, sd.look === 'nut' && fly && fly.t > 0.55 ? (fly.t - 0.55) * 18 : 0);
      ctx.restore();
    }
    function step(dt) {
      time += dt;
      if (fly) {
        const S = STYLE[fly.sd.look] || STYLE.parachute;
        fly.t = Math.min(1, fly.t + dt / S.T);
        if (fly.t >= 1 && busy && !fly.down) { fly.down = true; landed(); }
      }
      draw();
    }
    function draw() {
      skyAndGround(ctx, W, H, FLOOR);
      // measuring tape along the ground, in metres
      ctx.fillStyle = '#ffd43b'; ctx.fillRect(X0, FLOOR + 22, W - X0, 22); ctx.fillStyle = '#000'; ctx.fillRect(X0, FLOOR + 44, W - X0, 2);
      const stepM = maxM > 30 ? 10 : maxM > 12 ? 5 : 1;
      for (let mm = 0; mm * PX <= W - X0; mm += stepM) { ctx.fillStyle = '#000'; ctx.fillRect(X0 + mm * PX, FLOOR + 22, 2, 10); if (mm) pxText(ctx, String(mm), X0 + mm * PX, FLOOR + 37, 10, '#fff'); }
      pxText(ctx, 'm', W - 14, FLOOR + 37, 10, '#fff');
      // the parent plant
      ctx.fillStyle = '#000'; ctx.fillRect(X0 - 5, TOP + 10, 10, FLOOR - TOP - 10); ctx.fillStyle = '#2e9e3e'; ctx.fillRect(X0 - 3, TOP + 12, 6, FLOOR - TOP - 12);
      ctx.fillStyle = '#5bbf3a'; ctx.fillRect(X0 - 26, TOP + 70, 22, 10); ctx.fillRect(X0 + 4, TOP + 100, 22, 10);
      // the fan
      ctx.fillStyle = '#000'; ctx.fillRect(8, TOP - 26, 36, 52); ctx.fillStyle = '#8e9aa8'; ctx.fillRect(11, TOP - 23, 30, 46);
      ctx.save(); ctx.translate(26, TOP); ctx.rotate(busy ? time * 20 : 0); ctx.fillStyle = '#fff'; ctx.fillRect(-2, -16, 4, 32); ctx.fillRect(-16, -2, 32, 4); ctx.restore();
      ctx.fillStyle = '#000'; ctx.fillRect(22, TOP + 26, 8, FLOOR - TOP - 26);
      if (busy) for (let k = 0; k < 7; k++) { // wind streaks
        const x = 60 + ((time * 260 + k * 97) % (W - 60)), y = TOP - 40 + k * 22;
        ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(x, y, 26, 3);
      }
      // where earlier seeds landed
      marks.forEach((mk, k) => {
        const last = k === marks.length - 1;
        ctx.fillStyle = last ? '#e53935' : 'rgba(0,0,0,.35)'; ctx.fillRect(mk.x - 1, FLOOR - 34, 3, 34);
        if (last) { ctx.fillStyle = '#e53935'; ctx.fillRect(mk.x + 2, FLOOR - 34, 16, 10); pxText(ctx, mk.m + ' m', mk.x, FLOOR - 46, 14, '#fff'); }
      });
      // the seed: waiting on the plant, flying, or on the ground
      if (fly) {
        const S = STYLE[fly.sd.look] || STYLE.parachute, t = fly.t;
        const x = X0 + S.side(t) * fly.sd.m * PX, bob = fly.sd.look === 'parachute' ? Math.sin(t * 18) * 8 * (1 - t) : 0;
        drawSeed(fly.sd, x, TOP + S.fall(t) * (FLOOR - 12 - TOP) + bob, time);
      } else drawSeed(pick, X0, TOP, 0);
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, 30);
      pxText(ctx, `🌬️ Wind test: ${pick.name}`, W / 2, 16, 15, '#ffd43b');
    }

    const seedBtns = seeds.map(sd => h('button', { class: 'lab-chip', type: 'button', onclick() { if (busy) return; pick = sd; sfx.tap(); sync(); } }, sd.name));
    const goBtn = h('button', { class: 'btn big green', type: 'button', onclick: blow }, '🌬️ Switch on the wind!');
    function sync() {
      seedBtns.forEach((b, k) => { b.classList.toggle('on', seeds[k] === pick); b.disabled = busy; });
      goBtn.disabled = busy;
    }
    sync();
    const stopLoop = gameLoop(cv, step);
    const root = h('div', { class: 'game arcade lab windtest' },
      missions.box,
      h('div', { class: 'arc-screen' }, cv),
      h('div', { class: 'lab-controls' }, h('span', { class: 'lab-label' }, 'Seed:'), ...seedBtns),
      h('div', { class: 'btn-row' }, goBtn),
      missions.ask, table.el);
    root._test = {
      frames(n) { for (let i = 0; i < n; i++) step(1 / 60); },
      pick(id) { pick = seeds.find(sd => sd.id === id); sync(); }, blow,
      get busy() { return busy; }, get mission() { return missions.i; },
    };
    root._stop = stopLoop;
    missions.next();
    return root;
  };

  // ===== Bee Flight: fly a bee from flower to flower to carry pollen (pollination → fruit and seeds) =====
  // r.missions: [{ text, flowers: ['apple', 'apple', 'poppy'], goal: 'collect' | 'all', yes, fix, ask: [questions] }]
  // Touch or drag anywhere and the bee flies there. Hover on a flower's middle to drink nectar: the bee picks up
  // that flower's pollen (dots in its colour), and leaves pollen on another flower of the SAME kind, which then
  // drops its petals and grows a fruit or seed head.
  const BLOOMS = {
    apple: { name: 'apple blossom', petal: '#ffd6e7', mid: '#ffd43b', pollen: '#ffe066', fruit: 'apple', made: 'an apple' },
    poppy: { name: 'poppy', petal: '#e53935', mid: '#2b2b2b', pollen: '#5b4a8a', fruit: 'pod', made: 'a seed pod' },
    sunflower: { name: 'sunflower', petal: '#ffcc33', mid: '#8a5a32', pollen: '#ff9f1a', fruit: 'seeds', made: 'a head full of seeds' },
    daisy: { name: 'daisy', petal: '#ffffff', mid: '#ffd43b', pollen: '#ffd43b', fruit: 'pod', made: 'tiny seeds' },
  };
  GAMES.pollinate = function (r, key, done) {
    const W = 640, H = 400, GROUND = 330;
    const { cv, ctx } = arcadeCanvas(W, H);
    let flowers = [], bee = { x: 80, y: 80, tx: 80, ty: 80, pollen: {} }, hover = null, hoverT = 0, time = 0, puffs = [], warned = {}, checking = false;
    const missions = missionRunner(r, key, done, m => setup(m.flowers || ['apple', 'apple', 'apple']));
    function setup(kinds) {
      const gap = W / (kinds.length + 1);
      flowers = kinds.map((k, i) => ({ id: i, kind: k, x: gap * (i + 1), y: 170 + ((i * 53) % 70), state: 'open', t: 0 }));
      bee = { x: 70, y: 70, tx: 70, ty: 70, pollen: {} }; hover = null; hoverT = 0; puffs = []; warned = {}; checking = false;
    }
    const pollinated = () => flowers.filter(f => f.state !== 'open').length;

    // the bee follows your finger
    const aim = e => { const [x, y] = toGame(cv, W, H, e); bee.tx = Math.max(20, Math.min(W - 20, x)); bee.ty = Math.max(30, Math.min(GROUND - 10, y)); };
    cv.addEventListener('pointerdown', e => { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } aim(e); });
    cv.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'mouse') aim(e); });

    function visit(f) {
      const B = BLOOMS[f.kind];
      if (f.state !== 'open') { say(`This ${B.name} is already pollinated – it is busy making ${B.made}!`); return; }
      const src = bee.pollen[f.kind];
      if (src != null && src !== f.id) {
        f.state = 'pollinated'; f.t = 0; sfx.good();
        for (let i = 0; i < 12; i++) puffs.push({ x: f.x, y: f.y, vx: (Math.random() - 0.5) * 120, vy: -Math.random() * 90, c: B.pollen, life: 0.8 });
        say(`Pollen delivered! The ${B.name} can now make ${B.made}.`);
      } else if (Object.keys(bee.pollen).some(k => k !== f.kind) && !warned[f.kind]) {
        warned[f.kind] = true; sfx.bad();
        const other = Object.keys(bee.pollen).find(k => k !== f.kind);
        say(`That is ${BLOOMS[other].name} pollen – it only works on a ${BLOOMS[other].name}! But you picked up some ${B.name} pollen too.`);
      } else if (src === f.id) say('Same flower! Fly to a DIFFERENT flower of this kind to drop the pollen off.');
      else say(`Slurp! Nectar for the bee – and sticky ${B.name} pollen on its fuzzy body. Now visit another ${B.name}!`);
      bee.pollen[f.kind] = f.id;
      sfx.tap();
      check();
    }
    function check() {
      const m = missions.m;
      if (!m || checking) return;
      const ok = m.goal === 'collect' ? Object.keys(bee.pollen).length > 0 : flowers.every(f => f.state !== 'open');
      if (ok) { checking = true; setTimeout(() => missions.win(cv), m.goal === 'collect' ? 300 : 1800); }
    }

    function step(dt) {
      time += dt;
      bee.x += (bee.tx - bee.x) * Math.min(1, dt * 5); bee.y += (bee.ty - bee.y) * Math.min(1, dt * 5);
      const f = flowers.find(q => Math.hypot(q.x - bee.x, q.y - bee.y) < 30);
      if (f !== hover) { hover = f; hoverT = 0; }
      if (hover && hoverT >= 0) { hoverT += dt; if (hoverT > 0.35) { hoverT = -1; visit(hover); } }
      flowers.forEach(q => { if (q.state === 'pollinated') { q.t += dt; if (q.t > 1.4) q.state = 'fruit'; } });
      puffs.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 200 * dt; p.life -= dt; });
      puffs = puffs.filter(p => p.life > 0);
      draw();
    }
    function drawFlower(f) {
      const B = BLOOMS[f.kind], s = 10;
      ctx.fillStyle = '#2e9e3e'; ctx.fillRect(f.x - 3, f.y, 6, GROUND - f.y);
      ctx.fillStyle = '#5bbf3a'; ctx.fillRect(f.x + 3, f.y + 60, 18, 8); ctx.fillRect(f.x - 21, f.y + 100, 18, 8);
      if (f.state === 'fruit') {
        if (B.fruit === 'apple') emojiAt(ctx, '🍎', f.x, f.y + 14, 34);
        else if (B.fruit === 'seeds') {
          ctx.fillStyle = '#000'; ctx.fillRect(f.x - 21, f.y - 21, 42, 42); ctx.fillStyle = '#6b4425'; ctx.fillRect(f.x - 19, f.y - 19, 38, 38);
          ctx.fillStyle = '#e9cfa6'; for (let i = 0; i < 9; i++) ctx.fillRect(f.x - 15 + (i % 3) * 11, f.y - 15 + (i / 3 | 0) * 11, 6, 6);
        } else {
          ctx.fillStyle = '#000'; ctx.fillRect(f.x - 12, f.y - 16, 24, 30); ctx.fillStyle = '#9bb06a'; ctx.fillRect(f.x - 10, f.y - 14, 20, 26);
          ctx.fillStyle = '#6f7f45'; ctx.fillRect(f.x - 10, f.y - 16, 20, 4);
        }
        return;
      }
      const drop = f.state === 'pollinated' ? f.t / 1.4 : 0; // petals fall off once it is pollinated
      [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([dx, dy], i) => {
        const far = i < 4 ? 2.2 : 1.6, px = f.x + dx * s * far - s, py = f.y + dy * s * far - s + drop * (40 + i * 12);
        ctx.globalAlpha = 1 - drop * 0.9;
        ctx.fillStyle = '#000'; ctx.fillRect(px - 1, py - 1, s * 2 + 2, s * 2 + 2);
        ctx.fillStyle = B.petal; ctx.fillRect(px, py, s * 2, s * 2);
        ctx.globalAlpha = 1;
      });
      ctx.fillStyle = '#000'; ctx.fillRect(f.x - 13, f.y - 13, 26, 26);
      ctx.fillStyle = B.mid; ctx.fillRect(f.x - 11, f.y - 11, 22, 22);
      ctx.fillStyle = B.pollen; [[-6, -6], [3, -5], [-4, 3], [4, 4]].forEach(([dx, dy]) => ctx.fillRect(f.x + dx, f.y + dy, 3, 3));
      if (f.state === 'pollinated') pxText(ctx, '✓', f.x + 22, f.y - 24, 18, '#7cfc3a');
    }
    function draw() {
      skyAndGround(ctx, W, H, GROUND);
      flowers.forEach(drawFlower);
      puffs.forEach(p => { ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, 4, 4); });
      // the bee, with the pollen it is carrying stuck to it
      const by = bee.y + Math.sin(time * 12) * 2;
      Object.keys(bee.pollen).forEach((k, j) => {
        ctx.fillStyle = BLOOMS[k].pollen;
        [[-14, 8], [12, 10], [-6, 14], [6, -12]].forEach(([dx, dy], i) => ctx.fillRect(bee.x + dx + j * 3, by + dy - j * 2 + (i % 2), 4, 4));
      });
      emojiAt(ctx, '🐝', bee.x, by + 16, 46);
      if (hover && hoverT > 0) { ctx.fillStyle = '#000'; ctx.fillRect(bee.x - 21, by - 32, 42, 8); ctx.fillStyle = '#ffd43b'; ctx.fillRect(bee.x - 19, by - 30, 38 * Math.min(1, hoverT / 0.35), 4); }
      const n = pollinated();
      pxText(ctx, `🌸 ${n}/${flowers.length} pollinated`, W - 12, 22, 16, n === flowers.length ? '#7cfc3a' : '#ffffff', 'right');
    }

    const stopLoop = gameLoop(cv, step);
    const root = h('div', { class: 'game arcade lab pollinate' },
      missions.box,
      h('div', { class: 'arc-screen' }, cv),
      h('p', { class: 'arc-tip' }, '🐝 Touch or drag anywhere and the bee flies there · hover on the middle of a flower to drink nectar'),
      missions.ask);
    root._test = {
      frames(n) { for (let i = 0; i < n; i++) step(1 / 60); },
      fly(i) { bee.x = bee.tx = flowers[i].x; bee.y = bee.ty = flowers[i].y; for (let k = 0; k < 30; k++) step(1 / 60); },
      get flowers() { return flowers; }, get bee() { return bee; }, get mission() { return missions.i; },
    };
    root._stop = stopLoop;
    missions.next();
    return root;
  };

  // ===== Rock Lab: test rock samples like a geologist =====
  // r.rocks: ids from ROCKS (granite, marble, slate, sandstone, chalk, pumice) – the samples on the bench.
  // r.tests: which tools to offer (default all): 'look' (magnifying glass: crystals, grains, layers or holes),
  //   'scratch' (drag the paper clip across the rock – soft rocks scratch and crumble), 'water' (drip water on it –
  //   permeable rocks soak it up, impermeable ones leave a droplet) and 'float' (drop it in a tank of water).
  // r.missions: [{ text, need: ['chalk:scratch', 'granite:scratch'], yes, ask: [questions] }] – the tests to do.
  // Every test adds a row to the results table.
  const ROCKS = {
    granite: { name: 'Granite', type: 'igneous', c: ['#d9a3a0', '#8e8e8e', '#2b2b2b', '#f1e3d3'], look: 'crystals', hard: 3, soak: false, float: false,
      lookTxt: 'big speckly crystals, locked tightly together' },
    marble: { name: 'Marble', type: 'metamorphic', c: ['#f4f4f0', '#ffffff', '#c9c9c9', '#9aa3ad'], look: 'veins', hard: 2, soak: false, float: false,
      lookTxt: 'tiny shiny crystals with grey swirly lines' },
    slate: { name: 'Slate', type: 'metamorphic', c: ['#4a5160', '#5a6272', '#3b414d', '#6b7480'], look: 'layers', hard: 2, soak: false, float: false,
      lookTxt: 'thin flat layers, squashed tightly together' },
    sandstone: { name: 'Sandstone', type: 'sedimentary', c: ['#e0b46c', '#c9974f', '#f0cf8f', '#b07f3e'], look: 'grains', hard: 1, soak: true, float: false,
      lookTxt: 'round grains of sand, stuck together with little gaps between them' },
    chalk: { name: 'Chalk', type: 'sedimentary', c: ['#fbfbf6', '#ecece4', '#ffffff', '#dcdccf'], look: 'powder', hard: 0, soak: true, float: false,
      lookTxt: 'fine powdery bits, made from tiny sea shells long ago' },
    pumice: { name: 'Pumice', type: 'igneous', c: ['#c8c6bd', '#b3b0a6', '#dedcd3', '#3f3d38'], look: 'holes', hard: 1, soak: true, float: true,
      lookTxt: 'full of holes – bubbles of gas trapped when lava cooled fast' },
  };
  const ROCK_TOOLS = { look: '🔍 Look closely', scratch: '📎 Scratch test', water: '💧 Water drop', float: '🪣 Sink or float?' };
  const SCRATCH_TXT = ['a deep scratch and lots of powder – very soft', 'scratched easily, and grains rub off – soft', 'only a thin scratch line – quite hard', 'no scratch at all – very hard'];
  GAMES.rocklab = function (r, key, done) {
    const W = 640, H = 340, RX = 220, RY = 190, TANK = { x: 450, y: 110, w: 150, h: 180 };
    const { cv, ctx } = arcadeCanvas(W, H);
    const rocks = (r.rocks || Object.keys(ROCKS)).map(id => Object.assign({ id }, ROCKS[id]));
    const tools = r.tests || Object.keys(ROCK_TOOLS);
    let rock = rocks[0], tool = tools[0], busy = false, anim = null, scratches = [], dragPath = null, crumbs = [], wet = 0, drop = null, done_ = new Set(), runN = 0, time = 0;
    const table = resultsTable(r.caption || '🪨 Our rock test results', ['Test', 'Rock', 'What we tested', 'What happened']);
    const missions = missionRunner(r, key, done, () => { done_ = new Set(); busy = false; sync(); });
    // each rock is a lumpy pixel blob, its cells coloured by its texture
    const CELL = 8, rand = (x, y, k) => { const n = Math.sin(x * 12.9898 + y * 78.233 + k * 37.719) * 43758.5453; return n - Math.floor(n); };
    function inRock(x, y, rk) { // a lumpy ellipse, a little different for every rock
      const k = Object.keys(ROCKS).indexOf(rk.id);
      const a = Math.atan2(y, x), rad = 1 + 0.12 * Math.sin(a * 3 + k) + 0.07 * Math.sin(a * 5 + k * 2);
      return (x / 120) ** 2 + (y / 80) ** 2 < rad * rad;
    }
    function cellColour(rk, gx, gy) {
      const c = rk.c, n = rand(gx, gy, 1);
      switch (rk.look) {
        case 'crystals': return n < 0.4 ? c[0] : n < 0.75 ? c[1] : n < 0.9 ? c[3] : c[2];
        case 'veins': return Math.abs(Math.sin(gx * 0.5 + gy * 0.9) + Math.sin(gy * 0.3)) < 0.12 ? c[3] : n < 0.7 ? c[0] : n < 0.9 ? c[1] : c[2];
        case 'layers': return gy % 3 === 0 ? c[2] : n < 0.6 ? c[0] : c[1];
        case 'grains': return n < 0.5 ? c[0] : n < 0.8 ? c[1] : n < 0.92 ? c[2] : c[3];
        case 'powder': return n < 0.7 ? c[0] : n < 0.9 ? c[1] : c[3];
        case 'holes': return n < 0.18 ? c[3] : n < 0.6 ? c[0] : n < 0.85 ? c[1] : c[2];
      }
      return c[0];
    }
    function drawRock(rk, cx, cy, scale = 1) {
      for (let gy = -12; gy <= 12; gy++) for (let gx = -16; gx <= 16; gx++) {
        const x = gx * CELL, y = gy * CELL;
        if (!inRock(x, y, rk)) continue;
        ctx.fillStyle = cellColour(rk, gx, gy);
        ctx.fillRect(cx + x * scale, cy + y * scale, CELL * scale + 0.5, CELL * scale + 0.5);
      }
      // a black outline: any cell next to an empty one
      ctx.fillStyle = '#000';
      for (let gy = -13; gy <= 13; gy++) for (let gx = -17; gx <= 17; gx++) {
        const x = gx * CELL, y = gy * CELL;
        if (inRock(x, y, rk)) continue;
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inRock(x + dx * CELL, y + dy * CELL, rk))) ctx.fillRect(cx + x * scale, cy + y * scale, CELL * scale, CELL * scale);
      }
    }
    function record(result) {
      runN++; done_.add(`${rock.id}:${tool}`);
      table.add([runN, rock.name, ROCK_TOOLS[tool].replace(/^\S+\s/, ''), result]);
      say(`${rock.name}: ${result}.`);
      const m = missions.m, need = (m && m.need) || [];
      const left = need.filter(n => !done_.has(n));
      busy = false;
      if (m && need.length && !left.length) { busy = true; setTimeout(() => missions.win(cv), 600); }
      else if (left.length) setTimeout(() => { if (!busy) say(`${rock.name}: ${result}. Next: ${left.map(n => { const [rid, t] = n.split(':'); return `${ROCK_TOOLS[t].replace(/^\S+\s/, '').toLowerCase()} on the ${ROCKS[rid].name.toLowerCase()}`; }).join(', then ')}.`); }, 1600);
      sync();
    }
    // the tests
    function look() { busy = true; anim = { kind: 'look', t: 0, T: 1.8 }; sfx.tap(); sync(); }
    function water() { busy = true; drop = { y: 40, vy: 0, landed: false, t: 0 }; anim = { kind: 'water', t: 0, T: 2.6 }; sfx.tap(); sync(); }
    function sinkFloat() { busy = true; anim = { kind: 'float', t: 0, T: 2.4 }; sfx.zap(); sync(); }
    function scratchDone() {
      const marks = SCRATCH_TXT[rock.hard];
      if (rock.hard <= 1) for (let i = 0; i < (rock.hard ? 10 : 22); i++) crumbs.push({ x: dragPath[dragPath.length - 1][0], y: dragPath[dragPath.length - 1][1], vx: (Math.random() - 0.5) * 120, vy: -Math.random() * 80, life: 1, c: rock.c[1] });
      if (rock.hard < 3) scratches.push({ path: dragPath, w: [5, 3.5, 1.5][rock.hard], a: [0.85, 0.65, 0.3][rock.hard] });
      dragPath = null;
      rock.hard < 3 ? sfx.good() : sfx.bad();
      record(marks);
    }
    function run() { // the current tool, used straight away (taps on the bench, or the test hook)
      if (busy) return;
      if (tool === 'look') look();
      else if (tool === 'water') water();
      else if (tool === 'float') sinkFloat();
      else { dragPath = [[RX - 80, RY - 10], [RX + 80, RY + 14]]; scratchDone(); }
    }
    // the paper clip is dragged across the rock
    cv.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (busy) return;
      const [x, y] = toGame(cv, W, H, e);
      if (tool !== 'scratch') { if (Math.abs(x - RX) < 150 && Math.abs(y - RY) < 110) run(); return; }
      if (!inRock(x - RX, y - RY, rock)) { say('Put the paper clip ON the rock, then drag it across!'); return; }
      try { cv.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      dragPath = [[x, y]];
    });
    cv.addEventListener('pointermove', e => {
      if (!dragPath || busy) return;
      const [x, y] = toGame(cv, W, H, e);
      if (inRock(x - RX, y - RY, rock)) dragPath.push([x, y]);
      if (dragPath.length % 6 === 0) sfx.tap();
    });
    cv.addEventListener('pointerup', () => {
      if (!dragPath || busy) return;
      const len = dragPath.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - dragPath[i][0], p[1] - dragPath[i][1]), 0);
      if (len < 60) { dragPath = null; say('Drag the paper clip right across the rock – press hard!'); return; }
      scratchDone();
    });

    function step(dt) {
      time += dt;
      crumbs.forEach(c => { c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 300 * dt; c.life -= dt * 0.8; });
      crumbs = crumbs.filter(c => c.life > 0);
      if (anim) {
        anim.t += dt;
        if (anim.kind === 'water' && drop) {
          const top = RY - 70;
          if (!drop.landed) { drop.vy += 600 * dt; drop.y += drop.vy * dt; if (drop.y >= top) { drop.y = top; drop.landed = true; sfx.tap(); } }
          else { drop.t += dt; if (rock.soak) wet = Math.min(1, drop.t / 1.2); }
        }
        if (anim.t >= anim.T) {
          const k = anim.kind; anim = null;
          if (k === 'look') record(rock.lookTxt);
          else if (k === 'water') { record(rock.soak ? 'the water soaked in – permeable' : 'the water stayed as a droplet – impermeable'); }
          else if (k === 'float') { (rock.float ? sfx.good : sfx.tap)(); record(rock.float ? 'it FLOATS!' : 'it sinks to the bottom'); }
        }
      }
      draw();
    }
    function draw() {
      // the lab bench
      ctx.fillStyle = '#2b3a55'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#34476a'; for (let y = 0; y < 270; y += 30) ctx.fillRect(0, y, W, 2);
      ctx.fillStyle = '#8a5a32'; ctx.fillRect(0, 280, W, H - 280); ctx.fillStyle = '#6b4425'; ctx.fillRect(0, 280, W, 6);
      // the tank of water
      ctx.fillStyle = '#000'; ctx.fillRect(TANK.x - 4, TANK.y - 4, TANK.w + 8, TANK.h + 8);
      ctx.fillStyle = '#cfe9ff'; ctx.fillRect(TANK.x, TANK.y, TANK.w, TANK.h);
      ctx.fillStyle = '#4fa3e8'; ctx.fillRect(TANK.x, TANK.y + 40, TANK.w, TANK.h - 40);
      ctx.fillStyle = '#7cc0f5'; ctx.fillRect(TANK.x, TANK.y + 40, TANK.w, 6);
      // the rock (or, in the float test, the rock falling into the tank)
      const fl = anim && anim.kind === 'float' ? Math.min(1, anim.t / 1.6) : 0;
      if (fl > 0) {
        const tx = TANK.x + TANK.w / 2, endY = rock.float ? TANK.y + 46 + Math.sin(time * 4) * 3 : TANK.y + TANK.h - 22;
        const x = RX + (tx - RX) * Math.min(1, fl * 1.6), arc = Math.sin(Math.min(1, fl * 1.6) * Math.PI) * -60;
        const y = fl < 0.62 ? RY + (TANK.y + 30 - RY) * (fl / 0.62) + arc : rock.float ? endY : TANK.y + 30 + (endY - TANK.y - 30) * Math.min(1, (fl - 0.62) / 0.38);
        drawRock(rock, x, y, 0.28);
      } else {
        drawRock(rock, RX, RY);
        if (wet > 0) { ctx.fillStyle = `rgba(30,50,90,${0.35 * wet})`; ctx.beginPath(); ctx.ellipse(RX, RY - 50, 24 + wet * 26, 10 + wet * 10, 0, 0, Math.PI * 2); ctx.fill(); }
        scratches.forEach(s => {
          ctx.strokeStyle = `rgba(255,255,255,${s.a})`; ctx.lineWidth = s.w; ctx.lineCap = 'round'; ctx.beginPath();
          s.path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
        });
        if (dragPath && dragPath.length > 1) { ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; ctx.beginPath(); dragPath.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); }
        if (tool === 'scratch' && !busy) emojiAt(ctx, '📎', dragPath ? dragPath[dragPath.length - 1][0] : RX + 120, dragPath ? dragPath[dragPath.length - 1][1] : RY - 90, 34);
      }
      crumbs.forEach(c => { ctx.fillStyle = c.c; ctx.fillRect(c.x, c.y, 5, 5); });
      // the water dropper
      if (anim && anim.kind === 'water' && drop) {
        emojiAt(ctx, '💧', RX, 34, 30);
        const sz = rock.soak && drop.landed ? Math.max(0, 1 - drop.t / 1.1) : 1;
        if (sz > 0) { ctx.fillStyle = '#000'; ctx.fillRect(RX - 9 * sz - 2, drop.y - 12 * sz - 2, 18 * sz + 4, 16 * sz + 4); ctx.fillStyle = '#4fc3ff'; ctx.fillRect(RX - 9 * sz, drop.y - 12 * sz, 18 * sz, 16 * sz); ctx.fillStyle = '#fff'; ctx.fillRect(RX - 5 * sz, drop.y - 9 * sz, 4 * sz, 4 * sz); }
      }
      // the magnifying glass: a big circle showing the rock up close
      if (anim && anim.kind === 'look') {
        const g = Math.min(1, anim.t / 0.4), R = 84 * g;
        ctx.save(); ctx.beginPath(); ctx.arc(RX, RY - 10, R, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = '#fff'; ctx.fillRect(RX - R, RY - 10 - R, R * 2, R * 2);
        for (let gy = -6; gy <= 6; gy++) for (let gx = -6; gx <= 6; gx++) { ctx.fillStyle = cellColour(rock, gx * 3 + 1, gy * 3 + 2); ctx.fillRect(RX + gx * 14 - 7, RY - 10 + gy * 14 - 7, 14, 14); }
        ctx.restore();
        ctx.strokeStyle = '#000'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(RX, RY - 10, R, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#c9a25a'; ctx.lineWidth = 4; ctx.stroke();
        ctx.fillStyle = '#000'; ctx.save(); ctx.translate(RX + R * 0.7, RY - 10 + R * 0.7); ctx.rotate(Math.PI / 4); ctx.fillRect(0, -8, 60 * g, 16); ctx.fillStyle = '#8a5a32'; ctx.fillRect(4, -5, 54 * g, 10); ctx.restore();
      }
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, 30);
      pxText(ctx, `🪨 ${rock.name} · ${ROCK_TOOLS[tool]}`, W / 2, 16, 15, '#ffd43b');
      if (tool === 'scratch' && !busy && !dragPath) pxText(ctx, 'Drag the paper clip across the rock!', RX, 300, 13, '#fff');
      else if (!busy && tool !== 'scratch') pxText(ctx, 'Tap the rock to test it!', RX, 300, 13, '#fff');
    }

    const rockBtns = rocks.map(rk => h('button', { class: 'lab-chip', type: 'button', onclick() { if (busy) return; rock = rk; scratches = []; wet = 0; crumbs = []; sfx.tap(); sync(); } }, rk.name));
    const toolBtns = tools.map(t => h('button', { class: 'lab-chip', type: 'button', onclick() { if (busy) return; tool = t; sfx.tap(); sync(); } }, ROCK_TOOLS[t]));
    const goBtn = h('button', { class: 'btn big green', type: 'button', onclick: () => { if (tool === 'scratch') say('Drag the paper clip across the rock on the screen!'); else run(); } }, '🧪 Test it!');
    function sync() {
      rockBtns.forEach((b, k) => { b.classList.toggle('on', rocks[k] === rock); b.disabled = busy; });
      toolBtns.forEach((b, k) => { b.classList.toggle('on', tools[k] === tool); b.disabled = busy; });
      goBtn.disabled = busy; goBtn.hidden = tool === 'scratch';
    }
    sync();
    const stopLoop = gameLoop(cv, step);
    const root = h('div', { class: 'game arcade lab rocklab' },
      missions.box,
      h('div', { class: 'arc-screen' }, cv),
      h('div', { class: 'lab-controls' }, h('span', { class: 'lab-label' }, 'Rock:'), ...rockBtns),
      h('div', { class: 'lab-controls' }, h('span', { class: 'lab-label' }, 'Test:'), ...toolBtns),
      h('div', { class: 'btn-row' }, goBtn),
      missions.ask, table.el);
    root._test = {
      frames(n) { for (let i = 0; i < n; i++) step(1 / 60); },
      pick(id) { rock = rocks.find(rk => rk.id === id); scratches = []; wet = 0; sync(); },
      tool(t) { tool = t; sync(); }, run,
      get busy() { return busy; }, get mission() { return missions.i; },
    };
    root._stop = stopLoop;
    missions.next();
    return root;
  };

  // ===== Fossil Dig: brush away the rubble on a cliff of rock layers to uncover fossils =====
  // r.layers: [{ rock: 'soil' | 'sandstone' | 'mudstone' | 'limestone' | 'chalk' | 'shale', age: 'about 10 million years ago' }] – top to bottom
  //   (the top layer is the newest; each layer below is older).
  // r.missions: [{ text, fossils: [{ kind: 'ammonite' | 'trilobite' | 'fern' | 'fish' | 'tooth' | 'footprint' | 'bone' | 'shell', layer, x (0–1) }],
  //   need: [kinds to find], yes, ask: [questions] }]
  // Drag (or rub) on the cliff to brush the loose rubble away. A fossil counts as found once most of it is showing:
  // it goes in the finds table with its layer and how old that layer is.
  const ROCK_COL = { soil: ['#7a5230', '#5e3d22'], sandstone: ['#e3b872', '#c4964f'], mudstone: ['#9c8a78', '#7a6a5a'], limestone: ['#ddd6c2', '#bdb49c'],
    chalk: ['#f4f1e8', '#d9d4c4'], shale: ['#6c7380', '#525866'] };
  const FOSSIL_ART = { // little pixel fossils (k: dark stone, a: pale fossil, b: mid)
    ammonite: ['..kkkkkk..', '.kaaaaaak.', 'kaakkkkaak', 'kakbbbbkak', 'kakbkkbkak', 'kakbkabkak', 'kakbbbbkak', 'kaakkkkaak', '.kaaaaaak.', '..kkkkkk..'],
    trilobite: ['...kkkk...', '..kaaaak..', '.kaakkaak.', 'kakkaakkak', 'kakaaaakak', 'kakkaakkak', 'kakaaaakak', 'kakkaakkak', '.kakaakak.', '..kkaakk..', '...kkkk...'],
    fern: ['....k.....', '...kak....', '.k.kak.k..', 'kak.ka.kak', '.kakaakak.', '..k.kak.k.', '.kakaakak.', 'kak.ka.kak', '.k.kak.k..', '....ak....', '....ak....', '....kk....'],
    fish: ['..........', '.kk....kk.', 'kaak..kaak', 'kaakkkkaak', 'kabababaak', 'kaakkkkaak', 'kaak..kaak', '.kk....kk.'],
    tooth: ['kkkkkkkk', 'kaaaaaak', 'kaaaaaak', '.kaaaak.', '.kaaaak.', '..kaak..', '..kaak..', '...kk...'],
    footprint: ['k...k...k', 'ak.kak.ka', 'kak.a.kak', '.kakakak.', '..kaaak..', '..kaaak..', '...kak...', '....k....'],
    bone: ['kk......kk', 'kak....kak', '.kakkkkak.', '..kaaaak..', '.kakkkkak.', 'kak....kak', 'kk......kk'],
    shell: ['...kkkk...', '..kababk..', '.kabababk.', 'kabababak.', 'kabababak.', '.kababak..', '..kkkkk...'],
  };
  const FOSSIL_NAME = { ammonite: '🐚 Ammonite', trilobite: '🪲 Trilobite', fern: '🌿 Fern leaf', fish: '🐟 Fish', tooth: '🦈 Shark tooth', footprint: '🦖 Dinosaur footprint', bone: '🦴 Dinosaur bone', shell: '🐚 Sea shell' };
  GAMES.fossildig = function (r, key, done) {
    const W = 640, H = 360, TOP = 34, CELL = 8, FS = 4; // FS: fossil pixel size
    const { cv, ctx } = arcadeCanvas(W, H);
    const layers = r.layers, LH = (H - TOP) / layers.length;
    const cover = document.createElement('canvas'); cover.width = W; cover.height = H;
    const cg = cover.getContext('2d');
    let fossils = [], cleared = new Set(), found = new Set(), brushing = false, last = null, time = 0, flash = 0, runN = 0, won = false;
    const table = resultsTable(r.caption || '🦴 Our fossil finds', ['Find', 'Fossil', 'Rock layer', 'How old?']);
    const missions = missionRunner(r, key, done, m => setup(m));
    const rand = (x, y) => { const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return n - Math.floor(n); };
    function setup(m) {
      cleared = new Set(); found = new Set(); flash = 0; won = false;
      fossils = (m.fossils || []).map(f => {
        const art = FOSSIL_ART[f.kind] || FOSSIL_ART.shell, w = art[0].length * FS, h = art.length * FS;
        const x = Math.round((40 + f.x * (W - 80 - w)) / CELL) * CELL, y = Math.round((TOP + (f.layer + 0.5) * LH - h / 2) / CELL) * CELL;
        return Object.assign({}, f, { art, x, y, w, h });
      });
      // the rubble: rough, darker bits of each layer's rock over everything
      cg.clearRect(0, 0, W, H);
      for (let y = TOP; y < H; y += CELL) {
        const L = layers[Math.min(layers.length - 1, Math.floor((y - TOP) / LH))], col = ROCK_COL[L.rock] || ROCK_COL.sandstone;
        for (let x = 0; x < W; x += CELL) {
          const n = rand(x, y);
          cg.fillStyle = n < 0.5 ? col[1] : n < 0.8 ? col[0] : 'rgba(0,0,0,.35)'; cg.fillRect(x, y, CELL, CELL);
          if (n > 0.9) { cg.fillStyle = 'rgba(255,255,255,.25)'; cg.fillRect(x, y, CELL / 2, CELL / 2); }
        }
      }
      sync();
    }
    const cellKey = (x, y) => (Math.floor(x / CELL)) + ',' + (Math.floor(y / CELL));
    function brush(x, y) {
      const R = 22;
      for (let yy = y - R; yy <= y + R; yy += CELL) for (let xx = x - R; xx <= x + R; xx += CELL) {
        if (yy < TOP || yy >= H || xx < 0 || xx >= W || Math.hypot(xx - x, yy - y) > R) continue;
        const k = cellKey(xx, yy);
        if (cleared.has(k)) continue;
        cleared.add(k);
        cg.clearRect(Math.floor(xx / CELL) * CELL, Math.floor(yy / CELL) * CELL, CELL, CELL);
      }
      check();
    }
    function shown(f) { // how much of a fossil is uncovered
      let n = 0, all = 0;
      for (let y = f.y; y < f.y + f.h; y += CELL) for (let x = f.x; x < f.x + f.w; x += CELL) { all++; if (cleared.has(cellKey(x, y))) n++; }
      return n / all;
    }
    function check() {
      fossils.forEach((f, i) => {
        if (found.has(i) || shown(f) < 0.65) return;
        found.add(i); runN++; flash = 1; sfx.good();
        const L = layers[f.layer];
        table.add([runN, FOSSIL_NAME[f.kind] || f.kind, `${L.rock[0].toUpperCase() + L.rock.slice(1)} (layer ${f.layer + 1} from the top)`, L.age || '']);
        say(`You found ${(FOSSIL_NAME[f.kind] || f.kind).replace(/^\S+\s/, 'a ').toLowerCase()} in the ${L.rock}! ${L.age ? 'That layer formed ' + L.age + '.' : ''}`);
      });
      const m = missions.m;
      if (m && !won) {
        const want = m.need || fossils.map(f => f.kind);
        if (want.every(k => fossils.some((f, i) => f.kind === k && found.has(i)))) { won = true; setTimeout(() => missions.win(cv), 700); }
      }
    }
    cv.addEventListener('pointerdown', e => { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } brushing = true; last = toGame(cv, W, H, e); brush(...last); sfx.tap(); });
    cv.addEventListener('pointermove', e => {
      if (!brushing) return;
      const p = toGame(cv, W, H, e), d = Math.hypot(p[0] - last[0], p[1] - last[1]);
      for (let t = CELL; t < d; t += CELL) brush(last[0] + (p[0] - last[0]) * t / d, last[1] + (p[1] - last[1]) * t / d);
      brush(...p); last = p;
    });
    const stop = () => { brushing = false; };
    cv.addEventListener('pointerup', stop); cv.addEventListener('pointercancel', stop);

    function step(dt) { time += dt; flash = Math.max(0, flash - dt); draw(); }
    function draw() {
      // the sky and grass on top, then the layers of rock (smooth where brushed), the fossils, and the rubble over them
      ctx.fillStyle = '#9fd8ff'; ctx.fillRect(0, 0, W, TOP); ctx.fillStyle = '#5bbf3a'; ctx.fillRect(0, TOP - 8, W, 8);
      layers.forEach((L, i) => {
        const col = ROCK_COL[L.rock] || ROCK_COL.sandstone, y = TOP + i * LH;
        ctx.fillStyle = col[0]; ctx.fillRect(0, y, W, LH);
        ctx.fillStyle = 'rgba(0,0,0,.08)'; for (let x = (i * 37) % 40; x < W; x += 40) ctx.fillRect(x, y + LH * 0.4, 18, 3);
        ctx.fillStyle = '#000'; ctx.fillRect(0, y, W, 2);
      });
      fossils.forEach((f, i) => {
        const pal = { k: '#4a3a2a', a: '#efe2c4', b: '#c9b48c' };
        f.art.forEach((row, yy) => [...row].forEach((c, xx) => { if (pal[c]) { ctx.fillStyle = pal[c]; ctx.fillRect(f.x + xx * FS, f.y + yy * FS, FS, FS); } }));
        if (found.has(i)) { ctx.strokeStyle = `rgba(255,212,59,${0.6 + Math.sin(time * 6) * 0.3})`; ctx.lineWidth = 3; ctx.strokeRect(f.x - 4, f.y - 4, f.w + 8, f.h + 8); }
      });
      ctx.drawImage(cover, 0, 0);
      // the age of each layer, down the side: newest at the top, oldest at the bottom
      layers.forEach((L, i) => {
        const y = TOP + i * LH + LH / 2;
        ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(W - 168, y - 11, 164, 22);
        pxText(ctx, `${L.rock.toUpperCase()}${i === 0 ? ' · newest' : i === layers.length - 1 ? ' · oldest' : ''}`, W - 86, y, 11, '#fff');
      });
      if (flash) { ctx.fillStyle = `rgba(255,255,255,${flash * 0.3})`; ctx.fillRect(0, 0, W, H); }
      pxText(ctx, `🖌️ Brush the rubble away · ${found.size}/${fossils.length} found`, W / 2, 16, 14, '#000');
    }
    function sync() { draw(); }
    const stopLoop = gameLoop(cv, step);
    const root = h('div', { class: 'game arcade lab fossildig' },
      missions.box, h('div', { class: 'arc-screen' }, cv),
      h('p', { class: 'arc-tip' }, '🖌️ Drag your finger over the cliff to brush the rubble away – gently, like a real fossil hunter!'),
      missions.ask, table.el);
    root._test = {
      frames(n) { for (let i = 0; i < n; i++) step(1 / 60); },
      reveal(kind) { const f = fossils.find(x => x.kind === kind); for (let y = f.y; y < f.y + f.h; y += CELL) for (let x = f.x; x < f.x + f.w; x += CELL) brush(x + 4, y + 4); },
      get found() { return found.size; }, get mission() { return missions.i; },
    };
    root._stop = stopLoop;
    missions.next();
    return root;
  };
});
