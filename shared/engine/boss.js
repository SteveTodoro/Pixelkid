/* Pixelkid lesson engine – the quiz stage and boss battles: dodge rounds, the finishing-move cut scene.
 * One part of shared/engine.js, which loads it only when a lesson uses it. E is the engine's shared helpers
 * (E.state and E.stageCard are live). See the top of shared/engine.js for how the parts fit together.
 */
PixelkidEngine.part('boss', E => {
  'use strict';
  const { AV, CUR, L, RKEY, WARDROBE, achieve, award, complete, confetti, fill, fmt, go, h, heroImg, mascot, navRow,
    pic, pick, player, popText, put, pxDraw, replay, runQuestions, saveRecord, say, seq, settings, sfx, shake, shell,
    showCert, shuffle, store, toast, tone } = E;

  // ---------- stage: quiz (with optional boss battle) ----------
  // A boss battle: the boss panel on top, the questions, then the player's avatar with 3 hearts at the bottom.
  // Right answer = the avatar attacks; wrong answer = the boss attacks and takes a heart (at most one per question).
  // Bosses can set attack (emoji they fire) and lines: { intro, hurt: [], taunt: [], angry, dodge, miss, last, defeat, win }.
  // From half HP the boss also fights back with dodge rounds (see dodgeRound).
  const LIVES = 3;
  const BOSS_LINES = {
    intro: 'Mwahaha! You will never beat me!',
    hurt: ['Ouch!', 'Argh! Lucky shot!', 'Grr! Stop that!', 'Nooo! My power!', 'That tickled… a bit.', 'Hey! No fair!'],
    taunt: ['Ha ha! Missed!', 'Too slow!', 'Is that all you\'ve got?', 'Mwahaha!', 'Hee hee! Wrong!'],
    angry: 'Right, now I\'m REALLY cross!',
    last: 'No… not like this…',
    defeat: 'NOOOOO! I\'ve been beaten!',
    win: 'Mwahaha! I win! Come back when you\'re cleverer!',
    stunned: 'Ooh… my head is spinning…',
    beg: ['W-wait! Let\'s talk about this!', 'Uh oh…', 'Mercy! MERCY!', 'Can we be friends now?'],
  };
  const HERO_LINES = {
    hit: ['Take that!', 'Pow!', 'Bullseye!', 'Got you!', 'Hi-yah!', 'Boom!', 'Easy!'],
    hurt: ['Ouch!', 'Oof!', 'Eek!', 'Yikes!', 'I\'ll get the next one!'],
    win: 'Victory! 🏆',
  };
  // what pops up over the avatar for a streak of right answers in a row
  const COMBO_WORDS = ['NICE!', 'GREAT!', 'AWESOME!', 'SUPER!', 'AMAZING!', 'UNSTOPPABLE!'];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const calm = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function speech(cls) {
    const el = h('div', { class: 'fight-bubble ' + cls });
    let t = 0;
    return {
      el,
      say(msg, ms = 2200) {
        el.textContent = fill(msg); el.classList.add('show'); replay(el, 'pop');
        clearTimeout(t); if (ms) t = setTimeout(() => { el.classList.remove('show'); }, ms);
      },
    };
  }
  // flies an emoji from one element to another (the attack)
  function projectile(emoji, from, to, cls = '') {
    if (calm() || !from.isConnected || !to.isConnected) return;
    const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
    if (Array.isArray(emoji)) emoji = pick(emoji);
    const isPic = String(emoji).trim().startsWith('<');
    const p = h('div', { class: 'projectile ' + cls + (isPic ? ' pic-shot' : ''), 'aria-hidden': 'true', html: isPic ? emoji : null }, isPic ? null : emoji);
    document.body.append(p);
    const x0 = a.left + a.width / 2 - 20, y0 = a.top + a.height / 2 - 20, x1 = b.left + b.width / 2 - 20, y1 = b.top + b.height / 2 - 20;
    const anim = p.animate([
      { transform: `translate(${x0}px, ${y0}px) scale(.6) rotate(0)` },
      { transform: `translate(${(x0 + x1) / 2}px, ${Math.min(y0, y1) - 60}px) scale(1.3) rotate(180deg)` },
      { transform: `translate(${x1}px, ${y1}px) scale(1) rotate(360deg)` },
    ], { duration: 420, easing: 'linear' });
    anim.onfinish = () => p.remove();
  }
  function banner(parent, text, cls = '') {
    const b = h('div', { class: 'fight-banner ' + cls, 'aria-hidden': 'true' }, text);
    parent.append(b); setTimeout(() => b.remove(), 1500);
  }
  // a burst of pixel sparkles from the middle of `from`, drawn inside the positioned `parent`
  function sparkle(parent, from, n = 10, colors = ['#ffd54f', '#7ec8ff', '#ffffff', '#7cfc3a']) {
    if (calm() || !from.isConnected) return;
    const p = parent.getBoundingClientRect(), a = from.getBoundingClientRect();
    const cx = a.left - p.left + a.width / 2, cy = a.top - p.top + a.height / 2;
    for (let k = 0; k < n; k++) {
      const ang = (k / n) * Math.PI * 2 + Math.random() * 0.5, dist = 34 + Math.random() * 40, s = pick([6, 9, 12]);
      const sp = h('div', { class: 'spark', 'aria-hidden': 'true', style: `left:${cx - s / 2}px;top:${cy - s / 2}px;width:${s}px;height:${s}px;background:${pick(colors)}` });
      parent.append(sp);
      sp.animate([
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist}px) scale(.4)`, opacity: 0 },
      ], { duration: 650, easing: 'steps(6)', fill: 'forwards' }).onfinish = () => sp.remove();
    }
  }
  function heartsRow(n) {
    return Array.from({ length: LIVES }, (_, k) => h('span', { class: 'heart' + (k < n ? '' : ' lost') }, k < n ? '❤️' : '🖤'));
  }

  // Undertale-style dodge round: the avatar is the "soul" in a box and the boss fires its attack emoji in patterns.
  // Arrow keys / WASD or drag anywhere on the box. A hit costs at most one heart per round; a perfect dodge earns gems.
  // end({ hit, dead }) is called when the round is over.
  // Hits never cost hearts: the player starts with a pot of gems, each hit knocks one out, and surviving banks the rest.
  function dodgeRound(area, b, round, { end }) {
    const W = 360, H = 240, DUR = 12, speed = 1 + 0.15 * round, POT = 5;
    let pot = POT;
    const cvs = h('canvas', { class: 'dodge-box', width: W * 2, height: H * 2, 'aria-label': 'Dodge the attacks! Use the arrow keys or drag to move.' });
    const ctx = cvs.getContext('2d'); ctx.scale(2, 2); ctx.imageSmoothingEnabled = false;
    const timer = h('div', { class: 'dodge-timer' }, h('div', { class: 'dodge-timer-fill' }));
    const status = h('div', { class: 'dodge-status' }, '3…');
    const potEl = h('div', { class: 'dodge-pot' });
    const paintPot = () => { potEl.textContent = `💎 Gems at stake: ${'💎'.repeat(pot)}${'▫️'.repeat(POT - pot)}  ·  survive to keep them!`; };
    paintPot();
    put(area, h('div', { class: 'dodge' },
      h('div', { class: 'dodge-title' }, `⚠️ ${b.name} attacks! DODGE!`),
      h('div', { class: 'dodge-help' }, '⬅️⬆️⬇️➡️ arrow keys, or drag your finger on the box'),
      potEl, cvs, timer, status));
    // sprites: the avatar (or a heart) and the boss's attack, drawn once
    const me = AV ? AV.draw(AV.load().look, { scale: 2 }) : null;
    const pw = me ? me.width : 22, ph = me ? me.height : 22;
    // the boss's ammo: one or more emoji or Pixel.svg pictures (b.attack can be a list); b.spin makes them twirl
    const shots = [].concat(b.attack || '💥').map(a => {
      const c = document.createElement('canvas'); c.width = c.height = 48;
      const g = c.getContext('2d');
      if (String(a).trim().startsWith('<')) {
        const img = new Image();
        img.onload = () => { g.imageSmoothingEnabled = false; g.drawImage(img, 6, 6, 36, 36); };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(String(a).replace('<svg ', '<svg width="36" height="36" '));
      } else if (!pxDraw(g, a, 24, 24, 36, { baseline: 'middle' })) { g.font = '36px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(a, 24, 27); }
      return c;
    });
    const p = { x: W / 2, y: H / 2 }, keys = {}, bullets = [], walls = [];
    let t = -1.5, last = 0, hitAt = -9, hit = false, over = false, raf = 0, spawnT = 0, lt = 0, S = {};
    const fire = q => bullets.push(Object.assign({ s: pick(shots), a: Math.random() * 6.3, va: b.spin ? 7 : 0 }, q));
    const PINK = '#ff4fa3';
    // two random patterns per round (or the boss's own list in b.patterns). lt = seconds into this pattern, S = its own memory.
    // Bullets are dodged; walls are pink zones that hurt while they are solid (they flash first as a warning).
    const PATTERNS = {
      rain(dt) { if ((spawnT += dt) > 0.32 / speed) { spawnT = 0; fire({ x: 10 + Math.random() * (W - 20), y: -12, vx: 0, vy: (80 + Math.random() * 50) * speed, r: 10 }); } },
      sweep(dt) {
        if ((spawnT += dt) > 0.9 / speed) {
          spawnT = 0; const left = Math.random() < 0.5, gap = 30 + Math.random() * (H - 100);
          for (let y = 12; y < H; y += 26) if (y < gap || y > gap + 64) fire({ x: left ? -12 : W + 12, y, vx: (left ? 1 : -1) * 95 * speed, vy: 0, r: 9 });
        }
      },
      aimed(dt) {
        if ((spawnT += dt) > 0.5 / speed) {
          spawnT = 0; const a = Math.random() * Math.PI * 2, x = W / 2 + Math.cos(a) * 220, y = H / 2 + Math.sin(a) * 160;
          const d = Math.hypot(p.x - x, p.y - y) || 1, v = 110 * speed;
          fire({ x, y, vx: (p.x - x) / d * v, vy: (p.y - y) / d * v, r: 10 });
        }
      },
      ring(dt) {
        if ((spawnT += dt) > 1.3 / speed) {
          spawnT = 0; const cx = 40 + Math.random() * (W - 80), n = 10, off = Math.random();
          for (let k = 0; k < n; k++) { const a = (k + off) / n * Math.PI * 2; fire({ x: cx, y: 20, vx: Math.cos(a) * 80 * speed, vy: Math.sin(a) * 80 * speed + 30, r: 9 }); }
        }
      },
      // pink walls slide in from both sides and squeeze – hide in the gap! (flashes first, then closes, then opens)
      crush() {
        const cyc = 2.4 / Math.min(speed, 1.4), k = lt % cyc, n = Math.floor(lt / cyc);
        if (S.n !== n) { S.n = n; S.gap = 50 + Math.random() * (W - 100); }
        const half = 30, warn = 0.7, close = warn + 0.5, hold = close + 0.5;
        const f = k < warn ? 0 : k < close ? (k - warn) / 0.5 : k < hold ? 1 : Math.max(0, 1 - (k - hold) / 0.4);
        walls.length = 0;
        if (k < warn) { walls.push({ x: 0, y: 0, w: S.gap - half, h: H, warn: true }, { x: S.gap + half, y: 0, w: W - S.gap - half, h: H, warn: true }); return; }
        walls.push({ x: 0, y: 0, w: (S.gap - half) * f, h: H }, { x: W - (W - S.gap - half) * f, y: 0, w: (W - S.gap - half) * f, h: H });
      },
      // laser beams: a thin flashing line warns where a pink beam is about to blast across
      laser() {
        const cyc = 1.5 / speed, k = lt % cyc, n = Math.floor(lt / cyc);
        if (S.n !== n) { S.n = n; S.v = Math.random() < 0.5; S.at = S.v ? 30 + Math.random() * (W - 60) : 25 + Math.random() * (H - 50); }
        walls.length = 0;
        const th = k < 0.75 ? 4 : 30, warn = k < 0.75;
        if (k > 1.25) return;
        walls.push(S.v ? { x: S.at - th / 2, y: 0, w: th, h: H, warn, beam: true } : { x: 0, y: S.at - th / 2, w: W, h: th, warn, beam: true });
      },
      // a twirling stream of shots from the top
      spiral(dt) {
        S.a = (S.a || 0) + dt * 3.2;
        if ((spawnT += dt) > 0.11 / speed) { spawnT = 0; fire({ x: W / 2, y: 18, vx: Math.cos(S.a) * 85 * speed, vy: Math.abs(Math.sin(S.a)) * 70 * speed + 25, r: 9 }); }
      },
      // a handful of shots that bounce around the box
      bounce() {
        if (!S.done) {
          S.done = true;
          for (let k = 0; k < 3 + Math.min(3, round); k++) {
            const a = Math.random() * Math.PI * 2;
            fire({ x: 20 + Math.random() * 40, y: 20 + Math.random() * 30, vx: Math.cos(a) * 90 * speed, vy: Math.sin(a) * 90 * speed, r: 10, bounce: true });
          }
        }
      },
    };
    const pool = (b.patterns || Object.keys(PATTERNS)).filter(k => PATTERNS[k]);
    // mix it up: one of the new wall/laser patterns in most rounds, plus a bullet pattern
    const special = pool.filter(k => k === 'crush' || k === 'laser'), shooty = pool.filter(k => !special.includes(k));
    const plan = special.length && shooty.length ? shuffle([pick(special), pick(shooty)]) : shuffle(pool).slice(0, 2);

    const KEYS = { ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r', ArrowUp: 'u', w: 'u', W: 'u', ArrowDown: 'd', s: 'd', S: 'd' };
    const kd = e => { const k = KEYS[e.key]; if (k) { keys[k] = true; e.preventDefault(); } };
    const ku = e => { const k = KEYS[e.key]; if (k) { keys[k] = false; e.preventDefault(); } };
    document.addEventListener('keydown', kd); document.addEventListener('keyup', ku);
    // drag: the avatar follows the finger's movement (not its position), so the finger never hides it
    let drag = null;
    cvs.addEventListener('pointerdown', e => { e.preventDefault(); drag = { x: e.clientX, y: e.clientY }; try { cvs.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } });
    cvs.addEventListener('pointermove', e => {
      if (!drag) return;
      const k = W / cvs.getBoundingClientRect().width * 1.3;
      p.x += (e.clientX - drag.x) * k; p.y += (e.clientY - drag.y) * k; drag = { x: e.clientX, y: e.clientY };
    });
    const undrag = () => { drag = null; };
    cvs.addEventListener('pointerup', undrag); cvs.addEventListener('pointercancel', undrag);
    const stop = () => { over = true; cancelAnimationFrame(raf); document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku); };

    function finish() {
      stop();
      for (let k = 0; k < pot; k++) award(`dodge:${round}:${k}`, status);
      if (!hit) { status.textContent = `✨ PERFECT DODGE! +${pot} 💎`; sfx.win(); }
      else if (pot) { status.textContent = `You survived! +${pot} 💎`; sfx.good(); }
      else status.textContent = 'Ouch! No gems this time – back to the questions!';
      setTimeout(() => end({ hit, dead: false }), 1500);
    }
    function frame(now) {
      if (over) return;
      if (!cvs.isConnected) return stop(); // left the stage mid-round
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0); last = now; t += dt;
      if (t < 0) status.textContent = t < -1 ? '3… 2…' : '1…';
      else {
        status.textContent = hit ? 'Ouch! Keep dodging!' : 'Dodge!';
        const phase = t < DUR / 2 ? 0 : 1;
        if (phase !== S.phase) { S = { phase }; spawnT = 0; walls.length = 0; if (phase === 1) bullets.forEach(q => { q.bounce = false; }); }
        lt = t - phase * DUR / 2;
        if (t < DUR - 0.6) PATTERNS[plan[phase]](dt); else walls.length = 0;
        timer.firstChild.style.width = Math.max(0, 100 - t / DUR * 100) + '%';
      }
      const v = 150 * dt;
      p.x += ((keys.r ? 1 : 0) - (keys.l ? 1 : 0)) * v; p.y += ((keys.d ? 1 : 0) - (keys.u ? 1 : 0)) * v;
      p.x = Math.max(pw / 2, Math.min(W - pw / 2, p.x)); p.y = Math.max(ph / 2, Math.min(H - ph / 2, p.y));
      for (const q of bullets) {
        q.x += q.vx * dt; q.y += q.vy * dt; q.a += q.va * dt;
        if (q.bounce) { if (q.x < q.r || q.x > W - q.r) q.vx *= -1; if (q.y < q.r || q.y > H - q.r) q.vy *= -1; }
      }
      for (let k = bullets.length - 1; k >= 0; k--) { const q = bullets[k]; if (q.x < -30 || q.x > W + 30 || q.y < -30 || q.y > H + 30) bullets.splice(k, 1); }
      // a small, forgiving hitbox in the middle of the avatar
      const safe = t - hitAt < 1.2;
      if (!safe) for (const q of bullets) {
        if (Math.abs(q.x - p.x) < q.r * 0.7 + pw * 0.28 && Math.abs(q.y - p.y) < q.r * 0.7 + ph * 0.3) {
          hitAt = t; sfx.hit(); shake(cvs); hit = true;
          if (pot) { pot--; paintPot(); replay(potEl, 'shake'); popText(cvs.parentNode, '-1 💎', 'ouch'); }
          break;
        }
      }
      if (!(t - hitAt < 1.2)) for (const w of walls) {
        if (w.warn || w.w <= 0) continue;
        const hx = pw * 0.28, hy = ph * 0.3;
        if (p.x + hx > w.x && p.x - hx < w.x + w.w && p.y + hy > w.y && p.y - hy < w.y + w.h) {
          hitAt = t; sfx.hit(); shake(cvs); hit = true;
          if (pot) { pot--; paintPot(); replay(potEl, 'shake'); popText(cvs.parentNode, '-1 💎', 'ouch'); }
          break;
        }
      }
      // draw
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      if (!(t - hitAt < 1.2 && Math.floor(t * 12) % 2)) {
        if (me) ctx.drawImage(me, Math.round(p.x - pw / 2), Math.round(p.y - ph / 2));
        else if (!pxDraw(ctx, '❤️', p.x, p.y, 22, { baseline: 'middle' })) { ctx.font = '22px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('❤️', p.x, p.y); }
      }
      for (const w of walls) {
        if (w.warn) {
          ctx.globalAlpha = Math.floor(t * 10) % 2 ? 0.35 : 0.15; ctx.fillStyle = PINK; ctx.fillRect(w.x, w.y, w.w, w.h); ctx.globalAlpha = 1;
          if (!w.beam) { ctx.strokeStyle = '#fff'; ctx.setLineDash([4, 4]); ctx.strokeRect(w.x + 1, w.y + 1, w.w - 2, w.h - 2); ctx.setLineDash([]); }
        } else if (w.w > 0) {
          ctx.fillStyle = PINK; ctx.fillRect(w.x, w.y, w.w, w.h);
          ctx.fillStyle = '#ffd1e8';
          if (w.beam) ctx.fillRect(w.x + (w.w > w.h ? 0 : w.w / 2 - 3), w.y + (w.w > w.h ? w.h / 2 - 3 : 0), w.w > w.h ? w.w : 6, w.w > w.h ? 6 : w.h);
          else for (let y = 4; y < H; y += 16) ctx.fillRect(w.x < 1 ? w.x + w.w - 6 : w.x + 2, y, 4, 8); // a bright inner edge on each wall
        }
      }
      for (const q of bullets) {
        ctx.save(); ctx.translate(q.x, q.y); if (q.va) ctx.rotate(q.a);
        ctx.drawImage(q.s, -q.r * 1.2, -q.r * 1.2, q.r * 2.4, q.r * 2.4); ctx.restore();
      }
      if (t >= DUR) return finish();
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    cvs.scrollIntoView({ block: 'center', behavior: calm() ? 'auto' : 'smooth' });
  }

  // ---------- the finishing-move cut scene ----------
  // Plays full screen after the "Final blow!" button, then calls done(). First the player taps to fill a power meter, then one of three finishers at random:
  // a giant hammer squashes the boss flat, an uppercut launches it into the sky, or it explodes into its own pixels.
  function finisher(b, lines, done) {
    if (calm()) { done(); return; }
    let over = false;
    const STOP = {};
    const step = async ms => { await wait(ms); if (over) throw STOP; };
    const hero = heroImg('cs-hero');
    const boss = pic(b.sprite || b.emoji || '👾', 'cs-boss');
    const bubble = h('div', { class: 'fight-bubble from-boss cs-bubble' });
    const caption = h('div', { class: 'cs-text', 'aria-live': 'polite' });
    const parts = h('canvas', { class: 'cs-parts', 'aria-hidden': 'true' });
    const skip = h('button', { class: 'btn ghost cs-skip', type: 'button', onclick() { sfx.tap(); finish(); } }, 'Skip ▶');
    const stage = h('div', { class: 'cs-stage' }, h('div', { class: 'cs-floor' }), hero, boss, bubble);
    const scene = h('div', { class: 'cutscene', role: 'dialog', 'aria-label': `Final blow! ${b.name} is defeated` },
      h('div', { class: 'cs-bar top' }), h('div', { class: 'cs-bar bottom' }), stage, parts, caption, skip);
    const onKey = e => { if (e.key === 'Escape') finish(); };
    function finish() {
      if (over) return;
      over = true; document.removeEventListener('keydown', onKey);
      scene.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, easing: 'steps(4)', fill: 'forwards' }).onfinish = () => scene.remove();
      done();
    }
    document.addEventListener('keydown', onKey);
    document.body.append(scene);

    // flying bits (pixels, dust) on a canvas over the whole scene
    let bits = [], raf = 0;
    parts.width = innerWidth; parts.height = innerHeight;
    function frame() {
      const ctx = parts.getContext('2d');
      ctx.clearRect(0, 0, parts.width, parts.height);
      bits = bits.filter(p => p.life < p.max && p.y < parts.height + 40);
      for (const p of bits) {
        p.vy += p.g; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.life++;
        ctx.globalAlpha = Math.min(1, (p.max - p.life) / 20);
        ctx.fillStyle = '#000'; ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, p.s + 2, p.s + 2);
        ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
      }
      ctx.globalAlpha = 1;
      raf = bits.length && scene.isConnected ? requestAnimationFrame(frame) : 0;
    }
    const fling = list => { bits.push(...list); if (!raf) raf = requestAnimationFrame(frame); };
    // the boss bursts into its own pixels (pixel-art sprites), or into coloured chunks (emoji bosses)
    function shatter(power = 1) {
      const r = boss.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const svg = boss.querySelector('svg'), list = [];
      if (svg && svg.viewBox.baseVal && svg.viewBox.baseVal.width) {
        const vb = svg.viewBox.baseVal, sr = svg.getBoundingClientRect(), px = sr.width / vb.width, py = sr.height / vb.height;
        for (const rc of svg.querySelectorAll('rect')) {
          const x = sr.left + (+rc.getAttribute('x') + 0.5) * px, y = sr.top + (+rc.getAttribute('y') + 0.5) * py;
          list.push({ x, y, s: Math.max(4, Math.round(Math.min(px, py))), c: rc.getAttribute('fill'), g: 0.42, life: 0, max: 140,
            vx: (x - cx) / r.width * 18 * power + (Math.random() - 0.5) * 6, vy: (y - cy) / r.height * 10 * power - 6 - Math.random() * 8 });
        }
      } else {
        for (let k = 0; k < 70; k++) list.push({ x: cx + (Math.random() - 0.5) * r.width * 0.6, y: cy + (Math.random() - 0.5) * r.height * 0.6,
          s: pick([6, 9, 12]), c: pick(['#e53935', '#ffd54f', '#ffffff', '#8e5cff', '#2ee6d6']), g: 0.42, life: 0, max: 140,
          vx: (Math.random() - 0.5) * 22 * power, vy: -Math.random() * 16 - 4 });
      }
      fling(list);
    }
    function dust(x, y, n = 26) {
      fling(Array.from({ length: n }, (_, k) => ({ x, y, s: pick([6, 9]), c: pick(['#d7ccc8', '#bcaaa4', '#ffffff']), g: -0.04, life: 0, max: 50,
        vx: (k % 2 ? 1 : -1) * (2 + Math.random() * 7), vy: -Math.random() * 2.5 })));
    }
    const centre = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r }; };
    const shout = (text, cls = '') => { caption.className = 'cs-text ' + cls; caption.textContent = text; replay(caption, 'show'); };
    const flash = () => scene.animate([{ filter: 'brightness(4)' }, { filter: 'none' }], { duration: 260, easing: 'steps(3)' });
    const quake = () => stage.animate([
      { transform: 'translate(0,0)' }, { transform: 'translate(-14px,8px)' }, { transform: 'translate(12px,-10px)' },
      { transform: 'translate(-8px,6px)' }, { transform: 'translate(6px,-4px)' }, { transform: 'translate(0,0)' },
    ], { duration: 420, easing: 'steps(6)' });
    // anim() just plays; await move() waits for it and stops the scene if it was skipped meanwhile
    const anim = (el, frames, ms, easing = 'steps(8)') => el.animate(frames, { duration: ms, easing, fill: 'forwards' });
    const move = async (...args) => { await anim(...args).finished; if (over) throw STOP; };

    async function hammer() {
      const c = centre(boss), sr = stage.getBoundingClientRect();
      const ham = h('div', { class: 'cs-prop', 'aria-hidden': 'true', style: `left:${c.x - sr.left - 60}px;top:${c.r.top - sr.top - 130}px` }, '🔨');
      stage.append(ham);
      shout('HAMMER TIME!');
      sfx.whoosh();
      await move(ham, [{ transform: 'translateY(-420px) rotate(-70deg)' }, { transform: 'translateY(0) rotate(25deg)' }], 320, 'ease-in');
      sfx.smash(); flash(); quake();
      boss.style.transformOrigin = '50% 100%';
      boss.animate([{ transform: 'none' }, { transform: 'scale(1.8, .15)' }], { duration: 90, fill: 'forwards' });
      dust(c.x, c.r.bottom - 6);
      shout('SMASH!', 'big');
      anim(ham, [{ transform: 'translateY(0) rotate(25deg)' }, { transform: 'translateY(-70px) rotate(-10deg)', opacity: 1 }, { transform: 'translateY(-90px) rotate(-30deg)', opacity: 0 }], 600);
      await step(800);
      sfx.boom(); shatter(0.6); boss.style.visibility = 'hidden';
      shout('PANCAKED!');
    }
    async function launch() {
      const a = centre(hero), c = centre(boss), dx = c.x - a.x - c.r.width * 0.45;
      shout('UPPERCUT!');
      sfx.whoosh();
      await move(hero, [{ transform: 'none' }, { transform: `translateX(${dx}px)` }], 260);
      await move(hero, [{ transform: `translateX(${dx}px)` }, { transform: `translate(${dx + 10}px, -90px) rotate(-20deg) scale(1.2)` }], 160);
      sfx.bossHit(); flash(); quake(); sfx.launch();
      shout('POW!', 'big');
      anim(boss, [{ transform: 'none' }, { transform: 'translate(180px, -900px) rotate(1080deg) scale(.15)' }], 900, 'ease-in');
      dust(c.x, c.r.bottom - 6, 14);
      await step(300);
      anim(hero, [{ transform: `translate(${dx + 10}px, -90px) rotate(-20deg) scale(1.2)` }, { transform: 'none' }], 380);
      await step(800);
      const sr = stage.getBoundingClientRect();
      const star = h('div', { class: 'cs-prop twinkle', 'aria-hidden': 'true', style: `left:${Math.min(c.x - sr.left + 60, sr.width - 60)}px;top:-40px` }, '✨');
      stage.append(star);
      sfx.ding();
      anim(star, [{ transform: 'scale(0)' }, { transform: 'scale(1.6) rotate(45deg)' }, { transform: 'scale(0) rotate(90deg)' }], 700);
      shout('BYE BYE!');
    }
    async function explode() {
      const zap = b.heroAttack || '⚡';
      shout('SUPER COMBO!');
      for (let k = 0; k < 3; k++) {
        projectile(zap, hero, boss, 'cs-shot'); sfx.zap();
        await step(380);
        sfx.bossHit(); replay(boss, 'cs-hit');
      }
      boss.classList.add('cs-rumble');
      shout('IT\'S GOING TO BLOW!');
      seq([200, 230, 260, 300, 340, 390, 450], 0.07, 'sawtooth', 0.05);
      await step(900);
      sfx.boom(); flash(); quake(); shatter(1.2);
      boss.style.visibility = 'hidden';
      shout('KABOOM!', 'big');
    }

    // the player taps (or presses space) to fill the power meter; it drains slowly when they stop, then the blow lands
    async function powerUp() {
      let power = 0, idle = 0, taps = 0;
      const fillBar = h('div', { class: 'cs-meter-fill' });
      const tapBtn = h('button', { class: 'btn gold big cs-tap', type: 'button' }, '👊 TAP! TAP! TAP!');
      const meter = h('div', { class: 'cs-power' },
        h('div', { class: 'cs-meter-label' }, '⚡ CHARGE YOUR FINAL BLOW!'),
        h('div', { class: 'cs-meter', role: 'progressbar', 'aria-label': 'Power', 'aria-valuemin': 0, 'aria-valuemax': 100 }, fillBar),
        tapBtn);
      const tap = e => {
        if (e) e.preventDefault();
        if (over || power >= 1) return;
        power = Math.min(1, power + 0.1); idle = 0; taps++;
        tone(220 + power * 660, 0, 0.08, 'square', 0.05);
        hero.classList.add('cs-charge'); replay(tapBtn, 'pop');
        if (taps % 3 === 0) sparkle(stage, hero, 8);
      };
      const onSpace = e => { if (e.key === ' ' || e.key === 'Enter') tap(e); };
      tapBtn.addEventListener('pointerdown', tap);
      tapBtn.addEventListener('click', e => e.preventDefault());
      document.addEventListener('keydown', onSpace);
      scene.append(meter); tapBtn.focus();
      shout('POWER UP!');
      scene._test = Object.assign(scene._test || {}, { tap: () => tap(), get power() { return power; } });
      try {
        while (power < 1) {
          await step(50);
          idle += 50;
          if (idle > 500 && power > 0) power = Math.max(0, power - 0.012); // gentle drain: keep tapping!
          if (!power) hero.classList.remove('cs-charge');
          fillBar.style.width = power * 100 + '%';
          meter.querySelector('.cs-meter').setAttribute('aria-valuenow', Math.round(power * 100));
          meter.classList.toggle('hot', power > 0.7);
        }
        fillBar.style.width = '100%'; meter.classList.add('full');
        shout('MAX POWER!', 'big gold'); sparkle(stage, hero, 24);
        await step(600);
      } finally {
        document.removeEventListener('keydown', onSpace);
        meter.remove(); skip.focus();
      }
    }

    (async () => {
      try {
        // intro: letterbox bars slide in, the boss wobbles and begs, the player charges the meter, the hero powers up
        await step(350);
        bubble.textContent = fill(pick(lines.beg)); bubble.classList.add('show'); replay(bubble, 'pop');
        await step(2200);
        bubble.classList.remove('show');
        await powerUp();
        hero.classList.add('cs-charge'); sfx.charge(); shout('FINAL BLOW!', 'big');
        sparkle(stage, hero, 18);
        await step(700);
        hero.classList.remove('cs-charge');
        boss.classList.remove('cs-dizzy');
        await pick([hammer, launch, explode])();
        await step(1100);
        // the boss's last words, then victory!
        bubble.textContent = fill(lines.defeat); bubble.classList.add('show', 'ghost'); replay(bubble, 'pop');
        await step(3000); // time to read the last words before the confetti
        sfx.win(); confetti(160);
        hero.getAnimations().forEach(x => { if (x.constructor === Animation) x.cancel(); }); // let the CSS cheer take over
        hero.classList.add('cs-cheer'); shout('VICTORY!', 'big gold');
        skip.textContent = '🏆 See my score ▶'; skip.className = 'btn gold big cs-skip'; skip.focus();
      } catch (e) { if (e !== STOP) throw e; }
    })();
    boss.classList.add('cs-dizzy');
    skip.focus();
  }

  function bossFight(b, total) {
    const lines = Object.assign({}, BOSS_LINES, b.lines);
    let hp = total, lives = LIVES, half = false, dodgeDue = false, rounds = 0, sinceDodge = 0, streak = 0, moveT = 0;
    const lostOn = new Set();
    // boss panel
    const fillEl = h('div', { class: 'hp-fill', style: 'width:100%' });
    const hpText = h('div', { class: 'boss-sub' }, `HP ${hp}/${total} · Every right answer is a hit!`);
    const sprite = pic(b.sprite || b.emoji || '👾', 'boss-sprite');
    const bossTalk = speech('from-boss');
    const el = h('div', { class: 'boss' }, sprite, h('div', { class: 'boss-info' }, h('div', { class: 'boss-name' }, b.name), h('div', { class: 'hp' }, fillEl), hpText, bossTalk.el));
    // player panel
    const avatar = heroImg('hero-sprite');
    const hearts = h('div', { class: 'hearts', role: 'img', 'aria-label': `Lives: ${lives} of ${LIVES}` }, heartsRow(lives));
    const heroTalk = speech('from-hero');
    // the aura wraps the avatar, so it can glow while the avatar itself lunges, bobs or says ouch
    const aura = h('div', { class: 'hero-aura' }, avatar);
    const hero = h('div', { class: 'hero' }, aura,
      h('div', { class: 'hero-info' },
        h('div', { class: 'hero-top' }, h('div', { class: 'hero-name' }, settings.name || 'You'), hearts,
          h('div', { class: 'boss-sub' }, `Lose all ${LIVES} hearts and ${b.name} wins!`)),
        heroTalk.el));
    // swaps the avatar's current move (attack, celebration, ouch) for a fresh one
    const avatarBase = avatar.className;
    function act(cls) { avatar.className = avatarBase; void avatar.offsetWidth; avatar.className = avatarBase + ' ' + cls; }
    // the avatar celebrates a right answer by powering up its aura: every answer in a row makes it bigger, brighter and faster (up to 5)
    function celebrate() {
      const word = COMBO_WORDS[Math.min(streak, COMBO_WORDS.length) - 1];
      popText(hero, streak > 1 ? `${word} x${streak}` : word, 'combo' + (streak >= 3 ? ' mega' : ''));
      aura.dataset.aura = Math.min(streak, 5);
      act('surge');
      replay(hero, 'glow');
      sparkle(hero, avatar, 8 + Math.min(streak, 5) * 4);
      if (streak >= 2) sfx.combo(streak);
      hero.classList.toggle('powered', streak >= 3);
    }

    function breakHeart() {
      const heart = hearts.children[lives];
      heart.textContent = '🖤'; heart.classList.add('lost'); replay(heart, 'break');
      hearts.setAttribute('aria-label', `Lives: ${lives} of ${LIVES}`);
      act('hurt'); shake(E.stageCard); popText(hero, '-1 ❤️', 'ouch');
      if (!lives) { hero.classList.add('fainted'); heroTalk.say('Oh no…', 0); bossTalk.say(lines.win, 0); banner(hero, 'GAME OVER', 'over'); }
      else heroTalk.say(lives === 1 ? 'Last heart… careful now!' : pick(HERO_LINES.hurt), 1600);
    }

    setTimeout(() => { banner(el, 'FIGHT!'); bossTalk.say(lines.intro, 2600); }, 300);
    return {
      el, hero,
      hit() {
        hp = Math.max(0, hp - 1); sinceDodge++;
        // first dodge round at half HP, then every 3 hits (never on the knockout)
        if (hp && ((!half && hp <= total / 2) || (half && sinceDodge >= 3))) dodgeDue = true;
        streak++;
        act('lunge'); heroTalk.say(pick(HERO_LINES.hit), 1400);
        clearTimeout(moveT); moveT = setTimeout(celebrate, calm() ? 0 : 450);
        projectile(b.heroAttack || '⚡', avatar, sprite);
        setTimeout(() => {
          fillEl.style.width = hp / total * 100 + '%';
          replay(sprite, 'hurt'); sfx.bossHit(); replay(el, 'flash');
          popText(el, hp ? 'HIT!' : 'K.O.!', 'dmg');
          if (!hp) {
            // stunned and wobbling: the "Final blow!" button plays the finishing cut scene
            hpText.textContent = 'STUNNED! Finish it!'; el.classList.remove('enraged'); el.classList.add('stunned');
            banner(el, 'FINISH IT!', 'ko'); bossTalk.say(lines.stunned, 0); heroTalk.say('Time for the FINAL BLOW!', 0);
          } else if (dodgeDue) {
            if (!half) { half = true; el.classList.add('enraged'); }
            hpText.textContent = `HP ${hp}/${total} · ${b.name} is getting angry!`;
            bossTalk.say(rounds ? (lines.dodge || 'Dodge THIS!') : lines.angry, 2600);
          } else if (hp === 1) {
            hpText.textContent = `HP ${hp}/${total} · One more hit!`; bossTalk.say(lines.last);
          } else if (!half && hp <= total / 2) {
            half = true; el.classList.add('enraged');
            hpText.textContent = `HP ${hp}/${total} · ${b.name} is getting angry!`; bossTalk.say(lines.angry, 2600);
          } else {
            hpText.textContent = `HP ${hp}/${total} · Keep going!`; bossTalk.say(pick(lines.hurt), 1600);
          }
        }, calm() ? 0 : 400);
      },
      // returns true when the last heart is lost
      zap(qi) {
        replay(sprite, 'lunge-boss'); sfx.zap();
        streak = 0; clearTimeout(moveT); hero.classList.remove('powered'); delete aura.dataset.aura;
        if (lostOn.has(qi)) { bossTalk.say(pick(lines.taunt), 1600); return false; } // one heart per question
        lostOn.add(qi); lives--;
        projectile(b.attack || '💥', sprite, avatar);
        setTimeout(() => { breakHeart(); if (lives) bossTalk.say(pick(lines.taunt), 1600); }, calm() ? 0 : 400);
        return !lives;
      },
      dodgeDue: () => dodgeDue,
      // the bullet-hell round shown in place of the questions; done(dead)
      dodge(area, done) {
        dodgeDue = false; sinceDodge = 0; rounds++;
        el.classList.add('attacking'); heroTalk.say('Here it comes!', 1500);
        dodgeRound(area, b, rounds, {
          end({ hit, dead }) {
            el.classList.remove('attacking');
            if (!dead) {
              bossTalk.say(hit ? pick(lines.taunt) : (lines.miss || 'WHAT?! You dodged everything?!'), 2200);
              heroTalk.say(hit ? 'Phew! Back to the questions!' : 'Too slow! 😎', 1800);
            }
            setTimeout(() => done(dead), dead ? 1600 : 0);
          },
        });
      },
      lives: () => lives,
      finale: done => finisher(b, lines, done),
    };
  }
  function renderQuiz(s, i) {
    const qs = s.questions;
    const area = h('div');
    const nav = navRow(() => go(i - 1, true));
    let boss = null;

    function begin() {
      boss = s.boss ? bossFight(s.boss, qs.length) : null;
      const qArea = h('div', { class: 'q-area' });
      put(area, boss && boss.el, qArea, boss && boss.hero);
      runQuestions(qArea, qs, { key: 'quiz', boss, done: score => (boss ? boss.finale(() => results(score)) : results(score)), lost: gameOver, lastLabel: s.boss ? '⚔️ Final blow!' : 'See my score 🏆', kind: boss ? 'Boss battle' : 'Quiz' });
      nav.hideNext();
    }

    // the boss took all 3 hearts: no completion, just a retry
    function gameOver(score) {
      const lines = Object.assign({}, BOSS_LINES, s.boss.lines);
      sfx.bad();
      say('Don\'t give up, {name}! Have a quick look back at the pages, then try again!');
      put(area, h('div', { class: 'results lose' },
        h('h2', null, `${s.boss.name.toUpperCase()} WINS…`),
        h('div', { class: 'gloat' }, pic(s.boss.sprite || s.boss.emoji || '👾', 'boss-sprite'),
          h('div', { class: 'fight-bubble from-boss show' }, fill(lines.win))),
        h('div', { class: 'hearts big' }, heartsRow(0)),
        h('p', { class: 'lead' }, `You landed ${score} first-try hit${score === 1 ? '' : 's'} before your hearts ran out. You can do it – have another go!`),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn big green', type: 'button', onclick() { sfx.good(); begin(); } }, '↺ Retry battle'),
          h('a', { class: 'btn ghost', href: L.home || '../index.html' }, '🏠 Library'))));
      nav.hideNext();
    }

    function results(score) {
      const total = qs.length, pct = score / total;
      const livesLeft = boss ? boss.lives() : 0;
      complete(i);
      // first finish of a lesson: 3 bonus gems towards the next level
      let bonus = 0;
      for (let k = 0; k < 3; k++) if (award('finish:' + k, area)) bonus++;
      if (bonus) setTimeout(() => toast('QUEST BONUS!', `+${bonus} ${CUR.icon} for finishing the lesson`, '🎁'), 1000);
      const prev = (store.get(RKEY, {})[L.id] || {}).best || 0;
      saveRecord({ best: Math.max(prev, score), total, done: true });
      if (s.boss) achieve('boss');
      if (L.finishAch) achieve(L.finishAch); // e.g. every Wonders lesson unlocks the explorer hat
      if (L.stamp) { // Around the World: a passport stamp for each country (shown on the library page)
        const pp = store.get('y3:passport', {});
        if (!pp[L.stamp.id]) {
          pp[L.stamp.id] = { name: L.stamp.name, flag: L.stamp.flag, date: new Date().toISOString().slice(0, 10) };
          store.set('y3:passport', pp);
          setTimeout(() => { sfx.ding(); toast('PASSPORT STAMPED!', `${L.stamp.flag} ${L.stamp.name} – ${Object.keys(pp).length} countr${Object.keys(pp).length === 1 ? 'y' : 'ies'} visited`, '🛂'); }, 1400);
        }
      }
      if (score === total) achieve('perfect');
      const msg = pct === 1 ? 'PERFECT SCORE! You are a legend! 🌟'
        : pct >= 0.75 ? 'Brilliant work! 🎉'
          : pct >= 0.5 ? 'Good effort! Play again to beat your score! 💪'
            : 'Nice try! Read the pages again, then have another go! 📖';
      sfx.win(); confetti(pct >= 0.75 ? 220 : 90);
      say(pct >= 0.75 ? `Amazing, {name}! You're a real ${L.subject === 'science' ? 'scientist' : L.subject === 'maths' ? 'mathematician' : L.subject === 'world' ? 'world traveller' : 'star'}!` : 'Every try makes your brain stronger!');
      put(area, h('div', { class: 'results' },
        s.boss && h('h2', null, `${s.boss.name.toUpperCase()} IS DEFEATED!`),
        s.boss && h('div', { class: 'victory' }, heroImg('hero-sprite cheer'), pic(s.boss.sprite || s.boss.emoji || '👾', 'boss-sprite ko')),
        s.boss && h('div', { class: 'hearts big', role: 'img', 'aria-label': `${livesLeft} of ${LIVES} hearts left` }, heartsRow(livesLeft)),
        !s.boss && h('div', { class: 'trophy' }, pct >= 0.75 ? '🏆' : '🎖️'),
        h('div', { class: 'score' }, `${score} / ${total}`),
        h('p', { class: 'lead' }, msg),
        h('p', { class: 'stars-earned' }, `You collected ${E.state.stars} ${CUR.icon} in this lesson. You are LEVEL ${player().level}${player().title ? ' – ' + player().title : ''}!`),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn gold big', type: 'button', onclick() { sfx.good(); showCert(score, total); } }, '📜 Get my certificate'),
          h('button', { class: 'btn ghost', type: 'button', onclick: begin }, s.boss ? '↺ Rematch' : '↺ Try again'),
          AV && h('a', { class: 'btn', href: WARDROBE }, `👕 Spend gems (💎 ${AV.wallet().balance})`),
          h('a', { class: 'btn ghost', href: L.home || '../index.html' }, '🏠 Library')),
        s.bonus && h('div', { class: 'panel-inner bonus' },
          h('h3', null, s.bonus.title || '⭐ Bonus quest'),
          h('p', { html: fmt(s.bonus.text, false) }),
          h('a', { class: 'btn', href: s.bonus.url, target: '_blank', rel: 'noopener' }, s.bonus.button || 'Open ▶'))));
      nav.hideNext();
    }

    const el = shell(s, [mascot(s.say || 'Quiz time! Show me what you remember!'), area, nav.el]);
    begin();
    return el;
  }

  return { renderQuiz };
});
