/* Pixelkid lesson engine – time games: clocks, Day Dial, Time Hops and Knuckle months (clocks need shared/clock.js).
 * One part of shared/engine.js, which loads it only when a lesson uses it. E is the engine's shared helpers
 * (E.state and E.stageCard are live). See the top of shared/engine.js for how the parts fit together.
 */
PixelkidEngine.part('time', E => {
  'use strict';
  const { GAMES, QTYPES, arcadeCanvas, award, canvasFont, checkBtn, confetti, emojiAt, esc, fmt, gameLoop, h, missionRunner, praise,
    put, pxText, runQuestions, say, sfx, shake, skyAndGround, toGame } = E;

  // ---------- clock games (need shared/clock.js) ----------
  // Set the clock: { game: 'clock', mode: 'set', times: ['3:45' | { time, say, start, ask }], show: 'words' | 'digital' | 'both',
  //   step: 5, helper: 'on' | 'off' | 'none' (the PAST / TO helper ring), roman: true }
  //   A time can add start (where the hands begin) and ask (a puzzle shown instead of the time, e.g. a start time plus a duration).
  //   Drag the red minute hand (the hour hand moves with it, like a real clock) or the short hour hand.
  // Read the clock: { game: 'clock', mode: 'read', times: [...] } – pick the hour, then type the minutes.
  const angGap = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
  const minsOf = t => { const p = window.Clock.parse(t); return (p.h % 12) * 60 + p.m; };
  // a clock face whose hands can be dragged: the red minute hand (the hour hand moves with it, like a real clock) or the
  // short hour hand. Shared by the clock game's set mode and the setclock question type.
  // o: { step, opts() (the face's Clock.svg options), locked() } → { face, T, set(v), draw(ghost) } (ghost: faint answer hands)
  function liveClock(o) {
    const CK = window.Clock;
    let T = 0, dragging = null, ghost = null;
    const face = h('div', { class: 'clk-face live', 'aria-label': 'Clock' });
    function draw(g = ghost) {
      ghost = g;
      const fo = o.opts();
      face.innerHTML = CK.svg(Math.floor(T / 60), T % 60, fo);
      if (ghost) face.append(h('div', { class: 'clk-ghost', html: CK.svg(ghost.h, ghost.m, { ticks: false }) }));
    }
    function set(v, quiet) { T = ((v % 720) + 720) % 720; if (!quiet) sfx.tap(); draw(); }
    // pointer → angle (0 = 12 o'clock, clockwise) and distance in SVG units (face is 200 wide)
    function polar(e) {
      const b = face.getBoundingClientRect(), x = (e.clientX - b.left) / b.width * 200 - 100, y = (e.clientY - b.top) / b.height * 200 - 100;
      return { ang: (Math.atan2(x, -y) * 180 / Math.PI + 360) % 360, dist: Math.hypot(x, y) };
    }
    function dragTo(e) {
      const { ang } = polar(e);
      if (dragging === 'm') {
        const nm = (Math.round(ang / 6 / o.step) * o.step) % 60;
        let d = nm - T % 60;
        if (d > 30) d -= 60; else if (d < -30) d += 60;
        if (d) set(T + d);
      } else {
        const hr = ((Math.round((ang - (T % 60) * 0.5) / 30) % 12) + 12) % 12;
        if (hr !== Math.floor(T / 60)) set(hr * 60 + T % 60);
      }
    }
    face.addEventListener('pointerdown', e => {
      if (o.locked()) return;
      e.preventDefault();
      const { ang, dist } = polar(e);
      const hDeg = (T / 2) % 360, R = o.opts().halves ? 70 : 88;
      // near the middle on the short hand → hour hand (even when the hands overlap); anywhere else → minute hand
      dragging = dist < R * 0.55 && angGap(ang, hDeg) < 30 ? 'h' : 'm';
      try { face.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      dragTo(e);
    });
    face.addEventListener('pointermove', e => { if (dragging && !o.locked()) dragTo(e); });
    const end = () => { dragging = null; };
    face.addEventListener('pointerup', end); face.addEventListener('pointercancel', end);
    return { face, draw, set, get T() { return T; } };
  }
  // the − / + buttons under a live clock
  const nudgeRow = (lc, step) => {
    const btn = (label, d) => h('button', { class: 'btn ghost', type: 'button', onclick() { lc.set(lc.T + d); } }, label);
    return h('div', { class: 'clk-nudge' }, btn('⟲ hour', -60), btn(`− ${step} min`, -step), btn(`+ ${step} min`, step), btn('hour ⟳', 60));
  };
  // what's wrong with the hands at T (minutes after 12) when the answer is t ({ h, m }); words = the time said aloud
  function setHint(t, T, words) {
    const cm = T % 60, ch = Math.floor(T / 60) % 12 || 12, th = t.h % 12 || 12, next = th % 12 + 1;
    const num = m => (m === 0 ? 12 : m / 5);
    if (cm !== t.m) {
      if (t.m % 30 && cm === (60 - t.m) % 60) return `Careful – wrong side! ${t.m < 30 ? 'PAST times are on the RIGHT side' : 'TO times are on the LEFT side'}. The minute hand should point at the ${num(t.m)}.`;
      return t.m % 5 ? `Count the little marks: the red minute hand goes on ${t.m} minutes.` : `The long red minute hand should point at the ${num(t.m)}.`;
    }
    if (t.m > 30 && ch === next) return `So close! "${words}" is BEFORE ${next} o'clock, so the short hand is just before the ${next} – not past it.`;
    if (t.m === 0) return `The short hour hand should point straight at the ${th}.`;
    return t.m <= 30 ? `The short hour hand should be just past the ${th}.` : `The short hour hand should be just before the ${next}.`;
  }

  GAMES.clock = function (r, key, done) {
    const CK = window.Clock;
    if (!CK) return h('p', null, 'This game needs shared/clock.js.');
    const items = r.times.map(t => (typeof t === 'string' ? { time: t } : t)).map(t => Object.assign({}, t, CK.parse(t.time)));
    const read = r.mode === 'read';
    const step = r.step || (read ? 1 : 5);
    let qi = 0, misses = 0, helper = r.helper === 'on', locked = false;
    let pickH = null, mins = '';
    const it = () => items[qi];
    const target = () => (it().h % 12) * 60 + it().m;
    const faceOpts = () => ({ roman: r.roman || it().roman, halves: helper, ring: helper ? 'pastto' : (r.ring || null) });
    const lc = !read && liveClock({ step, opts: faceOpts, locked: () => locked });
    const face = read ? h('div', { class: 'clk-face', 'aria-label': 'Clock' }) : lc.face;
    const prompt = h('div', { class: 'clk-prompt' });
    const count = h('div', { class: 'q-count' });
    const fb = h('div', { class: 'feedback', hidden: true });
    const controls = h('div', { class: 'clk-controls' });
    const nextBtn = h('button', { class: 'btn', type: 'button', hidden: true, onclick() { sfx.tap(); qi++; if (qi < items.length) show(); else { put(controls); nextBtn.hidden = true; done(); } } }, 'Next clock ▶');
    const sayTime = t => t.say || CK.words(t.h, t.m);

    function draw() {
      if (read) face.innerHTML = CK.svg(it().h, it().m, faceOpts());
      else lc.draw(misses >= 2 ? it() : null); // ghost hands show where to go
    }
    function hintRead(gh, gm) {
      const t = it(), th = t.h % 12 || 12;
      if (gh !== th) {
        if (gh === th % 12 + 1) return `Look again at the short hand – it has NOT reached the ${gh} yet. So it is still ${th} something!`;
        return 'Look at the short hour hand first. Which number has it just gone past?';
      }
      if (gm === 60 - t.m) return 'Digital times count the minutes PAST the hour – all the way round from the 12.';
      return 'Count in 5s from the 12 to the last number before the red hand, then count on in 1s.';
    }
    function right(el) {
      locked = true;
      if (misses === 0) award(`${key}:${qi}`, el);
      sfx.good(); say(praise());
      fb.className = 'feedback good'; fb.hidden = false;
      fb.innerHTML = `✔ ${esc(sayTime(it()))} = <b>${CK.digital(it())}</b>`;
      if (!read) { misses = 0; draw(); }
      nextBtn.textContent = qi < items.length - 1 ? 'Next clock ▶' : 'Done ✔';
      nextBtn.hidden = false;
      controls.querySelectorAll('button').forEach(b => { b.disabled = true; });
    }
    function wrong(el, msg) {
      misses++; shake(el); sfx.bad(); say('💡 ' + msg);
      fb.className = 'feedback try'; fb.hidden = false;
      fb.innerHTML = '💡 ' + esc(msg) + (misses >= 2 ? (read ? ` The answer is <b>${CK.digital(it())}</b> – type it in.` : ' The faint hands show where to go!') : '');
      if (!read) draw();
    }

    function setControls() {
      const btn = (label, fn, cls = 'btn ghost') => h('button', { class: cls, type: 'button', onclick: fn }, label);
      const check = btn('✔ Check', e => { if (lc.T === target()) right(face); else wrong(face, setHint(it(), lc.T, sayTime(it()))); }, 'btn big green');
      const helpBtn = r.helper !== 'none' && btn(helper ? '💡 Helper ON' : '💡 Helper', e => { helper = !helper; e.currentTarget.textContent = helper ? '💡 Helper ON' : '💡 Helper'; sfx.tap(); draw(); }, 'btn gold');
      put(controls, nudgeRow(lc, step), h('div', { class: 'btn-row' }, helpBtn, check));
    }
    function readControls() {
      const lcd = h('div', { class: 'clk-lcd' });
      const paint = () => { lcd.textContent = `${pickH || '?'}:${(mins + '__').slice(0, 2)}`; };
      const hours = Array.from({ length: 12 }, (_, k) => h('button', {
        class: 'clk-hr', type: 'button', onclick(e) { pickH = k + 1; hours.forEach(b => b.classList.toggle('on', b === e.currentTarget)); sfx.tap(); paint(); },
      }, String(k + 1)));
      const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(n => h('button', { class: 'clk-key', type: 'button', onclick() { if (mins.length < 2) { mins += n; sfx.tap(); paint(); } } }, String(n)));
      const del = h('button', { class: 'clk-key', type: 'button', 'aria-label': 'Delete', onclick() { mins = mins.slice(0, -1); paint(); } }, '⌫');
      const check = h('button', {
        class: 'btn big green', type: 'button', onclick(e) {
          if (!pickH) { shake(e.currentTarget); say('First tap the HOUR – look at the short hand!'); return; }
          if (mins.length < 2) { shake(e.currentTarget); say('Type 2 digits for the minutes – like 07 or 52.'); return; }
          const gm = +mins;
          if (pickH === (it().h % 12 || 12) && gm === it().m) right(lcd);
          else { wrong(lcd, hintRead(pickH, gm)); mins = ''; paint(); }
        },
      }, '✔ Check');
      paint();
      put(controls, lcd,
        h('div', { class: 'clk-step' }, '1️⃣ Which HOUR? (short hand)'), h('div', { class: 'clk-hours' }, hours),
        h('div', { class: 'clk-step' }, '2️⃣ How many MINUTES past? (long red hand)'), h('div', { class: 'clk-keys' }, keys, del),
        h('div', { class: 'btn-row' }, check));
    }

    function show() {
      misses = 0; locked = false; pickH = null; mins = '';
      const t = it();
      if (!read) lc.set(t.start ? minsOf(t.start) : r.start ? minsOf(r.start) : 0, true);
      count.textContent = `Clock ${qi + 1} of ${items.length}`;
      const showMode = t.show || r.show || 'words';
      if (read) put(prompt, h('span', null, t.ask || 'What time does this clock show?'));
      else if (t.ask) put(prompt, h('span', { html: fmt(t.ask, false) })); // a puzzle instead of the time, e.g. "starts at 3:55, lasts 30 minutes"
      else put(prompt, h('span', null, 'Set the clock to: '),
        showMode !== 'digital' && h('b', { class: 'clk-words' }, sayTime(t)),
        showMode !== 'words' && h('span', { class: 'clk-lcd small' }, CK.digital(t)));
      fb.hidden = true; nextBtn.hidden = true;
      draw();
      if (read) readControls(); else setControls();
      if (qi === 0) say(r.say || (read ? 'Short hand first, then the long red hand!' : 'Drag the long red minute hand around the clock!'));
    }
    const root = h('div', { class: 'game clock' }, count, prompt, h('div', { class: 'clk-wrap' }, face, controls), fb, h('div', { class: 'btn-row' }, nextBtn));
    show();
    root._test = { set(v) { lc.set(minsOf(v), true); }, get T() { return lc.T; } };
    return root;
  };

  // setclock (a question type, so it works in reading checks, video quests, the questions game and boss battles):
  // drag the hands to show a time. { q, time: '3:45', step: 5, start: '12:00', helper: true (the PAST / TO ring) }
  // A miss says what's wrong with the hands; after two, faint hands show where to go.
  QTYPES.setclock = (q, onRight, onMiss) => {
    const CK = window.Clock, t = CK.parse(q.time), step = q.step || 5;
    let misses = 0, done = false;
    const lc = liveClock({ step, opts: () => ({ halves: !!q.helper, ring: q.helper ? 'pastto' : null }), locked: () => done });
    const note = h('div', { class: 'sl-note', 'aria-live': 'polite' });
    const btn = checkBtn('✔ Check', () => {
      if (done) return;
      if (lc.T === (t.h % 12) * 60 + t.m) { done = true; btn.disabled = true; note.textContent = ''; lc.draw(null); lc.face.classList.add('right'); onRight(lc.face, !misses); return; }
      misses++; shake(lc.face); sfx.bad(); onMiss(lc.face);
      note.textContent = '💡 ' + setHint(t, lc.T, CK.words(t.h, t.m)) + (misses >= 2 ? ' The faint hands show where to go!' : '');
      if (misses >= 2) lc.draw(t);
    });
    lc.set(q.start ? minsOf(q.start) : 0, true);
    lc.face._test = { set(v) { lc.set(minsOf(v), true); }, get T() { return lc.T; } };
    return [h('div', { class: 'q-tag' }, '👆 Drag the long red hand, then check!'), h('div', { class: 'clk-q' }, lc.face, nudgeRow(lc, step)), note, h('div', { class: 'btn-row' }, btn)];
  };

  // ---------- whole-day time helpers (Day Dial, Time Hops) ----------
  const tMin = t => { const [hh, mm] = String(t).split(':').map(Number); return hh * 60 + (mm || 0); };
  const pad2 = n => String(n).padStart(2, '0');
  const fmt24 = T => { T = ((T % 1440) + 1440) % 1440; return `${pad2(Math.floor(T / 60))}:${pad2(T % 60)}`; };
  const fmt12 = T => { T = ((T % 1440) + 1440) % 1440; const hh = Math.floor(T / 60); return `${hh % 12 || 12}:${pad2(T % 60)} ${hh < 12 ? 'a.m.' : 'p.m.'}`; };
  const dayPart = hh => (hh < 5 ? 'in the night' : hh < 12 ? 'in the morning' : hh < 17 ? 'in the afternoon' : hh < 21 ? 'in the evening' : 'at night');
  const dayWords = T => { T = ((T % 1440) + 1440) % 1440; return T === 0 ? 'midnight' : T === 720 ? 'midday' : `${window.Clock ? Clock.words(Math.floor(T / 60), T % 60) : fmt12(T)} ${dayPart(Math.floor(T / 60))}`; };
  const durWords = n => { const hh = Math.floor(n / 60), mm = n % 60; return [hh && `${hh} hour${hh > 1 ? 's' : ''}`, (mm || !hh) && `${mm} minute${mm === 1 ? '' : 's'}`].filter(Boolean).join(' '); };
  const hopWords = n => (n >= 60 && n % 60 === 0 ? `${n / 60} hour${n > 60 ? 's' : ''}` : `${n} min`);

  // ===== Day Dial: drag the sun and moon through a whole day; a clock, the 12-hour time and the 24-hour time follow along =====
  // r.missions: [{ time: '19:30', show: '12' | '24' | 'words', hide: ['24'], text, yes, ask: [questions] }]
  //   show = how the mission writes the time; hide = readouts that stay covered, so the child has to convert
  //   (default: the readout that matches show, or the 12-hour one for words). Readouts: 'clock', '12', '24'.
  // r.events: [{ time: '7:00', emoji: '🥣' }] little pictures along the day · r.step: 15 (minutes per notch when dragging)
  // r.nudge: 5 (the − / + buttons) · r.start: '6:00'
  // sky colours through the day: night, purple dawn, orange sunrise, blue day, orange sunset, purple dusk, night
  const SKY_KEYS = [[0, [11, 27, 63]], [5, [11, 27, 63]], [5.75, [94, 64, 140]], [6.5, [255, 150, 110]], [8, [95, 184, 245]], [17, [95, 184, 245]], [18, [255, 126, 95]], [18.75, [94, 64, 140]], [19.5, [11, 27, 63]], [24, [11, 27, 63]]];
  function skyAt(hr) {
    let i = 0;
    while (i < SKY_KEYS.length - 2 && SKY_KEYS[i + 1][0] <= hr) i++;
    const [a, ca] = SKY_KEYS[i], [b, cb] = SKY_KEYS[i + 1], k = Math.min(1, (hr - a) / (b - a));
    return `rgb(${ca.map((v, j) => Math.round(v + (cb[j] - v) * k)).join(',')})`;
  }
  GAMES.daydial = function (r, key, done) {
    const W = 640, H = 290, GROUND = 190, X0 = 30, X1 = 610, PX = (X1 - X0) / 1440;
    const { cv, ctx } = arcadeCanvas(W, H);
    const step = r.step || 15, nudge = r.nudge || 5;
    const label = m => (m.show === '24' ? fmt24(tMin(m.time)) : m.show === 'words' ? dayWords(tMin(m.time)) : fmt12(tMin(m.time)));
    const R = Object.assign({ finish: '🏆 All day long – you are a 24-hour hero!' }, r, {
      missions: (r.missions || []).map(m => Object.assign({ text: `Slide the day to **${label(m)}**` }, m)),
    });
    const stars = Array.from({ length: 46 }, (_, i) => ({ x: (i * 137) % W, y: (i * 61) % (GROUND - 40) + 6, s: i % 4 ? 2 : 3 }));
    const startT = m => (m && m.start != null ? tMin(m.start) : r.start != null ? tMin(r.start) : 360);
    let T = startT(), misses = 0, locked = true, dragging = false;
    const xOf = t => X0 + t * PX;
    const goal = () => tMin(missions.m.time) % 1440;
    const hidden = () => { const m = missions.m || {}; return m.hide || [m.show === '24' ? '24' : '12']; };

    const face = h('div', { class: 'dd-face' });
    const lcd12 = h('div', { class: 'clk-lcd dd-lcd' }), lcd24 = h('div', { class: 'clk-lcd dd-lcd' });
    const panel = (title, el) => h('div', { class: 'dd-read' }, h('div', { class: 'dd-title' }, title), el);
    const fb = h('div', { class: 'feedback', hidden: true });
    function paint() {
      const hide = hidden(), lock = n => hide.includes(n) && !locked;
      face.innerHTML = window.Clock ? Clock.svg(Math.floor(T / 60), T % 60, lock('clock') ? { hands: false } : {}) : '';
      lcd12.textContent = lock('12') ? '?:?? ?.m.' : fmt12(T);
      lcd24.textContent = lock('24') ? '??:??' : fmt24(T);
      lcd12.classList.toggle('locked', lock('12')); lcd24.classList.toggle('locked', lock('24'));
    }
    function setT(v, snap) {
      v = Math.max(0, Math.min(1439, Math.round(v)));
      if (snap) v = Math.min(1440 - step, Math.round(v / step) * step);
      if (v === T) return;
      T = v; sfx.tap(); paint();
    }
    const missions = missionRunner(R, key, done, m => {
      T = startT(m); misses = 0; locked = false; fb.hidden = true;
      controls.querySelectorAll('button').forEach(b => { b.disabled = false; });
      paint();
    });

    // drag anywhere on the day: left = midnight at the start of the day, right = the end of the day
    const aim = e => { if (!locked) setT(((toGame(cv, W, H, e)[0]) - X0) / PX, true); };
    cv.addEventListener('pointerdown', e => { e.preventDefault(); dragging = true; try { cv.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } aim(e); });
    cv.addEventListener('pointermove', e => { if (dragging) aim(e); });
    const stopDrag = () => { dragging = false; };
    cv.addEventListener('pointerup', stopDrag); cv.addEventListener('pointercancel', stopDrag);

    function hint(g) {
      if (g === 720 && T === 0) return 'That is midnight – the middle of the NIGHT! Midday is in the middle of the day, when the sun is high.';
      if (g === 0 && T === 720) return 'That is midday – the middle of the DAY! Midnight is in the middle of the night, at the very start of the day.';
      if (Math.abs(T - g) === 720) return g >= 720
        ? 'Right clock time – but the wrong half of the day! This time is AFTER midday, so the 24-hour clock shows 12 or more.'
        : 'Right clock time – but the wrong half of the day! This time is BEFORE midday – look for the morning sky.';
      if (Math.floor(T / 60) === Math.floor(g / 60)) return 'The hour is right! Now nudge the minutes with the − and + buttons.';
      const m = missions.m, hh = Math.floor(g / 60);
      if (m.show === '24' && hh > 12) return `Take away 12 to find the p.m. hour: ${hh} − 12 = ${hh - 12}. ${T < g ? 'Slide later – to the right.' : 'Slide back – to the left.'}`;
      if (m.show === '12' && hh > 12) return `p.m. means after midday: add 12 to the hour. ${T < g ? 'Slide later – to the right.' : 'Slide back – to the left.'}`;
      return T < g ? 'Too early! Slide the sun further along – to the right.' : 'Too late! Slide back – to the left.';
    }
    function check(e) {
      if (locked || !missions.m) return;
      const g = goal();
      if (T === g) {
        locked = true; fb.hidden = true; paint();
        controls.querySelectorAll('button').forEach(b => { b.disabled = true; });
        missions.win(cv);
        return;
      }
      misses++; sfx.bad(); shake(e && e.currentTarget);
      const msg = hint(g) + (misses >= 2 ? ' The dotted line shows where to go!' : '');
      say('💡 ' + msg);
      fb.className = 'feedback try'; fb.hidden = false; fb.textContent = '💡 ' + msg;
    }
    const btn = (lab, fn, cls = 'lab-chip') => h('button', { class: cls, type: 'button', onclick: fn }, lab);
    const controls = h('div', { class: 'lab-controls' },
      btn('⏪ 1 hour', () => setT(T - 60)), btn(`− ${nudge} min`, () => setT(T - nudge)),
      btn(`+ ${nudge} min`, () => setT(T + nudge)), btn('1 hour ⏩', () => setT(T + 60)),
      btn('✔ Check', check, 'btn big green'));

    function draw() {
      const hr = T / 60;
      ctx.fillStyle = skyAt(hr); ctx.fillRect(0, 0, W, GROUND);
      // stars come out at night
      const night = hr < 5 || hr > 20 ? 1 : hr < 7 ? (7 - hr) / 2 : hr > 18 ? (hr - 18) / 2 : 0;
      if (night > 0) { ctx.globalAlpha = Math.min(1, night); ctx.fillStyle = '#fff'; stars.forEach(s => ctx.fillRect(s.x, s.y, s.s, s.s)); ctx.globalAlpha = 1; }
      // the sun rises at 6 and sets at 6; the moon crosses the sky at night
      const arc = k => [X0 + 20 + k * (X1 - X0 - 40), GROUND - 26 - Math.sin(k * Math.PI) * (GROUND - 70)];
      if (hr >= 6 && hr <= 18) { const [x, y] = arc((hr - 6) / 12); emojiAt(ctx, '☀️', x, y + 19, 48); }
      else { const [x, y] = arc(((hr + 6) % 24) / 12); emojiAt(ctx, '🌙', x, y + 16, 40); }
      // ground with the day's events on it
      ctx.fillStyle = '#5bbf3a'; ctx.fillRect(0, GROUND, W, 8); ctx.fillStyle = '#8a5a32'; ctx.fillRect(0, GROUND + 8, W, 14);
      (r.events || []).forEach(ev => emojiAt(ctx, ev.emoji, xOf(tMin(ev.time)), GROUND - 2, 26));
      // the 24-hour ruler
      const RY = GROUND + 22;
      ctx.fillStyle = '#1b1b1b'; ctx.fillRect(0, RY, W, H - RY);
      for (let k = 0; k <= 24; k++) {
        const x = xOf(k * 60);
        ctx.fillStyle = k % 3 ? '#777' : '#fff'; ctx.fillRect(x - 1, RY, 2, k % 3 ? 8 : 14);
        if (k % 3 === 0) {
          pxText(ctx, pad2(k % 24), x, RY + 28, 15, '#7cfc3a');
          pxText(ctx, k === 0 || k === 24 ? 'midnight' : k === 12 ? 'midday' : `${k % 12} ${k < 12 ? 'am' : 'pm'}`, x, RY + 50, 11, '#ffd43b');
        }
      }
      // dotted help line after two misses
      if (missions.m && misses >= 2 && !locked) {
        ctx.setLineDash([6, 6]); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(xOf(goal()), 0); ctx.lineTo(xOf(goal()), RY); ctx.stroke(); ctx.setLineDash([]);
      }
      // the time marker
      const x = xOf(T);
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(x - 3, 0, 6, RY);
      ctx.fillStyle = '#ffd43b'; ctx.fillRect(x - 1, 0, 2, RY);
      ctx.fillStyle = '#000'; ctx.fillRect(x - 11, RY - 4, 22, 20); ctx.fillStyle = '#ffd43b'; ctx.fillRect(x - 8, RY - 1, 16, 14);
    }

    const stopLoop = gameLoop(cv, () => draw());
    const root = h('div', { class: 'game arcade lab daydial' },
      missions.box,
      h('div', { class: 'arc-screen' }, cv),
      h('p', { class: 'arc-tip' }, '☀️ Drag along the day to move time · use the buttons for small steps'),
      h('div', { class: 'dd-reads' }, panel('🕰️ Clock', face), panel('12-hour clock', lcd12), panel('24-hour clock', lcd24)),
      controls, fb, missions.ask);
    root._test = { set(t) { T = tMin(t); paint(); }, check() { check(); }, get T() { return T; }, get mission() { return missions.i; }, frames(n) { for (let i = 0; i < n; i++) draw(); } };
    root._stop = stopLoop;
    missions.next();
    return root;
  };

  // ===== Time Hops: a frog hops along a time line to work out how long something takes =====
  // r.missions: [{ from: '3:45', to: '4:20', text, yes, ask }]  how long? hop from the start time to the end time, then add up the hops
  //             [{ from: '5:50', add: 25, text, yes, ask }]     when does it end? hop on 25 minutes, then read the end time
  // r.hops: [60, 10, 5, 1] the hop buttons (minutes) · r.clock: '24' writes times as 24-hour (14:05), otherwise 12-hour (2:05)
  GAMES.timehops = function (r, key, done) {
    const W = 640, H = 250, LINE = 176, X0 = 40, X1 = 600;
    const { cv, ctx } = arcadeCanvas(W, H);
    const sizes = r.hops || [60, 10, 5, 1];
    const show = T => (r.clock === '24' ? fmt24(T) : fmt12(T).replace(/ [ap]\.m\./, ''));
    const R = Object.assign({ finish: '🏆 Every hop counted – you are a time-hopping champion!' }, r, {
      missions: (r.missions || []).map(m => Object.assign({
        text: m.add != null ? `Start at **${show(tMin(m.from))}** and hop on **${durWords(m.add)}**. When does it end?` : `Hop from **${show(tMin(m.from))}** to **${show(tMin(m.to))}**. How long is that?`,
      }, m)),
    });
    let from = 0, goal = 0, add = null, hops = [], lo = 0, hi = 60, anim = null, finished = true, time = 0;
    const pos = () => from + hops.reduce((a, b) => a + b, 0);
    const xOf = t => X0 + (t - lo) / (hi - lo) * (X1 - X0);
    const list = h('div', { class: 'th-list' });
    const fb = h('div', { class: 'feedback', hidden: true });
    const btns = sizes.map(n => h('button', { class: 'lab-chip th-hop', type: 'button', onclick: () => hop(n) }, `🐸 +${hopWords(n)}`));
    const undo = h('button', { class: 'lab-chip', type: 'button', onclick() { if (finished || anim || !hops.length) return; hops.pop(); sfx.tap(); fb.hidden = true; refresh(); } }, '↩ Undo');
    const missions = missionRunner(R, key, done, m => {
      from = tMin(m.from); add = m.add != null ? m.add : null;
      goal = add != null ? from + add : tMin(m.to); if (goal <= from) goal += 1440;
      const span = goal - from, pad = Math.max(5, Math.round(span * 0.12));
      lo = from - pad; hi = goal + pad + (add != null ? Math.max(10, Math.round(span * 0.25)) : 0);
      hops = []; anim = null; finished = false; fb.hidden = true;
      btns.concat(undo).forEach(b => { b.disabled = false; });
      refresh();
    });
    function refresh() {
      const sum = pos() - from;
      put(list, hops.length ? h('span', null, 'Hops: ', h('b', null, hops.map(n => '+' + hopWords(n)).join(', ')),
        add != null ? ` = ${durWords(sum)} so far` : '') : h('span', null, '👆 Tap a hop button to make the frog jump.'));
    }
    function hop(n) {
      if (finished || anim) return;
      const a = pos();
      hops.push(n); sfx.tap();
      anim = { a, b: a + n, t: 0 };
      refresh();
    }
    function land() {
      const p = pos(), over = add != null ? p - from > add : p > goal;
      if (p === goal) return reached();
      if (over) {
        sfx.bad(); shake(cv);
        const msg = add != null ? `Whoa – that is more than ${durWords(add)}! Tap ↩ Undo and try a smaller hop.` : `Whoa – you hopped past ${show(goal)}! Tap ↩ Undo and try a smaller hop.`;
        say('💡 ' + msg); fb.className = 'feedback try'; fb.hidden = false; fb.textContent = '💡 ' + msg;
        return;
      }
      fb.hidden = true;
      if (hops.length === 1 && from % 60 && p % 60 && n2oclock() > 0 && goal - from > n2oclock()) say(`Tip: hop to the next o'clock first – it is only ${n2oclock()} minutes from ${show(from)} to ${show(from + n2oclock())}!`);
      else say(`Landed on ${show(p)}!`);
    }
    const n2oclock = () => 60 - (from % 60);
    // reached the end: now add up the hops (how long?) or read the time (when?)
    function reached() {
      finished = true; sfx.good(); confetti(20);
      btns.concat(undo).forEach(b => { b.disabled = true; });
      // the hops written as a sum; three or more of the same hop in a row become "8 × 1 min"
      const runs = [];
      hops.forEach(n => { const last = runs[runs.length - 1]; if (last && last.n === n) last.k++; else runs.push({ n, k: 1 }); });
      const total = goal - from, sum = runs.map(({ n, k }) => (k >= 3 ? `${k} × ${hopWords(n)}` : Array(k).fill(hopWords(n)).join(' + '))).join(' + ');
      let q;
      if (add == null) {
        // the classic mistake is taking the times away like normal numbers: 4:20 − 3:45 → 420 − 345 = "75 minutes"
        const digits = t => { const hh = Math.floor((t % 1440) / 60); return (r.clock === '24' ? hh : hh % 12 || 12) * 100 + t % 60; };
        const naive = digits(goal) - digits(from), opts = [durWords(total)];
        const offer = w => { if (opts.length < 3 && !opts.includes(w)) opts.push(w); };
        if (naive > 0 && naive !== total) offer(`${naive} minutes`);
        [total + 10, total - 5, total + 5, total + 60].forEach(n => { if (n > 0) offer(durWords(n)); });
        q = { type: 'mcq', q: `So how long is it from ${show(from)} to ${show(goal)}?`, options: opts, answer: 0, hint: `Add up your hops: ${sum}.`, explain: `${sum} = ${durWords(total)}` };
      } else {
        const fm = from % 60, opts = [show(goal)];
        if (fm + add >= 60 && add < 60) opts.push(`${show(from).split(':')[0]}:${fm + add}`); // the classic mistake: 5:50 + 25 = "5:75"
        [goal + 10, goal - 10, goal + 60].forEach(t => { if (opts.length < 3 && !opts.includes(show(t))) opts.push(show(t)); });
        q = { type: 'mcq', q: 'So when does it end?', options: opts, answer: 0, hint: `Look where the frog landed after hopping ${durWords(add)}.`, explain: `${show(from)} + ${durWords(add)} = ${show(goal)}` };
      }
      say(add == null ? 'You made it! Now add up all your hops.' : 'Exactly the right amount of time! Where did the frog land?');
      runQuestions(missions.ask, [q], { key: `${key}:h${missions.i}`, lastLabel: 'Done ✔', done: () => missions.win(cv) });
    }

    function step(dt) {
      time += dt;
      if (anim) { anim.t += dt / 0.45; if (anim.t >= 1) { anim = null; land(); } }
      draw();
    }
    function draw() {
      skyAndGround(ctx, W, H, LINE + 14);
      // ticks every 5 minutes (or 15 for long spans); labels spaced so they never overlap
      const span = hi - lo, tick = span > 150 ? 15 : 5;
      const lab = [5, 10, 15, 30, 60].find(s => s / span * (X1 - X0) >= 62) || 60;
      ctx.fillStyle = '#000'; ctx.fillRect(X0 - 14, LINE - 5, X1 - X0 + 28, 10);
      ctx.fillStyle = '#fff'; ctx.fillRect(X0 - 12, LINE - 3, X1 - X0 + 24, 6);
      for (let t = Math.ceil(lo / tick) * tick; t <= hi; t += tick) {
        const x = xOf(t), big = t % lab === 0;
        ctx.fillStyle = '#000'; ctx.fillRect(x - (big ? 2 : 1), LINE - (big ? 12 : 7), big ? 4 : 2, big ? 24 : 14);
        if (big && Math.abs(t - from) * (X1 - X0) / span > 30 && (add != null || Math.abs(t - goal) * (X1 - X0) / span > 30)) pxText(ctx, show(t), x, LINE + 36, 14, '#fff');
      }
      // start flag (and the finish flag when we know the end)
      const flag = (t, txt, col) => {
        const x = xOf(t);
        ctx.fillStyle = '#000'; ctx.fillRect(x - 2, LINE - 32, 4, 32); ctx.fillRect(x + 2, LINE - 32, 22, 14);
        ctx.fillStyle = col; ctx.fillRect(x + 2, LINE - 30, 20, 10);
        pxText(ctx, show(t), x, LINE + 36, 15, col);
        pxText(ctx, txt, x, LINE + 58, 12, col);
      };
      flag(from, 'START', '#7cfc3a');
      if (add == null) flag(goal, 'END', '#ff7eb6');
      // the hops so far, as rainbow arcs with their size on top
      let a = from;
      hops.forEach((n, i) => {
        if (anim && i === hops.length - 1) return;
        const xa = xOf(a), xb = xOf(a + n), hgt = Math.min(70, (xb - xa) * 0.5 + 18);
        ctx.strokeStyle = '#000'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(xa, LINE - 6); ctx.quadraticCurveTo((xa + xb) / 2, LINE - 6 - hgt * 2, xb, LINE - 6); ctx.stroke();
        ctx.strokeStyle = ['#ffd43b', '#2ee6d6', '#ff8c1a', '#b28cf5'][i % 4]; ctx.lineWidth = 3; ctx.stroke();
        pxText(ctx, '+' + hopWords(n), (xa + xb) / 2, LINE - 10 - hgt - 8, 13, '#fff');
        a += n;
      });
      // the frog, mid-jump or sitting on the line, with a bubble saying where it is
      let fx, fy;
      if (anim) {
        const k = Math.min(1, anim.t), xa = xOf(anim.a), xb = xOf(anim.b), hgt = Math.min(70, (xb - xa) * 0.5 + 18);
        fx = xa + (xb - xa) * k; fy = LINE - 6 - Math.sin(k * Math.PI) * hgt;
      } else { fx = xOf(pos()); fy = LINE - 6 + Math.sin(time * 4) * 1.5; }
      emojiAt(ctx, '🐸', fx, fy, 34);
      if (!anim && missions.m) {
        const txt = show(pos());
        ctx.font = canvasFont(txt, 15); const tw = ctx.measureText(txt).width + 14;
        ctx.fillStyle = '#000'; ctx.fillRect(fx - tw / 2 - 2, fy - 72, tw + 4, 26); ctx.fillStyle = '#ffd43b'; ctx.fillRect(fx - tw / 2, fy - 70, tw, 22);
        pxText(ctx, txt, fx, fy - 59, 15, '#1b1b1b');
      }
    }

    const stopLoop = gameLoop(cv, step);
    const root = h('div', { class: 'game arcade lab timehops' },
      missions.box,
      h('div', { class: 'arc-screen' }, cv),
      list,
      h('div', { class: 'lab-controls' }, btns, undo),
      fb, missions.ask);
    root._test = {
      hop(n) { hop(n); if (anim) { anim.t = 1; step(0); } },
      frames(n) { for (let i = 0; i < n; i++) step(1 / 60); },
      get pos() { return pos(); }, get mission() { return missions.i; },
    };
    root._stop = stopLoop;
    missions.next();
    return root;
  };

  // ===== Knuckle months: tap along two fists to find how many days each month has (knuckle = 31, dip = 30, February 28) =====
  // r.ask: [questions] asked once all 12 months are found
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  GAMES.knuckles = function (r, key, done) {
    let next = 0;
    const slots = [];
    const ask = h('div', { class: 'lab-ask' });
    const fb = h('div', { class: 'feedback', hidden: true });
    // each hand: knuckle, dip, knuckle … from the little finger. The left hand holds January to July; the right hand starts again on a knuckle.
    function hand(first, used, title) {
      const row = h('div', { class: 'kn-row' });
      for (let j = 0; j < 7; j++) {
        const mi = first + j, knuckle = j % 2 === 0, live = j < used;
        const b = h('button', { class: `kn-slot ${knuckle ? 'knuckle' : 'dip'}${live ? '' : ' spare'}`, type: 'button', disabled: !live, 'aria-label': knuckle ? 'knuckle' : 'dip' },
          h('span', { class: 'kn-month' }), h('span', { class: 'kn-days' }));
        if (live) { b.addEventListener('click', () => tap(mi, b)); slots[mi] = b; }
        row.append(b);
      }
      return h('div', { class: 'kn-hand' }, h('div', { class: 'kn-label' }, title), row, h('div', { class: 'kn-fist' }, h('i'), h('i'), h('i')));
    }
    function glow() { slots.forEach((b, k) => b.classList.toggle('glow', k === next)); }
    function tap(mi, b) {
      if (mi < next) { sfx.tap(); say(`${MONTHS[mi]} has ${mi === 1 ? '28 days (29 in a leap year)' : MONTH_DAYS[mi] + ' days'}.`); return; }
      if (mi !== next) {
        sfx.bad(); shake(b);
        const msg = next === 0 ? 'Start on the knuckle of your LEFT little finger – that is January!' : `Go in order! Next is ${MONTHS[next]} – the very next bump or dip along.`;
        say('💡 ' + msg); fb.className = 'feedback try'; fb.hidden = false; fb.textContent = '💡 ' + msg;
        return;
      }
      fb.hidden = true;
      const knuckle = b.classList.contains('knuckle');
      b.classList.add('done');
      b.querySelector('.kn-month').textContent = MONTHS[mi].slice(0, 3);
      b.querySelector('.kn-days').textContent = MONTH_DAYS[mi];
      sfx.good();
      if (mi === 1) say('February is in a dip, and it is the shortest month: 28 days – or 29 in a leap year!');
      else if (mi === 7) say('August starts the RIGHT hand – on a knuckle again, so it has 31 days! July and August both have 31.');
      else say(`${MONTHS[mi]} is on a ${knuckle ? 'KNUCKLE: 31 days!' : 'DIP: 30 days.'}`);
      next++; glow();
      if (next === 7) { award(`${key}:L`, b); setTimeout(() => say('Out of knuckles! Jump to your RIGHT hand and start on the first knuckle for August.'), 1400); }
      if (next === 12) {
        award(`${key}:R`, b); confetti(40);
        setTimeout(() => {
          say('All 12 months found! Knuckles have 31 days, dips have 30 – except February.');
          if (r.ask && r.ask.length) runQuestions(ask, r.ask, { key: `${key}:q`, lastLabel: 'Done ✔', done: () => done() });
          else done();
        }, 900);
      }
    }
    const root = h('div', { class: 'game knuckles' },
      h('div', { class: 'kn-hands' }, hand(0, 7, '✊ LEFT hand'), hand(7, 5, '✊ RIGHT hand')),
      h('p', { class: 'arc-tip' }, 'Tap the bumps (knuckles) and dips in order, starting with the left little finger'),
      fb, ask);
    glow();
    root._test = { tap(mi) { tap(mi, slots[mi]); }, get next() { return next; } };
    return root;
  };
});
