/* Pixelkid finishing moves – the boss "Final blow!" cut scene.
 * Not an engine part: it needs no engine helpers, so the Wardrobe (avatar.html) loads it too and plays a move
 * against a practice dummy as a preview. Needs shared/avatar.js (and shared/pixel.js for the dummy).
 *
 * PixelkidFinishers.play({ boss, lines, done, tone, fill, confetti, preview, finisher })
 *   boss: { name, sprite | emoji, heroAttack }   lines: { beg: [], defeat }   done(): called when the scene closes
 *   tone: the page's tone(freq, at, dur, type, vol) (the lesson's respects mute); fill: fills {name}; confetti(n)
 *   preview: true skips the begging and the power meter (the Wardrobe)   finisher: an item id to play instead of the worn one
 *
 * Which move plays: the player's 💥 Finisher in the Wardrobe (look.finisher). "Surprise me" (the default) lets the
 * pet out do its own move if it has one (Avatar.PET_FINISHERS), or else picks any finisher the player owns.
 * A pet move brings a pet that knows it, even if a different pet is out.
 * A new move: an async function in MOVES below, plus a 'finisher' item with move: '<its name>' in avatar.js.
 */
(function () {
  'use strict';
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const calm = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat(Infinity)) if (k != null && k !== false) el.append(k instanceof Node ? k : String(k));
    return el;
  }
  const pic = (p, cls) => p.trim().startsWith('<') ? h('div', { class: cls, html: p }) : h('div', { class: cls + ' emoji' }, p);
  const replay = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

  // flies an emoji from one element to another (the boss battle's attacks use this too)
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

  // the cut scene's sounds, built on the page's tone() (or this one, on pages without the engine)
  let actx = null;
  function ownTone(freq, at, dur, type = 'square', vol = 0.06) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const t = actx.currentTime + at, o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t); g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* no audio */ }
  }
  function soundKit(tone) {
    const seq = (notes, step = 0.08, type, vol) => notes.forEach((f, i) => f && tone(f, i * step, step * 1.1, type, vol));
    return { tone, seq, sfx: {
      tap: () => tone(880, 0, 0.04, 'square', 0.03),
      win: () => seq([523, 659, 784, 1047, 0, 784, 1047], 0.09),
      zap: () => seq([1200, 900, 600, 300], 0.04, 'sawtooth', 0.04),
      bossHit: () => { tone(110, 0, 0.07, 'triangle', 0.14); seq([659, 988, 1319], 0.045, 'square', 0.06); },
      charge: () => seq([262, 330, 392, 523, 659, 784, 1047], 0.06, 'square', 0.05),
      whoosh: () => seq([1600, 1200, 900, 700, 500], 0.025, 'triangle', 0.08),
      smash: () => { tone(70, 0, 0.35, 'sawtooth', 0.16); tone(55, 0.03, 0.4, 'square', 0.1); seq([300, 180, 120], 0.05, 'sawtooth', 0.08); },
      boom: () => { tone(60, 0, 0.6, 'sawtooth', 0.18); tone(45, 0.05, 0.7, 'square', 0.12); seq([400, 260, 170, 110, 80], 0.06, 'sawtooth', 0.07); },
      launch: () => seq([300, 400, 520, 680, 880, 1150, 1500], 0.05, 'triangle', 0.1),
      ding: () => { tone(1760, 0, 0.5, 'triangle', 0.12); tone(2637, 0.05, 0.45, 'sine', 0.06); },
    } };
  }

  // pixel art: the practice dummy (Wardrobe preview), and the baby gear for Babality
  const svg = (rows, pal) => window.Pixel ? window.Pixel.svg(rows, pal) : '';
  const DUMMY = () => svg([
    '....kkkk....', '...kssssk...', '..ksxssxsk..', '..kssssssk..', '..ksxxxxsk..', '...kssssk...',
    '..kkkkkkkk..', '.ksssrrsssk.', 'kssrwwwwrssk', 'kssrwrrwrssk', 'kssrwwwwrssk', '.ksssrrsssk.', '..kkkkkkkk..',
    '.....bb.....', '.....bb.....', '...bbbbbb...',
  ], { k: '#3e2723', s: '#e9c46a', x: '#5d4037', r: '#e53935', w: '#ffffff', b: '#8d6e63' });
  const BONNET = () => svg(['....pppp....', '..pppppppp..', '.pppwwwwppp.', 'pppww..wwppp', 'pww......wwp', 'w..........w'], { p: '#ff9cc7', w: '#ffffff' });
  const DUMMY_SOOTHER = () => svg(['.bbbbb.', 'bbbwbbb', 'bbbbbbb', '..yyy..', '.y...y.', '..yyy..'], { b: '#7ec8ff', w: '#ffffff', y: '#ffd54f' });

  // which move, and which pet stands by the hero (see the top of this file)
  function choose(want) {
    const AV = window.Avatar, look = AV ? AV.load().look : {};
    const basic = { move: pick(['hammer', 'launch', 'explode']), pet: look.pet };
    if (!AV) return basic;
    let it = AV.byId(want || look.finisher);
    if (!it || !it.move) { // Surprise me
      if (AV.PET_FINISHERS[look.pet]) return { move: AV.PET_FINISHERS[look.pet], pet: look.pet };
      const mine = AV.ITEMS.filter(i => i.cat === 'finisher' && i.move && AV.owns(i));
      if (!mine.length) return basic;
      it = pick(mine);
    }
    const pets = AV.finisherPets(it);
    if (!pets.length) return { move: it.move, pet: look.pet };
    return { move: it.move, pet: pets.includes(look.pet) ? look.pet : pets.find(p => AV.owns(AV.byId(p))) || pets[0] };
  }

  function play({ boss: b, lines = {}, done, tone, fill = s => s, confetti = () => {}, preview = false, finisher = null }) {
    if (calm()) { done(); return; }
    const { seq, sfx } = soundKit(tone || ownTone);
    const AV = window.Avatar;
    const { move: moveName, pet: petId } = choose(finisher);
    let over = false;
    const STOP = {};
    const step = async ms => { await wait(ms); if (over) throw STOP; };
    const hero = AV ? h('img', { class: 'cs-hero', src: AV.dataURL(AV.load().look, { scale: 4 }), alt: 'You' }) : h('div', { class: 'cs-hero emoji', 'aria-hidden': 'true' }, '🧒');
    const boss = pic(b.sprite || b.emoji || '👾', 'cs-boss');
    const petSrc = AV && petId && AV.petURL(petId);
    const pet = petSrc ? h('img', { class: 'cs-pet', src: petSrc, alt: 'Your pet' }) : null;
    const bubble = h('div', { class: 'fight-bubble from-boss cs-bubble' });
    const caption = h('div', { class: 'cs-text', 'aria-live': 'polite' });
    const parts = h('canvas', { class: 'cs-parts', 'aria-hidden': 'true' });
    const skip = h('button', { class: 'btn ghost cs-skip', type: 'button', onclick() { sfx.tap(); finish(); } }, preview ? '✖ Close' : 'Skip ▶');
    const stage = h('div', { class: 'cs-stage' }, h('div', { class: 'cs-floor' }), hero, pet, boss, bubble);
    const scene = h('div', { class: 'cutscene', role: 'dialog', 'aria-label': `Final blow! ${b.name} is defeated` },
      h('div', { class: 'cs-bar top' }), h('div', { class: 'cs-bar bottom' }), stage, parts, caption, skip);
    scene._test = { finisher: moveName, pet: petId };
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
    function shatter(power = 1, colours = null) {
      const r = boss.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const sv = boss.querySelector('svg'), list = [];
      if (sv && sv.viewBox.baseVal && sv.viewBox.baseVal.width) {
        const vb = sv.viewBox.baseVal, sr = sv.getBoundingClientRect(), px = sr.width / vb.width, py = sr.height / vb.height;
        for (const rc of sv.querySelectorAll('rect')) {
          const x = sr.left + (+rc.getAttribute('x') + 0.5) * px, y = sr.top + (+rc.getAttribute('y') + 0.5) * py;
          list.push({ x, y, s: Math.max(4, Math.round(Math.min(px, py))), c: colours ? pick(colours) : rc.getAttribute('fill'), g: 0.42, life: 0, max: 140,
            vx: (x - cx) / r.width * 18 * power + (Math.random() - 0.5) * 6, vy: (y - cy) / r.height * 10 * power - 6 - Math.random() * 8 });
        }
      } else {
        for (let k = 0; k < 70; k++) list.push({ x: cx + (Math.random() - 0.5) * r.width * 0.6, y: cy + (Math.random() - 0.5) * r.height * 0.6,
          s: pick([6, 9, 12]), c: pick(colours || ['#e53935', '#ffd54f', '#ffffff', '#8e5cff', '#2ee6d6']), g: 0.42, life: 0, max: 140,
          vx: (Math.random() - 0.5) * 22 * power, vy: -Math.random() * 16 - 4 });
      }
      fling(list);
    }
    function dust(x, y, n = 26, colours = ['#d7ccc8', '#bcaaa4', '#ffffff']) {
      fling(Array.from({ length: n }, (_, k) => ({ x, y, s: pick([6, 9]), c: pick(colours), g: -0.04, life: 0, max: 50,
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

    // ---------- the moves: each returns 'baby' if the boss is still on screen as a baby (for its last words) ----------
    const MOVES = {
      // a giant hammer squashes the boss flat
      async hammer() {
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
      },
      // an uppercut launches the boss into the sky
      async launch() {
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
      },
      // three zaps, then the boss explodes into its own pixels
      async explode() {
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
      },
      // pet move: the pet tiptoes up while the boss looks away, leaps, bites, and the boss runs off the screen
      async bite() {
        const c = centre(boss), p = centre(pet), lift = c.r.height * 0.45;
        const dx = c.r.left + c.r.width * 0.2 - p.x, at = (x, y = 0, rest = '') => ({ transform: `translate(${x}px, ${y}px) ${rest}` });
        shout('SNEAK ATTACK!');
        anim(boss, [{ transform: 'none' }, { transform: 'scaleX(-1)' }], 120, 'steps(1)'); // the boss looks the other way
        pet.style.transformOrigin = '50% 100%';
        seq([392, 0, 440, 0, 392, 0, 440, 0], 0.17, 'triangle', 0.03); // tiptoe, tiptoe…
        await move(pet, Array.from({ length: 9 }, (_, k) => at(dx * 0.6 * k / 8, k % 2 ? -6 : 0, 'scaleY(.8)')), 1400, 'linear');
        const sr = stage.getBoundingClientRect();
        const alert = h('div', { class: 'cs-prop twinkle', 'aria-hidden': 'true', style: `left:${c.x - sr.left - 20}px;top:${c.r.top - sr.top - 64}px` }, '❗');
        stage.append(alert);
        anim(boss, [{ transform: 'scaleX(-1)' }, { transform: 'none' }], 120, 'steps(1)'); // …it turns round, too late!
        seq([1320], 0.12, 'square', 0.05);
        await step(450);
        alert.remove();
        sfx.whoosh();
        await move(pet, [at(dx * 0.6, 0, 'scaleY(.8)'), at(dx * 0.85, -lift * 1.4, 'rotate(20deg)'), at(dx, -lift, 'rotate(10deg)')], 260, 'ease-out');
        sfx.bossHit(); flash(); quake();
        shout('CHOMP!', 'big');
        for (let k = 0; k < 3; k++) { // it hangs on and the boss shakes
          anim(boss, [{ transform: 'translateX(-10px)' }, { transform: 'translateX(10px)' }, { transform: 'none' }], 200, 'steps(3)');
          seq([160], 0.08, 'sawtooth', 0.08);
          await step(280);
        }
        await move(pet, [at(dx, -lift, 'rotate(10deg)'), at(dx, 0)], 200, 'ease-in');
        dust(c.x, c.r.bottom - 6, 18);
        shout('RUN AWAY!');
        seq([700, 600, 700, 600, 700, 600], 0.06, 'square', 0.04);
        anim(boss, [{ transform: 'none' }, { transform: 'translateX(900px)' }], 700, 'ease-in');
        await move(pet, [at(dx, 0), { transform: 'none' }], 600);
        boss.style.visibility = 'hidden';
        sfx.ding();
        shout('GOOD DOG!');
      },
      // pet move: the pet flies up and breathes a stream of fire over the boss, which chars and crumbles into ash
      async fire() {
        const c = centre(boss), flames = ['#ff5722', '#ff9800', '#ffd54f', '#fff3c4', '#e53935'];
        shout('FIRE BREATH!');
        sfx.charge();
        await move(pet, [{ transform: 'none' }, { transform: 'translateY(-70px) scale(1.3)' }], 400, 'ease-out');
        shout('ROAR!', 'big');
        anim(boss, [{ filter: 'none' }, { filter: 'brightness(.3) sepia(1)' }], 1400, 'steps(6)');
        for (let t = 0; t < 1500; t += 60) {
          const m = pet.getBoundingClientRect(), mx = m.right - m.width * 0.15, my = m.top + m.height * 0.55;
          fling(Array.from({ length: 10 }, () => {
            const tx = c.x + (Math.random() - 0.5) * c.r.width * 0.8, ty = c.y + (Math.random() - 0.5) * c.r.height * 0.8, f = 22 + Math.random() * 10;
            return { x: mx, y: my, s: pick([6, 9, 12]), c: pick(flames), g: -0.05, life: 0, max: f + 12, vx: (tx - mx) / f * 1.15, vy: (ty - my) / f };
          }));
          seq([90 + Math.random() * 60], 0.07, 'sawtooth', 0.04); // crackle
          await step(60);
        }
        // smoke drifts up off the charred boss
        fling(Array.from({ length: 24 }, () => ({ x: c.x + (Math.random() - 0.5) * c.r.width * 0.7, y: c.r.top + Math.random() * c.r.height * 0.5,
          s: pick([9, 12]), c: pick(['#616161', '#9e9e9e', '#424242']), g: -0.06, life: 0, max: 70, vx: (Math.random() - 0.5) * 2, vy: -1 - Math.random() * 2 })));
        shout('TOASTED!', 'big');
        anim(pet, [{ transform: 'translateY(-70px) scale(1.3)' }, { transform: 'none' }], 500, 'ease-in');
        await step(900);
        sfx.boom(); flash(); quake(); shatter(0.8, ['#3e2723', '#212121', '#5d4037', '#757575', '#ff5722']);
        boss.style.visibility = 'hidden';
        shout('CRISPY!');
      },
      // a nod to Mortal Kombat: a magic bottle turns the boss into a crying baby, in a bonnet with a dummy
      async babality() {
        const pinks = ['#ff9cc7', '#ffffff', '#ffd1e8', '#7ec8ff'];
        shout('BABY MAGIC!');
        projectile('🍼', hero, boss, 'cs-shot');
        seq([523, 523, 784, 784, 880, 880, 784], 0.13, 'triangle', 0.06); // twinkle, twinkle…
        await step(950);
        flash(); sparkle(stage, boss, 30, pinks);
        const c0 = centre(boss);
        dust(c0.x, c0.y, 40, pinks);
        boss.style.transformOrigin = '50% 100%';
        seq([880, 740, 620, 520, 440, 370, 310], 0.05, 'square', 0.05); // shrinking…
        await move(boss, [{ transform: 'none' }, { transform: 'scale(1.15)' }, { transform: 'scale(.42)' }, { transform: 'scale(.64)' }, { transform: 'scale(.55)' }], 700, 'ease-out');
        // dress the baby: a bonnet on top, a dummy in the middle
        const c = centre(boss), sr = stage.getBoundingClientRect();
        const gear = (art, w, x, y) => {
          const g = h('div', { class: 'cs-gear', 'aria-hidden': 'true', html: art, style: `width:${w}px;left:${x - sr.left - w / 2}px;top:${y - sr.top}px` });
          stage.append(g);
          anim(g, [{ transform: 'scale(0)' }, { transform: 'scale(1.3)' }, { transform: 'none' }], 300, 'steps(3)');
          sfx.ding();
          return g;
        };
        gear(BONNET(), c.r.width * 1.1, c.x, c.r.top - c.r.width * 0.2);
        await step(350);
        gear(DUMMY_SOOTHER(), c.r.width * 0.28, c.x, c.r.top + c.r.height * 0.66);
        await step(500);
        // WAAAH!
        bubble.textContent = 'WAAAH!'; bubble.classList.add('show'); replay(bubble, 'pop');
        for (let k = 0; k < 14; k++) {
          if (k % 5 === 0) seq([660, 620, 560, 520], 0.09, 'triangle', 0.06);
          fling([-1, 1].map(side => ({ x: c.x + side * c.r.width * 0.2, y: c.r.top + c.r.height * 0.4, s: 9, c: '#7ec8ff', g: 0.3, life: 0, max: 40,
            vx: side * (1.5 + Math.random() * 2.5), vy: -3 - Math.random() * 2 })));
          await step(110);
        }
        bubble.classList.remove('show');
        shout('BABALITY!', 'big gold');
        sfx.ding();
        await step(600);
        return 'baby';
      },
    };

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
        seq([220 + power * 660], 0.08, 'square', 0.05);
        hero.classList.add('cs-charge'); replay(tapBtn, 'pop');
        if (taps % 3 === 0) sparkle(stage, hero, 8);
      };
      const onSpace = e => { if (e.key === ' ' || e.key === 'Enter') tap(e); };
      tapBtn.addEventListener('pointerdown', tap);
      tapBtn.addEventListener('click', e => e.preventDefault());
      document.addEventListener('keydown', onSpace);
      scene.append(meter); tapBtn.focus();
      shout('POWER UP!');
      Object.assign(scene._test, { tap: () => tap(), get power() { return power; } });
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

    const cheer = el => { // let the CSS cheer take over from the moves' animations
      el.getAnimations().forEach(x => { if (x.constructor === Animation) x.cancel(); });
      el.classList.add('cs-cheer');
    };
    (async () => {
      try {
        if (preview) {
          await step(500);
        } else {
          // intro: letterbox bars slide in, the boss wobbles and begs, the player charges the meter, the hero powers up
          await step(350);
          bubble.textContent = fill(pick(lines.beg || ['Mercy! MERCY!'])); bubble.classList.add('show'); replay(bubble, 'pop');
          await step(2200);
          bubble.classList.remove('show');
          await powerUp();
          hero.classList.add('cs-charge'); sfx.charge(); shout('FINAL BLOW!', 'big');
          sparkle(stage, hero, 18);
          await step(700);
          hero.classList.remove('cs-charge');
        }
        boss.classList.remove('cs-dizzy');
        const baby = (await MOVES[moveName]()) === 'baby';
        await step(1100);
        // the boss's last words (a baby can only babble), then victory!
        bubble.textContent = baby ? pick(['Goo goo… ga ga!', 'WAAAH! I want my mummy!', 'Goo goo… *hic*']) : fill(lines.defeat || 'NOOOOO!');
        bubble.classList.add('show', 'ghost'); replay(bubble, 'pop');
        await step(preview ? 1800 : 3000); // time to read the last words before the confetti
        sfx.win(); if (!preview) confetti(160);
        cheer(hero); if (pet) cheer(pet);
        shout(preview ? 'NICE MOVE!' : 'VICTORY!', 'big gold');
        if (!preview) { skip.textContent = '🏆 See my score ▶'; skip.className = 'btn gold big cs-skip'; }
        skip.focus();
      } catch (e) { if (e !== STOP) throw e; }
    })();
    boss.classList.add('cs-dizzy');
    skip.focus();
  }

  window.PixelkidFinishers = { play, projectile, sparkle, choose, dummy: DUMMY };
})();
