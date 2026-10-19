/* Pixelkid lesson engine – simulated science experiments: Force Lab, Ramp Lab, Seed Garden, Wind Test and Bee Flight.
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
});
