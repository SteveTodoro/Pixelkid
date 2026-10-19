/* Pixelkid lesson engine – arcade games: Answer Invaders, Platformer, Lane Runner and Block Builder.
 * One part of shared/engine.js, which loads it only when a lesson uses it. E is the engine's shared helpers
 * (E.state and E.stageCard are live). See the top of shared/engine.js for how the parts fit together.
 */
PixelkidEngine.part('arcade', E => {
  'use strict';
  const { AV, GAMES, ROBOT_PAL, SPR, arcadeCanvas, award, canvasFont, confetti, emojiAt, gameLoop, h, holdButton,
    keys, pick, praise, put, pxText, say, sfx, shuffle, speak, spriteCanvas, toGame } = E;

  // ===== Answer Invaders: shoot the aliens carrying the right answers =====
  // r.waves: [{ prompt, items: [{ label, ok, why }] }]
  // Spelling waves: { spell: 'unlock', clue: 'open with a key', decoys: 'ae' } – shoot the letters in order to spell the word.
  // Like the arcade original, the aliens drop bombs to dodge (a hit stuns the ship for a moment – it never costs gems;
  // a wave with no hits earns a bonus gem) and now and then a mystery UFO flies over: shoot it for a bonus gem (3 at most).
  GAMES.invaders = function (r, key, done) {
    const W = 640, H = 440;
    const { cv, ctx } = arcadeCanvas(W, H);
    const colors = ['#7cfc3a', '#ff7eb6', '#2ee6d6', '#ffb800', '#b44dff', '#ff8c1a'];
    const alienSpr = colors.map(c => [SPR.alienA, SPR.alienB].map(rows => spriteCanvas(rows, { g: c, p: '#ffffff', k: '#1b1b1b', w: '#ffffff' }, 4)));
    const shipSpr = spriteCanvas(SPR.ship, { w: '#e8f4ff', c: '#2ee6d6', r: '#ff5252' }, 4);
    const ufoSpr = ['#ffe27a', '#ffffff'].map(w => spriteCanvas(SPR.ufo, { r: '#ff3b6b', w }, 3));
    const UFO_MAX = 3;
    const stars = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: Math.random() < 0.2 ? 3 : 2, t: Math.random() * 6 }));
    let wi = -1, aliens = [], ox = 0, oy = 0, dir = 1, shot = null, cool = 0, banner = null, finished = false, time = 0;
    const ship = { x: W / 2, target: null, fireOnArrive: false, move: 0 };
    const parts = [];
    let autopilot = false, spellAt = 0, misses = 0;
    const bombs = [];
    let bombT = 0, stun = 0, waveHit = false, bombsSeen = false, ufo = null, ufoT = 10 + Math.random() * 6, ufoGems = 0;

    function startWave() {
      wi++;
      if (wi >= r.waves.length) { finished = true; banner = { text: 'ALL WAVES CLEAR!', t: 99 }; done(); return; }
      const wave = r.waves[wi];
      spellAt = 0; misses = 0;
      if (wave.spell) wave.items = [...wave.spell.toLowerCase()].map(c => ({ label: c, ok: true }))
        .concat([...(wave.decoys || '')].filter(c => !wave.spell.toLowerCase().includes(c)).map(c => ({ label: c, ok: false, why: `There is no "${c}" in this word!` })));
      const items = shuffle(wave.items);
      const perRow = Math.min(4, Math.ceil(items.length / 2));
      aliens = items.map((it, i) => ({
        it, col: i % perRow, row: Math.floor(i / perRow), alive: true, flash: 0, color: i % colors.length, leaving: 0,
        // rows are staggered like bricks, so no alien ever hides behind another
        bx: (i % perRow - (perRow - 1) / 2) * 136 + (Math.floor(i / perRow) % 2 ? 34 : -34), by: 96 + Math.floor(i / perRow) * 92,
      }));
      ox = 0; oy = 0; dir = 1;
      bombs.length = 0; bombT = 2.6; waveHit = false;
      banner = { text: `WAVE ${wi + 1}`, t: 1.4 };
      if (wave.spell) { say(`Spell the word: ${wave.clue || wave.spell}. Shoot the letters in order!`); speak(wave.spell); }
      else say(wave.prompt);
    }
    // in a spelling wave only the NEXT letter counts
    const isRight = a => { const w = r.waves[wi]; return a.it.ok && (!w || !w.spell || a.it.label === w.spell.toLowerCase()[spellAt]); };
    const promptText = w => w.spell ? `${w.clue ? w.clue + ': ' : 'SPELL: '}${[...w.spell.toLowerCase()].map((c, k) => (k < spellAt ? c : '_')).join(' ')}` : w.prompt;
    const alienPos = a => [W / 2 + a.bx + ox, a.by + oy];
    function fire() {
      if (shot || cool > 0 || finished || stun > 0) return;
      shot = { x: ship.x, y: H - 58 }; cool = 0.3; sfx.tap();
    }
    function hit(a) {
      const [x, y] = alienPos(a);
      const w = r.waves[wi];
      if (isRight(a)) {
        a.alive = false; sfx.good(); misses = 0;
        if (w.spell) spellAt++;
        for (let k = 0; k < 18; k++) parts.push({ x, y, vx: (Math.random() - 0.5) * 360, vy: (Math.random() - 0.5) * 360, life: 0.7, c: colors[a.color] });
        if (!w.spell) { award(`${key}:${wi}:${a.it.label}`, cv); say(a.it.yes || praise()); }
        else if (spellAt === w.spell.length) { award(`${key}:${wi}:spell`, cv); say(`${w.spell.toUpperCase()}! ${praise()}`); }
        else say(`Yes! Now find the next letter…`);
        if (!aliens.some(o => o.alive && o.it.ok)) {
          aliens.forEach(o => { if (o.alive) o.leaving = 0.001; });
          bombs.length = 0;
          if (!waveHit && bombsSeen) { award(`${key}:${wi}:nohit`, cv); banner = { text: 'NO-HIT BONUS! +💎', t: 1.6 }; }
          else banner = { text: 'WAVE CLEAR!', t: 1.6 };
          sfx.win();
          setTimeout(startWave, 1700);
        }
      } else {
        a.flash = 0.6; sfx.bad();
        if (w.spell) {
          misses++;
          const need = w.spell.toLowerCase()[spellAt];
          say(misses >= 2 ? `💡 Look for the letter "${need}"!` : a.it.ok ? 'That letter is in the word – but not yet! Spell it in order.' : '💡 ' + a.it.why);
        } else say(a.it.why ? '💡 ' + a.it.why : 'Not that one – read the mission again!');
      }
    }
    const step = dt => {
      time += dt; cool = Math.max(0, cool - dt);
      // autopilot (used by the automated tests)
      if (autopilot && !finished) {
        const tgt = aliens.filter(a => a.alive && isRight(a) && !a.leaving).sort((a, b) => b.by - a.by)[0];
        if (tgt) { ship.target = alienPos(tgt)[0]; ship.fireOnArrive = true; }
      }
      // formation drift
      const live = aliens.filter(a => a.alive && !a.leaving);
      if (live.length && !finished) {
        ox += dir * 26 * dt;
        const xs = live.map(a => W / 2 + a.bx + ox);
        if (Math.max(...xs) > W - 70) { dir = -1; oy += 10; }
        if (Math.min(...xs) < 70) { dir = 1; oy += 10; }
        if (Math.max(...live.map(a => a.by + oy)) > H - 150) oy = 0; // gently back to the top – no game over
      }
      // ship
      if (ship.move) { ship.x += ship.move * 330 * dt; ship.target = null; }
      if (ship.target != null) {
        const d = ship.target - ship.x;
        ship.x += Math.sign(d) * Math.min(Math.abs(d), 420 * dt);
        if (Math.abs(d) < 3) { ship.target = null; if (ship.fireOnArrive) { ship.fireOnArrive = false; fire(); } }
      }
      ship.x = Math.max(30, Math.min(W - 30, ship.x));
      stun = Math.max(0, stun - dt);
      const burst = (x, y, c, n = 10) => { for (let k = 0; k < n; k++) parts.push({ x, y, vx: (Math.random() - 0.5) * 260, vy: (Math.random() - 0.5) * 260, life: 0.5, c }); };
      // bombs: a random alien drops one now and then – about half of them aimed at the ship. Faster in later waves.
      if (live.length && !finished && !(banner && banner.t > 0 && /WAVE \d/.test(banner.text))) {
        bombT -= dt;
        if (bombT <= 0 && bombs.length < 3) {
          const aim = Math.random() < 0.5;
          const from = aim ? live.reduce((b, a) => (Math.abs(alienPos(a)[0] - ship.x) < Math.abs(alienPos(b)[0] - ship.x) ? a : b)) : pick(live);
          const [bx, by] = alienPos(from);
          bombs.push({ x: bx, y: by + 30, vy: 110 + 15 * wi, t: 0 });
          bombT = Math.max(1.1, 2.3 - wi * 0.25) * (0.75 + Math.random() * 0.5);
          if (!bombsSeen) { bombsSeen = true; say('Watch out – the aliens are dropping bombs! Move to dodge them.'); }
        }
      }
      for (let i = bombs.length - 1; i >= 0; i--) {
        const b = bombs[i];
        b.y += b.vy * dt; b.t += dt;
        if (stun <= 0 && Math.abs(b.x - ship.x) < 24 && b.y > H - 56 && b.y < H - 16) {
          bombs.splice(i, 1); stun = 1.1; waveHit = true; sfx.bad(); burst(ship.x, H - 40, '#ff5252', 16);
          say(pick(['Ouch! Dodge the bombs – then keep shooting!', 'Zapped! Move out of the way of the bombs!']));
        } else if (b.y > H - 16) { bombs.splice(i, 1); burst(b.x, H - 16, '#7f8bb3', 6); }
      }
      // the mystery UFO: flies across the top now and then while a wave is on
      if (!ufo && live.length && !finished && ufoGems < UFO_MAX && (ufoT -= dt) <= 0) {
        const fromLeft = Math.random() < 0.5;
        ufo = { x: fromLeft ? -30 : W + 30, vx: fromLeft ? 95 : -95, y: 60 };
        ufoT = 14 + Math.random() * 8; sfx.ding();
      }
      if (ufo) { ufo.x += ufo.vx * dt; if (ufo.x < -40 || ufo.x > W + 40) ufo = null; }
      // shot: hits an alien, a bomb or the UFO
      if (shot) {
        shot.y -= 640 * dt;
        for (const a of aliens) {
          if (!a.alive || a.leaving) continue;
          const [x, y] = alienPos(a);
          if (Math.abs(shot.x - x) < 44 && shot.y < y + 36 && shot.y > y - 24) { hit(a); shot = null; break; }
        }
        const bi = shot ? bombs.findIndex(b => Math.abs(shot.x - b.x) < 12 && Math.abs(shot.y - b.y) < 18) : -1;
        if (bi >= 0) { burst(bombs[bi].x, bombs[bi].y, '#ffd43b', 8); bombs.splice(bi, 1); shot = null; sfx.tap(); }
        if (shot && ufo && Math.abs(shot.x - ufo.x) < 32 && Math.abs(shot.y - ufo.y) < 18) {
          award(`${key}:ufo:${ufoGems}`, cv); ufoGems++;
          burst(ufo.x, ufo.y, '#ffd43b', 24); burst(ufo.x, ufo.y, '#ff3b6b', 12);
          banner = { text: 'UFO BONUS! +💎', t: 1.4 }; sfx.win(); say('You shot the mystery UFO! Bonus gem!');
          ufo = null; shot = null;
        }
        if (shot && shot.y < 0) shot = null;
      }
      aliens.forEach(a => { a.flash = Math.max(0, a.flash - dt); if (a.leaving) a.leaving += dt; });
      parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; });
      for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
      if (banner) banner.t -= dt;

      // ----- draw -----
      ctx.fillStyle = '#0b0f2a'; ctx.fillRect(0, 0, W, H);
      stars.forEach(s => { ctx.fillStyle = (Math.sin(time * 2 + s.t) > 0.6) ? '#ffffff' : '#7f8bb3'; ctx.fillRect(s.x, s.y, s.s, s.s); });
      ctx.fillStyle = '#1e2a5a'; ctx.fillRect(0, H - 14, W, 14);
      const frame = Math.floor(time * 2) % 2;
      aliens.forEach(a => {
        if (!a.alive || a.leaving > 1.2) return;
        let [x, y] = alienPos(a);
        if (a.leaving) y -= a.leaving * a.leaving * 500;
        if (a.flash) x += Math.sin(a.flash * 60) * 6;
        const spr = alienSpr[a.color][frame];
        ctx.globalAlpha = a.flash ? 0.6 : 1;
        ctx.drawImage(spr, x - spr.width / 2, y - spr.height / 2 - 10);
        ctx.globalAlpha = 1;
        ctx.font = canvasFont(a.it.label, 15);
        const tw = ctx.measureText(a.it.label).width + 14;
        ctx.fillStyle = a.flash ? 'rgba(229,57,53,.9)' : 'rgba(0,0,0,.7)';
        ctx.fillRect(x - tw / 2, y + 22, tw, 24);
        pxText(ctx, a.it.label, x, y + 34, 15, '#fff');
      });
      if (shot) { ctx.fillStyle = '#7cfc3a'; ctx.fillRect(shot.x - 2, shot.y - 12, 4, 16); ctx.fillStyle = '#e8ffe0'; ctx.fillRect(shot.x - 1, shot.y - 12, 2, 6); }
      // zig-zag bombs, like the arcade original
      bombs.forEach(b => {
        const z = Math.floor(b.t * 10) % 2 ? 4 : -4;
        ctx.fillStyle = '#ff5252';
        for (let k = 0; k < 4; k++) ctx.fillRect(b.x - 3 + (k % 2 ? z : -z), b.y - 22 + k * 6, 6, 6);
        ctx.fillStyle = '#ffd43b'; ctx.fillRect(b.x - 4, b.y + 2, 8, 8);
      });
      if (ufo) { const u = ufoSpr[Math.floor(time * 6) % 2]; ctx.drawImage(u, ufo.x - u.width / 2, ufo.y - u.height / 2); }
      parts.forEach(p => { ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, 5, 5); });
      if (!(stun > 0 && Math.floor(time * 12) % 2)) ctx.drawImage(shipSpr, ship.x - shipSpr.width / 2, H - 52); // blinks while stunned
      if (ship.target != null) { ctx.fillStyle = 'rgba(124,252,58,.35)'; ctx.fillRect(ship.target - 1, H - 70, 2, 14); }
      const wave = r.waves[Math.min(wi, r.waves.length - 1)];
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, 40);
      if (wave) pxText(ctx, promptText(wave), W / 2, 21, 20, '#ffd43b');
      const left = aliens.filter(a => a.alive && a.it.ok).length;
      pxText(ctx, `🎯 ${left} left`, W - 12, H - 30, 14, '#fff', 'right');
      pxText(ctx, `WAVE ${Math.min(wi + 1, r.waves.length)}/${r.waves.length}`, 12, H - 30, 14, '#fff', 'left');
      if (banner && banner.t > 0) pxText(ctx, banner.text, W / 2, H / 2 + 40, 40, '#7cfc3a');
    };
    const stopLoop = gameLoop(cv, step);
    // controls: tap the space to fly there and fire; or ◀ 🔥 ▶ buttons; or arrow keys + space
    cv.addEventListener('pointerdown', e => {
      e.preventDefault();
      const [x] = toGame(cv, W, H, e);
      ship.target = x; ship.fireOnArrive = true;
    });
    const root = h('div', { class: 'game arcade invaders' },
      h('div', { class: 'arc-screen' }, cv),
      h('div', { class: 'arc-controls' },
        holdButton('◀', 'arc-left', () => { ship.move = -1; }, () => { if (ship.move < 0) ship.move = 0; }),
        holdButton('🔥 FIRE', 'arc-fire', fire),
        holdButton('▶', 'arc-right', () => { ship.move = 1; }, () => { if (ship.move > 0) ship.move = 0; })),
      r.waves.some(w => w.spell) && h('div', { class: 'btn-row' }, h('button', { class: 'btn gold', type: 'button', onclick() { const w = r.waves[wi]; if (w && w.spell) speak(w.spell, { force: true }); } }, '🔊 Hear the word')),
      h('p', { class: 'arc-tip' }, '👆 Tap above an alien to fly there and fire – or use ◀ 🔥 ▶. Only shoot the RIGHT answers! Dodge the bombs, and shoot the mystery UFO for a bonus 💎'));
    keys(root, {
      ArrowLeft: [() => { ship.move = -1; }, () => { if (ship.move < 0) ship.move = 0; }],
      ArrowRight: [() => { ship.move = 1; }, () => { if (ship.move > 0) ship.move = 0; }],
      ' ': [fire],
    });
    root._test = {
      frames(n) { for (let i = 0; i < n; i++) step(1 / 60); }, autopilot() { autopilot = true; }, shootWrong() { const a = aliens.find(o => o.alive && !o.it.ok); if (a) hit(a); },
      get finished() { return finished; }, get stun() { return stun; }, get bombs() { return bombs.length; }, get ufo() { return ufo; }, get ufoGems() { return ufoGems; }, get wave() { return wi; }, get left() { return aliens.filter(o => o.alive && o.it.ok).length; },
      ufoNow() { ufoT = 0; }, bombOnShip() { bombs.push({ x: ship.x, y: H - 60, vy: 120, t: 0 }); }, shootAt(x) { ship.x = x; shot = null; cool = 0; fire(); },
    };
    startWave();
    root._stop = stopLoop;
    return root;
  };

  // ===== Platformer: run, jump, collect the right answers, reach the flag =====
  // r.items: [{ label, ok, why }] · r.ice: true adds slippery ice patches (less friction!)
  GAMES.platformer = function (r, key, done) {
    const T = 32, W = 640, H = 384, ROWS = 12;
    const { cv, ctx } = arcadeCanvas(W, H);
    const items = shuffle(r.items);
    // ----- build the level -----
    const cols = 10 + items.length * 7 + 8;
    const tile = Array.from({ length: ROWS }, () => Array(cols).fill(0)); // 0 air, 1 ground, 2 platform, 3 ice
    for (let x = 0; x < cols; x++) { tile[10][x] = 1; tile[11][x] = 1; }
    const placed = [];
    let x = 8;
    items.forEach((it, i) => {
      const kind = i % 3; // 0: gap jump, 1: floating platform, 2: ice run
      if (kind === 0) { tile[10][x + 2] = tile[11][x + 2] = tile[10][x + 3] = tile[11][x + 3] = 0; placed.push({ it, x: (x + 5.5) * T, y: 9 * T - 6 }); }
      if (kind === 1) { for (let k = 2; k < 5; k++) tile[7][x + k] = 2; placed.push({ it, x: (x + 3.5) * T, y: 6 * T - 6 }); }
      if (kind === 2) { for (let k = 1; k < 6; k++) if (r.ice !== false && r.ice) tile[10][x + k] = 3; placed.push({ it, x: (x + 4.5) * T, y: 9 * T - 6 }); }
      x += 7;
    });
    const flagX = (cols - 4) * T;
    const solid = (tx, ty) => ty >= 0 && ty < ROWS && tx >= 0 && tx < cols && tile[ty][tx] > 0;
    // ----- tiles & sprites -----
    // the level uses the player's chosen background scene (sky, ground colours, decorations)
    const scene = AV ? AV.sceneDef() : { sky: ['#5fb8f5', '#c4e8ff'], ground: ['#5bbf3a', '#3d8a26', '#8a5a32', '#6b4425'], game: 'clouds' };
    const [g1, g2, g3, g4] = scene.ground;
    const tileSpr = {
      1: spriteCanvas(['gggggggg', 'GgGgGgGg', 'dddDdddd', 'dDdddddD', 'ddddDddd', 'dddddddd', 'DddDdddd', 'dddddDdd'], { g: g1, G: g2, d: g3, D: g4 }, 4),
      0.5: spriteCanvas(['dddDdddd', 'dDdddddD', 'ddddDddd', 'dddddddd', 'DddDdddd', 'dddddDdd', 'dDdddddd', 'ddddddDd'], { d: g3, D: g4 }, 4),
      2: spriteCanvas(['wwwwwwww', 'WWWWWWWW', 'w..w..w.', 'wwwwwwww', 'WWWWWWWW', '........', '........', '........'], { w: '#c08a52', W: '#6b4423' }, 4),
      3: spriteCanvas(['iiiiiiii', 'iIIiiiii', 'iiiIIiii', 'iiiiiIIi', 'iiiiiiii', 'iIiiiiii', 'iiiiiiii', 'iiiiiiii'], { i: '#bfefff', I: '#ffffff' }, 4),
    };
    const hero = AV ? AV.draw(AV.load().look, { scale: 2 }) : null; // the player's own avatar is the hero
    const run = hero ? [hero, hero] : [spriteCanvas(SPR.robot, ROBOT_PAL, 2), spriteCanvas(SPR.robotRun, ROBOT_PAL, 2)];
    const flagSpr = [spriteCanvas(SPR.flag, { k: '#1b1b1b', g: '#8b8b8b' }, 4), spriteCanvas(SPR.flag, { k: '#1b1b1b', g: '#7cfc3a' }, 4)];
    const clouds = Array.from({ length: 8 }, (_, i) => ({ x: i * 260 + Math.random() * 120, y: 30 + Math.random() * 90 }));
    const dots = Array.from({ length: 60 }, () => ({ x: Math.random() * 1600, y: Math.random() * 300, r: Math.random() }));
    const SWEETS = ['#e53935', '#2ee6d6', '#8e5cff', '#ffd43b', '#ff7eb6'];
    function drawSceneDeco(t) {
      const wrap = (x, span) => ((x % span) + span) % span - 60;
      if (scene.game === 'stars') dots.forEach(d => { ctx.fillStyle = Math.sin(t * 2 + d.r * 9) > 0.5 ? '#ffffff' : '#9fa8d9'; ctx.fillRect(wrap(d.x - cam * 0.15, W + 120), d.y, d.r > 0.8 ? 3 : 2, d.r > 0.8 ? 3 : 2); });
      else if (scene.game === 'snow') dots.forEach(d => { ctx.fillStyle = '#ffffff'; ctx.fillRect(wrap(d.x - cam * 0.2 + Math.sin(t + d.r * 6) * 10, W + 120), (d.y + t * (20 + d.r * 30)) % 330, 3, 3); });
      else if (scene.game === 'bubbles') dots.slice(0, 25).forEach(d => { ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(wrap(d.x - cam * 0.2, W + 120), 330 - ((d.y + t * (25 + d.r * 25)) % 330), 3 + d.r * 6, 0, 7); ctx.stroke(); });
      else if (scene.game === 'sweets') dots.slice(0, 20).forEach((d, i) => { const x = wrap(d.x - cam * 0.25, W + 120), y = d.y * 0.8; ctx.fillStyle = SWEETS[i % SWEETS.length]; ctx.fillRect(x, y, 14, 10); ctx.fillRect(x - 5, y + 2, 5, 6); ctx.fillRect(x + 14, y + 2, 5, 6); });
      else if (scene.game === 'leaves') clouds.forEach(c => { const x0 = wrap(c.x - cam * 0.4, W + 300); ctx.fillStyle = '#1f6b2a'; ctx.fillRect(x0, 0, 6, 60 + c.y); ctx.fillRect(x0 - 6, 30 + c.y / 2, 18, 8); });
      else { ctx.fillStyle = 'rgba(255,255,255,.85)'; clouds.forEach(c => { const x0 = ((c.x - cam * 0.3) % (W + 300) + W + 300) % (W + 300) - 150; ctx.fillRect(x0, c.y, 90, 14); ctx.fillRect(x0 + 14, c.y - 12, 56, 12); }); }
    }
    // ----- player -----
    const p = { x: 2 * T, y: 9 * T - 32, vx: 0, vy: 0, w: 22, h: 30, ground: false, onIce: false, face: 1, safeX: 2 * T, bump: 0 };
    let ghost = false; // test hook: ignore answer bubbles
    let left = false, right = false, jumpQ = false, cam = 0, got = 0, finished = false, time = 0, msg = null;
    const need = items.filter(i => i.ok).length;
    const collect = pl => {
      if (pl.done) return;
      if (pl.it.ok) {
        pl.done = true; got++; sfx.good(); award(`${key}:${pl.it.label}`, cv);
        say(got === need ? '🚩 You got them all! Run to the flag!' : (pl.it.yes || praise()));
      } else if (p.bump <= 0) {
        p.bump = 0.9; p.vx = -p.face * 260; p.vy = -260; sfx.bad();
        say(pl.it.why ? '💡 ' + pl.it.why : 'Oops – that is not one of the right answers!');
      }
    };
    const step = dt => {
      time += dt; p.bump = Math.max(0, p.bump - dt);
      if (!finished) {
        // horizontal: accelerate when holding, slow down by friction (much less on ice!)
        const acc = p.onIce ? 500 : 1500, fr = p.onIce ? 120 : 1800, max = 210;
        if (left && !right) { p.vx -= acc * dt; p.face = -1; } else if (right && !left) { p.vx += acc * dt; p.face = 1; } else if (p.ground) {
          const s = Math.sign(p.vx); p.vx -= s * fr * dt; if (Math.sign(p.vx) !== s) p.vx = 0;
        }
        p.vx = Math.max(-max * 1.3, Math.min(max * 1.3, p.vx));
        if (jumpQ && p.ground) { p.vy = -560; p.ground = false; sfx.tap(); }
        jumpQ = false;
        p.vy = Math.min(900, p.vy + 1500 * dt);
        // move x
        p.x += p.vx * dt;
        const rows = [Math.floor(p.y / T), Math.floor((p.y + p.h - 1) / T)];
        if (p.vx > 0) { const tx = Math.floor((p.x + p.w) / T); if (rows.some(ty => solid(tx, ty) && tile[ty][tx] !== 2)) { p.x = tx * T - p.w; p.vx = 0; } }
        if (p.vx < 0) { const tx = Math.floor(p.x / T); if (rows.some(ty => solid(tx, ty) && tile[ty][tx] !== 2)) { p.x = (tx + 1) * T; p.vx = 0; } }
        p.x = Math.max(0, Math.min(cols * T - p.w, p.x));
        // move y (platforms are one-way: you can jump up through them)
        const prevBottom = p.y + p.h;
        p.y += p.vy * dt;
        p.ground = false; p.onIce = false;
        const cx = [Math.floor(p.x / T), Math.floor((p.x + p.w - 1) / T)];
        if (p.vy >= 0) {
          const ty = Math.floor((p.y + p.h) / T);
          const hitT = cx.find(tx => solid(tx, ty) && (tile[ty][tx] !== 2 || prevBottom <= ty * T + 1));
          if (hitT != null) { p.y = ty * T - p.h; p.vy = 0; p.ground = true; p.onIce = cx.some(tx => tile[ty][tx] === 3); if (tile[ty][hitT] !== 2) p.safeX = p.x; }
        } else {
          const ty = Math.floor(p.y / T);
          if (cx.some(tx => solid(tx, ty) && tile[ty][tx] !== 2)) { p.y = (ty + 1) * T; p.vy = 0; }
        }
        if (p.y > H + 40) { p.x = Math.max(T, p.safeX - T); p.y = 9 * T - 32; p.vx = 0; p.vy = 0; sfx.bad(); say('Whoops! Jump over the gaps – press ⬆ just before the edge.'); }
        // collect / bump into answers
        if (!ghost) placed.forEach(pl => { if (!pl.done && Math.abs(p.x + p.w / 2 - pl.x) < 28 && Math.abs(p.y + p.h / 2 - pl.y) < 30) collect(pl); });
        // flag
        if (p.x + p.w > flagX + 8 && p.x < flagX + 40) {
          if (got === need) { finished = true; sfx.win(); confetti(80); done(); }
          else if (!msg || msg.t <= 0) { msg = { t: 1.5 }; say(`Collect all the right answers first! (${got}/${need})`); }
        }
        if (msg) msg.t -= dt;
      }
      cam = Math.max(0, Math.min(cols * T - W, p.x - W / 3));
      // ----- draw -----
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, scene.sky[0]); g.addColorStop(1, scene.sky[1]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      drawSceneDeco(time);
      const c0 = Math.floor(cam / T), c1 = Math.min(cols - 1, c0 + Math.ceil(W / T) + 1);
      for (let ty = 0; ty < ROWS; ty++) for (let tx = c0; tx <= c1; tx++) {
        const v = tile[ty][tx]; if (!v) continue;
        const spr = v === 1 && ty > 0 && tile[ty - 1][tx] === 1 ? tileSpr[0.5] : tileSpr[v];
        ctx.drawImage(spr, tx * T - cam, ty * T);
      }
      ctx.drawImage(flagSpr[got === need ? 1 : 0], flagX - cam, 10 * T - 40);
      placed.forEach(pl => {
        if (pl.done) return;
        const bob = Math.sin(time * 3 + pl.x) * 4, x = pl.x - cam, y = pl.y + bob;
        ctx.font = canvasFont(pl.it.label, 14);
        const tw = Math.max(40, ctx.measureText(pl.it.label).width + 16);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x - tw / 2, y - 14, tw, 28);
        ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeRect(x - tw / 2, y - 14, tw, 28);
        ctx.fillStyle = '#1b1b1b'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(pl.it.label, x, y + 1);
      });
      const spr = run[p.ground && Math.abs(p.vx) > 20 ? Math.floor(time * 10) % 2 : 0];
      ctx.save();
      if (p.bump > 0 && Math.floor(time * 20) % 2) ctx.globalAlpha = 0.4;
      ctx.translate(p.x - cam + p.w / 2, p.y);
      ctx.scale(p.face, 1);
      const bobY = hero && p.ground && Math.abs(p.vx) > 20 ? (Math.floor(time * 10) % 2) * -2 : 0;
      ctx.drawImage(spr, -spr.width / 2, p.h - spr.height + bobY);
      ctx.restore();
      if (p.onIce && Math.abs(p.vx) > 40) pxText(ctx, 'WHEEE! ICE = LESS FRICTION', p.x - cam + 10, p.y - 18, 12, '#bfefff');
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, 36);
      pxText(ctx, r.prompt || 'Collect the right answers!', W / 2, 19, 18, '#ffd43b');
      pxText(ctx, `✔ ${got}/${need}`, W - 12, 56, 18, '#7cfc3a', 'right');
      if (finished) pxText(ctx, 'LEVEL COMPLETE!', W / 2, H / 2, 40, '#7cfc3a');
    };
    const stopLoop = gameLoop(cv, step);
    const root = h('div', { class: 'game arcade platformer' },
      h('div', { class: 'arc-screen' }, cv),
      h('div', { class: 'arc-controls' },
        h('div', { class: 'arc-pad' },
          holdButton('◀', 'arc-left', () => { left = true; }, () => { left = false; }),
          holdButton('▶', 'arc-right', () => { right = true; }, () => { right = false; })),
        holdButton('⬆ JUMP', 'arc-jump', () => { jumpQ = true; })),
      h('p', { class: 'arc-tip' }, '◀ ▶ to run, ⬆ to jump. Grab the RIGHT answers, dodge the wrong ones, then reach the 🚩!'));
    keys(root, {
      ArrowLeft: [() => { left = true; }, () => { left = false; }],
      ArrowRight: [() => { right = true; }, () => { right = false; }],
      ArrowUp: [() => { jumpQ = true; }], ' ': [() => { jumpQ = true; }],
    });
    root._test = {
      frames(n) { for (let i = 0; i < n; i++) step(1 / 60); },
      state: () => ({ x: p.x, y: p.y, vx: p.vx, vy: p.vy, ground: p.ground, onIce: p.onIce, got, need, finished }),
      hold(dir, on) { if (dir < 0) left = on; else right = on; },
      jump() { jumpQ = true; },
      bumpWrong() { const pl = placed.find(o => !o.it.ok); if (pl) collect(pl); p.bump = 0; },
      collectAll() { placed.filter(o => o.it.ok).forEach(collect); },
      toFlag() { p.x = flagX - 4; p.y = 9 * T - 32; p.vy = 0; },
      iceX: () => { for (let tx = 0; tx < cols; tx++) if (tile[10][tx] === 3) return tx * T; return null; },
      ghost(on) { ghost = on; },
      teleport(x0) { p.x = x0; p.y = 9 * T - 32; p.vx = 0; p.vy = 0; },
    };
    root._stop = stopLoop;
    return root;
  };

  // ===== Lane Runner: the avatar runs by itself; word signs come in pairs (top lane / bottom lane) – pick the lane with the right one =====
  // Same data as the platformer: r.prompt, r.items: [{ label, ok, why, yes }]. Right and wrong words are paired up (one of each per pair);
  // a wrong pick shows why and that pair comes round again later. r.speed: base pixels per second (default 165).
  // Between the signs: rocks to jump over (or dodge) and coins to grab. Hold DASH to rush the next sign once you've picked a lane,
  // and every right pick in a row makes the run a little faster.
  // Lanes: tap the top or bottom half, swipe, the ⬆ / ⬇ buttons, or the arrow keys. Jump: JUMP button or space. Dash: hold DASH or →.
  GAMES.runner = function (r, key, done) {
    const W = 640, H = 360, HX = 120, LANES = [158, 296]; // lane floor heights
    const GAP = 400; // ground between one sign and the next (rock + coins live here)
    const { cv, ctx } = arcadeCanvas(W, H);
    const oks = shuffle(r.items.filter(i => i.ok)), bads = shuffle(r.items.filter(i => !i.ok));
    const n = Math.max(oks.length, bads.length);
    let queue = Array.from({ length: n }, (_, k) => ({ ok: oks[k % oks.length], bad: bads[k % bads.length] }));
    const total = n, base = r.speed || 165;
    const scene = AV ? AV.sceneDef() : { sky: ['#5fb8f5', '#c4e8ff'], ground: ['#5bbf3a', '#3d8a26', '#8a5a32', '#6b4425'] };
    const [g1, g2, g3, g4] = scene.ground;
    const heroImg = AV ? AV.draw(AV.load().look, { scale: 3 }) : spriteCanvas(SPR.robot, ROBOT_PAL, 3);
    const clouds = Array.from({ length: 6 }, (_, i) => ({ x: i * 140 + 30, y: 20 + (i * 37) % 70 }));
    let lane = 1, heroY = LANES[1], jumpY = 0, vy = 0, gates = [], things = [], got = 0, time = 0, scroll = 0, dist = 0, nextAt = Infinity,
      started = false, finished = false, stumble = 0, slow = 0, dash = false, streak = 0, coins = 0, sparks = [], banner = null, bonk = null;
    const label = it => { const m = /^(\S+)\s+(.+)$/.exec(it.label); return m && window.Pixel && Pixel.has && Pixel.has(m[1]) ? { icon: m[1], text: m[2] } : { icon: null, text: it.label }; };
    const speed = () => (base + Math.min(streak, 6) * 12) * (dash ? 1.9 : 1) * (slow > 0 ? 0.45 : 1);
    function nextGate() {
      if (!queue.length) return;
      const pair = queue.shift(), top = Math.random() < 0.5;
      gates.push({ x: W + 40, pair, words: top ? [pair.ok, pair.bad] : [pair.bad, pair.ok], hit: false });
      nextAt = Infinity; // the next sign waits until this one is passed
    }
    function finish() { if (finished) return; finished = true; dash = false; banner = { text: '🏁 FINISHED!', t: 0 }; sfx.win(); setTimeout(done, 900); }
    // the stretch after a sign: a rock in one lane with a coin arc over it, and a coin trail in the other
    function segment() {
      const rl = Math.random() < 0.5 ? 0 : 1, rx = W + 90 + Math.random() * 60;
      things.push({ kind: 'rock', lane: rl, x: rx });
      [-60, -30, 0, 30, 60].forEach(d => things.push({ kind: 'coin', lane: rl, x: rx + d, up: 95 - Math.abs(d) * 0.75 }));
      for (let k = 0; k < 3; k++) things.push({ kind: 'coin', lane: 1 - rl, x: rx + 150 + k * 34, up: 26 });
      nextAt = dist + GAP;
    }
    function setLane(l) { if (!started) { start(); return; } if (l !== lane && !finished) { lane = l; sfx.tap(); } }
    function jump() { if (!started) { start(); return; } if (jumpY === 0 && !finished) { vy = -560; sfx.tap(); } }
    function setDash(on) { if (on && !started) { start(); return; } dash = on && !finished; }
    function start() { if (started) return; started = true; segment(); sfx.good(); say(r.say || 'Pick the lane with the right word! Jump the rocks, grab the coins – hold DASH to go faster!'); }
    function judge(gate) {
      const it = gate.words[lane], ok = it.ok;
      gate.hit = true;
      if (ok) {
        got++; streak++; sfx.good(); award(`${key}:${it.label}`, cv);
        for (let i = 0; i < 14; i++) sparks.push({ x: HX + 20, y: heroY - jumpY - 40, vx: (Math.random() - 0.3) * 260, vy: -Math.random() * 220, life: 0.7, c: '#ffd43b' });
        say(it.yes || praise());
        if (streak >= 2) banner = { text: `🔥 ${streak} IN A ROW!`, t: 0, small: true };
      } else {
        stumble = 0.6; slow = 0.5; streak = 0; sfx.bad();
        say('💡 ' + (it.why || `"${it.label}" is not one of them.`) + ' This one will come round again!');
        queue.splice(Math.min(queue.length, 1 + Math.floor(Math.random() * 2)), 0, gate.pair); // try it again soon
      }
      if (queue.length) segment(); else nextAt = Infinity;
    }
    function touch(t) {
      if (Math.abs(t.x - HX) > 20 || t.lane !== lane || t.got) return;
      if (t.kind === 'rock') {
        if (jumpY < 34) { t.got = true; stumble = 0.5; slow = 0.6; sfx.bad(); bonk = { t: 0 }; }
      } else {
        const feet = jumpY, head = jumpY + heroImg.height - 6;
        if (t.up >= feet - 6 && t.up <= head) {
          t.got = true; coins++; sfx.tap();
          for (let i = 0; i < 5; i++) sparks.push({ x: HX, y: LANES[lane] - t.up, vx: (Math.random() - 0.5) * 160, vy: -Math.random() * 160, life: 0.4, c: '#fff3a0' });
        }
      }
    }
    // controls: tap a half (or the sign in it), swipe, buttons, keys
    let sy = null;
    cv.addEventListener('pointerdown', e => { e.preventDefault(); sy = toGame(cv, W, H, e)[1]; });
    cv.addEventListener('pointerup', e => {
      const y = toGame(cv, W, H, e)[1];
      if (sy != null && Math.abs(y - sy) > 30) setLane(y < sy ? 0 : 1); else setLane(y < (LANES[0] + LANES[1]) / 2 - 20 ? 0 : 1);
      sy = null;
    });
    function step(dt) {
      time += dt;
      if (started && !finished) {
        const v = speed() * dt;
        scroll += v; dist += v;
        if (dist >= nextAt) nextGate();
        gates.forEach(g => { g.x -= v; if (!g.hit && g.x <= HX + 18) judge(g); });
        gates = gates.filter(g => g.x > -300);
        things.forEach(t => { t.x -= v; touch(t); });
        things = things.filter(t => t.x > -40);
        if (!queue.length && gates.every(g => g.hit && g.x < HX - 60)) finish(); // the last sign is behind us
      }
      // the jump: simple gravity, back to the lane floor
      if (jumpY > 0 || vy < 0) { jumpY -= vy * dt; vy += 1700 * dt; if (jumpY <= 0) { jumpY = 0; vy = 0; } }
      stumble = Math.max(0, stumble - dt); slow = Math.max(0, slow - dt);
      heroY += (LANES[lane] - heroY) * Math.min(1, dt * 14);
      sparks.forEach(s => { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 500 * dt; s.life -= dt; });
      sparks = sparks.filter(s => s.life > 0);
      if (banner) { banner.t += dt; if (banner.small && banner.t > 1.2) banner = null; }
      if (bonk) { bonk.t += dt; if (bonk.t > 0.7) bonk = null; }
      draw();
    }
    function sign(it, x, floor, highlight) {
      const { icon, text } = label(it);
      ctx.font = '800 21px Lexend, "Trebuchet MS", sans-serif';
      const tw = ctx.measureText(text).width, w = Math.max(110, tw + (icon ? 52 : 28)), hgt = 46, top = floor - 112;
      // two posts and a banner the hero runs under
      ctx.fillStyle = '#000'; ctx.fillRect(x - 3, top + hgt - 2, 8, floor - top - hgt + 2); ctx.fillRect(x + w - 5, top + hgt - 2, 8, floor - top - hgt + 2);
      ctx.fillStyle = '#8a5a32'; ctx.fillRect(x - 1, top + hgt, 4, floor - top - hgt); ctx.fillRect(x + w - 3, top + hgt, 4, floor - top - hgt);
      ctx.fillStyle = '#000'; ctx.fillRect(x - 4, top - 4, w + 8, hgt + 8);
      ctx.fillStyle = highlight || '#fffdf2'; ctx.fillRect(x, top, w, hgt);
      if (icon) emojiAt(ctx, icon, x + 22, top + hgt / 2 + 11, 28);
      ctx.fillStyle = '#1b1b1b'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(text, x + (icon ? 42 : 14), top + hgt / 2 + 1);
    }
    function rock(x, floor) {
      ctx.fillStyle = '#000'; ctx.fillRect(x - 17, floor - 26, 34, 26); ctx.fillRect(x - 12, floor - 32, 24, 6);
      ctx.fillStyle = '#8d8d8d'; ctx.fillRect(x - 14, floor - 24, 28, 24); ctx.fillRect(x - 10, floor - 29, 20, 5);
      ctx.fillStyle = '#b8b8b8'; ctx.fillRect(x - 10, floor - 26, 8, 6);
      ctx.fillStyle = '#5f5f5f'; ctx.fillRect(x + 4, floor - 12, 8, 6);
    }
    function coin(x, y) {
      const w = [10, 7, 3, 7][Math.floor(time * 8) % 4]; // a little spin
      ctx.fillStyle = '#000'; ctx.fillRect(x - w / 2 - 2, y - 9, w + 4, 18);
      ctx.fillStyle = '#ffd43b'; ctx.fillRect(x - w / 2, y - 7, w, 14);
      if (w > 4) { ctx.fillStyle = '#fff3a0'; ctx.fillRect(x - w / 2 + 1, y - 5, 2, 6); }
    }
    function draw() {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, scene.sky[0]); g.addColorStop(1, scene.sky[1]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,.8)';
      clouds.forEach(c => { const x = ((c.x - scroll * 0.2) % (W + 160) + W + 160) % (W + 160) - 120; ctx.fillRect(x, c.y, 80, 12); ctx.fillRect(x + 12, c.y - 10, 50, 10); });
      // top lane: a floating block bridge; bottom lane: the ground
      const blocks = (y, hgt) => {
        for (let x = -((scroll) % 32) - 32; x < W + 32; x += 32) {
          ctx.fillStyle = g3; ctx.fillRect(x, y, 32, hgt); ctx.fillStyle = g4; ctx.fillRect(x + 6, y + 14, 6, 6); ctx.fillRect(x + 20, y + 26, 6, 6);
          ctx.fillStyle = g1; ctx.fillRect(x, y, 32, 8); ctx.fillStyle = g2; ctx.fillRect(x, y + 8, 32, 4);
          ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x + 31, y, 1, hgt);
        }
      };
      blocks(LANES[0], 26); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, LANES[0] + 26, W, 4);
      blocks(LANES[1], H - LANES[1]);
      // the signs, rocks and coins
      gates.forEach(gt => gt.words.forEach((it, l) => sign(it, gt.x, LANES[l], gt.hit && l === lane && gt.x > HX - 200 ? (it.ok ? '#c8f7b0' : '#ffc9c9') : null)));
      things.forEach(t => { if (t.kind === 'rock') rock(t.x, LANES[t.lane]); else if (!t.got) coin(t.x, LANES[t.lane] - t.up); });
      // speed lines while dashing
      if (dash && started && !finished) {
        ctx.fillStyle = 'rgba(255,255,255,.7)';
        for (let i = 0; i < 7; i++) { const y = 50 + ((i * 47) % (H - 70)), x = W - ((time * 900 + i * 173) % (W + 120)); ctx.fillRect(x, y, 60, 3); }
      }
      // the hero: runs with a bob, stumbles on a wrong pick or a rock, leans forward on a dash
      const bobY = started && !finished && jumpY === 0 ? (Math.floor(time * (dash ? 18 : 10)) % 2) * -3 : 0;
      ctx.save();
      if (stumble) { ctx.globalAlpha = Math.floor(time * 16) % 2 ? 0.4 : 1; }
      const hx = HX - heroImg.width / 2 + (stumble ? -6 : 0), hy = heroY - jumpY - heroImg.height + bobY;
      if (jumpY > 0) { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(HX - 16, heroY - 4, 32, 4); }
      if (dash && !stumble) { ctx.translate(hx + heroImg.width / 2, hy + heroImg.height); ctx.rotate(0.12); ctx.drawImage(heroImg, -heroImg.width / 2, -heroImg.height); }
      else ctx.drawImage(heroImg, hx, hy);
      ctx.restore();
      sparks.forEach(s => { ctx.fillStyle = s.c; ctx.fillRect(s.x, s.y, 5, 5); });
      if (bonk) pxText(ctx, 'BONK!', HX + 10, heroY - heroImg.height - 20 - bonk.t * 30, 18, '#ff6b6b');
      // lane arrows on the left edge show where you can go
      pxText(ctx, lane === 0 ? '▶' : '', 18, LANES[0] - 30, 22, '#ffd43b');
      pxText(ctx, lane === 1 ? '▶' : '', 18, LANES[1] - 30, 22, '#ffd43b');
      // HUD
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, 34);
      pxText(ctx, r.prompt || 'Pick the right lane!', 12, 18, 16, '#fff', 'left');
      pxText(ctx, `🪙 ${coins}   ✔ ${got}/${total}`, W - 12, 18, 16, got === total ? '#7cfc3a' : '#ffd43b', 'right');
      if (!started) {
        ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H);
        pxText(ctx, 'TAP TO START', W / 2, H / 2 - 30, 30, '#ffd43b');
        pxText(ctx, '⬆ ⬇ pick the lane with the right word', W / 2, H / 2 + 10, 14, '#fff');
        pxText(ctx, 'JUMP the rocks  ·  hold DASH to go faster', W / 2, H / 2 + 34, 14, '#fff');
      }
      if (banner) pxText(ctx, banner.text, W / 2, banner.small ? 70 : H / 2, banner.small ? 22 : 34, banner.small ? '#ffd43b' : '#7cfc3a');
    }
    keys(cv, {
      ArrowUp: [() => setLane(0)], w: [() => setLane(0)], ArrowDown: [() => setLane(1)], s: [() => setLane(1)],
      ' ': [() => jump()], Enter: [() => start()],
      ArrowRight: [() => setDash(true), () => setDash(false)], d: [() => setDash(true), () => setDash(false)],
    });
    const stopLoop = gameLoop(cv, step);
    const root = h('div', { class: 'game arcade runner' },
      h('div', { class: 'arc-screen' }, cv),
      h('div', { class: 'arc-controls' },
        h('div', { class: 'arc-pad runner-lanes' },
          holdButton('⬆ Top', 'runner-btn', () => setLane(0)),
          holdButton('⬇ Bottom', 'runner-btn', () => setLane(1))),
        h('div', { class: 'arc-pad' },
          holdButton('JUMP', 'arc-jump runner-jump', () => jump()),
          holdButton('DASH ▶▶', 'runner-dash', () => setDash(true), () => setDash(false)))),
      h('p', { class: 'arc-tip' }, '🏃 Pick the lane with the right word! JUMP the rocks, grab coins, and hold DASH ▶▶ to zoom to the next sign.'));
    root._test = {
      frames(k) { for (let i = 0; i < k; i++) step(1 / 30); },
      start, lane: l => setLane(l), jump, dash: setDash,
      get gate() { const gt = gates.find(x => !x.hit); return gt && { x: gt.x, words: gt.words.map(w => w.label), ok: gt.words.findIndex(w => w.ok) }; },
      get got() { return got; }, get finished() { return finished; }, get left() { return queue.length; },
      get coins() { return coins; }, get things() { return things.map(t => ({ kind: t.kind, lane: t.lane, x: t.x, got: !!t.got })); },
      get speed() { return speed(); }, get jumpY() { return jumpY; },
    };
    root._stop = stopLoop;
    return root;
  };

  // ===== Block Builder: place blocks on a grid so the robot can reach the flag =====
  // r.map: rows of terrain letters (g grass, d dirt, s stone, w water, R robot start, F flag, '.' air)
  // r.blocks: [{ id, label, count, sinks: true|false, why }] – blocks that "sink" fall into water when placed over it
  const BLOCK_TEX = {
    g: [['gggggggg', 'GgGgGgGg', 'dddDdddd', 'dDdddddD', 'ddddDddd', 'dddddddd', 'DddDdddd', 'dddddDdd'], { g: '#5bbf3a', G: '#3d8a26', d: '#8a5a32', D: '#6b4425' }],
    d: [['dddDdddd', 'dDdddddD', 'ddddDddd', 'dddddddd', 'DddDdddd', 'dddddDdd', 'dDdddddd', 'ddddddDd'], { d: '#8a5a32', D: '#6b4425' }],
    s: [['ssSsssss', 'sssssSss', 'sSssssss', 'ssssSsss', 'sssssssS', 'sSssssss', 'ssssSsss', 'ssSsssss'], { s: '#9a9a9a', S: '#6f6f6f' }],
    w: [['wwwwwwww', 'wWWwwwWW', 'wwwwwwww', 'wwwwwwww', 'WWwwwWWw', 'wwwwwwww', 'wwwwwwww', 'wwwwwwww'], { w: '#2f7fd8', W: '#7fc3ff' }],
    iron: [['kkkkkkkk', 'kiiiiiik', 'kiIiiIik', 'kiiiiiik', 'kiiiiiik', 'kiIiiIik', 'kiiiiiik', 'kkkkkkkk'], { k: '#4b4b4b', i: '#c9c9c9', I: '#7a7a7a' }],
    steel: [['kkkkkkkk', 'kbbbbbbk', 'kbWbbbbk', 'kbbWbbbk', 'kbbbWbbk', 'kbbbbWbk', 'kbbbbbbk', 'kkkkkkkk'], { k: '#2c3e50', b: '#8fa7bd', W: '#e8f1fa' }],
    nickel: [['kkkkkkkk', 'knnnnnnk', 'knWnnnnk', 'knnnnnnk', 'knnnnWnk', 'knnnnnnk', 'knnnnnnk', 'kkkkkkkk'], { k: '#5d5d4f', n: '#b8b59a', W: '#f2f0e0' }],
    wood: [['bbbbbbbb', 'wwwwwwww', 'wWwwwwww', 'bbbbbbbb', 'wwwwwWww', 'wwwwwwww', 'bbbbbbbb', 'wwWwwwww'], { b: '#6b4423', w: '#c08a52', W: '#9c6b3c' }],
    plastic: [['pppppppp', 'pPPppppp', 'pPpppppp', 'pppppppp', 'pppppppp', 'pppppppp', 'ppppppqp', 'pppppqqp'], { p: '#ff5fa2', P: '#ffc2dd', q: '#c2306f' }],
    gold: [['kkkkkkkk', 'kyyyyyyk', 'kyWyyyyk', 'kyyWyyyk', 'kyyyyyyk', 'kyyyyOyk', 'kyyyyyyk', 'kkkkkkkk'], { k: '#8a5d00', y: '#ffd43b', W: '#fff6c2', O: '#e09a00' }],
    glass: [['kkkkkkkk', 'kgggggWk', 'kggggWgk', 'kgggWggk', 'kggWgggk', 'kgWggggk', 'kWgggggk', 'kkkkkkkk'], { k: '#5a9bb0', g: '#d9f6ff', W: '#ffffff' }],
    foil: [['ffffffff', 'fFfffFff', 'ffffffff', 'ffFfffff', 'ffffffFf', 'ffffffff', 'fFffffff', 'ffffFfff'], { f: '#d7dde3', F: '#ffffff' }],
  };
  const texURL = {};
  const blockTex = id => texURL[id] || (texURL[id] = BLOCK_TEX[id] ? spriteCanvas(BLOCK_TEX[id][0], BLOCK_TEX[id][1], 4).toDataURL() : '');
  GAMES.blocks = function (r, key, done) {
    const rows = r.map.length, cols = Math.max(...r.map.map(x => x.length));
    const terr = r.map.map(row => [...row.padEnd(cols, '.')]);
    let start = null, flag = null;
    terr.forEach((row, y) => row.forEach((ch, x) => { if (ch === 'R') { start = [x, y]; row[x] = '.'; } if (ch === 'F') { flag = [x, y]; row[x] = '.'; } }));
    const inv = {};
    (r.blocks || []).forEach(b => { inv[b.id] = b.count; });
    const placedB = {}; // "x,y" -> block id
    let selId = (r.blocks || [])[0] && r.blocks[0].id, busy = false, finished = false;
    const isWater = (x, y) => terr[y] && terr[y][x] === 'w';
    const solidAt = (x, y) => y >= rows || (terr[y] && 'gds'.includes(terr[y][x])) || !!placedB[x + ',' + y];
    const gridEl = h('div', { class: 'bb-grid', style: `--c:${cols};--r:${rows}` });
    const cells = [];
    const robot = h('div', { class: 'bb-robot' }, h('img', { src: AV ? AV.dataURL(AV.load().look, { scale: 4 }) : spriteCanvas(SPR.robot, ROBOT_PAL, 4).toDataURL(), alt: 'you' }));
    const flagEl = h('div', { class: 'bb-flag' }, '🚩');
    const invEl = h('div', { class: 'bb-inv' });
    const statusEl = h('div', { class: 'bb-status' });
    const posRobot = (x, y, instant) => {
      robot.style.transition = instant ? 'none' : '';
      robot.style.left = `${x / cols * 100}%`; robot.style.top = `${y / rows * 100}%`;
    };
    function drawCell(x, y) {
      const c = cells[y * cols + x], id = placedB[x + ',' + y], t = terr[y][x];
      const tex = id ? blockTex(id) : ('gdsw'.includes(t) ? blockTex(t) : '');
      c.style.backgroundImage = tex ? `url(${tex})` : '';
      c.classList.toggle('placed', !!id);
    }
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const c = h('div', { class: 'bb-cell' });
      c.addEventListener('click', () => tapCell(x, y));
      cells.push(c); gridEl.append(c);
    }
    function drawInv() {
      put(invEl, (r.blocks || []).map(b => h('button', {
        class: 'bb-block' + (b.id === selId ? ' on' : ''), type: 'button', disabled: !inv[b.id],
        onclick() { selId = b.id; sfx.tap(); drawInv(); },
      }, h('img', { src: blockTex(b.id), alt: '' }), h('span', null, b.label), h('b', null, '×' + inv[b.id]))));
    }
    function tapCell(x, y) {
      if (busy || finished) return;
      const k = x + ',' + y;
      if (placedB[k]) { inv[placedB[k]]++; delete placedB[k]; drawCell(x, y); drawInv(); sfx.tap(); return; } // tap again to pick it back up
      if (solidAt(x, y) || isWater(x, y) || (start[0] === x && start[1] === y) || (flag[0] === x && flag[1] === y)) return;
      if (!selId || !inv[selId]) { say('Pick a block from your inventory first!'); return; }
      const b = r.blocks.find(o => o.id === selId);
      inv[selId]--; placedB[k] = selId; drawCell(x, y); drawInv(); sfx.tap();
      // a "sinking" block placed over the water drops in with a splash
      if (b.sinks && isWater(x, y + 1)) {
        busy = true; cells[y * cols + x].classList.add('bb-sink');
        setTimeout(() => {
          delete placedB[k]; inv[b.id]++; cells[y * cols + x].classList.remove('bb-sink'); drawCell(x, y); drawInv();
          sfx.bad(); say('💦 SPLASH! ' + (b.why || 'That block can\'t be used here.')); busy = false;
        }, 650);
      }
    }
    // the robot walks right: steps up one block, falls down gaps, stops at walls
    async function go() {
      if (busy || finished) return;
      busy = true; sfx.good(); say('Here I go…');
      let [x, y] = start;
      posRobot(x, y, true);
      const pause = ms => new Promise(res => setTimeout(res, ms));
      let result = null;
      for (let steps = 0; steps < 200 && !result; steps++) {
        if (x === flag[0] && y === flag[1]) { result = 'win'; break; }
        // fall first
        if (!solidAt(x, y + 1)) {
          if (isWater(x, y + 1) || y + 1 >= rows) { y++; posRobot(x, y); await pause(260); result = 'water'; break; }
          y++; posRobot(x, y); await pause(160); continue;
        }
        const nx = x + 1;
        if (nx >= cols) { result = 'edge'; break; }
        if (!solidAt(nx, y)) { x = nx; }
        else if (!solidAt(nx, y - 1) && !solidAt(x, y - 1)) { x = nx; y--; } // step up one block
        else { result = 'wall'; break; }
        posRobot(x, y); await pause(260);
      }
      if (result === 'win') {
        finished = true; sfx.win(); confetti(90); award(key + ':done', gridEl); say(r.done || 'I made it! Brilliant building!');
        put(statusEl, '🏁 Puzzle solved!'); busy = false; done(); return;
      }
      sfx.bad();
      say(result === 'water' ? (r.hintWater || '💦 Splash! I fell in. Build a bridge across the gap!') : result === 'wall' ? (r.hintWall || 'A wall is in the way! I can only climb ONE block at a time – build some steps.') : (r.hint || 'Hmm, try a different build!'));
      await pause(900); posRobot(start[0], start[1], true); busy = false;
    }
    const reset = () => { if (busy) return; Object.keys(placedB).forEach(k => { inv[placedB[k]]++; delete placedB[k]; }); for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) drawCell(x, y); drawInv(); sfx.tap(); };
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) drawCell(x, y);
    flagEl.style.left = `${flag[0] / cols * 100}%`; flagEl.style.top = `${flag[1] / rows * 100}%`;
    flagEl.style.width = robot.style.width = `${100 / cols}%`; flagEl.style.height = robot.style.height = `${100 / rows}%`;
    posRobot(start[0], start[1], true);
    drawInv();
    put(statusEl, '👆 Pick a block, then tap the grid to place it. Tap a block again to pick it back up.');
    const root = h('div', { class: 'game blocks' },
      h('div', { class: 'bb-board' }, gridEl, flagEl, robot),
      statusEl,
      h('div', { class: 'panel-inner bb-inv-wrap' }, h('h3', null, '🎒 Inventory'), invEl),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn ghost', type: 'button', onclick: reset }, '↺ Reset'),
        h('button', { class: 'btn big green', type: 'button', onclick: go }, '▶ GO, ROBOT!')));
    root._test = { tap: tapCell, go, select(id) { selId = id; drawInv(); }, get finished() { return finished; } };
    return root;
  };
});
