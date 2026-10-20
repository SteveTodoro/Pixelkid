/* Pixelkid lesson engine – Earth science sims: the Soil Lab (shake a soil in a jar of water, pour water through it).
 * One part of shared/engine.js, which loads it only when a lesson uses it. E is the engine's shared helpers
 * (E.state and E.stageCard are live). See the top of shared/engine.js for how the parts fit together.
 */
PixelkidEngine.part('earth', E => {
  'use strict';
  const { GAMES, arcadeCanvas, gameLoop, h, missionRunner, pxText, resultsTable, say, sfx, toGame } = E;

  // ===== Soil Lab: what is soil made of, and which soil lets water through? =====
  // r.soils: ids from SOILS (default all) · r.tests: 'shake' | 'drain' (default both) · r.caption
  // r.missions: [{ text, need: ['garden:shake', 'clay:drain'], yes, ask: [questions] }]
  // shake: drag the jar from side to side (or tap Shake it!) and the soil swirls into muddy water, then settles in layers:
  //   stones sink first, then sand, silt and clay, and bits of dead plants (humus) float. The layers match the soil's recipe.
  // drain: drag the watering can over the funnel of soil to pour 100 ml in (or tap Pour), then see how much drips through.
  const SOILS = {
    garden: { name: 'Garden soil', mix: { stones: 0.1, sand: 0.32, silt: 0.26, clay: 0.18, humus: 0.14 }, ml: 55, top: '#5a3d26' },
    sandy: { name: 'Sandy soil', mix: { stones: 0.14, sand: 0.66, silt: 0.1, clay: 0.04, humus: 0.06 }, ml: 85, top: '#c9a464' },
    clay: { name: 'Clay soil', mix: { stones: 0.05, sand: 0.1, silt: 0.25, clay: 0.54, humus: 0.06 }, ml: 15, top: '#9a5a3a' },
  };
  // bottom to top, the order the bits settle in (humus floats, so it ends up on the water)
  const LAYERS = [
    { id: 'stones', name: 'stones', c: '#8a8a99', speed: 3.2 },
    { id: 'sand', name: 'sand', c: '#e3c27a', speed: 1.6 },
    { id: 'silt', name: 'silt', c: '#a0805a', speed: 0.8 },
    { id: 'clay', name: 'clay', c: '#b8734a', speed: 0.35 },
  ];
  const HUMUS = ['#3b2a1f', '#2e9e3e', '#6b4425'];
  GAMES.soillab = function (r, key, done) {
    const W = 640, H = 360;
    const { cv, ctx } = arcadeCanvas(W, H);
    const soils = (r.soils || Object.keys(SOILS)).map(id => Object.assign({ id }, SOILS[id]));
    const tests = r.tests || ['shake', 'drain'];
    let soil = soils[0], test = tests[0], time = 0, busy = false, did = new Set(), runN = 0;
    const table = resultsTable(r.caption || '🪱 Our soil test results', ['Test', 'Soil', 'What we tested', 'What happened']);
    const missions = missionRunner(r, key, done, () => { did = new Set(); reset(); });

    // ---- shake jar ----
    const JAR = { x: 240, y: 70, w: 160, h: 250 }, WATER_TOP = JAR.y + 40, BED = JAR.y + JAR.h - 8;
    let jar = null; // { phase: 'still' | 'cloudy' | 'settling' | 'settled', shake 0–1, dx, t, bits: [] }
    const layerTops = s => { // how high each settled layer reaches, from the soil's recipe
      let y = BED; const out = {};
      LAYERS.forEach(L => { const hgt = s.mix[L.id] * 120; out[L.id] = { from: y - hgt, to: y }; y -= hgt; });
      return out;
    };
    function newJar() {
      const tops = layerTops(soil), bits = [];
      LAYERS.forEach(L => { for (let k = 0; k < Math.round(soil.mix[L.id] * 200); k++) bits.push({ L, x: JAR.x + 12 + Math.random() * (JAR.w - 24), y: BED - Math.random() * 60, ty: tops[L.id].from + Math.random() * (tops[L.id].to - tops[L.id].from - 3), vx: 0 }); });
      for (let k = 0; k < Math.round(soil.mix.humus * 120); k++) bits.push({ humus: HUMUS[k % 3], x: JAR.x + 12 + Math.random() * (JAR.w - 24), y: BED - Math.random() * 60, ty: WATER_TOP + 2 + Math.random() * 10, vx: 0 });
      jar = { phase: 'still', shake: 0, dx: 0, t: 0, bits };
    }
    function shakeBy(amount) {
      if (!jar || (jar.phase !== 'still' && jar.phase !== 'cloudy')) return;
      jar.shake = Math.min(1, jar.shake + amount);
      jar.phase = 'cloudy'; busy = true; sync();
      jar.bits.forEach(b => { b.y = WATER_TOP + 10 + Math.random() * (BED - WATER_TOP - 20); b.x = JAR.x + 10 + Math.random() * (JAR.w - 20); });
      if (jar.shake >= 1) { jar.phase = 'settling'; jar.t = 0; sfx.good(); say('Now put it down and watch it settle…'); }
    }
    function settled() {
      jar.phase = 'settled'; busy = false;
      const big = LAYERS.slice().sort((a, b) => soil.mix[b.id] - soil.mix[a.id])[0];
      record('shake', 'Shake jar', `Layers: stones at the bottom, then sand, silt and clay. Most of it: ${big.name}. Bits of dead plants floated.`);
    }

    // ---- drain test ----
    const FUN = { x: 250, y: 90, w: 140, h: 70 }, CYL = { x: 285, y: 190, w: 70, h: 134 };
    let can = { x: 520, y: 70, drag: false }, drain = null; // { poured, through, t, phase: 'pour' | 'drip' | 'done' }
    function newDrain() { drain = { poured: 0, through: 0, t: 0, phase: 'pour', drops: [] }; can = { x: 520, y: 70, drag: false }; }
    const overFunnel = () => can.x > FUN.x - 30 && can.x < FUN.x + FUN.w + 30 && can.y < FUN.y + 10;
    function pour(dt) {
      if (!drain || drain.phase !== 'pour') return;
      drain.poured = Math.min(100, drain.poured + dt * 45);
      busy = true;
      if (drain.poured >= 100) { drain.phase = 'drip'; drain.t = 0; can.drag = false; sync(); say('All 100 ml poured in! Now wait and see how much drips through…'); }
    }
    function drained() {
      drain.phase = 'done'; busy = false;
      record('drain', 'Drain test', `${soil.ml} ml of the 100 ml dripped through${soil.ml < 30 ? ' – most stayed in the soil' : soil.ml > 70 ? ' – it rushed through' : ''}.`);
    }

    function record(t, label, what) {
      runN++; did.add(`${soil.id}:${t}`);
      table.add([runN, soil.name, label, what]);
      const m = missions.m, need = (m && m.need) || [], left = need.filter(n => !did.has(n));
      if (m && !left.length) missions.win(cv);
      else if (left.length) {
        const [s, tt] = left[0].split(':');
        say(`Now try the ${tt === 'shake' ? 'shake jar' : 'drain test'} with the ${SOILS[s].name.toLowerCase()}.`);
      }
      sync();
    }
    function reset() { busy = false; if (test === 'shake') newJar(); else newDrain(); sync(); }

    // ---- fingers ----
    let grab = null;
    cv.addEventListener('pointerdown', e => {
      e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      const [x, y] = toGame(cv, W, H, e);
      if (test === 'shake') grab = { x, last: x };
      else if (drain && drain.phase === 'pour' && Math.hypot(x - can.x, y - can.y) < 70) { can.drag = true; grab = { x, y }; }
    });
    cv.addEventListener('pointermove', e => {
      if (!grab) return;
      const [x, y] = toGame(cv, W, H, e);
      if (test === 'shake' && jar) {
        jar.dx = Math.max(-60, Math.min(60, x - grab.x));
        const moved = Math.abs(x - grab.last); grab.last = x;
        if (moved > 2) shakeBy(moved / 900);
      } else if (can.drag) { can.x = Math.max(60, Math.min(W - 60, x)); can.y = Math.max(40, Math.min(H - 80, y)); }
    });
    const let_go = () => { grab = null; if (jar) jar.dx = 0; if (can.drag && (!drain || drain.phase === 'pour')) can.drag = false; };
    cv.addEventListener('pointerup', let_go); cv.addEventListener('pointercancel', let_go);

    function step(dt) {
      time += dt;
      if (test === 'shake' && jar) {
        if (jar.phase === 'cloudy' && !grab) jar.dx *= 0.8;
        if (jar.phase === 'cloudy') jar.bits.forEach(b => { b.x += (Math.random() - 0.5) * 6; b.y += (Math.random() - 0.5) * 6; });
        if (jar.phase === 'settling') {
          jar.t += dt; jar.dx *= 0.8;
          let moving = false;
          jar.bits.forEach(b => {
            const sp = b.humus ? 1.2 : b.L.speed;
            const d = b.ty - b.y; if (Math.abs(d) > 0.5) { b.y += Math.sign(d) * Math.min(Math.abs(d), sp * 60 * dt); moving = true; }
          });
          if (!moving && jar.t > 2.5) settled();
        }
      }
      if (test === 'drain' && drain) {
        if (can.drag && overFunnel()) pour(dt);
        if (drain.phase === 'pour' || drain.phase === 'drip') { // water seeps through while it's poured, then finishes dripping
          const want = Math.min(soil.ml, drain.poured * soil.ml / 100 * (drain.phase === 'drip' ? 1 : 0.6));
          if (drain.through < want) { drain.through = Math.min(want, drain.through + dt * (8 + soil.ml * 0.25)); if (Math.random() < dt * 10) drain.drops.push({ y: FUN.y + FUN.h + 8 }); }
          if (drain.phase === 'drip') { drain.t += dt; if (drain.through >= soil.ml - 0.01 && drain.t > 1.5) drained(); }
        }
        drain.drops.forEach(d => { d.y += dt * 240; });
        drain.drops = drain.drops.filter(d => d.y < CYL.y + CYL.h - drain.through / 100 * CYL.h);
      }
      draw();
    }

    function drawJar() {
      const ox = jar ? jar.dx : 0, J = { x: JAR.x + ox, y: JAR.y, w: JAR.w, h: JAR.h };
      ctx.fillStyle = '#000'; ctx.fillRect(J.x - 4, J.y - 4, J.w + 8, J.h + 8);
      ctx.fillStyle = '#dff3ff'; ctx.fillRect(J.x, J.y, J.w, J.h);
      ctx.fillStyle = '#3d6bb3'; ctx.fillRect(J.x - 8, J.y - 18, J.w + 16, 18); // lid
      const cloud = !jar ? 0 : jar.phase === 'cloudy' ? 0.85 : jar.phase === 'settling' ? Math.max(0.1, 0.85 - jar.t / 6) : jar.phase === 'settled' ? 0.08 + soil.mix.clay * 0.25 : 0;
      ctx.fillStyle = '#8fc7ff'; ctx.fillRect(J.x, WATER_TOP, J.w, BED - WATER_TOP + 8);
      if (jar) {
        if (jar.phase === 'still') { // the soil sits in a lump at the bottom before shaking
          ctx.fillStyle = soil.top; ctx.fillRect(J.x + 6, BED - 56, J.w - 12, 62);
          for (let k = 0; k < 30; k++) { ctx.fillStyle = k % 3 ? '#00000033' : '#ffffff22'; ctx.fillRect(J.x + 10 + (k * 37) % (J.w - 24), BED - 50 + (k * 23) % 52, 4, 4); }
        } else {
          if (jar.phase === 'settling' || jar.phase === 'settled') { // the layers firm up into solid bands as the bits settle
            const tops = layerTops(soil), a = jar.phase === 'settled' ? 1 : Math.min(1, jar.t / 4);
            ctx.globalAlpha = a; LAYERS.forEach(L => { ctx.fillStyle = L.c; ctx.fillRect(J.x, tops[L.id].from, J.w, tops[L.id].to - tops[L.id].from + 8); }); ctx.globalAlpha = 1;
          }
          jar.bits.forEach(b => { ctx.fillStyle = b.humus || b.L.c; const s = b.humus ? 5 : b.L.id === 'stones' ? 7 : b.L.id === 'sand' ? 4 : 3; ctx.fillRect(b.x + ox - s / 2, b.y - s / 2, s, s); });
        }
        if (cloud > 0) { ctx.fillStyle = `rgba(140, 95, 60, ${cloud})`; ctx.fillRect(J.x, WATER_TOP, J.w, BED - WATER_TOP + 8); }
        if (jar.phase === 'settled') { // labels beside the layers
          const tops = layerTops(soil);
          LAYERS.forEach(L => { const t = tops[L.id]; if (t.to - t.from > 9) pxText(ctx, L.name, J.x + J.w + 14, (t.from + t.to) / 2, 13, L.c, 'left'); });
          pxText(ctx, 'humus floats', J.x + J.w + 14, WATER_TOP + 8, 13, '#9be15d', 'left');
        }
      }
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(J.x + 8, J.y + 10, 8, J.h - 30); // shine
      if (jar && jar.phase === 'still') pxText(ctx, '⬅ drag to shake ➡', W / 2, H - 14, 15, '#ffd43b');
      if (jar && jar.phase === 'cloudy') { ctx.fillStyle = '#000'; ctx.fillRect(W / 2 - 80, H - 22, 160, 14); ctx.fillStyle = '#7cfc3a'; ctx.fillRect(W / 2 - 78, H - 20, 156 * jar.shake, 10); }
    }
    function drawDrain() {
      // funnel full of soil
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.moveTo(FUN.x - 4, FUN.y - 4); ctx.lineTo(FUN.x + FUN.w + 4, FUN.y - 4); ctx.lineTo(CYL.x + CYL.w / 2 + 14, FUN.y + FUN.h + 4); ctx.lineTo(CYL.x + CYL.w / 2 - 14, FUN.y + FUN.h + 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = soil.top;
      ctx.beginPath(); ctx.moveTo(FUN.x, FUN.y); ctx.lineTo(FUN.x + FUN.w, FUN.y); ctx.lineTo(CYL.x + CYL.w / 2 + 10, FUN.y + FUN.h); ctx.lineTo(CYL.x + CYL.w / 2 - 10, FUN.y + FUN.h); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#000'; ctx.fillRect(CYL.x + CYL.w / 2 - 7, FUN.y + FUN.h, 14, 22);
      // water sitting on top of the soil (clay holds it: a puddle stays)
      if (drain) {
        const sitting = drain.phase === 'done' ? (100 - soil.ml) * 0.12 : Math.max(0, drain.poured - drain.through * 1.2) * 0.12;
        if (sitting > 1) { ctx.fillStyle = '#4f9cf0'; ctx.fillRect(FUN.x + 4, FUN.y - sitting, FUN.w - 8, sitting); }
        drain.drops.forEach(d => { ctx.fillStyle = '#4f9cf0'; ctx.fillRect(CYL.x + CYL.w / 2 - 3, d.y, 6, 9); });
      }
      // measuring cylinder with a ml scale
      ctx.fillStyle = '#000'; ctx.fillRect(CYL.x - 4, CYL.y, CYL.w + 8, CYL.h + 4);
      ctx.fillStyle = '#eef8ff'; ctx.fillRect(CYL.x, CYL.y, CYL.w, CYL.h);
      if (drain) { const hgt = drain.through / 100 * CYL.h; ctx.fillStyle = '#4f9cf0'; ctx.fillRect(CYL.x, CYL.y + CYL.h - hgt, CYL.w, hgt); }
      for (let ml = 0; ml <= 100; ml += 10) {
        const y = CYL.y + CYL.h - ml / 100 * CYL.h;
        ctx.fillStyle = '#000'; ctx.fillRect(CYL.x + CYL.w - (ml % 50 ? 12 : 22), y, ml % 50 ? 12 : 22, 2);
        if (ml % 20 === 0) pxText(ctx, String(ml), CYL.x + CYL.w + 12, y, 13, '#fff', 'left');
      }
      pxText(ctx, 'ml', CYL.x + CYL.w + 12, CYL.y - 14, 13, '#fff', 'left');
      if (drain && drain.phase === 'done') pxText(ctx, `${soil.ml} ml came through`, W / 2, 24, 16, '#ffd43b');
      // the watering can
      if (drain && drain.phase === 'pour') {
        ctx.save(); ctx.translate(can.x, can.y); if (can.drag && overFunnel()) ctx.rotate(-0.5);
        ctx.fillStyle = '#000'; ctx.fillRect(-34, -24, 52, 44); ctx.fillStyle = '#2f80ed'; ctx.fillRect(-30, -20, 44, 36);
        ctx.fillStyle = '#000'; ctx.fillRect(-60, -20, 30, 8); ctx.fillStyle = '#2f80ed'; ctx.fillRect(-58, -18, 28, 4);
        ctx.fillStyle = '#000'; ctx.fillRect(-10, -36, 30, 14); ctx.fillStyle = '#8fdcff'; ctx.fillRect(-6, -32, 22, 6);
        ctx.restore();
        if (can.drag && overFunnel()) for (let k = 0; k < 6; k++) { ctx.fillStyle = '#4f9cf0'; ctx.fillRect(can.x - 62 + (k % 3) * 6, can.y - 10 + ((time * 300 + k * 17) % (FUN.y - can.y + 10)), 4, 8); }
        pxText(ctx, `${Math.round(drain.poured)} / 100 ml poured`, W / 2, 24, 15, '#ffd43b');
        if (!drain.poured) pxText(ctx, 'drag the can over the funnel', W / 2, H - 12, 15, '#ffd43b');
      }
    }
    function draw() {
      ctx.fillStyle = '#2b3a4a'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#8a5a32'; ctx.fillRect(0, H - 32, W, 32); ctx.fillStyle = '#6b4425'; ctx.fillRect(0, H - 32, W, 4); // lab bench
      if (test === 'shake') drawJar(); else drawDrain();
      pxText(ctx, soil.name, 70, 24, 15, '#fff', 'left');
    }

    const soilBtns = soils.map(s => h('button', { class: 'lab-chip', type: 'button', onclick() { if (busy) return; soil = s; sfx.tap(); reset(); } }, s.name));
    const testBtns = tests.map(t => h('button', { class: 'lab-chip', type: 'button', onclick() { if (busy) return; test = t; sfx.tap(); reset(); } }, t === 'shake' ? 'Shake jar' : 'Drain test'));
    const helpBtn = h('button', { class: 'btn green', type: 'button', onclick() {
      if (test === 'shake') shakeBy(1);
      else if (drain && drain.phase === 'pour') { drain.poured = 100; pour(0); }
    } }, '');
    const againBtn = h('button', { class: 'btn ghost', type: 'button', onclick() { if (!busy) { sfx.tap(); reset(); } } }, '↺ Fresh sample');
    function sync() {
      soilBtns.forEach((b, k) => { b.classList.toggle('on', soils[k] === soil); b.disabled = busy; });
      testBtns.forEach((b, k) => { b.classList.toggle('on', tests[k] === test); b.disabled = busy; });
      helpBtn.textContent = test === 'shake' ? '👋 Shake it for me' : '💧 Pour it for me';
      helpBtn.hidden = test === 'shake' ? !jar || jar.phase !== 'still' : !drain || drain.phase !== 'pour';
      againBtn.disabled = busy;
    }
    reset();
    const stopLoop = gameLoop(cv, step);
    const root = h('div', { class: 'game arcade lab soillab' },
      missions.box,
      h('div', { class: 'arc-screen' }, cv),
      h('div', { class: 'lab-controls' }, h('span', { class: 'lab-label' }, 'Soil:'), ...soilBtns),
      tests.length > 1 && h('div', { class: 'lab-controls' }, h('span', { class: 'lab-label' }, 'Test:'), ...testBtns),
      h('div', { class: 'btn-row' }, againBtn, helpBtn),
      missions.ask, table.el);
    root._test = {
      frames(n) { for (let i = 0; i < n; i++) step(1 / 60); },
      pick(id) { soil = soils.find(s => s.id === id); reset(); }, use(t) { test = t; reset(); },
      shake: () => shakeBy(1), pour: () => { if (drain && drain.phase === 'pour') { drain.poured = 100; pour(0); } },
      get busy() { return busy; }, get mission() { return missions.i; }, get did() { return [...did]; },
    };
    root._stop = stopLoop;
    missions.next();
    return root;
  };
});
