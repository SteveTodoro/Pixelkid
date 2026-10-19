/* Year 3 Lesson Engine
 * Renders an interactive lesson from the data in window.LESSON.
 * Stage types: welcome, review, read, video, game, break, quiz (optionally a boss battle).
 * Brain breaks also get mini games (boss tic-tac-toe, steady hand, maze, hangman) unless the stage sets games: false.
 * A quick 'Games' break is added after the first game stage automatically (L.midBreak: false turns it off).
 * Game types: sort, match, label, order, truefalse, questions, wordsearch, crossword, trainai, pixelcopy, pixelstudio, poster,
 *   spelltest (spelling test: listen / look-cover-write-check / fix the mistake),
 *   and arcade games: invaders, runner (two-lane word runner), platformer, blocks.
 *   clock (needs shared/clock.js): set the clock by dragging the hands, or read a clock and type the time.
 *   daydial (24-hour Day Dial), timehops (durations on a time line), knuckles (days in each month).
 *   Around the World: worldmap (needs shared/world-map.js + shared/world.js), cook (Chef), phrases (Say it! greetings).
 * Questions can set optionsHtml: true to show pictures (HTML) as the answer buttons.
 * Question types (quiz, video, questions game): mcq, tf, gap, order (ends: ['FIRST', 'LAST'] labels, start: true pre-fills item 1),
 *   and the hands-on types (QTYPES; these also work as reading checks): evidence (tap the sentence that proves it),
 *   hotspot (tap the place on a picture), slider (number line), oddone (odd one out + why), build (tiles into a word
 *   or sentence), type (write the answer), predict (guess, see the reveal, then explain). See QTYPES for each one's fields.
 *   Run `node tools/activity-audit.js` after writing a lesson to check the activity mix.
 */
(function () {
  'use strict';
  const L = window.LESSON;
  if (!L) { document.body.textContent = 'No LESSON data found.'; return; }

  // ---------- helpers ----------
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
  // replaceChildren that skips empty optional bits (null / false / undefined)
  const put = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter(k => k != null && k !== false));
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // **bold** and [[word]] / [[word|glossaryKey]]
  function fmt(text, gloss = true) {
    return esc(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[\[(.+?)(?:\|(.+?))?\]\]/g, (m, word, key) => gloss
        ? `<button type="button" class="gloss" data-key="${(key || word).toLowerCase()}">${word}</button>`
        : word);
  }
  function pic(p, cls = 'pic') {
    if (!p) return null;
    return p.trim().startsWith('<') ? h('div', { class: cls, html: p }) : h('div', { class: cls + ' emoji' }, p);
  }
  // draw an emoji on a canvas as its pixel icon (shared/pixel-icons.js); false if there isn't one, so callers fall back to fillText
  const pxDraw = (ctx, e, x, y, size, opts) => !!(window.Pixel && Pixel.draw && Pixel.draw(ctx, e, x, y, size, opts));
  function shake(el) { if (!el) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }

  // ---------- storage (optional; everything works without it) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  };
  const PKEY = 'y3:progress:' + L.id, RKEY = 'y3:records', SKEY = 'y3:settings';
  const fresh = () => ({ stage: 0, maxStage: 0, stars: 0, awarded: {}, complete: {}, ach: {} });
  // A quick brain break (the pick-a-game menu) goes in after the first game stage, so the games aren't only near the end.
  // A lesson can turn it off with midBreak: false, or pass an object to change its title / say / games.
  const MID = (() => {
    if (L.midBreak === false) return -1;
    const firstGame = L.stages.findIndex(st => st.type === 'game');
    const firstBreak = L.stages.findIndex(st => st.type === 'break');
    if (firstGame < 0 || firstGame >= L.stages.length - 2 || (firstBreak >= 0 && firstBreak <= firstGame + 1)) return -1;
    L.stages.splice(firstGame + 1, 0, Object.assign({
      type: 'break', title: 'Quick Break: Brain Games', short: 'Games', icon: '🕹️', minutes: 3,
      say: 'Quick break! Pick a brain game – win it to earn a 💎. Then back to the adventure!',
    }, typeof L.midBreak === 'object' ? L.midBreak : null));
    return firstGame + 1;
  })();
  let state = Object.assign(fresh(), store.get(PKEY, {}));
  // progress saved before the quick break existed: move stage numbers after it up by one
  if (MID >= 0 && !state.mid) {
    const shift = n => (n >= MID ? n + 1 : n);
    if (store.get(PKEY, null)) {
      state.complete = Object.fromEntries(Object.entries(state.complete).map(([k, v]) => [shift(+k), v]));
      state.stage = shift(state.stage); state.maxStage = shift(state.maxStage);
      state.mid = 1; store.set(PKEY, state);
    }
    state.mid = 1;
  }
  state.stage = Math.min(state.stage, L.stages.length - 1);
  const settings = Object.assign({ muted: false, name: '' }, store.get(SKEY, {}));
  const save = () => store.set(PKEY, state);
  const saveSettings = () => store.set(SKEY, settings);
  function saveRecord(patch) {
    const rec = store.get(RKEY, {});
    rec[L.id] = Object.assign(rec[L.id] || {}, { stars: state.stars }, patch);
    store.set(RKEY, rec);
  }

  // ---------- chiptune sound effects (Web Audio, no files needed) ----------
  let actx = null;
  function tone(freq, at, dur, type = 'square', vol = 0.06) {
    if (settings.muted) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const t = actx.currentTime + at, o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t);
      g.gain.setValueAtTime(vol, t + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(actx.destination);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* no audio */ }
  }
  const seq = (notes, step = 0.08, type, vol) => notes.forEach((f, i) => f && tone(f, i * step, step * 1.1, type, vol));
  let mistakes = 0;
  const sfx = {
    tap: () => tone(880, 0, 0.04, 'square', 0.03),
    good: () => seq([784, 1047], 0.07),
    bad: () => { mistakes++; seq([220, 165], 0.1, 'sawtooth', 0.05); },
    star: () => seq([1319, 1760], 0.05, 'square', 0.035),
    win: () => seq([523, 659, 784, 1047, 0, 784, 1047], 0.09),
    levelup: () => seq([392, 523, 659, 784, 1047, 1319], 0.07, 'square', 0.06),
    achieve: () => seq([659, 784, 988, 1319], 0.08, 'triangle', 0.12),
    hit: () => { seq([150, 90], 0.06, 'sawtooth', 0.08); }, // the player gets hurt
    // the boss gets hurt: a bright, rising "pow!" so it never sounds like a wrong answer
    bossHit: () => { tone(110, 0, 0.07, 'triangle', 0.14); seq([659, 988, 1319], 0.045, 'square', 0.06); },
    zap: () => seq([1200, 900, 600, 300], 0.04, 'sawtooth', 0.04),
    // boss-battle combo: climbs higher the longer the streak
    combo: n => { const k = Math.min(n, 6); seq([523 * (1 + k / 8), 784 * (1 + k / 8), 1047 * (1 + k / 8)], 0.05, 'square', 0.045); },
    // the finishing-move cut scene
    charge: () => seq([262, 330, 392, 523, 659, 784, 1047], 0.06, 'square', 0.05),
    whoosh: () => seq([1600, 1200, 900, 700, 500], 0.025, 'triangle', 0.08),
    smash: () => { tone(70, 0, 0.35, 'sawtooth', 0.16); tone(55, 0.03, 0.4, 'square', 0.1); seq([300, 180, 120], 0.05, 'sawtooth', 0.08); },
    boom: () => { tone(60, 0, 0.6, 'sawtooth', 0.18); tone(45, 0.05, 0.7, 'square', 0.12); seq([400, 260, 170, 110, 80], 0.06, 'sawtooth', 0.07); },
    launch: () => seq([300, 400, 520, 680, 880, 1150, 1500], 0.05, 'triangle', 0.1),
    ding: () => { tone(1760, 0, 0.5, 'triangle', 0.12); tone(2637, 0.05, 0.45, 'sine', 0.06); },
  };

  // ---------- pixel confetti ----------
  const cvs = h('canvas', { class: 'confetti', 'aria-hidden': 'true' });
  let parts = [], raf = 0;
  function confetti(n = 120) {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    cvs.width = innerWidth; cvs.height = innerHeight;
    const colors = ['#7cfc3a', '#2ee6d6', '#ffb800', '#e53935', '#ffffff', '#8e5cff', '#5bbf3a'];
    for (let i = 0; i < n; i++) parts.push({
      x: innerWidth / 2 + (Math.random() - 0.5) * innerWidth * 0.5, y: innerHeight * 0.4,
      vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 15 - 5,
      s: 6 + Math.floor(Math.random() * 3) * 3, c: pick(colors), life: 0,
    });
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function tick() {
    const ctx = cvs.getContext('2d');
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    parts = parts.filter(p => p.y < cvs.height + 30 && p.life < 320);
    for (const p of parts) {
      p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.life++;
      ctx.fillStyle = '#000'; ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, p.s + 2, p.s + 2);
      ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
    }
    raf = parts.length ? requestAnimationFrame(tick) : 0;
  }

  // ---------- mascot ----------
  const WARDROBE = (L.home || '../index.html').replace(/index\.html$/, 'avatar.html');
  const AV = window.Avatar || null;
  if (AV) AV.wallet(); // set up the gem wallet before any new gems are added
  const M = Object.assign({
    name: 'Buddy', emoji: '🤖',
    praise: ['Brilliant!', 'Super job!', 'You got it!', 'Amazing!', 'Wow, well done!', 'Fantastic!'],
    oops: ['Oops! Have another go.', 'Not quite – try again!', 'Hmm, think again!', 'So close! Try once more.'],
  }, L.mascot);
  const fill = msg => String(msg).replace(/\{name\}/g, settings.name || 'friend');
  let bubbleMsg = null, bubble = null;
  function mascot(msg) {
    bubbleMsg = h('span', null, fill(msg));
    bubble = h('div', { class: 'bubble', 'aria-live': 'polite' }, h('span', { class: 'who' }, `<${M.name}>`), bubbleMsg);
    return h('div', { class: 'mascot' }, M.sprite ? pic(M.sprite, 'bot') : h('div', { class: 'bot', 'aria-hidden': 'true' }, M.emoji), bubble);
  }
  function say(msg) {
    if (!bubble) return;
    bubbleMsg.textContent = fill(msg);
    bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
  }
  const praise = () => pick(M.praise), oops = () => pick(M.oops);

  // ---------- page frame: HUD, hotbar, stage ----------
  const CUR = Object.assign({ icon: '💎', name: 'gems' }, L.currency);
  const PER_LEVEL = 10;
  document.body.classList.add(L.subject || 'science');
  document.title = L.title;
  const starCount = h('span', null, state.stars);
  const starBox = h('div', { class: 'starbox', title: CUR.name }, CUR.icon, starCount);
  const xpLevel = h('div', { class: 'xp-level' });
  const xpFill = h('div', { class: 'xp-fill' });
  const muteBtn = h('button', {
    class: 'icon-btn', type: 'button', 'aria-label': 'Sound on or off',
    onclick() { settings.muted = !settings.muted; saveSettings(); muteBtn.textContent = settings.muted ? '🔇' : '🔊'; },
  }, settings.muted ? '🔇' : '🔊');
  const topbar = h('header', { class: 'topbar' },
    h('div', { class: 'hud-row' },
      h('a', { class: 'icon-btn', href: L.home || '../index.html', 'aria-label': 'Back to the library' }, '🏠'),
      h('div', { class: 'lesson-title' }, (L.emoji || '') + ' ' + L.title),
      starBox, muteBtn),
    h('div', { class: 'xp-row' }, xpLevel, h('div', { class: 'xp-bar', 'aria-hidden': 'true' }, xpFill)));
  const path = h('nav', { class: 'path', 'aria-label': 'Lesson steps' });
  const main = h('main', { class: 'stage', id: 'stage' });
  const overlay = h('div', { class: 'overlay', hidden: true });
  const certOverlay = h('div', { class: 'overlay cert-overlay', hidden: true });
  const toasts = h('div', { class: 'toasts', 'aria-live': 'polite' });
  document.body.append(topbar, path, main, overlay, certOverlay, toasts, cvs);

  // ---------- gems, XP levels, achievements ----------
  // The level belongs to the player, not the lesson: it comes from every gem ever earned (shared/avatar.js),
  // so it carries on from lesson to lesson. Without avatar.js it falls back to this lesson's gems.
  const levelOf = n => Math.floor(n / PER_LEVEL) + 1;
  const player = () => AV ? AV.levelInfo() : { level: levelOf(state.stars), into: state.stars % PER_LEVEL, need: PER_LEVEL, title: '' };
  function updateStars(bump) {
    const p = player();
    starCount.textContent = state.stars;
    xpLevel.textContent = 'LEVEL ' + p.level + (p.title ? ' · ' + p.title.toUpperCase() : '');
    xpFill.style.width = p.into / p.need * 100 + '%';
    if (bump) { starBox.classList.remove('bump'); void starBox.offsetWidth; starBox.classList.add('bump'); }
  }
  updateStars();
  function toast(title, sub, icon, cls = '') {
    const t = h('div', { class: 'toast ' + cls }, h('div', { class: 'toast-icon' }, icon), h('div', null, h('div', { class: 'toast-title' }, title), h('div', { class: 'toast-sub' }, sub)));
    toasts.append(t);
    setTimeout(() => t.classList.add('out'), 3200);
    setTimeout(() => t.remove(), 3700);
  }
  const ACH = Object.assign({
    word: { icon: '📖', name: 'Word Explorer' },
    words5: { icon: '📚', name: 'Dictionary Master' },
    flawless: { icon: '✨', name: 'Flawless – no mistakes!' },
    video: { icon: '🎬', name: 'Movie Buff' },
    boss: { icon: '⚔️', name: 'Boss Defeated!' },
    perfect: { icon: '🏆', name: 'Perfect Score!' },
    level5: { icon: '🚀', name: 'Reached Level 5' },
    artist: { icon: '🎨', name: 'Pixel Artist' },
    designer: { icon: '🖼️', name: 'Graphic Designer' },
    wonder: { icon: '🌍', name: 'Wonder Hunter' },
    speller: { icon: '🪄', name: 'Spell Master' },
    miner: { icon: '⛏️', name: 'Maths Miner' },
    gardener: { icon: '🌻', name: 'Green Thumb' },
    traveller: { icon: '🧳', name: 'World Traveller' },
  }, L.achievements);
  function achieve(id) {
    const a = ACH[id];
    if (!a || state.ach[id]) return;
    state.ach[id] = true; save();
    setTimeout(() => { sfx.achieve(); toast('ACHIEVEMENT UNLOCKED!', a.name, a.icon); }, 400);
  }
  function flyStar(from) {
    if (!from || !from.getBoundingClientRect) return;
    const a = from.getBoundingClientRect(), b = starBox.getBoundingClientRect();
    const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    const s = h('div', { class: 'fly-star' }, CUR.icon);
    s.style.left = ax + 'px'; s.style.top = ay + 'px';
    document.body.append(s);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      s.style.transform = `translate(${b.left + b.width / 2 - ax}px, ${b.top + b.height / 2 - ay}px) scale(.6)`;
      s.style.opacity = '0.4';
    }));
    setTimeout(() => s.remove(), 800);
  }
  // Each gem key can only be earned once, so replaying never inflates the total.
  function award(key, fromEl) {
    if (state.awarded[key]) return false;
    const before = player().level;
    state.awarded[key] = true; state.stars++;
    if (AV) {
      const total = AV.earn(1); // add to the wallet first, so a brand-new wallet never counts this gem twice
      if (total % 25 === 0) setTimeout(() => { sfx.achieve(); toast('NEW GEAR TIME!', `💎 ${AV.wallet().balance} gems to spend in the Wardrobe`, '🛍️'); }, 1500);
    }
    save(); saveRecord({});
    flyStar(fromEl); sfx.star();
    setTimeout(() => updateStars(true), 650);
    const lvl = player().level;
    if (lvl > before) setTimeout(() => {
      sfx.levelup(); confetti(60);
      toast('LEVEL UP!', `You reached level ${lvl}!`, '⬆️', 'level');
      if (lvl >= 5) achieve('level5');
      if (AV) {
        AV.newRewards(lvl).forEach((r, k) => setTimeout(() => { sfx.achieve(); toast('NEW REWARD UNLOCKED!', r.label + ' – wear it in the Wardrobe', '🎁', 'level'); }, 1200 + k * 900));
        AV.markSeen(lvl);
      }
    }, 700);
    return true;
  }

  // ---------- glossary pop-up ----------
  function closeOverlay() { overlay.hidden = true; overlay.replaceChildren(); }
  overlay.addEventListener('click', e => { if (e.target === overlay) closeOverlay(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeOverlay(); certOverlay.hidden = true; } });
  document.addEventListener('click', e => {
    const g = e.target.closest && e.target.closest('.gloss');
    if (!g) return;
    let d = (L.glossary || {})[g.dataset.key];
    if (!d) return;
    if (typeof d === 'string') d = { def: d };
    sfx.tap();
    const close = h('button', { class: 'btn', type: 'button', onclick: closeOverlay }, 'Got it! 👍');
    overlay.replaceChildren(h('div', { class: 'card gloss-card', role: 'dialog', 'aria-label': 'Word meaning' },
      d.emoji && h('div', { class: 'gloss-emoji' }, d.emoji),
      h('div', { class: 'gloss-word' }, d.word || g.textContent),
      h('p', { class: 'gloss-def', html: fmt(d.def, false) }),
      close));
    overlay.hidden = false;
    close.focus();
    if (award('word:' + g.dataset.key, g)) {
      achieve('word');
      if (Object.keys(state.awarded).filter(k => k.startsWith('word:')).length >= 5) achieve('words5');
    }
  });

  // ---------- navigation ----------
  const ICON = { welcome: '🏁', review: '⏪', read: '📖', video: '🎬', game: '🎮', break: '🤸', quiz: '⚔️' };
  const KIND = { welcome: 'Start', review: 'Recap', read: 'Reading quest', video: 'Video quest', game: 'Game', break: 'Brain break', quiz: 'Quiz' };
  const RENDER = { welcome: renderWelcome, review: renderReview, read: renderRead, video: renderVideo, game: renderGame, break: renderBreak, quiz: renderQuiz };
  let cleanup = null, enteringBackwards = false, stageCard = null;

  function renderPath() {
    path.replaceChildren(...L.stages.map((s, i) => h('button', {
      type: 'button', title: s.title, disabled: i > state.maxStage,
      class: ['step', i === state.stage && 'now', state.complete[i] && 'done'].filter(Boolean).join(' '),
      onclick() { sfx.tap(); go(i); },
    },
    h('span', { class: 'step-ico' }, s.icon || ICON[s.type]),
    h('span', { class: 'step-label' }, s.short || s.title))));
  }
  function go(i, backwards = false) {
    if (cleanup) { cleanup(); cleanup = null; }
    state.stage = Math.max(0, Math.min(L.stages.length - 1, i));
    state.maxStage = Math.max(state.maxStage, state.stage);
    enteringBackwards = backwards;
    save(); render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function complete(i) {
    if (state.complete[i]) return;
    state.complete[i] = true;
    state.maxStage = Math.max(state.maxStage, i + 1 < L.stages.length ? i + 1 : i);
    save(); renderPath();
  }
  function render() {
    renderPath();
    bubble = null;
    const s = L.stages[state.stage];
    main.replaceChildren(RENDER[s.type](s, state.stage));
  }
  function shell(s, body) {
    stageCard = h('section', { class: 'card stage-card' },
      h('div', { class: 'stage-head' },
        h('span', { class: 'chip' }, (s.icon || ICON[s.type]) + ' ' + (s.kind || KIND[s.type])),
        s.minutes && h('span', { class: 'chip soft' }, '⏱ about ' + s.minutes + ' min'),
        h('h1', null, s.title)),
      body);
    return stageCard;
  }
  // A plain "Correct!" (no explanation to read) moves on by itself after a beat, so quizzes and boss battles keep their pace.
  // The button stays up with a filling bar, so a tap skips the wait. stillValid() says the button still means the same step.
  const AUTO_NEXT_MS = 1500;
  function autoClick(btn, stillValid = () => true) {
    btn.classList.add('auto');
    setTimeout(() => { if (btn.isConnected && !btn.hidden && !btn.disabled && stillValid()) btn.click(); }, AUTO_NEXT_MS);
  }

  function navRow(onBack) {
    const back = h('button', { class: 'btn ghost', type: 'button', onclick() { sfx.tap(); onBack(); } }, '◀ Back');
    const next = h('button', { class: 'btn big', type: 'button' }, 'Next ▶');
    let handler = null;
    next.addEventListener('click', () => { if (!next.disabled && handler) { sfx.tap(); handler(); } });
    return {
      el: h('div', { class: 'navrow' }, back, next),
      set(label, fn, enabled = true) {
        next.textContent = label; handler = fn; next.disabled = !enabled;
        next.classList.toggle('ready', enabled); next.classList.remove('auto');
      },
      auto() { const fn = handler; autoClick(next, () => handler === fn); },
      hideNext() { next.hidden = true; },
    };
  }
  const nextLabel = i => {
    const n = L.stages[i + 1];
    return n ? `${n.icon || ICON[n.type]} ${n.short || KIND[n.type]} ▶` : 'Finish ▶';
  };

  // ---------- stage: welcome ----------
  function renderWelcome(s, i) {
    const name = h('input', {
      class: 'name-in', type: 'text', maxlength: '20', autocomplete: 'off',
      placeholder: 'Type your name', value: settings.name || '', 'aria-label': 'Your name',
    });
    name.addEventListener('input', () => { settings.name = name.value.trim(); saveSettings(); });
    const resume = state.maxStage > 0;
    const start = h('button', {
      class: 'btn big green ready', type: 'button',
      onclick() { sfx.win(); complete(i); go(resume ? Math.max(1, state.maxStage) : 1); },
    }, resume ? '▶ CONTINUE' : '▶ PLAY');
    const restart = resume
      ? h('button', {
        class: 'btn ghost', type: 'button',
        onclick() {
          if (!confirm(`Start this lesson again from the beginning? Your ${CUR.name} for it will go back to 0.`)) return;
          state = fresh(); save(); saveRecord({ done: false }); updateStars(); go(0);
        },
      }, '↺ New game')
      : h('span');
    return shell(s, [
      mascot(s.hello || `Hi! I'm ${M.name}. Ready for an adventure?`),
      h('div', { class: 'hero' },
        pic(s.pic || L.emoji, 'hero-pic'),
        h('div', { class: 'big-q' }, h('div', { class: 'big-q-label' }, '❓ THE BIG QUESTION'), h('p', { html: fmt(s.question) }))),
      s.intro && h('p', { class: 'lead', html: fmt(s.intro) }),
      h('div', { class: 'me-row' },
        AV && h('a', { class: 'me-link', href: WARDROBE, title: 'Change my outfit', style: `background:${AV.sceneBox(AV.load().look.scene)}` }, h('img', { class: 'me-avatar', src: AV.dataURL(AV.load().look, { scale: 5, pet: true }), alt: 'Your avatar' })),
        h('div', { class: 'me-fields' },
          h('label', { class: 'name-row' }, h('span', null, s.nameLabel || 'Player name:'), name),
          AV && h('a', { class: 'btn gold', href: WARDROBE }, `👕 Wardrobe · 💎 ${AV.wallet().balance}`))),
      h('div', { class: 'panel-inner map-box' },
        h('h3', null, '🗺️ Quest map'),
        h('ol', { class: 'map' }, L.stages.map((st, j) => j === 0 ? null : h('li', null,
          h('span', { class: 'map-ico' }, st.icon || ICON[st.type]),
          h('span', null, st.title),
          st.minutes && h('span', { class: 'map-min' }, st.minutes + ' min'))))),
      h('div', { class: 'navrow' }, restart, start),
    ]);
  }

  // ---------- stage: review ("last time…" recap of the previous lesson) ----------
  function renderReview(s, i) {
    const area = h('div');
    const nav = navRow(() => go(i - 1, true));
    const from = s.from || {};
    const start = () => {
      stopReading();
      sfx.good();
      say('Notes hidden! How much can you remember?');
      runQuestions(area, s.questions, {
        key: `s${i}rv`,
        done(score) {
          const finish = () => {
            sfx.win(); confetti(80); complete(i);
            say(score === s.questions.length ? 'Your memory is EPIC! Now for something new…' : 'Great recap! Now for something new…');
            put(area, h('div', { class: 'results' }, h('div', { class: 'trophy' }, '🧠'), h('h2', null, 'RECAP COMPLETE!'),
              h('p', { class: 'lead' }, `You remembered ${score} of ${s.questions.length} first time.`)));
            nav.set(nextLabel(i), () => go(i + 1));
          };
          // optional hands-on warm-up round after the memory questions, e.g. { game: 'forces', tasks: [...] }
          if (!s.game) return finish();
          sfx.good();
          put(area,
            h('div', { class: 'round-tag' }, `HANDS-ON${s.game.title ? ' · ' + s.game.title : ''}`),
            s.game.intro && h('p', { class: 'instr', html: fmt(s.game.intro) }),
            GAMES[s.game.game](s.game, `s${i}rvg`, () => setTimeout(finish, 1200)));
          say(s.game.say || 'Memory test done! Now try it with your hands…');
        },
      });
    };
    const factEls = (s.facts || []).map(f => h('li', { html: fmt(f, false) }));
    const reader = readAloud(factEls);
    cleanup = reader.stop;
    put(area,
      h('div', { class: 'panel-inner recap' },
        h('h3', null, `⏪ Last time: ${from.emoji || ''} ${from.title || 'our last lesson'}`),
        h('ul', null, factEls),
        h('div', { class: 'read-row' }, reader.btn),
        from.url && h('a', { class: 'recap-link', href: from.url }, '↺ Replay that lesson')),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn big green ready', type: 'button', onclick: start }, '🧠 Test my memory!')));
    nav.set(nextLabel(i), () => go(i + 1), !!state.complete[i]);
    return shell(s, [mascot(s.say || 'Welcome back! First, a quick recap of last time. Read the notes, then test your memory!'), area, nav.el]);
  }

  // ---------- read-aloud: a 🔊 button that reads a passage, lighting up each word as it is spoken ----------
  // readAloud([elements]) wraps every word in a span and returns { btn, stop }. Each element (title, paragraph, list item)
  // is spoken as its own short utterance; word highlighting uses the voice's word-boundary events, and if a voice
  // doesn't send them, the whole line stays lit instead.
  let stopReading = () => {};
  function readAloud(els) {
    const lines = els.filter(Boolean).map(el => {
      const words = [];
      let text = '';
      const walk = node => {
        for (const n of [...node.childNodes]) {
          if (n.nodeType === 3) {
            const frag = document.createDocumentFragment();
            n.textContent.split(/(\s+)/).forEach(part => {
              if (!part) return;
              if (/^\s+$/.test(part)) frag.append(part);
              else { const sp = h('span', { class: 'rd-w' }, part); words.push({ sp, start: text.length, end: text.length + part.length }); frag.append(sp); }
              text += part;
            });
            n.replaceWith(frag);
          } else if (n.nodeType === 1) walk(n);
        }
      };
      walk(el);
      return { el, words, text };
    });
    let playing = false, lit = null;
    const btn = h('button', { class: 'btn gold read-aloud', type: 'button', 'aria-label': 'Read this page to me' }, '🔊 Read to me');
    const light = sp => { if (lit) lit.classList.remove('rd-now'); lit = sp; if (sp) sp.classList.add('rd-now'); };
    const stop = () => {
      if (!playing) return;
      playing = false;
      try { speechSynthesis.cancel(); } catch (e) { /* ignore */ }
      light(null); lines.forEach(l => l.el.classList.remove('rd-line'));
      btn.textContent = '🔊 Read to me'; btn.classList.remove('on');
    };
    const play = k => {
      if (!playing) return;
      if (k >= lines.length) return stop();
      const line = lines[k];
      if (!line.text.trim()) return play(k + 1);
      const u = new SpeechSynthesisUtterance(line.text), v = voiceFor('en-GB');
      if (v) u.voice = v;
      u.lang = v ? v.lang : 'en-GB'; u.rate = 0.9;
      u.onstart = () => { if (playing) line.el.classList.add('rd-line'); };
      u.onboundary = e => {
        if (!playing || (e.name && e.name !== 'word')) return;
        const w = line.words.find(x => e.charIndex >= x.start && e.charIndex < x.end) || line.words.find(x => x.start >= e.charIndex);
        if (w) light(w.sp);
      };
      u.onend = () => { line.el.classList.remove('rd-line'); light(null); play(k + 1); };
      u.onerror = () => stop();
      speechSynthesis.speak(u);
    };
    btn.addEventListener('click', () => {
      if (playing) { stop(); return; }
      if (!canSpeak) { say('Sorry – this device can\'t read aloud.'); return; }
      stopReading();
      try { speechSynthesis.cancel(); } catch (e) { /* ignore */ }
      playing = true; btn.textContent = '⏹ Stop reading'; btn.classList.add('on');
      stopReading = stop;
      play(0);
    });
    if (!canSpeak) btn.hidden = true;
    return { btn, stop };
  }

  // ---------- stage: read ----------
  function renderRead(s, i) {
    let ci = enteringBackwards ? s.cards.length - 1 : 0;
    const area = h('div');
    const dots = h('div', { class: 'dots', 'aria-hidden': 'true' });
    const nav = navRow(() => { if (ci > 0) { ci--; show(); } else go(i - 1, true); });

    function show() {
      if (cleanup) { cleanup(); cleanup = null; }
      const c = s.cards[ci];
      const key = `s${i}c${ci}`;
      let answered = !c.check || !!state.awarded[key];
      const goNext = () => {
        if (ci < s.cards.length - 1) { ci++; show(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
        else { complete(i); go(i + 1); }
      };
      const label = ci < s.cards.length - 1 ? 'Next page ▶' : nextLabel(i);

      const titleEl = c.title && h('h2', { class: 'story-title' }, c.title);
      // an evidence check makes the page's own sentences tappable
      const evidence = c.check && c.check.type === 'evidence';
      const para = t => (evidence ? h('p', null, splitSentences(t)) : h('p', { html: fmt(t) }));
      // a comic page: c.comic = [{ who: 'mascot' | 'me' | emoji / svg, name, say, pic }] – each line is a panel with a speech bubble
      const paras = c.comic ? c.comic.map(line => para(fill(line.say))) : [].concat(c.text).map(para);

      let check = null;
      if (c.check && QTYPES[c.check.type]) {
        // the newer question types: only a first-try answer earns the gem (no answer lock-out needed – there is nothing to guess between)
        const fb = h('div', { class: 'feedback', hidden: true });
        const onRight = (el, first) => {
          sfx.good();
          if (first) { award(key, el); say(c.check.yes || praise()); } else say('You got there! Next time, read carefully first to win the gem.');
          fb.className = 'feedback good'; fb.hidden = false; fb.innerHTML = '✔ ' + fmt(c.check.explain || 'Correct!', false);
          answered = true; nav.set(label, goNext);
          if (!c.check.explain) nav.auto();
        };
        const onMiss = () => say(c.check.hint || 'Not quite! Read the page again to find the answer.');
        if (answered) { fb.className = 'feedback good'; fb.hidden = false; fb.innerHTML = '✔ ' + fmt(c.check.explain || 'Done!', false); }
        check = h('div', { class: 'check' },
          h('div', { class: 'check-q' }, h('b', null, '🔍 CHECK: '), c.check.q),
          !answered && QTYPES[c.check.type](c.check, onRight, onMiss, evidence ? { sentences: paras.flatMap(p => [...p.querySelectorAll('.ev-sent')]) } : {}),
          fb);
      } else if (c.check) {
        // Answers are shuffled, and only a first-try answer earns the gem. A wrong guess hides the
        // answers for a few seconds ("read the page again") and shuffles them, so guessing never pays.
        const fb = h('div', { class: 'feedback', hidden: true });
        const optsBox = h('div', { class: 'opts' });
        let firstTry = true, waitId = 0;
        const deal = () => {
          const order = answered ? c.check.options.map((_, k) => k) : shuffle(c.check.options.map((_, k) => k));
          const opts = order.map(oi => h('button', {
            class: 'opt' + (answered && oi === c.check.answer ? ' right' : ''), type: 'button', disabled: answered,
            onclick(e) {
              const b = e.currentTarget;
              if (oi === c.check.answer) {
                b.classList.add('right'); opts.forEach(x => { x.disabled = true; });
                sfx.good();
                if (firstTry) { award(key, b); say(c.check.yes || praise()); } else say('You got there! Next time, read carefully first to win the gem.');
                fb.className = 'feedback good'; fb.hidden = false; fb.innerHTML = '✔ ' + fmt(c.check.explain || 'Correct!', false);
                answered = true; nav.set(label, goNext);
                if (!c.check.explain) nav.auto();
              } else {
                firstTry = false;
                b.classList.add('wrong'); opts.forEach(x => { x.disabled = true; }); shake(b); sfx.bad();
                say(c.check.hint || 'Not quite! Read the page again to find the answer.');
                let left = 5;
                const msg = h('div', { class: 'reread' }, `📖 Read the page again! The answers come back in ${left}…`);
                setTimeout(() => { if (optsBox.isConnected) put(optsBox, msg); }, 700);
                const tick = () => {
                  left--;
                  if (!optsBox.isConnected) return;
                  if (left > 0) { msg.textContent = `📖 Read the page again! The answers come back in ${left}…`; waitId = setTimeout(tick, 1000); } else deal();
                };
                waitId = setTimeout(tick, 1700);
              }
            },
          }, o(oi)));
          put(optsBox, opts);
        };
        const o = oi => c.check.options[oi];
        deal();
        cleanup = () => clearTimeout(waitId);
        check = h('div', { class: 'check' },
          h('div', { class: 'check-q' }, h('b', null, '🔍 CHECK: '), c.check.q),
          optsBox, fb);
      }

      const reader = readAloud([titleEl, ...paras]);
      const prevCleanup = cleanup;
      cleanup = () => { if (prevCleanup) prevCleanup(); reader.stop(); };
      const face = who => who === 'mascot' ? (M.sprite ? pic(M.sprite, 'comic-face') : h('div', { class: 'comic-face emoji' }, M.emoji))
        : who === 'me' ? (AV ? h('img', { class: 'comic-face', src: AV.dataURL(AV.load().look, { scale: 4 }), alt: '' }) : h('div', { class: 'comic-face emoji' }, '🧒'))
        : pic(who, 'comic-face');
      const page = c.comic
        ? h('div', { class: 'panel-inner comic' }, titleEl,
          h('div', { class: 'comic-strip' }, c.comic.map((line, k) => h('div', { class: 'comic-panel' + (line.who === 'me' ? ' me' : '') },
            line.pic && pic(line.pic, 'comic-scene'),
            h('div', { class: 'comic-who' }, face(line.who), h('span', { class: 'comic-name' }, line.name || (line.who === 'mascot' ? M.name : line.who === 'me' ? settings.name || 'You' : ''))),
            h('div', { class: 'comic-bubble' }, paras[k])))),
          h('div', { class: 'read-row' }, reader.btn))
        : h('div', { class: 'panel-inner story' },
          pic(c.pic),
          h('div', { class: 'story-text' }, titleEl, paras, h('div', { class: 'read-row' }, reader.btn)));
      put(area, h('div', { class: 'story-anim' }, page, check));
      dots.replaceChildren(...s.cards.map((_, j) => h('span', { class: 'dot' + (j === ci ? ' on' : j < ci ? ' seen' : '') })));
      nav.set(label, goNext, answered);
      if (ci === 0 && !enteringBackwards) say(s.say || `Read each page. Tap the yellow words to learn what they mean – and earn a ${CUR.icon}!`);
      else if (!answered) say('Answer the check to unlock the next page!');
    }
    const el = shell(s, [mascot(''), area, dots, nav.el]);
    show();
    return el;
  }

  // ---------- questions (shared by quiz, video quests and the "questions" game) ----------
  // Renders one question. onRight(el, firstTry) / onMiss(el) handle feedback; shaking + buzzer happen here.
  function questionWidget(q, onRight, onMiss) {
    if (QTYPES[q.type]) return [h('p', { class: 'q-text', html: fmt(q.q, false) }), QTYPES[q.type](q, onRight, onMiss)];
    let wrong = false;
    if (q.type === 'order') {
      const text = h('p', { class: 'q-text', html: fmt(q.q, false) });
      let misses = 0; // order questions are many taps long, so the first slip is only a hint (no lost heart)
      const body = GAMES.order({ items: q.items, hint: q.hint, ends: q.ends, start: q.start }, '', () => onRight(body, !wrong), { noStars: true, quiet: true, wrong: el => { wrong = true; onMiss(el, ++misses === 1); } });
      return [text, body];
    }
    const options = q.type === 'tf' ? ['✅ True', '❌ False'] : q.options;
    const answer = q.type === 'tf' ? (q.answer ? 0 : 1) : q.answer;
    let text, blank = null;
    if (q.type === 'gap') {
      const [before, after] = q.q.split('___');
      blank = h('span', { class: 'blank' }, '?');
      text = h('p', { class: 'q-text' }, before, blank, after || '');
    } else text = h('p', { class: 'q-text', html: fmt(q.q, false) });
    // shuffle the answers each time (true/false keeps its order; keepOrder: true opts out)
    const order = q.type === 'tf' || q.keepOrder ? options.map((_, k) => k) : shuffle(options.map((_, k) => k));
    const btns = order.map(oi => [options[oi], oi]).map(([o, oi]) => h('button', {
      class: 'opt' + (q.optionsHtml ? ' opt-pic' : ''), type: 'button', html: q.optionsHtml ? o : null,
      onclick(e) {
        const b = e.currentTarget;
        if (oi === answer) {
          b.classList.add('right'); btns.forEach(x => { x.disabled = true; });
          if (blank) blank.textContent = o;
          onRight(b, !wrong);
        } else {
          wrong = true; b.classList.add('wrong'); b.disabled = true; shake(b); sfx.bad(); onMiss(b);
        }
      },
    }, q.optionsHtml ? null : o));
    return [text, h('div', { class: 'opts' }, btns)];
  }

  // ---------- more question types: evidence, hotspot, slider, oddone, build, type, predict ----------
  // Each one makes the child DO the thinking (find the proof, point at it, estimate, explain, build, recall, predict),
  // not just pick from a list. They work everywhere questionWidget does: reading checks, video quests, the questions game
  // and boss battles. QTYPES[type](q, onRight(el, firstTry), onMiss(el), ctx) returns the answer area (not the question text).
  const QTYPES = {};
  const checkBtn = (label, fn) => h('button', { class: 'btn q-check', type: 'button', onclick: fn }, label);
  // a passage split into tappable sentences (for evidence questions)
  const splitSentences = p => (String(p).match(/[^.!?…]+[.!?…]+["'”’)]*\s*|[^.!?…]+$/g) || [String(p)]).map(t => [h('span', { class: 'ev-sent', html: fmt(t.trim()) }), ' ']);

  // evidence: tap the sentence that proves the answer. { q, answer: a few words from the right sentence (or a list, when
  //   more than one sentence proves it), passage }
  // In a reading check the page's own sentences are tapped (ctx.sentences); anywhere else q.passage is shown.
  QTYPES.evidence = (q, onRight, onMiss, ctx = {}) => {
    let wrong = false, done = false, panel = null, sents = ctx.sentences;
    if (!sents) {
      const ps = [].concat(q.passage || []).map(t => h('p', null, splitSentences(t)));
      sents = ps.flatMap(el => [...el.querySelectorAll('.ev-sent')]);
      panel = h('div', { class: 'ev-passage' }, ps);
    }
    const wants = [].concat(q.answer).map(a => String(a).toLowerCase());
    const proves = el => wants.some(a => el.textContent.toLowerCase().includes(a));
    wants.forEach(a => { if (!sents.some(el => el.textContent.toLowerCase().includes(a))) console.warn('evidence: no sentence contains', a); });
    const tap = el => {
      if (done) return;
      if (proves(el)) {
        done = true; el.classList.add('right');
        sents.forEach(x => { x.classList.remove('tap'); x.removeAttribute('role'); x.removeAttribute('tabindex'); });
        onRight(el, !wrong);
      } else { wrong = true; replay(el, 'wrong'); shake(el); sfx.bad(); onMiss(el); }
    };
    sents.forEach(el => {
      el.classList.add('tap'); el.setAttribute('role', 'button'); el.tabIndex = 0;
      el.addEventListener('click', e => { if (!e.target.closest('.gloss')) tap(el); });
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(el); } });
    });
    return [h('div', { class: 'q-tag' }, ctx.sentences ? '👆 Tap the sentence on the page that proves it!' : '👆 Tap the sentence that proves it!'), panel];
  };

  // hotspot: tap the right place on a picture. { q, img (svg / emoji), spots: [{ x, y, r, label }] (% of the picture),
  //   answer: spot index, or a list when several spots are right (e.g. both leaves) }
  QTYPES.hotspot = (q, onRight, onMiss) => {
    let wrong = false, done = false;
    const ok = [].concat(q.answer);
    const spots = q.spots.map((sp, k) => h('button', {
      class: 'hs-spot', type: 'button', 'aria-label': sp.label || `spot ${k + 1}`,
      style: `left:${sp.x}%;top:${sp.y}%;width:${(sp.r || 12) * 2}%`,
      onclick(e) {
        const b = e.currentTarget;
        if (done) return;
        if (ok.includes(k)) { done = true; b.classList.add('right'); onRight(b, !wrong); }
        else {
          wrong = true; b.classList.add('wrong'); shake(b); sfx.bad(); onMiss(b);
          if (sp.label) popText(b, sp.label, 'hs-name');
        }
      },
    }));
    return [h('div', { class: 'q-tag' }, '👆 Tap the right place on the picture!'), h('div', { class: 'hs-pic' }, pic(q.img, 'hs-img'), spots)];
  };

  // slider: drag the marker along a number line, then lock it in.
  // { q, min, max, step, answer, tolerance, unit, ticks (number of gaps, default 10), from, hideValue (for estimating), format(v) }
  QTYPES.slider = (q, onRight, onMiss) => {
    const min = q.min ?? 0, max = q.max ?? 100, step = q.step || 1, tol = q.tolerance || 0, unit = q.unit || '', n = q.ticks || 10;
    let v = q.from ?? min, wrong = false, done = false, dragging = false;
    const show = x => (q.format ? q.format(x) : x) + unit;
    const snap = x => Number((Math.round((Math.max(min, Math.min(max, x)) - min) / step) * step + min).toFixed(6));
    const knob = h('div', { class: 'sl-knob', role: 'slider', tabindex: 0, 'aria-valuemin': min, 'aria-valuemax': max, 'aria-label': 'Move the marker' }, h('span', { class: 'sl-val' }));
    const ticks = Array.from({ length: n + 1 }, (_, k) => h('div', { class: 'sl-tick', style: `left:${k / n * 100}%` },
      h('span', null, q.endsOnly && k && k < n ? '' : show(snap(min + (max - min) * k / n)))));
    const track = h('div', { class: 'sl-track' }, h('div', { class: 'sl-line' }), ticks, knob);
    const note = h('div', { class: 'sl-note', 'aria-live': 'polite' });
    const set = x => { v = snap(x); knob.style.left = (v - min) / (max - min) * 100 + '%'; knob.setAttribute('aria-valuenow', v); knob.firstChild.textContent = q.hideValue ? '' : show(v); };
    const fromX = cx => { const r = track.getBoundingClientRect(); set(min + (cx - r.left) / r.width * (max - min)); };
    track.addEventListener('pointerdown', e => { if (done) return; e.preventDefault(); dragging = true; fromX(e.clientX); try { track.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } });
    track.addEventListener('pointermove', e => { if (dragging && !done) fromX(e.clientX); });
    const stop = () => { dragging = false; };
    track.addEventListener('pointerup', stop); track.addEventListener('pointercancel', stop);
    knob.addEventListener('keydown', e => {
      const d = { ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step }[e.key];
      if (d && !done) { e.preventDefault(); set(v + d); }
    });
    const btn = checkBtn('📍 Lock it in!', () => {
      if (done) return;
      if (Math.abs(v - q.answer) <= tol + 1e-9) { done = true; btn.disabled = true; knob.classList.add('right'); note.textContent = ''; onRight(knob, !wrong); }
      else { wrong = true; shake(knob); sfx.bad(); note.textContent = v > q.answer ? '⬅️ Too high – go lower!' : '➡️ Too low – go higher!'; onMiss(knob); }
    });
    set(v);
    track._test = { set, get value() { return v; } };
    return [h('div', { class: 'q-tag' }, '👆 Drag the marker, then lock it in!'), track, note, h('div', { class: 'btn-row' }, btn)];
  };

  // oddone: pick the odd one out, then pick WHY. { q, items, answer, why, reasons, reason }
  QTYPES.oddone = (q, onRight, onMiss) => {
    let wrong = false;
    const why = h('div', { class: 'odd-why', hidden: true });
    const items = shuffle(q.items.map((t, k) => [t, k])).map(([t, k]) => h('button', {
      class: 'opt', type: 'button', html: fmt(t, false),
      onclick(e) {
        const b = e.currentTarget;
        if (k === q.answer) {
          b.classList.add('right'); items.forEach(x => { x.disabled = true; }); sfx.tap();
          why.hidden = false;
          put(why, questionWidget({ q: q.why || 'Why is it the odd one out?', options: q.reasons, answer: q.reason }, (el, first) => onRight(el, first && !wrong), el => { wrong = true; onMiss(el); }));
        } else { wrong = true; b.classList.add('wrong'); b.disabled = true; shake(b); sfx.bad(); onMiss(b); }
      },
    }));
    return [h('div', { class: 'q-tag' }, '🔎 Which one does NOT belong?'), h('div', { class: 'opts' }, items), why];
  };

  // build: tap tiles to build the answer – a word from letters or word parts, or a sentence from words.
  // { q, answer: [tiles in the right order], extra: [decoy tiles], join: '' (word) or ' ' (sentence) }
  QTYPES.build = (q, onRight, onMiss) => {
    const join = q.join ?? '';
    let wrong = false, done = false;
    const row = h('div', { class: 'bld-row', 'aria-live': 'polite' });
    const place = b => { if (done) return; sfx.tap(); (b.parentElement === row ? pool : row).append(b); empty.hidden = row.children.length > 1; };
    const empty = h('span', { class: 'bld-empty' }, 'Tap the tiles to build it here');
    row.append(empty);
    const pool = h('div', { class: 'bld-pool' }, shuffle(q.answer.concat(q.extra || [])).map(t => h('button', { class: 'bld-tile', type: 'button', onclick: e => place(e.currentTarget) }, t)));
    const btn = checkBtn('✔ Check', () => {
      if (done) return;
      const built = [...row.querySelectorAll('.bld-tile')].map(b => b.textContent);
      if (!built.length) { shake(pool); return; }
      if (built.join(join) === q.answer.join(join)) { done = true; btn.disabled = true; row.classList.add('right'); onRight(row, !wrong); }
      else { wrong = true; shake(row); sfx.bad(); onMiss(row); }
    });
    return [row, pool, h('div', { class: 'btn-row' }, btn)];
  };

  // type: write the answer. { q, answer: 'word' or ['word', 'other spelling'], before, after, placeholder }
  // Capitals, spaces and punctuation don't matter (so 'Half past 3' = 'half past 3.').
  QTYPES.type = (q, onRight, onMiss) => {
    const clean = t => String(t).toLowerCase().replace(/[^a-z0-9£:]+/g, ' ').trim();
    const ok = [].concat(q.answer).map(clean);
    let wrong = false;
    const box = h('input', { class: 'q-type', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Your answer', placeholder: q.placeholder || 'Type your answer' });
    const go = () => {
      const v = clean(box.value);
      if (!v) { box.focus(); return; }
      if (ok.includes(v)) { box.classList.add('right'); box.disabled = btn.disabled = true; onRight(box, !wrong); }
      else { wrong = true; replay(box, 'wrong'); shake(box); sfx.bad(); onMiss(box); box.select(); }
    };
    const btn = checkBtn('✔ Check', go);
    box.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    return h('div', { class: 'q-type-row' }, q.before && h('span', null, q.before), box, q.after && h('span', null, q.after), btn);
  };

  // predict: guess what will happen first (never marked wrong), see what really happens, then explain why.
  // { q, options, answer (optional: the real outcome), reveal, revealPic, then: { q, options, answer, explain } }
  QTYPES.predict = (q, onRight, onMiss) => {
    const after = h('div', { class: 'pred-after', hidden: true });
    const opts = q.options.map((o, k) => h('button', {
      class: 'opt', type: 'button', html: fmt(o, false),
      onclick(e) {
        opts.forEach(x => { x.disabled = true; }); e.currentTarget.classList.add('picked'); sfx.tap();
        const lead = q.answer == null ? '' : k === q.answer ? '🎯 Great prediction! ' : '🤔 Surprise! ';
        after.hidden = false;
        put(after, h('div', { class: 'pred-reveal' }, pic(q.revealPic, 'pred-pic'), h('p', { html: lead + fmt(q.reveal, false) })),
          questionWidget(q.then, onRight, onMiss));
      },
    }));
    return [h('div', { class: 'q-tag' }, '🔮 Make a prediction – there is no wrong answer!'), h('div', { class: 'opts' }, opts), after];
  };

  // Runs a list of questions one at a time inside `area`; calls done(firstTryScore) at the end.
  // In a boss battle, boss.zap(qi) returns true when the last heart is gone; then lost(score) is called.
  function runQuestions(area, qs, { key, done, boss, lost, lastLabel = 'Finish ▶' }) {
    let qi = 0, score = 0;
    function show() {
      const q = qs[qi], isLast = qi === qs.length - 1;
      const explain = q.explain || (q.then && q.then.explain); // a predict question's explanation sits on its follow-up
      const fb = h('div', { class: 'feedback', hidden: true });
      let moved = false;
      const nextBtn = h('button', {
        class: 'btn', type: 'button', hidden: true,
        onclick() {
          if (moved) return;
          moved = true; sfx.tap(); qi++;
          const next = () => { if (qi < qs.length) show(); else done(score); };
          if (boss && boss.dodgeDue()) boss.dodge(area, dead => (dead ? lost(score) : next()));
          else next();
        },
      }, isLast ? lastLabel : 'Next question ▶');
      const onRight = (el, first) => {
        if (first) { score++; award(`${key}:${qi}`, el); }
        sfx.good(); say(praise());
        fb.className = 'feedback good'; fb.hidden = false;
        fb.innerHTML = '✔ ' + fmt(explain || (first ? 'Correct!' : 'You got there!'), false);
        let pause = !!explain; // something to read: wait for the tap
        if (boss) {
          boss.hit();
          if (boss.dodgeDue()) { nextBtn.textContent = '⚠️ Get ready to DODGE! ▶'; pause = true; }
          else if (isLast) { nextBtn.classList.add('gold', 'final'); pause = true; } // the final blow is the child's to strike
        }
        nextBtn.hidden = false;
        if (!pause) autoClick(nextBtn);
      };
      const onMiss = (el, free) => {
        say(q.hint ? '💡 ' + q.hint : oops());
        fb.className = 'feedback try'; fb.hidden = false;
        fb.innerHTML = '💡 ' + fmt(q.hint || 'Not quite – have another go!', false);
        if (boss && !free && boss.zap(qi)) {
          area.classList.add('locked');
          setTimeout(() => { area.classList.remove('locked'); lost(score); }, 1600);
        }
      };
      put(area,
        h('div', { class: 'qbar' }, h('div', { class: 'qbar-fill', style: `width:${qi / qs.length * 100}%` })),
        h('div', { class: 'q-count' }, `Question ${qi + 1} of ${qs.length}`),
        q.pic && pic(q.pic, 'q-pic'),
        questionWidget(q, onRight, onMiss), fb,
        h('div', { class: 'btn-row' }, nextBtn));
    }
    show();
  }

  // ---------- stage: video quest ----------
  function renderVideo(s, i) {
    const v = s.video;
    const url = v.url || `https://www.youtube.com/watch?v=${v.id}`;
    const thumb = v.thumb || (v.id ? `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg` : null);
    const area = h('div');
    const nav = navRow(() => go(i - 1, true));
    const startQs = () => {
      sfx.good();
      say(s.qsay || "Let's see what you spotted in the video!");
      runQuestions(area, s.questions, {
        key: `s${i}v`,
        done(score) {
          sfx.win(); confetti(90); complete(i); achieve('video');
          say(score === s.questions.length ? 'You were watching super carefully!' : 'Video quest complete!');
          put(area, h('div', { class: 'results' }, h('div', { class: 'trophy' }, '🎬'), h('h2', null, 'VIDEO QUEST COMPLETE!'), h('p', { class: 'lead' }, `You got ${score} of ${s.questions.length} right first time.`)));
          nav.set(nextLabel(i), () => go(i + 1));
        },
      });
      nav.set(nextLabel(i), () => go(i + 1), !!state.complete[i]);
    };
    const link = h('a', {
      class: 'video-thumb', href: url, target: '_blank', rel: 'noopener', 'aria-label': 'Play the video (opens in a new tab)',
      onclick() { sfx.good(); say('Enjoy the video! Come back to this tab when it finishes.'); },
    }, thumb && h('img', { src: thumb, alt: '', loading: 'lazy', onerror() { this.remove(); } }), h('span', { class: 'play' }, '▶'));
    put(area,
      h('div', { class: 'video-card' },
        h('div', null, link,
          h('div', { class: 'video-meta' },
            h('div', { class: 'vt' }, v.title),
            h('div', { class: 'vc' }, [v.channel, v.duration && '⏱ ' + v.duration].filter(Boolean).join('  ·  ')))),
        h('div', { class: 'panel-inner clues' },
          h('h3', null, '🔍 Watch out for…'),
          h('ul', null, (s.clues || []).map(c => h('li', { html: fmt(c, false) }))),
          h('div', { class: 'video-steps' }, '1️⃣ Press ▶ to watch.  2️⃣ Come back here.  3️⃣ Answer the questions!'))),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn big green ready', type: 'button', onclick: startQs }, "✔ I've watched it!")));
    nav.set(nextLabel(i), () => go(i + 1), !!state.complete[i]);
    const el = shell(s, [mascot(s.say || 'Video time! Watch carefully – there are questions after.'), area, nav.el]);
    return el;
  }

  // ---------- drag & drop (pointer events: mouse, touch and pen) ----------
  function draggable(el, { tap, drop }) {
    el.addEventListener('pointerdown', e => {
      if (e.button > 0 || el.classList.contains('placed')) return;
      e.preventDefault();
      const sx = e.clientX, sy = e.clientY, r = el.getBoundingClientRect();
      let ghost = null, over = null;
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      const zoneAt = (x, y) => { const t = document.elementFromPoint(x, y); return t && t.closest('[data-drop]'); };
      const move = ev => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (!ghost && Math.hypot(dx, dy) > 8) {
          ghost = el.cloneNode(true);
          ghost.classList.add('drag-ghost'); ghost.classList.remove('selected');
          Object.assign(ghost.style, { width: r.width + 'px', left: r.left + 'px', top: r.top + 'px' });
          document.body.append(ghost); el.classList.add('dragging');
        }
        if (ghost) {
          ghost.style.transform = `translate(${dx}px, ${dy}px) rotate(-4deg) scale(1.08)`;
          const z = zoneAt(ev.clientX, ev.clientY);
          if (z !== over) { if (over) over.classList.remove('over'); over = z; if (over) over.classList.add('over'); }
        }
      };
      const up = ev => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        if (over) over.classList.remove('over');
        if (ghost) {
          ghost.remove(); el.classList.remove('dragging');
          if (ev.type === 'pointerup') drop(zoneAt(ev.clientX, ev.clientY));
        } else if (ev.type === 'pointerup') tap();
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(); } });
  }

  // Shared "pick an item, then drop it on a target" logic for sort + label games.
  function dropGame({ items, makeChip, targets, check, onRight, onWrong, tapHint }) {
    let selected = null;
    const select = chip => {
      if (chip.classList.contains('placed')) return;
      if (selected) selected.classList.remove('selected');
      selected = selected === chip ? null : chip;
      if (selected) { selected.classList.add('selected'); sfx.tap(); say(tapHint); }
    };
    const attempt = (chip, target) => {
      chip.classList.remove('selected'); selected = null;
      if (check(chip, target)) onRight(chip, target);
      else { shake(chip); sfx.bad(); onWrong(chip, target); }
    };
    const chips = shuffle(items).map(it => {
      const chip = makeChip(it);
      chip.setAttribute('role', 'button'); chip.setAttribute('tabindex', '0');
      chip.classList.add('chip-item');
      chip._it = it;
      draggable(chip, { tap: () => select(chip), drop: z => { if (z) attempt(chip, z); } });
      return chip;
    });
    targets.forEach(t => {
      t.setAttribute('tabindex', '0');
      const act = () => { if (selected) attempt(selected, t); };
      t.addEventListener('click', act);
      t.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
    });
    return chips;
  }

  // ---------- games ----------
  // Each game: (round, gemKeyPrefix, done, hooks) → element.
  const GAMES = {
    sort(r, key, done) {
      let placed = 0;
      const lists = {};
      const targets = r.buckets.map(b => {
        lists[b.id] = h('div', { class: 'bucket-items' });
        return h('div', { class: 'bucket', 'data-drop': b.id },
          h('div', { class: 'bucket-head' }, b.emoji && h('span', { class: 'bucket-emoji' }, b.emoji), b.label),
          lists[b.id]);
      });
      const chips = dropGame({
        items: r.items, targets, tapHint: r.tapHint || 'Now tap the chest it belongs in!',
        makeChip: it => h('div', null, it.emoji && h('span', { class: 'ci-emoji' }, it.emoji), h('span', null, it.label)),
        check: (chip, t) => chip._it.bucket === t.dataset.drop,
        onRight(chip, t) {
          chip.classList.add('placed'); chip.removeAttribute('tabindex');
          lists[t.dataset.drop].append(chip);
          sfx.good(); award(key + ':' + chip._it.label, chip); say(chip._it.yes || praise());
          if (++placed === r.items.length) done();
        },
        onWrong(chip) { say(chip._it.hint || oops()); },
      });
      return h('div', { class: 'game sort' },
        h('div', { class: 'tray-wrap' },
          h('div', { class: 'tray-label' }, '👇 Drag each item into the right chest (or tap it, then tap the chest)'),
          h('div', { class: 'tray' }, chips)),
        h('div', { class: 'buckets', style: `--n:${r.buckets.length}` }, targets));
    },

    label(r, key, done) {
      let placed = 0;
      const board = h('div', { class: 'label-board' }, pic(r.pic, 'label-pic'));
      const targets = r.spots.map((sp, idx) => {
        const t = h('div', { class: 'spot', 'data-drop': String(idx), style: `left:${sp.x}%;top:${sp.y}%` }, '?');
        board.append(t);
        return t;
      });
      const words = r.spots.map(sp => sp.answer).concat(r.extra || []);
      const chips = dropGame({
        items: words, targets, tapHint: 'Now tap the ? where it goes!',
        makeChip: w => h('div', null, w),
        check: (chip, t) => !t.classList.contains('filled') && r.spots[+t.dataset.drop].answer === chip._it,
        onRight(chip, t) {
          const idx = t.dataset.drop;
          t.textContent = chip._it; t.classList.add('filled'); t.removeAttribute('data-drop');
          chip.remove();
          sfx.good(); award(key + ':' + idx, t); say(praise());
          if (++placed === r.spots.length) done();
        },
        onWrong() { say(r.hint || oops()); },
      });
      return h('div', { class: 'game label' }, board,
        h('div', { class: 'tray-wrap' },
          h('div', { class: 'tray-label' }, '👇 Drag each label onto a ? (or tap it, then tap the ?)'),
          h('div', { class: 'tray' }, chips)));
    },

    match(r, key, done) {
      let sel = null, matched = 0;
      const colors = ['#ffe66b', '#b9f29a', '#a8dcff', '#ffc2e2', '#d6c4ff', '#ffcf99', '#9ff2e6'];
      const mk = (idx, side) => {
        const b = h('button', { class: 'match-item', type: 'button', html: r.html ? r.pairs[idx][side] : fmt(r.pairs[idx][side], false) });
        b._idx = idx; b._side = side;
        b.addEventListener('click', () => choose(b));
        return b;
      };
      const idxs = r.pairs.map((_, i) => i);
      const left = (r.shuffleLeft === false ? idxs : shuffle(idxs)).map(i => mk(i, 'a'));
      const right = shuffle(idxs).map(i => mk(i, 'b'));
      function choose(b) {
        if (b.classList.contains('matched')) return;
        if (!sel || sel._side === b._side) {
          if (sel) sel.classList.remove('selected');
          sel = sel === b ? null : b;
          if (sel) { sel.classList.add('selected'); sfx.tap(); say(sel._side === 'a' ? 'Now tap its partner on the right!' : 'Now tap its partner on the left!'); }
          return;
        }
        const a = sel; sel = null; a.classList.remove('selected');
        const [pa, pb] = a._side === 'a' ? [a, b] : [b, a];
        if (r.pairs[pa._idx].b === r.pairs[pb._idx].b) {
          const c = colors[matched % colors.length];
          [pa, pb].forEach(x => { x.classList.add('matched'); x.style.background = c; x.disabled = true; });
          sfx.good(); award(key + ':' + pa._idx, pb); say(praise());
          if (++matched === r.pairs.length) done();
        } else {
          shake(a); shake(b); sfx.bad(); say(r.hint || oops());
        }
      }
      return h('div', { class: 'game match' },
        h('div', { class: 'match-grid' },
          h('div', { class: 'match-col left' }, left),
          h('div', { class: 'match-col right' }, right)));
    },

    // Tap the items into the numbered boxes in order. r.ends: labels for the two ends (default FIRST / LAST),
    // e.g. ['MOST friction', 'LEAST friction'] or ['SHORTEST', 'LONGEST']. r.start: true puts the first item in already.
    order(r, key, done, hooks = {}) {
      let n = r.start ? 1 : 0;
      const ends = r.ends || ['FIRST', 'LAST'];
      const slots = r.items.map((t, k) => h('li', null,
        h('span', { class: 'ord-text' }, k < n ? t : '…'),
        (k === 0 || k === r.items.length - 1) && h('span', { class: 'ord-end' }, k === 0 ? ends[0] : ends[1])));
      slots.slice(0, n).forEach(li => li.classList.add('filled', 'given'));
      const point = () => slots.forEach((li, k) => li.classList.toggle('next', k === n));
      const pool = shuffle(r.items.slice(n)).map(t => h('button', {
        class: 'opt', type: 'button', html: fmt(t, false),
        onclick(e) {
          const b = e.currentTarget;
          if (t === r.items[n]) {
            slots[n].querySelector('.ord-text').textContent = t; slots[n].classList.add('filled');
            b.remove();
            if (!hooks.noStars) award(key + ':' + n, slots[n]);
            n++; point();
            if (n === r.items.length) done();
            else if (hooks.quiet) sfx.tap(); else { sfx.good(); say(n === 1 ? 'Great start! What comes next?' : praise()); }
          } else {
            shake(b); sfx.bad();
            if (hooks.wrong) hooks.wrong(b);
            else say(r.hint || (n === 0 ? 'Hmm, what happens first?' : 'What happens next?'));
          }
        },
      }));
      point();
      return h('div', { class: 'game order' },
        h('ol', { class: 'order-list' }, slots),
        h('div', { class: 'tray-label' }, `👇 Tap them in order – start with the ${ends[0].toLowerCase()} one`),
        h('div', { class: 'order-pool' }, pool));
    },

    truefalse(r, key, done) {
      let si = 0;
      const box = h('div', { class: 'game tf' });
      function show() {
        const st = r.statements[si];
        const why = h('div', { class: 'why', hidden: true });
        const nextBtn = h('button', { class: 'btn', type: 'button', hidden: true, onclick() { sfx.tap(); si++; show(); } }, 'Next one ▶');
        const answer = (val, btn, other) => {
          bT.disabled = bF.disabled = true;
          if (val === st.answer) { btn.classList.add('right'); sfx.good(); award(`${key}:${si}`, btn); say(praise()); }
          else { btn.classList.add('wrong'); other.classList.add('right'); shake(btn); sfx.bad(); say('Not this time – read why below!'); }
          if (st.why) { why.innerHTML = (val === st.answer ? '✔ ' : '💡 ') + fmt(st.why, false); why.hidden = false; }
          if (si < r.statements.length - 1) nextBtn.hidden = false; else done();
        };
        const bT = h('button', { class: 'opt', type: 'button', onclick: () => answer(true, bT, bF) }, '✅ True');
        const bF = h('button', { class: 'opt', type: 'button', onclick: () => answer(false, bF, bT) }, '❌ False');
        box.replaceChildren(
          h('div', { class: 'tf-count' }, `${si + 1} of ${r.statements.length}`),
          h('p', { class: 'tf-q', html: fmt(st.text, false) }),
          h('div', { class: 'tf-row' }, bT, bF), why,
          h('div', { class: 'btn-row' }, nextBtn));
      }
      show();
      return box;
    },

    // Proofreader: tap the goblin's wrong word in a sentence, then drag the right word onto it.
    // r.sentences: [{ text, wrong: 'here', fix: 'hear', options: ['hair'], why, hint }] or { text, ok: true, why } (nothing to fix).
    // r.noOk: hide the "No mistakes!" button when every sentence has a mistake.
    fixit(r, key, done) {
      let si = 0;
      const box = h('div', { class: 'game fixit' });
      const bare = w => w.toLowerCase().replace(/^[^a-z']+|[^a-z']+$/gi, '');
      function show() {
        const st = r.sentences[si];
        let slip = false, over = false;
        const tokens = st.text.split(/\s+/);
        const wi = st.ok ? -1 : st.wrongAt != null ? st.wrongAt : tokens.findIndex(t => bare(t) === st.wrong.toLowerCase());
        const why = h('div', { class: 'why', hidden: true });
        const tray = h('div', { class: 'tray' });
        const trayWrap = h('div', { class: 'tray-wrap', hidden: true }, h('div', { class: 'tray-label' }, '👇 Drag the right word onto the red one (or tap it, then tap the red word)'), tray);
        const nextBtn = h('button', { class: 'btn', type: 'button', hidden: true, onclick() { sfx.tap(); si++; show(); } }, 'Next sentence ▶');
        const finish = (el, text) => {
          over = true; sfx.good();
          if (!slip) award(`${key}:${si}`, el);
          say(praise());
          why.innerHTML = '✔ ' + fmt(text || 'Fixed!', false); why.hidden = false;
          okBtn.disabled = true;
          if (si < r.sentences.length - 1) nextBtn.hidden = false; else done();
        };
        const miss = (el, msg) => { slip = true; shake(el); sfx.bad(); say(msg); };
        const words = tokens.map((t, i) => {
          const b = h('button', { class: 'fx-word', type: 'button' }, t);
          b.addEventListener('click', () => {
            if (over || b.classList.contains('found')) return;
            if (i !== wi) return miss(b, st.ok ? 'Look again – is anything really wrong in this sentence?' : st.hint || 'That word is fine. Read the sentence aloud – which word has the wrong meaning?');
            sfx.zap(); b.classList.add('found'); b.setAttribute('data-drop', 'fix');
            say('Found it! Now drag the right word onto it.');
            const chips = dropGame({
              items: [st.fix, ...(st.options || []).filter(o => o !== st.fix)], targets: [b], tapHint: 'Now tap the red word to swap it!',
              makeChip: w => h('div', null, w),
              check: chip => chip._it === st.fix,
              onRight(chip) {
                const [, pre, post] = t.match(/^([^a-z']*)[a-z']+(.*)$/i) || [, '', ''];
                const cap = /^[^a-z]*[A-Z]/.test(t) ? st.fix[0].toUpperCase() + st.fix.slice(1) : st.fix;
                b.textContent = pre + cap + post; b.classList.remove('found'); b.classList.add('fixed'); b.removeAttribute('data-drop');
                trayWrap.hidden = true;
                finish(b, st.why);
              },
              onWrong(chip) { slip = true; say(st.hint || `"${chip._it}" doesn't fit here. Think about what the word means!`); },
            });
            put(tray, chips); trayWrap.hidden = false;
          });
          return b;
        });
        const okBtn = h('button', { class: 'btn ghost', type: 'button', hidden: !!r.noOk, onclick() {
          if (over) return;
          if (st.ok) finish(okBtn, st.why || 'Every word is right!');
          else miss(okBtn, 'Hmm – a sneaky mistake is hiding in here. Hunt for it!');
        } }, '✔ No mistakes!');
        put(box,
          h('div', { class: 'tf-count' }, `${si + 1} of ${r.sentences.length}`),
          h('div', { class: 'fx-label' }, st.ok ? '🔍 Is there a mistake?' : '🔍 Tap the wrong word'),
          h('p', { class: 'fx-sentence' }, words),
          trayWrap, why,
          h('div', { class: 'btn-row' }, okBtn, nextBtn));
        box._test = { words, okBtn, tray, get over() { return over; }, next: () => nextBtn.click() };
      }
      show();
      return box;
    },

    // Read a picture / table, then answer questions about it.
    questions(r, key, done) {
      const area = h('div');
      runQuestions(area, r.questions, { key, done: () => done(), lastLabel: 'Done ✔' });
      return h('div', { class: 'game questions' },
        r.pic && pic(r.pic, 'data-pic'),
        r.html && h('div', { class: 'data-box', html: r.html }),
        area);
    },

    // Word hunt: find the hidden words. Drag across a word, or tap its first letter then its last letter.
    wordsearch(r, key, done) {
      const words = r.words.map(w => (typeof w === 'string' ? { word: w } : w))
        .map(w => Object.assign({}, w, { word: w.word.toUpperCase().replace(/[^A-Z]/g, '') }));
      const size = Math.max(r.size || 10, ...words.map(w => w.word.length));
      const { grid, placed } = buildWordsearch(words, size, r.diagonal);
      let found = 0, start = null, anchor = null, sel = [];
      const cellEls = [];
      const gridEl = h('div', { class: 'ws-grid', style: `--n:${size}`, 'aria-label': 'Word hunt grid' });
      grid.forEach((row, y) => row.forEach((ch, x) => {
        const c = h('div', { class: 'ws-cell' }, ch);
        c._x = x; c._y = y;
        cellEls.push(c); gridEl.append(c);
      }));
      const cellAt = (x, y) => cellEls[y * size + x];
      const listItems = placed.map(p => h('li', null, p.emoji && h('span', null, p.emoji + ' '), p.clue ? h('span', { html: fmt(p.clue, false) }) : p.word));
      const colors = ['#ffe66b', '#b9f29a', '#a8dcff', '#ffc2e2', '#d6c4ff', '#ffcf99', '#9ff2e6', '#ff9f9f'];

      const lineCells = (a, b) => {
        const dx = Math.sign(b._x - a._x), dy = Math.sign(b._y - a._y);
        const len = Math.max(Math.abs(b._x - a._x), Math.abs(b._y - a._y));
        const straight = a._x === b._x || a._y === b._y || Math.abs(b._x - a._x) === Math.abs(b._y - a._y);
        if (!straight) return [a];
        return Array.from({ length: len + 1 }, (_, k) => cellAt(a._x + dx * k, a._y + dy * k));
      };
      const paint = cells => { sel.forEach(c => c.classList.remove('sel')); sel = cells; sel.forEach(c => c.classList.add('sel')); };
      function check(cells) {
        const str = cells.map(c => c.textContent).join('');
        const hit = placed.findIndex(p => !p.found && (p.word === str || p.word === [...str].reverse().join('')) && p.cells.length === cells.length);
        paint([]);
        if (cells.length < 2) return;
        if (hit < 0) { sfx.bad(); say(r.hint || 'Not a hidden word – keep hunting!'); return; }
        const p = placed[hit]; p.found = true;
        const col = colors[found % colors.length];
        cells.forEach(c => { c.classList.add('found'); c.style.background = col; });
        listItems[hit].classList.add('done');
        sfx.good(); award(`${key}:${p.word}`, cells[cells.length - 1]); say(`You found ${p.word}! ${praise()}`);
        if (++found === placed.length) done();
      }
      const cellFromPoint = (x, y) => { const t = document.elementFromPoint(x, y); return t && t.classList.contains('ws-cell') && gridEl.contains(t) ? t : null; };
      gridEl.addEventListener('pointerdown', e => {
        const c = cellFromPoint(e.clientX, e.clientY);
        if (!c) return;
        e.preventDefault();
        try { gridEl.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        start = c; paint(anchor ? lineCells(anchor, c) : [c]);
      });
      gridEl.addEventListener('pointermove', e => {
        if (!start) return;
        const c = cellFromPoint(e.clientX, e.clientY);
        if (c && c !== start) { anchor = null; paint(lineCells(start, c)); }
      });
      const finish = e => {
        if (!start) return;
        const end = (e.type === 'pointerup' && cellFromPoint(e.clientX, e.clientY)) || sel[sel.length - 1] || start;
        if (end === start) {
          // a tap: first tap marks the start, second tap finishes the line
          if (anchor && anchor !== end) { check(lineCells(anchor, end)); anchor = null; }
          else if (anchor === end) { anchor = null; paint([]); }
          else { anchor = end; paint([end]); sfx.tap(); say('Now tap the LAST letter of the word!'); }
        } else check(lineCells(start, end));
        start = null;
      };
      gridEl.addEventListener('pointerup', finish);
      gridEl.addEventListener('pointercancel', finish);
      return h('div', { class: 'game wordsearch' },
        h('div', { class: 'ws-wrap' },
          h('div', { class: 'ws-board' }, gridEl),
          h('div', { class: 'panel-inner ws-list' },
            h('h3', null, `🔎 Find ${placed.length} words`),
            h('ul', null, listItems),
            h('p', { class: 'ws-tip' }, 'Drag across a word – or tap its first letter, then its last letter.'))));
    },

    // Crossword: tap a clue (or a square), then type with the letter keys.
    crossword(r, key, done) {
      const cw = buildCrossword(r.entries);
      let cur = null, pos = 0, solvedCount = 0;
      const cells = {}; // "x,y" -> { el, letter, val, locked, words: [] }
      const gridEl = h('div', { class: 'cw-grid', style: `--w:${cw.w};--h:${cw.h}` });
      for (let y = 0; y < cw.h; y++) for (let x = 0; x < cw.w; x++) {
        const k = x + ',' + y, letter = cw.grid[k];
        if (!letter) { gridEl.append(h('div', { class: 'cw-cell blank' })); continue; }
        const num = cw.numbers[k];
        const val = h('span', { class: 'cw-val' });
        const el = h('div', { class: 'cw-cell' }, num && h('span', { class: 'cw-num' }, num), val);
        cells[k] = { el, val, letter, locked: false, words: [] };
        el.addEventListener('click', () => {
          const ws = cells[k].words;
          const w = ws.length > 1 && cur && ws.includes(cur) ? ws.find(o => o !== cur) : (ws.find(o => !o.solved) || ws[0]);
          select(w, w.cells.indexOf(k));
        });
        gridEl.append(el);
      }
      cw.words.forEach(w => w.cells.forEach(k => cells[k].words.push(w)));
      const clueBtn = w => {
        w.btn = h('button', { class: 'cw-clue', type: 'button', onclick: () => select(w) },
          h('b', null, w.num + '. '), h('span', { html: fmt(w.clue, false) }), ` (${w.answer.length})`);
        return h('li', null, w.btn);
      };
      const across = cw.words.filter(w => w.dir === 'across').sort((a, b) => a.num - b.num);
      const down = cw.words.filter(w => w.dir === 'down').sort((a, b) => a.num - b.num);
      const banner = h('div', { class: 'cw-banner' }, '👆 Tap a clue or a square to start');
      const hintBtn = h('button', { class: 'btn gold', type: 'button', onclick: hint }, '💡 Hint');

      function select(w, at) {
        if (!w) return;
        cur = w;
        Object.values(cells).forEach(c => c.el.classList.remove('active', 'cursor'));
        cw.words.forEach(o => o.btn.classList.toggle('active', o === w));
        w.cells.forEach(k => cells[k].el.classList.add('active'));
        pos = at != null && at >= 0 ? at : 0;
        moveCursor(0);
        put(banner, h('b', null, `${w.num} ${w.dir === 'across' ? 'Across ➡' : 'Down ⬇'}: `), h('span', { html: fmt(w.clue, false) }), ` (${w.answer.length} letters)`);
        sfx.tap();
      }
      function moveCursor(step) {
        if (!cur) return;
        pos = Math.min(Math.max(pos + step, 0), cur.cells.length - 1);
        Object.values(cells).forEach(c => c.el.classList.remove('cursor'));
        cells[cur.cells[pos]].el.classList.add('cursor');
      }
      // Works whether the child types the whole word (solved squares are stepped over when the letter matches)
      // or only the missing letters (they skip ahead to the next empty square).
      function type(ch) {
        if (!cur || cur.solved) return;
        let c = cells[cur.cells[pos]];
        if (c.locked && c.letter !== ch) {
          while (pos < cur.cells.length - 1 && cells[cur.cells[pos]].locked) pos++;
          c = cells[cur.cells[pos]];
        }
        if (!c.locked) c.val.textContent = ch;
        sfx.tap();
        if (cur.cells.every(k => cells[k].val.textContent)) checkWord(cur);
        else moveCursor(1);
      }
      function back() {
        if (!cur) return;
        const c = cells[cur.cells[pos]];
        if (!c.locked && c.val.textContent) { c.val.textContent = ''; return; }
        moveCursor(-1);
        const p = cells[cur.cells[pos]];
        if (!p.locked) p.val.textContent = '';
      }
      function checkWord(w) {
        const guess = w.cells.map(k => cells[k].val.textContent).join('');
        if (guess === w.answer) {
          w.solved = true; solvedCount++; w.btn.classList.add('done');
          w.cells.forEach(k => { cells[k].locked = true; cells[k].el.classList.add('solved'); });
          sfx.good(); award(`${key}:${w.answer}`, cells[w.cells[w.cells.length - 1]].el); say(`${w.answer} – ${praise()}`);
          if (solvedCount === cw.words.length) { put(banner, '🎉 Crossword complete!'); done(); return; }
          // a crossing word might now be complete too
          const full = cw.words.find(o => !o.solved && o.cells.every(k => cells[k].val.textContent));
          if (full) { checkWord(full); return; }
          select(cw.words.find(o => !o.solved));
        } else {
          w.cells.forEach(k => { shake(cells[k].el); if (!cells[k].locked) cells[k].el.classList.add('wrong'); });
          sfx.bad(); say(r.hint || 'Not quite – read the clue again, or press 💡 Hint!');
          setTimeout(() => w.cells.forEach(k => { cells[k].el.classList.remove('wrong'); if (!cells[k].locked) cells[k].val.textContent = ''; }), 700);
          pos = 0; moveCursor(0);
        }
      }
      function hint() {
        const w = cur && !cur.solved ? cur : cw.words.find(o => !o.solved);
        if (!w) return;
        if (w !== cur) select(w);
        const k = w.cells.find(c => !cells[c].locked && cells[c].val.textContent !== cells[c].letter);
        if (!k) return;
        const c = cells[k];
        c.val.textContent = c.letter; c.locked = true; c.el.classList.add('given');
        sfx.tap(); say('Here is a letter to help you!');
        if (w.cells.every(o => cells[o].val.textContent)) checkWord(w); else moveCursor(0);
      }
      const keys = h('div', { class: 'cw-keys' }, ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'].map((row, ri) => h('div', { class: 'cw-row' },
        [...row].map(ch => h('button', { class: 'cw-key', type: 'button', onclick: () => type(ch) }, ch)),
        ri === 2 && h('button', { class: 'cw-key wide', type: 'button', onclick: back, 'aria-label': 'Delete' }, '⌫'))));
      const root = h('div', { class: 'game crossword' },
        h('div', { class: 'cw-wrap' },
          h('div', { class: 'cw-board' }, gridEl),
          h('div', { class: 'panel-inner cw-clues' },
            across.length > 0 && [h('h3', null, '➡ Across'), h('ol', null, across.map(clueBtn))],
            down.length > 0 && [h('h3', null, '⬇ Down'), h('ol', null, down.map(clueBtn))])),
        banner, keys, h('div', { class: 'btn-row' }, hintBtn));
      const onKey = e => {
        if (!root.isConnected) { document.removeEventListener('keydown', onKey); return; }
        if (e.ctrlKey || e.metaKey || e.altKey || document.activeElement && document.activeElement.tagName === 'INPUT') return;
        if (/^[a-z]$/i.test(e.key)) { e.preventDefault(); type(e.key.toUpperCase()); }
        else if (e.key === 'Backspace') { e.preventDefault(); back(); }
        else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') moveCursor(1);
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') moveCursor(-1);
      };
      document.addEventListener('keydown', onKey);
      setTimeout(() => select(across[0] || down[0]), 0);
      return root;
    },
  };

  // Teach the robot: the child labels training examples, then judges the robot's guesses on new things.
  // The robot guesses by finding the taught example with the most matching features (a tiny "nearest neighbour" AI).
  GAMES.trainai = function (r, key, done) {
    const box = h('div', { class: 'game trainai' });
    const memory = [];
    const memEl = h('div', { class: 'ai-memory' });
    const labelOf = id => r.labels[id] || id;
    const feats = it => r.features.map(f => h('span', { class: 'ai-feat' }, `${f}: ${it[f]}`));
    const memPanel = () => h('div', { class: 'panel-inner ai-mem-panel' },
      h('h3', null, `🧠 ${M.name}'s memory (training data)`), memEl);
    function drawMemory() {
      put(memEl, memory.length ? memory.map(m => h('div', { class: 'ai-mem-row' },
        h('span', { class: 'ai-emoji' }, m.emoji), feats(m), h('b', null, '→ ' + labelOf(m.label))))
        : h('p', { class: 'ai-empty' }, 'Empty! Teach me some examples…'));
    }
    function guess(it) {
      let best = null;
      memory.forEach(m => {
        const same = r.features.filter(f => m[f] === it[f]);
        if (!best || same.length > best.same.length) best = { m, same };
      });
      return best;
    }

    // Phase 1: teaching
    let ti = 0;
    function teach() {
      const it = r.train[ti];
      const btns = Object.keys(r.labels).map(id => h('button', {
        class: 'opt', type: 'button',
        onclick(e) {
          if (id !== it.label) {
            shake(e.currentTarget); sfx.bad();
            say(r.wrongTeach || "Oops! If you teach me the wrong answer, I'll learn the wrong thing!");
            return;
          }
          memory.push(it); drawMemory(); sfx.good(); award(`${key}:t${ti}`, e.currentTarget);
          say(`Saved to my memory: ${it.name} = ${labelOf(id)}!`);
          ti++;
          if (ti < r.train.length) teach(); else testIntro();
        },
      }, labelOf(id)));
      put(box,
        h('div', { class: 'ai-phase' }, `STEP 1: TEACH ME · example ${ti + 1} of ${r.train.length}`),
        h('div', { class: 'ai-card' }, h('div', { class: 'ai-big' }, it.emoji), h('div', { class: 'ai-name' }, it.name), h('div', null, feats(it))),
        h('p', { class: 'instr' }, 'What is it? Tap the right label to teach me:'),
        h('div', { class: 'opts' }, btns),
        memPanel());
      drawMemory();
    }

    // Phase 2: testing
    function testIntro() {
      sfx.win();
      say("Training complete! Now I'll guess some NEW things. You decide if I'm right!");
      put(box,
        h('div', { class: 'ai-phase' }, 'TRAINING COMPLETE!'),
        h('p', { class: 'lead' }, `${M.name} has learned from ${memory.length} examples. Now let's test the AI on things it has never seen before…`),
        memPanel(),
        h('div', { class: 'btn-row' }, h('button', { class: 'btn big green ready', type: 'button', onclick: () => test(0) }, '🧪 Test the AI!')));
      drawMemory();
    }
    function test(qi) {
      const it = r.test[qi];
      const g = guess(it);
      const robotRight = g.m.label === it.is;
      const why = h('div', { class: 'why', hidden: true });
      const nextBtn = h('button', { class: 'btn', type: 'button', hidden: true, onclick() { sfx.tap(); if (qi + 1 < r.test.length) test(qi + 1); else done(); } },
        qi + 1 < r.test.length ? 'Next test ▶' : 'Finish ✔');
      const judge = (sayRight, btn) => {
        bY.disabled = bN.disabled = true;
        const correct = sayRight === robotRight;
        if (correct) { btn.classList.add('right'); sfx.good(); award(`${key}:j${qi}`, btn); say(praise()); }
        else { btn.classList.add('wrong'); shake(btn); sfx.bad(); say('Look again – what is it REALLY?'); }
        why.innerHTML = (robotRight ? `✅ ${M.name} was RIGHT. ` : `❌ ${M.name} was WRONG – it's ${esc(it.truth || labelOf(it.is))}! `) + fmt(it.why || '', false);
        why.hidden = false; nextBtn.hidden = false;
      };
      const bY = h('button', { class: 'opt', type: 'button', onclick: e => judge(true, e.currentTarget) }, `✅ ${M.name} is right`);
      const bN = h('button', { class: 'opt', type: 'button', onclick: e => judge(false, e.currentTarget) }, `❌ ${M.name} is wrong`);
      put(box,
        h('div', { class: 'ai-phase' }, `STEP 2: TEST THE AI · ${qi + 1} of ${r.test.length}`),
        h('div', { class: 'ai-card' }, h('div', { class: 'ai-big' }, it.emoji), h('div', { class: 'ai-name' }, 'New thing!'), h('div', null, feats(it))),
        h('div', { class: 'ai-think' },
          h('div', null, `🤖 Thinking… ${g.same.length ? 'it has the same ' + g.same.join(' and ') + ' as my ' + g.m.name : 'nothing matches, so I will just guess'}…`),
          h('div', { class: 'ai-guess' }, `I'm SURE it's: ${labelOf(g.m.label).toUpperCase()}!`)),
        h('p', { class: 'instr' }, `Is ${M.name} right?`),
        h('div', { class: 'tf-row' }, bY, bN), why,
        h('div', { class: 'btn-row' }, nextBtn));
      say('Hmm, let me check my memory…');
    }

    teach();
    return box;
  };

  // ---------- pixel art editor (shared by the pixelcopy + pixelstudio games) ----------
  const DEFAULT_PALETTE = [
    ['#1b1b1b', 'black'], ['#ffffff', 'white'], ['#c6c6c6', 'light grey'], ['#6f6f6f', 'dark grey'],
    ['#e53935', 'red'], ['#ff8c1a', 'orange'], ['#ffd43b', 'yellow'], ['#7cfc3a', 'lime'],
    ['#2e9e3e', 'green'], ['#2ee6d6', 'aqua'], ['#1e6fd9', 'blue'], ['#1f2a6b', 'navy'],
    ['#8e5cff', 'purple'], ['#ff7eb6', 'pink'], ['#8a5a32', 'brown'], ['#f2c79b', 'peach'],
  ];
  function pixelEditor({ w, h: rows, palette = DEFAULT_PALETTE, mirror = false, mirrorToggle = true, onStroke }) {
    let cells = Array(w * rows).fill(null), color = palette[0][0], tool = 'pencil', mirrorOn = mirror;
    const undo = [];
    const cellEls = [];
    const grid = h('div', { class: 'px-grid', style: `--w:${w};--h:${rows}`, 'aria-label': 'Drawing grid' });
    for (let i = 0; i < w * rows; i++) { const c = h('div', { class: 'px-cell' }); cellEls.push(c); grid.append(c); }
    const mirrorLine = h('div', { class: 'px-mirror-line', hidden: !mirrorOn });
    const draw = () => cells.forEach((c, i) => { cellEls[i].style.background = c || ''; cellEls[i].classList.toggle('empty', !c); });
    const setCell = (x, y, c) => {
      if (x < 0 || y < 0 || x >= w || y >= rows) return;
      cells[y * w + x] = c;
      if (mirrorOn) cells[y * w + (w - 1 - x)] = c;
    };
    const fill = (x, y, c) => {
      const target = cells[y * w + x];
      if (target === c) return;
      const stack = [[x, y]];
      while (stack.length) {
        const [cx, cy] = stack.pop();
        if (cx < 0 || cy < 0 || cx >= w || cy >= rows || cells[cy * w + cx] !== target) continue;
        cells[cy * w + cx] = c;
        stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
      }
    };
    const at = (px, py) => {
      const r = grid.getBoundingClientRect();
      return [Math.floor((px - r.left) / r.width * w), Math.floor((py - r.top) / r.height * rows)];
    };
    let last = null, painting = false;
    const paintTo = ([x, y]) => {
      const c = tool === 'eraser' ? null : color;
      // fill in any squares skipped by a quick finger swipe
      const [x0, y0] = last || [x, y];
      const steps = Math.max(Math.abs(x - x0), Math.abs(y - y0), 1);
      for (let k = 0; k <= steps; k++) setCell(Math.round(x0 + (x - x0) * k / steps), Math.round(y0 + (y - y0) * k / steps), c);
      last = [x, y]; draw();
    };
    grid.addEventListener('pointerdown', e => {
      e.preventDefault();
      const p = at(e.clientX, e.clientY);
      if (p[0] < 0 || p[1] < 0 || p[0] >= w || p[1] >= rows) return;
      undo.push(cells.slice()); if (undo.length > 50) undo.shift();
      if (tool === 'fill') { fill(p[0], p[1], color); draw(); sfx.tap(); if (onStroke) onStroke(); return; }
      try { grid.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      painting = true; last = null; paintTo(p); sfx.tap();
    });
    grid.addEventListener('pointermove', e => { if (painting) paintTo(at(e.clientX, e.clientY)); });
    const end = () => { if (!painting) return; painting = false; last = null; if (onStroke) onStroke(); };
    grid.addEventListener('pointerup', end);
    grid.addEventListener('pointercancel', end);

    const swatches = palette.map(([c, name]) => h('button', {
      class: 'px-swatch', type: 'button', title: name, 'aria-label': name, style: `background:${c}`,
      onclick(e) { color = c; if (tool === 'eraser') setTool('pencil'); swatches.forEach(s => s.classList.remove('on')); e.currentTarget.classList.add('on'); sfx.tap(); },
    }));
    swatches[0].classList.add('on');
    const toolBtns = {};
    const setTool = t => { tool = t; Object.entries(toolBtns).forEach(([k, b]) => b.classList.toggle('on', k === t)); };
    const mkTool = (id, label) => (toolBtns[id] = h('button', { class: 'px-tool', type: 'button', onclick() { setTool(id); sfx.tap(); } }, label));
    const mirrorBtn = mirrorToggle && h('button', {
      class: 'px-tool' + (mirrorOn ? ' on' : ''), type: 'button',
      onclick(e) { mirrorOn = !mirrorOn; e.currentTarget.classList.toggle('on', mirrorOn); mirrorLine.hidden = !mirrorOn; sfx.tap(); say(mirrorOn ? 'Mirror ON – whatever you draw on one side appears on the other!' : 'Mirror off.'); },
    }, '🪞 Mirror');
    const tools = h('div', { class: 'px-tools' },
      mkTool('pencil', '✏️ Pencil'), mkTool('fill', '🪣 Fill'), mkTool('eraser', '🧽 Eraser'), mirrorBtn,
      h('button', { class: 'px-tool', type: 'button', onclick() { if (undo.length) { cells = undo.pop(); draw(); sfx.tap(); if (onStroke) onStroke(); } } }, '↶ Undo'),
      h('button', { class: 'px-tool', type: 'button', onclick() { if (!cells.some(Boolean) || confirm('Clear the whole picture?')) { undo.push(cells.slice()); cells.fill(null); draw(); if (onStroke) onStroke(); } } }, '🗑️ Clear'));
    setTool('pencil');
    draw();
    return {
      el: h('div', { class: 'px-editor' }, tools, h('div', { class: 'px-palette' }, swatches), pxAxes(h('div', { class: 'px-board' }, grid, mirrorLine), w, rows)),
      get cells() { return cells; },
      load(c) { undo.push(cells.slice()); cells = c.slice(); draw(); },
      flash(indexes) { indexes.forEach(i => cellEls[i].classList.add('px-wrong')); setTimeout(() => indexes.forEach(i => cellEls[i].classList.remove('px-wrong')), 1600); },
    };
  }
  // Map-style labels round a pixel board: letters along the top (A, B, C…) and numbers down the side (1, 2, 3…),
  // on both the drawing grid and the example, so "row 3, column D" is easy to find on each.
  function pxAxes(board, w, rows) {
    return h('div', { class: 'px-axes', style: `--w:${w};--h:${rows}` },
      h('span', { class: 'px-corner' }),
      h('div', { class: 'px-ax-top', 'aria-hidden': 'true' }, Array.from({ length: w }, (_, i) => h('span', null, String.fromCharCode(65 + i)))),
      h('div', { class: 'px-ax-left', 'aria-hidden': 'true' }, Array.from({ length: rows }, (_, i) => h('span', null, String(i + 1)))),
      board);
  }
  // the example as a grid of squares that looks like the drawing grid (empty squares show the same blue checks)
  function pxExample(rowsT, colors, w) {
    const cells = [];
    rowsT.forEach(row => { for (let x = 0; x < w; x++) { const c = colors[row[x]]; cells.push(h('div', { class: 'px-cell' + (c ? '' : ' empty'), style: c ? `background:${c}` : null })); } });
    return h('div', { class: 'px-grid px-static', style: `--w:${w};--h:${rowsT.length}`, role: 'img', 'aria-label': 'The picture to copy' }, cells);
  }
  // Pixel art → PNG data URL (transparent background)
  function pixelPNG(cells, w, rows, scale = 24) {
    const c = document.createElement('canvas');
    c.width = w * scale; c.height = rows * scale;
    const ctx = c.getContext('2d');
    cells.forEach((col, i) => { if (col) { ctx.fillStyle = col; ctx.fillRect((i % w) * scale, Math.floor(i / w) * scale, scale, scale); } });
    return c.toDataURL('image/png');
  }
  const GKEY = 'y3:gallery';

  // Copy the picture. The live meter shows the match; tapping "I'm finished!" scores it as a percentage and unlocks the
  // next round, so a perfect copy is a bonus, not a wall. A perfect copy celebrates on its own.
  // r.choices: [{ label, level (1–3), target, colors, names, tips, intro, say, mirror, done }] lets the player pick what to draw.
  GAMES.pixelcopy = function (r, key, done) {
    if (!r.choices) return h('div', { class: 'game pixelcopy' }, pixelCopy(r, key, done));
    let finished = false;
    const finish = () => { if (!finished) { finished = true; done(); } };
    const box = h('div', { class: 'game pixelcopy' });
    const stars = n => '★'.repeat(n) + '☆'.repeat(3 - n);
    const levelOfPic = c => c.level || (c.target.join('').replace(/\./g, '').length > 140 ? 3 : new Set(c.target.join('').replace(/\./g, '')).size > 3 ? 2 : 1);
    function menu() {
      say(r.pick || 'Pick a picture to draw! The more stars, the trickier it is.');
      put(box, h('h3', { class: 'px-pick-title' }, r.pickTitle || '🎨 What would you like to draw?'),
        h('div', { class: 'px-choices' }, r.choices.map((c, ci) => {
          const lv = levelOfPic(c);
          return h('button', { class: 'px-choice', type: 'button', onclick() { sfx.tap(); play(ci); } },
            pic(Pixel.svg(c.target, c.colors), 'px-choice-pic'),
            h('span', { class: 'px-choice-name' }, c.label),
            h('span', { class: 'px-choice-level', 'aria-label': `difficulty ${lv} of 3` }, stars(lv), ' ', ['', 'Easy', 'Medium', 'Tricky'][lv]),
            state.awarded[`${key}:${ci}:perfect`] ? h('span', { class: 'px-choice-done' }, '💯') : state.awarded[`${key}:${ci}:done`] && h('span', { class: 'px-choice-done' }, '✔'));
        })));
    }
    function play(ci) {
      const c = Object.assign({}, r, r.choices[ci]);
      delete c.choices;
      if (c.say) say(c.say);
      put(box, h('div', { class: 'btn-row px-back' }, h('button', { class: 'btn', type: 'button', onclick() { sfx.tap(); menu(); } }, '↩ Pick a different picture')),
        c.intro && h('p', { class: 'instr', html: fmt(c.intro) }),
        pixelCopy(c, `${key}:${ci}`, finish));
    }
    menu();
    return box;
  };
  function pixelCopy(r, key, done) {
    const rowsT = r.target, w = Math.max(...rowsT.map(x => x.length)), rows = rowsT.length;
    const want = [];
    rowsT.forEach(row => { for (let x = 0; x < w; x++) want.push(r.colors[row[x]] || null); });
    const used = [...new Set(want.filter(Boolean))];
    const names = r.names || {};
    const palette = used.map(c => [c, names[c] || 'colour']);
    const meter = h('div', { class: 'px-meter' });
    const result = h('div', { class: 'px-result', hidden: true });
    let submitted = false, perfect = false;
    const wrongIdx = () => want.map((c, i) => (ed.cells[i] || null) === c ? -1 : i).filter(i => i >= 0);
    // accuracy: of all the squares that are painted in the picture OR on your grid, how many are right?
    const accuracy = () => {
      let both = 0, right = 0;
      want.forEach((c, i) => { const mine = ed.cells[i] || null; if (c || mine) { both++; if (mine === c) right++; } });
      return both ? Math.round(right / both * 100) : 0;
    };
    const showMeter = () => {
      const pct = accuracy();
      put(meter, h('div', { class: 'px-meter-bar' }, h('div', { style: `width:${pct}%` })), `Match: ${pct}%`);
      return pct;
    };
    const celebratePerfect = () => {
      if (perfect) return;
      perfect = true; sfx.win(); confetti(80);
      award(key + ':done', meter); award(key + ':perfect', meter);
      showResult(100);
      say(r.done || 'PERFECT COPY! You are a real pixel artist!');
      if (!submitted) { submitted = true; done(); }
    };
    function showResult(pct) {
      const [stars, msg] = pct === 100 ? [3, 'PERFECT! Every square is right!']
        : pct >= 85 ? [3, 'Amazing! Nearly perfect.'] : pct >= 65 ? [2, 'Great job – it really looks like it!']
        : pct >= 40 ? [1, 'Good start! Keep painting to make it match.'] : [0, 'Keep going – paint more of the picture!'];
      result.hidden = false;
      put(result, h('div', { class: 'px-score' }, `${pct}%`),
        h('div', { class: 'px-stars' }, '★'.repeat(stars) + '☆'.repeat(3 - stars)),
        h('p', null, msg),
        pct < 100 && h('p', { class: 'px-result-tip' }, 'You can keep fixing it to reach 100% – or carry on to the next round. Your choice!'));
    }
    const check = () => {
      const pct = showMeter();
      if (pct === 100) celebratePerfect();
      else if (!result.hidden && submitted) result.classList.add('stale');
    };
    const ed = pixelEditor({ w, h: rows, palette, mirror: !!r.mirror, mirrorToggle: true, onStroke: check });
    const hintBtn = h('button', { class: 'btn gold', type: 'button', onclick() { const wr = wrongIdx(); ed.flash(wr); sfx.tap(); const empties = wr.filter(i => !ed.cells[i] || !want[i]).length;
      say(!wr.length ? 'Everything matches!' : `${wr.length} square${wr.length > 1 ? 's need' : ' needs'} fixing – look for the flashing red!` + (empties ? ' Blue-checked squares are empty – they are not white!' : '')); } }, '🔍 Show mistakes');
    const submitBtn = h('button', { class: 'btn', type: 'button', onclick() {
      const pct = showMeter();
      if (!ed.cells.some(Boolean)) { sfx.bad(); say('Paint something first!'); return; }
      result.classList.remove('stale');
      if (pct === 100) { celebratePerfect(); return; }
      showResult(pct);
      if (pct >= 40) { sfx.good(); award(key + ':done', submitBtn); } else sfx.tap();
      say(pct >= 85 ? `${pct}%! Brilliant copying!` : pct >= 40 ? `${pct}% – nice work! Fix the rest for 100%, or move on.` : `${pct}% so far. Want to keep going? You can still move on if you like.`);
      if (!submitted) { submitted = true; done(); }
    } }, "✅ I'm finished!");
    showMeter();
    return h('div', { class: 'px-copy' },
      h('div', { class: 'px-wrap' },
        h('div', { class: 'panel-inner px-target' }, h('h3', null, '🎯 Copy this'), h('div', { class: 'px-target-pic' }, pxAxes(pxExample(rowsT, r.colors, w), w, rows)),
          r.tips && h('ul', { class: 'px-tips' }, r.tips.map(t => h('li', { html: fmt(t, false) })))),
        h('div', null, ed.el, meter, h('div', { class: 'btn-row' }, submitBtn, hintBtn), result)));
  }

  // Mystery word: clues appear one at a time – work the word out as early as you can.
  // r.words: [{ word, clues: [hardest first, usually 3], options (optional: tap one instead of typing), explain }]
  // Solving on clue 1 earns 3 gems, on clue 2 earns 2, after that 1. A wrong guess shows the next clue,
  // and after two wrong guesses the first letter is given.
  GAMES.mystery = function (r, key, done) {
    const box = h('div', { class: 'game mystery' });
    const clean = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '');
    let wi = 0;
    function word() {
      const w = r.words[wi], last = wi === r.words.length - 1;
      let shown = 1, wrongs = 0, solved = false;
      const worth = () => Math.max(1, 4 - shown);
      const clues = h('ol', { class: 'my-clues' });
      const letters = h('div', { class: 'my-letters', 'aria-label': `${w.word.replace(/ /g, '').length} letters` });
      const worthEl = h('div', { class: 'my-worth' });
      const fb = h('div', { class: 'feedback', hidden: true });
      const moreBtn = h('button', { class: 'btn ghost', type: 'button', onclick() { reveal(); } }, '🔍 Another clue');
      const nextBtn = h('button', { class: 'btn', type: 'button', hidden: true, onclick() { sfx.tap(); wi++; word(); } }, 'Next mystery ▶');
      const answer = h('div', { class: 'my-answer' });
      const paint = () => {
        put(clues, w.clues.slice(0, shown).map((t, k) => h('li', { class: k === shown - 1 && !solved ? 'new' : '', html: fmt(t, false) })));
        put(letters, [...w.word].map((ch, k) => h('span', { class: ch === ' ' ? 'gap' : '' }, solved || (k === 0 && wrongs >= 2) ? ch.toUpperCase() : '')));
        worthEl.textContent = solved ? '' : `Solve it now for ${'💎'.repeat(worth())}`;
        moreBtn.disabled = solved || shown >= w.clues.length;
      };
      function reveal() { if (shown < w.clues.length) { shown++; sfx.tap(); paint(); } }
      function win(el) {
        const n = worth();
        solved = true;
        for (let k = 0; k < n; k++) award(`${key}:${wi}:${k}`, el);
        sfx.good(); say(n === 3 ? 'WOW – on the very first clue!' : praise());
        fb.className = 'feedback good'; fb.hidden = false; fb.innerHTML = '✔ ' + fmt(w.explain || `It's **${w.word}**!`, false);
        answer.hidden = true; paint();
        if (last) done(); else nextBtn.hidden = false;
      }
      function miss(el) {
        wrongs++; shake(el); sfx.bad();
        say(shown < w.clues.length ? 'Not that one – here is another clue!' : 'Not quite – look at the letters and try again!');
        if (shown < w.clues.length) reveal(); else paint();
      }
      if (w.options) {
        put(answer, h('div', { class: 'opts' }, shuffle(w.options).map(o => h('button', {
          class: 'opt', type: 'button',
          onclick(e) { const b = e.currentTarget; if (solved) return; if (clean(o) === clean(w.word)) { b.classList.add('right'); win(b); } else { b.classList.add('wrong'); b.disabled = true; miss(b); } },
        }, o))));
      } else {
        const input = h('input', { class: 'q-type', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Your guess', placeholder: 'Type the mystery word' });
        const guess = () => { if (solved || !input.value.trim()) return; if (clean(input.value) === clean(w.word)) { input.classList.add('right'); input.disabled = true; win(input); } else { miss(input); input.select(); } };
        input.addEventListener('keydown', e => { if (e.key === 'Enter') guess(); });
        put(answer, h('div', { class: 'q-type-row' }, input, h('button', { class: 'btn q-check', type: 'button', onclick: guess }, '✔ Guess')));
      }
      put(box,
        r.words.length > 1 && h('div', { class: 'q-count' }, `Mystery word ${wi + 1} of ${r.words.length}`),
        h('div', { class: 'my-card' }, h('div', { class: 'my-head' }, '🕵️ MYSTERY WORD'), letters, clues, h('div', { class: 'btn-row' }, moreBtn), worthEl),
        answer, fb, h('div', { class: 'btn-row' }, nextBtn));
      paint();
      box._test = { guess(t) { const inp = box.querySelector('input.q-type'); if (inp) { inp.value = t; box.querySelector('.q-check').click(); } else [...box.querySelectorAll('.opt')].find(b => b.textContent === t).click(); }, more: reveal, get shown() { return shown; } };
    }
    word();
    return box;
  };

  // Free studio: draw anything; save to the gallery, download as a picture.
  GAMES.pixelstudio = function (r, key, done) {
    const w = r.size || 16, rows = r.size || 16, min = r.minPixels || 30;
    let finished = false;
    const status = h('div', { class: 'px-meter' });
    const count = () => ed.cells.filter(Boolean).length;
    const update = () => {
      const n = count();
      finishBtn.disabled = n < min && !finished;
      put(status, n < min ? `🎨 ${n} squares painted – paint at least ${min} to finish` : `🎨 ${n} squares painted – looking great!`);
    };
    const ed = pixelEditor({ w, h: rows, palette: r.palette, mirror: false, onStroke: update });
    const gallery = h('div', { class: 'px-gallery' });
    const loadGallery = () => store.get(GKEY, []);
    function drawGallery() {
      const items = loadGallery();
      put(gallery, items.length ? items.map((g, gi) => h('div', { class: 'px-thumb' },
        h('img', { src: pixelPNG(g.cells, g.w, g.h, 4), alt: g.title || 'pixel art', title: 'Tap to open', onclick() { ed.load(g.cells); update(); sfx.tap(); } }),
        h('button', { class: 'px-del', type: 'button', 'aria-label': 'Delete', onclick() { if (!confirm('Delete this picture from your gallery?')) return; const all = loadGallery(); all.splice(gi, 1); store.set(GKEY, all); drawGallery(); } }, '✕')))
        : h('p', { class: 'ai-empty' }, 'No pictures yet – your saved art will appear here!'));
    }
    const saveArt = () => {
      if (!count()) { say('Paint something first!'); return false; }
      const all = loadGallery();
      all.unshift({ w, h: rows, cells: ed.cells.slice(), date: Date.now(), title: r.title || 'My art' });
      store.set(GKEY, all.slice(0, 24)); drawGallery();
      return true;
    };
    const download = () => {
      if (!count()) { say('Paint something first!'); return; }
      const a = h('a', { href: pixelPNG(ed.cells, w, rows, 24), download: `pixelkid-${(settings.name || 'art').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png` });
      document.body.append(a); a.click(); a.remove(); sfx.good(); say('Downloading your picture! Ask a grown-up to help you print or share it.');
    };
    const finishBtn = h('button', {
      class: 'btn big green', type: 'button',
      onclick() {
        if (finished) return;
        finished = true; saveArt(); sfx.win(); confetti(120); award(key + ':done', finishBtn); achieve('artist');
        say(r.done || 'WOW! Your masterpiece is saved in your gallery!'); finishBtn.textContent = '✔ Saved!'; done();
      },
    }, "✔ I'm finished!");
    drawGallery(); update();
    return h('div', { class: 'game pixelstudio' },
      r.brief && h('div', { class: 'panel-inner px-brief' }, h('h3', null, r.briefTitle || '📋 Design brief'), h('ol', null, r.brief.map(b => h('li', { html: fmt(b, false) })))),
      ed.el, status,
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', type: 'button', onclick() { if (saveArt()) { sfx.good(); say('Saved to your gallery!'); } } }, '💾 Save to gallery'),
        h('button', { class: 'btn ghost', type: 'button', onclick: download }, '⬇️ Download picture'),
        finishBtn),
      h('div', { class: 'panel-inner px-gallery-wrap' }, h('h3', null, '🖼️ My Gallery'), gallery));
  };

  // ---------- poster editor (graphic design) ----------
  // Elements: { t:'text', text, x, y, size, color, font } · { t:'sticker', emoji, x, y, size } · { t:'shape', shape:'rect'|'circle'|'star', x, y, w, h, color }
  // x / y are the centre in % of the poster; size is a % of the poster width; w / h are % of the width / height.
  const POSTER_FONTS = {
    pixel: { label: 'Pixel', css: '"Pixelify Sans", monospace' },
    clean: { label: 'Clean', css: 'Lexend, system-ui, sans-serif' },
    fun: { label: 'Fun', css: '"Chalkboard SE", "Comic Sans MS", "Marker Felt", cursive' },
    bold: { label: 'Bold', css: '"Arial Black", Impact, "Helvetica Neue", sans-serif' },
  };
  const POSTER_STICKERS = ['⭐', '🎉', '🤖', '🐶', '🐱', '🎮', '🚀', '🎈', '🍕', '🎵', '⚽', '🏆', '🌈', '🦖', '🎂', '🍿', '🎨', '❤️', '👾', '☀️'];
  const POSTER_COLORS = ['#1b1b1b', '#ffffff', '#e53935', '#ff8c1a', '#ffd43b', '#7cfc3a', '#2e9e3e', '#2ee6d6', '#1e6fd9', '#1f2a6b', '#8e5cff', '#ff7eb6', '#8a5a32', '#fff3a8'];
  const lum = hex => {
    const v = hex.replace('#', '').match(/../g).map(x => parseInt(x, 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const PKEY_POSTERS = 'y3:posters';

  function posterPNG(model, W = 600) {
    const H = W * 4 / 3, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = model.bg; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    model.items.forEach(e => {
      const cx = e.x / 100 * W, cy = e.y / 100 * H;
      if (e.t === 'shape') {
        const w = e.w / 100 * W, hh = e.h / 100 * H;
        ctx.fillStyle = e.color; ctx.beginPath();
        if (e.shape === 'circle') ctx.ellipse(cx, cy, w / 2, hh / 2, 0, 0, Math.PI * 2);
        else if (e.shape === 'star') {
          for (let k = 0; k < 10; k++) {
            const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? 0.4 : 1;
            ctx.lineTo(cx + Math.cos(a) * w / 2 * rr, cy + Math.sin(a) * hh / 2 * rr);
          }
        } else ctx.rect(cx - w / 2, cy - hh / 2, w, hh);
        ctx.fill();
      } else {
        const px = e.size / 100 * W;
        const lines = (e.t === 'sticker' ? e.emoji : e.text).split('\n');
        ctx.fillStyle = e.color || '#000';
        ctx.font = e.t === 'sticker' ? `${px}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`
          : `700 ${px}px ${(POSTER_FONTS[e.font] || POSTER_FONTS.clean).css}`;
        lines.forEach((ln, i) => {
          const ly = cy + (i - (lines.length - 1) / 2) * px * 1.15;
          if (!(e.t === 'sticker' && pxDraw(ctx, ln.trim(), cx, ly, px, { baseline: 'middle' }))) ctx.fillText(ln, cx, ly);
        });
      }
    });
    return c.toDataURL('image/png');
  }

  GAMES.poster = function (r, key, done) {
    const clone = o => JSON.parse(JSON.stringify(o));
    let model = clone(r.start || { bg: '#ffffff', items: [] });
    let sel = null, finished = false;
    const posterEl = h('div', { class: 'poster' });
    const elOf = new Map();
    const ticks = {};

    const bgUnder = e => {
      // the colour behind a text: the top-most shape under its centre, otherwise the poster background
      const idx = model.items.indexOf(e);
      for (let i = idx - 1; i >= 0; i--) {
        const s = model.items[i];
        if (s.t === 'shape' && Math.abs(e.x - s.x) <= s.w / 2 && Math.abs(e.y - s.y) <= s.h / 2) return s.color;
      }
      return model.bg;
    };
    const lowContrast = e => e.t === 'text' && contrast(e.color, bgUnder(e)) < 3;
    const AUTO = {
      bigTitle: () => model.items.some(e => e.t === 'text' && e.size >= 10),
      contrast: () => model.items.filter(e => e.t === 'text').length > 0 && !model.items.some(lowContrast),
      clutter: () => model.items.filter(e => e.t === 'sticker').length <= (r.maxStickers || 4),
      picture: () => model.items.some(e => e.t === 'sticker' || e.t === 'shape'),
      inside: () => model.items.every(e => e.x >= 5 && e.x <= 95 && e.y >= 4 && e.y <= 96),
    };

    function renderPoster() {
      posterEl.style.background = model.bg;
      posterEl.replaceChildren();
      elOf.clear();
      model.items.forEach(e => {
        const d = h('div', { class: 'pe pe-' + e.t + (e === sel ? ' sel' : '') });
        d.style.left = e.x + '%'; d.style.top = e.y + '%';
        if (e.t === 'shape') {
          Object.assign(d.style, { width: e.w + '%', height: e.h + '%', background: e.color });
          d.classList.add('pe-' + e.shape);
        } else {
          d.style.fontSize = `calc(${e.size} * 1cqw)`;
          d.textContent = e.t === 'sticker' ? e.emoji : e.text;
          if (e.t === 'text') { d.style.color = e.color; d.style.fontFamily = (POSTER_FONTS[e.font] || POSTER_FONTS.clean).css; }
          if (lowContrast(e)) d.append(h('span', { class: 'pe-warn', title: 'Hard to read!' }, '⚠️'));
        }
        drag(d, e);
        elOf.set(e, d);
        posterEl.append(d);
      });
      renderTools(); renderChecks();
    }
    function drag(d, e) {
      d.addEventListener('pointerdown', ev => {
        ev.preventDefault(); ev.stopPropagation();
        if (sel !== e) { sel = e; renderPoster(); d = elOf.get(e); }
        const rect = posterEl.getBoundingClientRect(), sx = ev.clientX, sy = ev.clientY, ox = e.x, oy = e.y;
        try { d.setPointerCapture(ev.pointerId); } catch (_) { /* ignore */ }
        const move = m => {
          e.x = Math.max(0, Math.min(100, ox + (m.clientX - sx) / rect.width * 100));
          e.y = Math.max(0, Math.min(100, oy + (m.clientY - sy) / rect.height * 100));
          d.style.left = e.x + '%'; d.style.top = e.y + '%';
        };
        const up = () => { d.removeEventListener('pointermove', move); d.removeEventListener('pointerup', up); d.removeEventListener('pointercancel', up); renderPoster(); };
        d.addEventListener('pointermove', move); d.addEventListener('pointerup', up); d.addEventListener('pointercancel', up);
      });
    }
    posterEl.addEventListener('pointerdown', () => { if (sel) { sel = null; renderPoster(); } });

    // ----- toolbar -----
    const tools = h('div', { class: 'pe-tools' });
    const swatchRow = (colors, current, onPick) => h('div', { class: 'pe-swatches' }, colors.map(c => h('button', {
      class: 'px-swatch' + (c === current ? ' on' : ''), type: 'button', style: `background:${c}`, 'aria-label': c,
      onclick() { onPick(c); sfx.tap(); },
    })));
    const add = item => { model.items.push(item); sel = item; sfx.good(); renderPoster(); };
    let trayOpen = false;
    function renderTools() {
      const s = sel;
      const addRow = h('div', { class: 'pe-row' },
        h('b', null, 'Add: '),
        h('button', { class: 'px-tool', type: 'button', onclick: () => add({ t: 'text', text: 'Your text', x: 50, y: 50, size: 8, color: '#1b1b1b', font: 'clean' }) }, '🔤 Text'),
        h('button', { class: 'px-tool' + (trayOpen ? ' on' : ''), type: 'button', onclick() { trayOpen = !trayOpen; renderTools(); } }, '😀 Sticker'),
        h('button', { class: 'px-tool', type: 'button', onclick: () => add({ t: 'shape', shape: 'rect', x: 50, y: 50, w: 80, h: 18, color: '#ffd43b' }) }, '▬ Banner'),
        h('button', { class: 'px-tool', type: 'button', onclick: () => add({ t: 'shape', shape: 'circle', x: 50, y: 50, w: 40, h: 30, color: '#2ee6d6' }) }, '⬤ Circle'),
        h('button', { class: 'px-tool', type: 'button', onclick: () => add({ t: 'shape', shape: 'star', x: 50, y: 50, w: 40, h: 30, color: '#ff8c1a' }) }, '★ Star'));
      const tray = trayOpen && h('div', { class: 'pe-tray' }, (r.stickers || POSTER_STICKERS).map(em => h('button', {
        class: 'pe-sticker', type: 'button', onclick() { trayOpen = false; add({ t: 'sticker', emoji: em, x: 50, y: 50, size: 14 }); },
      }, em)));
      let selPanel;
      if (!s) selPanel = h('p', { class: 'pe-hint' }, '👆 Tap something on the poster to change it. Drag it to move it.');
      else {
        const resize = f => { if (s.t === 'shape') { s.w = Math.max(5, Math.min(100, s.w * f)); s.h = Math.max(4, Math.min(100, s.h * f)); } else s.size = Math.max(2, Math.min(40, Math.round(s.size * f * 10) / 10)); sfx.tap(); renderPoster(); };
        const textIn = s.t === 'text' && h('input', { class: 'pe-input', type: 'text', value: s.text, maxlength: '40', 'aria-label': 'Edit text' });
        if (textIn) textIn.addEventListener('input', () => { s.text = textIn.value || ' '; const d = elOf.get(s); if (d) d.firstChild.textContent = s.text; renderChecks(); });
        selPanel = h('div', { class: 'pe-sel' },
          h('div', { class: 'pe-row' }, h('b', null, s.t === 'text' ? 'Text: ' : s.t === 'sticker' ? 'Sticker: ' : 'Shape: '),
            h('button', { class: 'px-tool', type: 'button', onclick: () => resize(1 / 1.2) }, '➖ Smaller'),
            h('button', { class: 'px-tool', type: 'button', onclick: () => resize(1.2) }, '➕ Bigger'),
            h('button', { class: 'px-tool', type: 'button', onclick() { model.items.splice(model.items.indexOf(s), 1); model.items.push(s); sfx.tap(); renderPoster(); } }, '⬆️ Front'),
            h('button', { class: 'px-tool', type: 'button', onclick() { model.items.splice(model.items.indexOf(s), 1); sel = null; sfx.tap(); renderPoster(); } }, '🗑️ Delete')),
          textIn && h('div', { class: 'pe-row' }, textIn),
          s.t === 'text' && h('div', { class: 'pe-row' }, h('b', null, 'Font: '), Object.entries(POSTER_FONTS).map(([id, f]) => h('button', {
            class: 'px-tool' + (s.font === id ? ' on' : ''), type: 'button', style: `font-family:${f.css}`, onclick() { s.font = id; sfx.tap(); renderPoster(); },
          }, f.label))),
          s.t !== 'sticker' && h('div', { class: 'pe-row' }, h('b', null, 'Colour: '), swatchRow(r.colors || POSTER_COLORS, s.color, c => { s.color = c; renderPoster(); })),
          lowContrast(s) && h('p', { class: 'pe-warn-text' }, '⚠️ Hard to read! Pick a colour that stands out from what is behind it.'));
      }
      put(tools, addRow, tray, selPanel,
        h('div', { class: 'pe-row' }, h('b', null, 'Background: '), swatchRow(r.colors || POSTER_COLORS, model.bg, c => { model.bg = c; renderPoster(); })));
    }

    // ----- checklist -----
    const checksEl = h('div', { class: 'panel-inner pe-checks' });
    const finishBtn = h('button', {
      class: 'btn big green', type: 'button',
      onclick() {
        if (finished) return;
        finished = true; sel = null; renderPoster(); savePoster();
        sfx.win(); confetti(120); award(key + ':done', finishBtn); achieve('designer');
        say(r.done || 'WOW! That is a real designer\'s poster! It is saved in your gallery.');
        finishBtn.textContent = '✔ Saved!'; done();
      },
    }, "✔ I'm finished!");
    function renderChecks() {
      let all = true;
      const list = (r.checklist || []).map((c, i) => {
        const auto = c.auto && AUTO[c.auto];
        const ok = auto ? auto() : !!ticks[i];
        if (!ok) all = false;
        return h('li', { class: ok ? 'ok' : '' },
          auto ? h('span', { class: 'pe-box' }, ok ? '✅' : '⬜')
            : h('button', { class: 'pe-box', type: 'button', onclick() { ticks[i] = !ticks[i]; sfx.tap(); renderChecks(); } }, ok ? '✅' : '⬜'),
          h('span', { html: fmt(c.text, false) }), auto && h('small', null, ' (auto-check)'));
      });
      const enough = model.items.length >= (r.minItems || 3);
      finishBtn.disabled = !finished && !(all && enough);
      put(checksEl, h('h3', null, r.checkTitle || '✅ Designer checklist'), h('ul', null, list),
        !enough && h('p', { class: 'pe-hint' }, `Add at least ${r.minItems || 3} things to your poster.`));
    }

    // ----- gallery -----
    const gallery = h('div', { class: 'px-gallery' });
    function drawGallery() {
      const items = store.get(PKEY_POSTERS, []);
      put(gallery, items.length ? items.map((m, gi) => h('div', { class: 'px-thumb pe-thumb' },
        h('img', { src: posterPNG(m, 150), alt: 'poster', title: 'Tap to open', onclick() { model = clone(m); sel = null; renderPoster(); sfx.tap(); } }),
        h('button', { class: 'px-del', type: 'button', 'aria-label': 'Delete', onclick() { if (!confirm('Delete this poster?')) return; const all = store.get(PKEY_POSTERS, []); all.splice(gi, 1); store.set(PKEY_POSTERS, all); drawGallery(); } }, '✕')))
        : h('p', { class: 'ai-empty' }, 'No posters yet – your saved posters will appear here!'));
    }
    const savePoster = () => {
      const all = store.get(PKEY_POSTERS, []);
      all.unshift(clone(model)); store.set(PKEY_POSTERS, all.slice(0, 12)); drawGallery();
    };
    const download = () => {
      sel = null; renderPoster();
      const a = h('a', { href: posterPNG(model, 900), download: `pixelkid-poster-${(settings.name || 'design').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png` });
      document.body.append(a); a.click(); a.remove(); sfx.good(); say('Downloading your poster! Ask a grown-up to help you print it.');
    };

    renderPoster(); drawGallery();
    return h('div', { class: 'game poster-game' },
      r.brief && h('div', { class: 'panel-inner px-brief' }, h('h3', null, r.briefTitle || '📋 Design brief'), h('ol', null, r.brief.map(b => h('li', { html: fmt(b, false) })))),
      h('div', { class: 'pe-wrap' }, h('div', { class: 'pe-stage' }, posterEl), h('div', null, tools, checksEl)),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', type: 'button', onclick() { savePoster(); sfx.good(); say('Saved to your gallery!'); } }, '💾 Save to gallery'),
        h('button', { class: 'btn ghost', type: 'button', onclick: download }, '⬇️ Download poster'),
        finishBtn),
      h('div', { class: 'panel-inner px-gallery-wrap' }, h('h3', null, '🖼️ My Posters'), gallery));
  };

  // ===== Spell test: hear (or look at) a word, then spell it on the pixel keyboard =====
  // r.words: [{ word, sentence ('… ___ …', read aloud with the word filled in), clue, hint, wrong (mode 'fix'), emoji }]
  // r.mode: 'listen' (default: hear the word and a sentence) | 'peek' (look, cover, write, check) | 'fix' (correct a misspelt word)
  // r.scene: 'potion' (default: each word adds an ingredient to a cauldron) | 'egg' (each word cracks a dragon egg)
  //   | 'castle' (each word builds a row of a castle tower) | 'rocket' (each word fuels a rocket, which blasts off at the end)
  // r.prize: the name of the finished potion / dragon. First-try spellings earn a gem; two misses show the word to copy.
  const SP_LIQUID = ['#7cfc3a', '#2ee6d6', '#b44dff', '#ff7eb6', '#ffb800', '#4fc3ff'];
  function cauldronSVG(p, n) {
    const fill = Math.round(p * 6), col = SP_LIQUID[n % SP_LIQUID.length];
    const rows = [
      '.kkkkkkkkkkkkkk.', 'kiiiiiiiiiiiiiik', '.kDDDDDDDDDDDDk.', '.kDDDDDDDDDDDDk.', 'kkDDDDDDDDDDDDkk',
      'k.kDDDDDDDDDDk.k', '..kDDDDDDDDDDk..', '...kDDDDDDDDk...', '....kkkkkkkk....', '...kk......kk...', '..y.o.yo.y.o.y..', '.oyoyoyoyoyoyoy.',
    ].map((r, y) => (y >= 2 && y <= 7 && 8 - y <= fill ? r.replace(/D/g, 'L') : r));
    if (fill === 6) rows[1] = rows[1].replace(/i/g, (m, x) => (x % 3 ? 'L' : 'w'));
    return Pixel.svg(rows, { k: '#1b1b1b', i: '#5a5f6b', D: '#2b2f3a', L: col, w: '#ffffff', y: '#ffd43b', o: '#ff8c1a' });
  }
  const EGG = ['....kkkk....', '...kwwwwk...', '..kwwwwwwk..', '.kwwsswwwwk.', '.kwwsswwwwk.', 'kwwwwwwwsswk', 'kwwwwwwwsswk',
    'kwsswwwwwwwk', 'kwsswwwwwwwk', 'kwwwwwsswwwk', 'kwwwwwsswwwk', '.kwwwwwwwwk.', '..kwwwwwwk..', '...kkkkkk...'];
  const CRACKS = [[5, 1], [6, 2], [5, 3], [6, 4], [7, 5], [6, 6], [5, 7], [4, 8], [5, 9], [6, 10], [7, 11], [3, 6], [2, 5], [8, 8], [9, 9], [7, 3], [4, 11], [6, 12]];
  function eggSVG(p) {
    const rows = EGG.map(r => [...r]);
    CRACKS.slice(0, Math.round(p * CRACKS.length)).forEach(([x, y]) => { if (rows[y][x] !== '.') rows[y][x] = 'k'; });
    return Pixel.svg(rows.map(r => r.join('')), { k: '#1b1b1b', w: '#fff6dc', s: '#8fd16a' });
  }
  const BABY_DRAGON = Pixel.svg(['..g......g..', '..gg....gg..', '..gggggggg..', '.ggwkggwkgg.', '.gggggggggg.', '.gggrrrrggg.', '..gggggggg..',
    'oggYYYYYYggo', 'ooYYYYYYYYoo', '..gYYYYYYg..', '..gg....gg..', '..kk....kk..'], { g: '#4caf2a', w: '#ffffff', k: '#1b1b1b', r: '#e53935', Y: '#ffd43b', o: '#ff8c1a' });
  const POTION = Pixel.svg(['....kkkk....', '....kbbk....', '.....kk.....', '....kwLk....', '...kwLLLk...', '..kLLLLLLk..', '.kLwLLLLLLk.', '.kLLLLLLLLk.', '.kLLLLLLwLk.', '..kLLLLLLk..', '...kkkkkk...'],
    { k: '#1b1b1b', b: '#8a5a32', w: '#ffffff', L: '#b44dff' });

  // castle: each word lays another row of stones, bottom up (unbuilt rows show as a faint outline)
  const CASTLE_ROWS = ['.ss..ss..ss..ss.', '.ss..ss..ss..ss.', '.ssssssssssssss.', '.sSssssssssssSs.', '.sssskkssskksss.', '.sssskwssskwsss.', '.ssssssssssssss.',
    '.sSsssssssssSss.', '.ssssssssssssss.', '.ssssskkkksssss.', '.sssskddddkssSs.', '.ssSskddddkssss.', '.sssskddddkssss.'];
  const CASTLE_PAL = { s: '#9aa3ad', S: '#6b7480', k: '#1b1b1b', w: '#ffd43b', d: '#8a5a32', g: '#dfe3e8', r: '#e53935', f: '#5a3a1a' };
  const castleFlag = ['.......frr......', '.......frrrr....', '.......frr......', '.......f........'];
  function castleSVG(p) {
    const built = Math.round(p * CASTLE_ROWS.length);
    return Pixel.svg(['................', '................', '................', '................']
      .concat(CASTLE_ROWS.map((r, y) => (y >= CASTLE_ROWS.length - built ? r : r.replace(/[^.]/g, 'g')))), CASTLE_PAL);
  }
  const CASTLE_DONE = Pixel.svg(castleFlag.concat(CASTLE_ROWS), CASTLE_PAL);
  // rocket: each word pours fuel into the tank; when it is full, the engines fire
  const ROCKET = ['.....kk.....', '....krrk....', '...krrrrk...', '...kwwwwk...', '..kwwccwwk..', '..kwcbbcwk..', '..kwcbbcwk..', '..kwwccwwk..',
    '..kFFFFFFk..', '..kFFFFFFk..', '..kFFFFFFk..', '..kFFFFFFk..', '.rkFFFFFFkr.', 'rrkFFFFFFkrr', 'rrkkkkkkkkrr', 'r..kk..kk..r'];
  function rocketSVG(p, fire) {
    const fill = Math.round(p * 6);
    const rows = ROCKET.map((r, y) => (y >= 8 && y <= 13 && 14 - y <= fill ? r.replace(/F/g, 'L') : r));
    return Pixel.svg(rows.concat(fire ? ['...oyyyyo...', '....oyyo....', '.....oo.....'] : ['............', '............', '............']),
      { k: '#1b1b1b', r: '#e53935', w: '#e8eef5', c: '#9fd8ff', b: '#2b6fd6', F: '#2b2f3a', L: '#7cfc3a', o: '#ff8c1a', y: '#ffd43b' });
  }
  // train: each word couples another carriage onto the engine (uncoupled ones show as a faint outline); full = full steam ahead
  const TRAIN_ENGINE = ['.........kkk.', '.........kok.', 'kkkkkk...kkk.', 'kwwwwk..kkkkk', 'kwccwkrrrrrrk', 'krrrrrrrrrrrk', 'krrrrrrrrrrrk', 'kkkkkkkkkkkkk', '.kyk..kyk.kyk', '..k....k...k.'];
  const TRAIN_CAR = ['..........', '..........', '..........', 'kkkkkkkkkk', 'kXXXXXXXXk', 'kXwwXXwwXk', 'kXXXXXXXXk', 'kkkkkkkkkk', '.kyk..kyk.', '..k....k..'];
  const TRAIN_COLS = ['B', 'G', 'P', 'O'];
  function trainSVG(p, full) {
    const coupled = Math.round(p * TRAIN_COLS.length); // the carriage next to the engine is coupled first
    const cars = TRAIN_COLS.map((c, i) => TRAIN_CAR.map(r => (TRAIN_COLS.length - i <= coupled ? r.replace(/X/g, c) : r.replace(/[^.]/g, 'g'))));
    const link = y => (y === 6 ? 'k' : '.');
    const rows = TRAIN_ENGINE.map((r, y) => cars.map(car => car[y] + link(y)).join('') + r);
    const w = rows[0].length, top = full ? ['.'.repeat(w - 6) + 'ss....', '.'.repeat(w - 4) + 'ss..'] : ['.'.repeat(w), '.'.repeat(w)];
    return Pixel.svg(top.concat(rows), { k: '#1b1b1b', w: '#e8eef5', c: '#9fd8ff', r: '#e53935', o: '#ff8c1a', y: '#ffd43b', g: '#dfe3e8', s: '#c9ced6',
      B: '#2b6fd6', G: '#2e9e3e', P: '#8e5cff', O: '#ff8c1a' });
  }
  // r.scene → how the picture, caption and finish banner look
  const SP_SCENES = {
    potion: { prize: 'the magic potion', draw: (p, n, full) => (full ? POTION : cauldronSVG(p, n)), cap: (n, of, prize) => `🧪 ${n}/${of} ingredients in ${prize}`, made: prize => `🧪 ${prize} is ready!`, done: '🧪 POTION BREWED!', anim: 'bubbling' },
    egg: { prize: 'your baby dragon', draw: (p, n, full) => (full ? BABY_DRAGON : eggSVG(p)), cap: (n, of) => `🥚 ${n}/${of} words · each one cracks the egg`, made: prize => `🐲 ${prize} has hatched!`, done: '🐲 IT HATCHED!', anim: 'wobble' },
    castle: { prize: 'your word castle', draw: (p, n, full) => (full ? CASTLE_DONE : castleSVG(p)), cap: (n, of) => `🧱 ${n}/${of} words · each one builds a row of stones`, made: prize => `🏰 ${prize} is built!`, done: '🏰 CASTLE BUILT!' },
    train: { prize: 'the word train', draw: (p, n, full) => trainSVG(p, full), cap: (n, of) => `🚃 ${n}/${of} words · each one couples a carriage`, made: prize => `🚂 ${prize} is full steam ahead!`, done: '🚂 ALL ABOARD!' },
    rocket: { prize: 'your rocket', draw: (p, n, full) => rocketSVG(p, full), cap: (n, of) => `⛽ ${n}/${of} words · each one adds fuel`, made: prize => `🚀 ${prize} has blasted off!`, done: '🚀 BLAST OFF!', anim: 'launch' },
  };

  const canSpeak = 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
  // the best voice for a language ('en-GB' by default; 'ja-JP', 'th-TH' … for other languages), or null
  function voiceFor(lang = 'en-GB') {
    if (!canSpeak) return null;
    const vs = speechSynthesis.getVoices(), base = lang.split('-')[0];
    const norm = l => String(l).replace('_', '-').toLowerCase();
    return vs.find(x => norm(x.lang) === lang.toLowerCase()) || vs.find(x => norm(x.lang).split('-')[0] === base) || null;
  }
  if (canSpeak) try { speechSynthesis.getVoices(); speechSynthesis.addEventListener('voiceschanged', () => speechSynthesis.getVoices()); } catch (e) { /* ignore */ }
  // read words aloud in a British voice (the 🔊 button always speaks; automatic reading respects mute)
  // lang: another language – it only speaks if this device has a voice for it (never in the wrong accent)
  function speak(text, { rate = 0.85, force = false, lang = null } = {}) {
    if (!canSpeak || (settings.muted && !force)) return false;
    try {
      const v = voiceFor(lang || 'en-GB');
      if (lang && !v) return false;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (v) u.voice = v;
      u.lang = v ? v.lang : 'en-GB'; u.rate = rate;
      speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  }

  GAMES.spelltest = function (r, key, done) {
    const mode = r.mode || 'listen', scene = SP_SCENES[r.scene] ? r.scene : 'potion', SC = SP_SCENES[scene];
    const prize = r.prize || SC.prize;
    const DEF_EMOJI = ['🍄', '🦎', '🌟', '🪶', '🐸', '💎', '🌙', '🍯', '🕷️', '🌈', '🔥', '❄️'];
    const words = r.words.map((w, i) => Object.assign({ emoji: DEF_EMOJI[i % DEF_EMOJI.length] }, typeof w === 'string' ? { word: w } : w));
    const results = {}; // word -> 'first' | 'second' | 'copied'
    let finishedOnce = false, count = 0;

    const sceneBox = h('div', { class: 'sp-scene-pic' });
    const sceneCap = h('div', { class: 'sp-scene-cap' });
    const ingredients = h('div', { class: 'sp-ingredients' });
    const board = h('div', { class: 'sp-board' });
    const root = h('div', { class: 'game spelltest sp-' + scene },
      h('div', { class: 'sp-wrap' },
        h('div', { class: 'panel-inner sp-scene' }, sceneBox, sceneCap, ingredients),
        board));

    function drawScene(added) {
      const p = count / words.length, full = count === words.length;
      sceneBox.innerHTML = SC.draw(p, count, full);
      ['wobble', 'bubbling'].forEach(a => sceneBox.classList.toggle(a, SC.anim === a && count > 0 && !full));
      sceneBox.classList.toggle('launch', SC.anim === 'launch' && full);
      sceneCap.textContent = full ? SC.made(prize) : SC.cap(count, words.length, prize);
      if (added) {
        const chip = h('span', { class: 'sp-ing pop' }, added.emoji);
        ingredients.append(chip);
        sceneBox.classList.remove('flash'); void sceneBox.offsetWidth; sceneBox.classList.add('flash');
      }
    }

    // ----- one word -----
    function runList(list, practice, onDone) {
      let wi = 0;
      const next = () => { if (wi < list.length) ask(list[wi++], practice, next); else onDone(); };
      next();
    }

    function ask(w, practice, goNext) {
      let moved = false;
      const next = () => { if (!moved) { moved = true; goNext(); } };
      const target = w.word.toLowerCase().replace(/[^a-z]/g, ''), n = target.length;
      const listen = mode === 'listen' && canSpeak;
      const peekMode = mode === 'peek' || (mode === 'listen' && !canSpeak);
      let letters = Array(n).fill(''), locked = Array(n).fill(false), tries = 0, revealed = false, peeked = false, over = false, covered = !peekMode;
      const full = () => (w.sentence ? w.sentence.replace(/_{2,}/, w.word) : '');
      const sayWord = (force, rate) => speak([w.word, full(), w.word].filter(Boolean).join('. '), { force, rate });

      const tiles = Array.from({ length: n }, () => h('div', { class: 'sp-tile' }));
      const tileRow = h('div', { class: 'sp-tiles', style: `--n:${n}` }, tiles);
      const status = h('div', { class: 'sp-status' });
      const checkBtn = h('button', { class: 'btn green', type: 'button', onclick: check, disabled: true }, '✔ Check');
      const card = h('div', { class: 'sp-card' });
      const tools = h('div', { class: 'btn-row sp-tools' });

      function paint() {
        tiles.forEach((t, i) => {
          t.textContent = letters[i];
          t.classList.toggle('lock', locked[i]);
          t.classList.toggle('cur', !over && covered && i === letters.findIndex(c => !c));
        });
        checkBtn.disabled = over || !covered || letters.some(c => !c);
      }
      function type(ch) {
        if (over || !covered) return;
        const i = letters.findIndex(c => !c);
        if (i < 0) return;
        letters[i] = ch; sfx.tap(); paint();
      }
      function back() {
        if (over) return;
        for (let i = n - 1; i >= 0; i--) if (letters[i] && !locked[i]) { letters[i] = ''; break; }
        paint();
      }
      function check() {
        if (over || letters.some(c => !c)) return;
        const guess = letters.join('');
        tries++;
        if (guess === target) return win();
        sfx.bad(); shake(tileRow);
        letters.forEach((c, i) => { if (c === target[i]) locked[i] = true; else tiles[i].classList.add('bad'); });
        if (tries >= 2 && !revealed) {
          revealed = true; locked = Array(n).fill(false);
          put(card, h('div', { class: 'sp-reveal' }, h('small', null, 'It is spelt:'), h('b', null, target)));
          card.classList.remove('covered');
          say(`Tricky one! Look carefully: ${[...target].join(' - ')}. Now copy it into the boxes.`);
          speak([...target].join(', '), { rate: 0.7 });
        } else if (!revealed) {
          say(w.hint ? '💡 ' + w.hint : 'Nearly! The green letters are right – fix the others.');
        } else say('Copy the word from the card, letter by letter.');
        paint();
        setTimeout(() => {
          tiles.forEach(t => t.classList.remove('bad'));
          letters = letters.map((c, i) => (locked[i] ? c : '')); paint();
        }, 900);
      }
      function win() {
        over = true; sfx.good();
        tiles.forEach((t, i) => setTimeout(() => t.classList.add('good'), i * 60));
        card.classList.remove('covered');
        if (peekMode && !revealed) put(card, h('div', { class: 'sp-reveal' }, h('small', null, '✔ CHECK – it matches!'), h('b', null, target)));
        const res = revealed ? 'copied' : tries === 1 && !peeked ? 'first' : 'second';
        if (!practice) {
          results[target] = res;
          if (res === 'first') award(`${key}:${target}`, tileRow);
          count++; drawScene(w);
        }
        say(res === 'first' ? `${target.toUpperCase()}! ${praise()}` : res === 'second' ? 'Got it on the second go – nice fixing!' : 'Good copying! This one goes on your practice list.');
        put(tools, h('button', { class: 'btn big green ready', type: 'button', onclick: next }, 'Next word ▶'));
        paint();
      }

      // the prompt: hear it, look-cover-write-check, or fix the mistake
      const prompt = h('div', { class: 'sp-prompt' });
      if (mode === 'fix') {
        const [a, b] = (w.sentence || '___').split(/_{2,}/);
        put(prompt, h('div', { class: 'sp-label' }, '🔍 Spot the spelling mistake – then write the word correctly'),
          h('p', { class: 'sp-sentence' }, a, h('span', { class: 'sp-wrongword' }, w.wrong || '?'), b || ''));
        tools.append(h('button', { class: 'btn', type: 'button', onclick() { sayWord(true); } }, '🔊 Hear it'));
        say(w.say || 'Uh-oh, a spelling goblin got here! Write the red word correctly.');
      } else if (listen) {
        put(prompt, h('div', { class: 'sp-label' }, '🎧 Listen, then spell the word'),
          w.sentence && h('p', { class: 'sp-sentence' }, w.sentence.split(/_{2,}/).reduce((acc, part, i) => i ? [...acc, h('span', { class: 'sp-gap' }, '_____'), part] : [part], [])),
          w.clue && h('p', { class: 'sp-clue' }, '💡 Means: ' + w.clue));
        tools.append(
          h('button', { class: 'btn gold', type: 'button', onclick() { sayWord(true); } }, '🔊 Hear it'),
          h('button', { class: 'btn', type: 'button', onclick() { speak(w.word, { force: true, rate: 0.55 }); } }, '🐢 Slowly'));
        say('Listen carefully… then type the word!');
        setTimeout(() => { if (root.isConnected) sayWord(false); }, 350);
      } else {
        // Look → Cover → Write → Check
        let t = Math.max(3, Math.round(2 + n * 0.35));
        const timer = h('span', { class: 'sp-timer' }, t);
        put(card, h('div', { class: 'sp-look' }, h('small', null, '👀 LOOK and say it'), h('b', null, target)), timer);
        put(prompt, h('div', { class: 'sp-label' }, '👀 Look · 🧱 Cover · ✍️ Write · ✔ Check'), w.clue && h('p', { class: 'sp-clue' }, '💡 Means: ' + w.clue));
        say('Look at the word. Say it in your head. Spot the tricky bit!');
        speak(w.word);
        const cover = () => {
          covered = true; card.classList.add('covered'); sfx.zap();
          put(card, h('div', { class: 'sp-blocks', 'aria-label': 'Word covered' }, Array.from({ length: 12 }, () => h('i'))));
          say('COVERED! Now write it from memory.');
          put(tools, h('button', { class: 'btn ghost', type: 'button', onclick() {
            if (over) return;
            peeked = true; card.classList.remove('covered');
            put(card, h('div', { class: 'sp-look' }, h('small', null, '👀 Peek (no gem this time)'), h('b', null, target)));
            setTimeout(() => { if (!over && root.isConnected) cover(); }, 1800);
          } }, '👀 Peek again'));
          paint();
        };
        const tick = setInterval(() => {
          if (!root.isConnected) return clearInterval(tick);
          t--; timer.textContent = t;
          if (t <= 0) { clearInterval(tick); cover(); }
        }, 1000);
        tools.append(h('button', { class: 'btn', type: 'button', onclick() { clearInterval(tick); cover(); } }, "🧱 I'm ready – cover it!"));
      }

      const keyRows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'].map((row, ri) => h('div', { class: 'cw-row' },
        [...row].map(ch => h('button', { class: 'cw-key sp-key', type: 'button', onclick: () => type(ch) }, ch)),
        ri === 2 && h('button', { class: 'cw-key wide', type: 'button', onclick: back, 'aria-label': 'Delete' }, '⌫')));
      put(board,
        h('div', { class: 'sp-count' }, practice ? '🔁 PRACTICE' : `WORD ${Object.keys(results).length + 1} OF ${words.length}`),
        prompt, card, tileRow, status,
        h('div', { class: 'cw-keys' }, keyRows),
        h('div', { class: 'btn-row' }, checkBtn), tools);
      paint();

      const onKey = e => {
        if (!tileRow.isConnected) { document.removeEventListener('keydown', onKey); return; }
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (/^[a-z]$/i.test(e.key)) { e.preventDefault(); type(e.key.toLowerCase()); }
        else if (e.key === 'Backspace') { e.preventDefault(); back(); }
        else if (e.key === 'Enter') { e.preventDefault(); if (over) next(); else check(); }
      };
      document.addEventListener('keydown', onKey);
      root._test = { type: s => [...s].forEach(type), check, back, cover: () => { covered = true; paint(); }, get over() { return over; }, next };
    }

    function report() {
      const mark = { first: '✅', second: '🟡', copied: '🔁' };
      const tricky = words.filter(w => results[w.word.toLowerCase()] !== 'first');
      const firsts = words.length - tricky.length;
      if (!finishedOnce) { finishedOnce = true; confetti(120); done(); }
      say(firsts === words.length ? `PERFECT SPELLING! Every word right first time, {name}!` : `${prize} is complete! Practise the tricky ones to make them stick.`);
      if (canSpeak) speechSynthesis.cancel();
      put(board,
        h('div', { class: 'results' },
          h('h2', null, SC.done),
          h('p', { class: 'lead' }, `${firsts} of ${words.length} spelt right first time.`),
          h('ul', { class: 'sp-report' }, words.map(w => h('li', { class: 'r-' + results[w.word.toLowerCase()] },
            h('span', null, mark[results[w.word.toLowerCase()]] || '•'), h('b', null, w.word)))),
          h('p', { class: 'sp-key-note' }, '✅ first try · 🟡 second try · 🔁 copied – practise!'),
          tricky.length > 0 && h('div', { class: 'btn-row' },
            h('button', { class: 'btn gold', type: 'button', onclick() { runList(shuffle(tricky), true, report); } }, `🔁 Practise my ${tricky.length} tricky word${tricky.length > 1 ? 's' : ''}`))));
    }

    drawScene();
    runList(r.shuffle === false ? words : shuffle(words), false, report);
    return root;
  };

  // ---------- arcade helpers (canvas games) ----------
  function spriteCanvas(rows, pal, scale = 1) {
    const w = Math.max(...rows.map(r => r.length)), hh = rows.length;
    const c = document.createElement('canvas');
    c.width = w * scale; c.height = hh * scale;
    const x = c.getContext('2d');
    rows.forEach((r, y) => [...r].forEach((ch, i) => { if (pal[ch]) { x.fillStyle = pal[ch]; x.fillRect(i * scale, y * scale, scale, scale); } }));
    return c;
  }
  function arcadeCanvas(W, H) {
    const cv = h('canvas', { class: 'arcade-canvas' });
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    return { cv, ctx };
  }
  const toGame = (cv, W, H, e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; };
  // runs step(dt) every frame until the game is removed from the page (or stop() is called)
  function gameLoop(root, step) {
    let last = null, stopped = false, started = false;
    const f = t => {
      if (stopped) return;
      if (!root.isConnected) { if (started) return; requestAnimationFrame(f); return; }
      started = true;
      // time between frames, from the frame timestamps only (capped so a slow frame never jumps the game)
      const dt = last == null ? 0 : Math.min(0.05, Math.max(0, (t - last) / 1000)); last = t;
      step(dt);
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
    return () => { stopped = true; };
  }
  // Numbers use the reading font: in the pixel font a 5 looks like an S and a 2 like an 8.
  const canvasFont = (text, size) => (/\d/.test(text) ? `700 ${size}px Lexend, "Trebuchet MS", sans-serif` : `700 ${size}px "Pixelify Sans", monospace`);
  function pxText(ctx, text, x, y, size, color = '#fff', align = 'center') {
    ctx.font = canvasFont(String(text), size);
    ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size / 4); ctx.strokeStyle = '#000';
    ctx.strokeText(text, x, y); ctx.fillStyle = color; ctx.fillText(text, x, y);
  }
  // hold-to-press on-screen buttons (multi-touch friendly) + keyboard
  function holdButton(label, cls, onDown, onUp) {
    const b = h('button', { class: 'arc-btn ' + cls, type: 'button', 'aria-label': label }, label);
    b.addEventListener('pointerdown', e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } b.classList.add('down'); onDown(); });
    const up = () => { b.classList.remove('down'); if (onUp) onUp(); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    b.addEventListener('contextmenu', e => e.preventDefault());
    return b;
  }
  function keys(root, map) {
    const down = e => { if (!root.isConnected) return cleanup(); const f = map[e.key]; if (f && f[0]) { e.preventDefault(); f[0](); } };
    const up = e => { if (!root.isConnected) return cleanup(); const f = map[e.key]; if (f && f[1]) { e.preventDefault(); f[1](); } };
    const cleanup = () => { document.removeEventListener('keydown', down); document.removeEventListener('keyup', up); };
    document.addEventListener('keydown', down); document.addEventListener('keyup', up);
  }
  const SPR = {
    alienA: ['...p...p...', '....g.g....', '..ggggggg..', '.ggkwgwkgg.', 'ggggggggggg', 'gg.ggggg.gg', 'g..g...g..g', '..gg...gg..'],
    alienB: ['...p...p...', '....g.g....', '..ggggggg..', '.ggwkgkwgg.', 'ggggggggggg', 'gg.ggggg.gg', '.g.g...g.g.', 'g.........g'],
    ufo: ['......rrrr......', '...rrrrrrrrrr...', '..rrrrrrrrrrrr..', '.rrwrrwrrwrrwrr.', 'rrrrrrrrrrrrrrrr', '..rrr..rr..rrr..', '...r........r...'],
    ship: ['.....r.....', '....www....', '....wcw....', '..wwwwwww..', '.wwwwwwwww.', 'wwwwwwwwwww', 'rr.r...r.rr'],
    robot: ['.....yy.....', '.....kk.....', '..kkkkkkkk..', '.kllllllllk.', '.klccllcclk.', '.klccllcclk.', '.kllllllllk.', '.kllkkkkllk.', '.kllllllllk.', '..kkkkkkkk..', '.kkggggggkk.', 'kgkgrggygkgk', 'kgkggggggkgk', '..kggggggk..', '..kgk..kgk..', '..kkk..kkk..'],
    robotRun: ['.....yy.....', '.....kk.....', '..kkkkkkkk..', '.kllllllllk.', '.klccllcclk.', '.klccllcclk.', '.kllllllllk.', '.kllkkkkllk.', '.kllllllllk.', '..kkkkkkkk..', '.kkggggggkk.', 'kgkgrggygkgk', 'kgkggggggkgk', '..kggggggk..', '.kgk....kgk.', '.kkk....kkk.'],
    flag: ['k.......', 'kggggg..', 'kgggggg.', 'kggggg..', 'k.......', 'k.......', 'k.......', 'k.......', 'k.......', 'k.......'],
  };
  const ROBOT_PAL = { k: '#1b1b1b', l: '#d9dde3', c: '#2ee6d6', g: '#8e9aa8', y: '#ffcc33', r: '#ff5252' };

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

  // ---------- simulated experiments (shared bits) ----------
  const EMOJI_FONT = n => `${n}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  const FACES_LEFT = new Set(['🚗', '🚙', '🏎️', '🚌', '🚚']); // these emoji face left, so flip them to drive right
  function emojiAt(ctx, e, x, y, size, angle = 0) {
    ctx.save(); ctx.translate(x, y); if (angle) ctx.rotate(angle);
    if (FACES_LEFT.has(e) && !(window.Pixel && Pixel.has && Pixel.has(e))) ctx.scale(-1, 1); // pixel vehicles already face right
    if (pxDraw(ctx, e, 0, 0, size)) { ctx.restore(); return; }
    ctx.font = EMOJI_FONT(size); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(e, 0, 0); ctx.restore();
  }
  function skyAndGround(ctx, W, H, floorY) {
    const sc = AV ? AV.sceneDef() : null;
    const sky = sc ? sc.sky : ['#5fb8f5', '#c4e8ff'], ground = sc ? sc.ground : ['#5bbf3a', '#3d8a26', '#8a5a32', '#6b4425'];
    const g = ctx.createLinearGradient(0, 0, 0, floorY);
    g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, floorY);
    ctx.fillStyle = ground[2]; ctx.fillRect(0, floorY, W, H - floorY);
    ctx.fillStyle = ground[0]; ctx.fillRect(0, floorY, W, 8);
  }
  // A results table that grows one row per test. cols: header labels; add(cells) highlights the newest row.
  function resultsTable(caption, cols) {
    const body = h('tbody');
    const box = h('div', { class: 'data-box', hidden: true },
      h('table', null, h('caption', null, caption), h('thead', null, h('tr', null, cols.map(c => h('th', null, c)))), body));
    return {
      el: box,
      add(cells) {
        body.querySelectorAll('tr.new').forEach(tr => tr.classList.remove('new'));
        body.append(h('tr', { class: 'new' }, cells.map(c => h('td', null, String(c)))));
        box.hidden = false;
      },
    };
  }
  // Missions for the simulated experiments: show the mission, and after a success ask its questions (if any).
  function missionRunner(r, key, done, onStart) {
    const missions = r.missions || [];
    let mi = -1;
    const box = h('div', { class: 'lab-mission' });
    const ask = h('div', { class: 'lab-ask' });
    const self = {
      box, ask,
      get i() { return mi; }, get m() { return missions[mi]; }, get count() { return missions.length; },
      next() {
        mi++; put(ask);
        if (mi >= missions.length) { put(box, r.finish || '🏆 All missions complete – brilliant science!'); done(); return; }
        put(box, h('span', { class: 'lab-mission-tag' }, `MISSION ${mi + 1}/${missions.length}`), ' ', h('span', { html: fmt(missions[mi].text, false) }));
        onStart(missions[mi]);
      },
      // the child's test matched the mission: pay a gem, then ask the follow-up questions
      win(fromEl) {
        const m = missions[mi];
        sfx.good(); award(`${key}:m${mi}`, fromEl); confetti(40);
        say(m.yes || 'Mission complete!');
        const go = h('button', { class: 'btn big ready', type: 'button', onclick() { sfx.tap(); self.next(); } }, mi < missions.length - 1 ? 'Next mission ▶' : 'Finish ✔');
        if (m.ask && m.ask.length) runQuestions(ask, m.ask, { key: `${key}:q${mi}`, lastLabel: 'Done ✔', done: () => put(ask, h('div', { class: 'btn-row' }, go)) });
        else put(ask, h('div', { class: 'btn-row' }, go));
      },
    };
    return self;
  }

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

  // ---------- clock games (need shared/clock.js) ----------
  // Set the clock: { game: 'clock', mode: 'set', times: ['3:45' | { time, say, start, ask }], show: 'words' | 'digital' | 'both',
  //   step: 5, helper: 'on' | 'off' | 'none' (the PAST / TO helper ring), roman: true }
  //   A time can add start (where the hands begin) and ask (a puzzle shown instead of the time, e.g. a start time plus a duration).
  //   Drag the red minute hand (the hour hand moves with it, like a real clock) or the short hour hand.
  // Read the clock: { game: 'clock', mode: 'read', times: [...] } – pick the hour, then type the minutes.
  const angGap = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
  GAMES.clock = function (r, key, done) {
    const CK = window.Clock;
    if (!CK) return h('p', null, 'This game needs shared/clock.js.');
    const items = r.times.map(t => (typeof t === 'string' ? { time: t } : t)).map(t => Object.assign({}, t, CK.parse(t.time)));
    const read = r.mode === 'read';
    const step = r.step || (read ? 1 : 5);
    let qi = 0, misses = 0, T = 0, helper = r.helper === 'on', dragging = null, locked = false;
    let pickH = null, mins = '';
    const face = h('div', { class: 'clk-face' + (read ? '' : ' live'), 'aria-label': 'Clock' });
    const prompt = h('div', { class: 'clk-prompt' });
    const count = h('div', { class: 'q-count' });
    const fb = h('div', { class: 'feedback', hidden: true });
    const controls = h('div', { class: 'clk-controls' });
    const nextBtn = h('button', { class: 'btn', type: 'button', hidden: true, onclick() { sfx.tap(); qi++; if (qi < items.length) show(); else { put(controls); nextBtn.hidden = true; done(); } } }, 'Next clock ▶');
    const it = () => items[qi];
    const target = () => (it().h % 12) * 60 + it().m;
    const faceOpts = () => ({ roman: r.roman || it().roman, halves: helper, ring: helper ? 'pastto' : (r.ring || null) });
    const sayTime = t => t.say || CK.words(t.h, t.m);

    function draw() {
      const p = read ? it() : { h: Math.floor(T / 60), m: T % 60 };
      face.innerHTML = CK.svg(p.h, p.m, faceOpts());
      if (!read && misses >= 2) { // ghost hands show where to go
        const g = CK.svg(it().h, it().m, { ticks: false });
        const ghost = h('div', { class: 'clk-ghost', html: g });
        face.append(ghost);
      }
    }
    function setT(v) { T = ((v % 720) + 720) % 720; sfx.tap(); draw(); }
    // pointer → angle (0 = 12 o'clock, clockwise) and distance in SVG units (face is 200 wide)
    function polar(e) {
      const b = face.getBoundingClientRect(), x = (e.clientX - b.left) / b.width * 200 - 100, y = (e.clientY - b.top) / b.height * 200 - 100;
      return { ang: (Math.atan2(x, -y) * 180 / Math.PI + 360) % 360, dist: Math.hypot(x, y) };
    }
    function dragTo(e) {
      const { ang } = polar(e);
      if (dragging === 'm') {
        const nm = (Math.round(ang / 6 / step) * step) % 60;
        let d = nm - T % 60;
        if (d > 30) d -= 60; else if (d < -30) d += 60;
        if (d) setT(T + d);
      } else {
        const hr = ((Math.round((ang - (T % 60) * 0.5) / 30) % 12) + 12) % 12;
        if (hr !== Math.floor(T / 60)) setT(hr * 60 + T % 60);
      }
    }
    if (!read) {
      face.addEventListener('pointerdown', e => {
        if (locked) return;
        e.preventDefault();
        const { ang, dist } = polar(e);
        const hDeg = (T / 2) % 360, mDeg = (T % 60) * 6, R = helper ? 70 : 88;
        // near the middle on the short hand → hour hand (even when the hands overlap); anywhere else → minute hand
        dragging = dist < R * 0.55 && angGap(ang, hDeg) < 30 ? 'h' : 'm';
        try { face.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        dragTo(e);
      });
      face.addEventListener('pointermove', e => { if (dragging && !locked) dragTo(e); });
      const end = () => { dragging = null; };
      face.addEventListener('pointerup', end); face.addEventListener('pointercancel', end);
    }

    function hintSet() {
      const t = it(), cm = T % 60, ch = Math.floor(T / 60) % 12 || 12, th = t.h % 12 || 12, next = th % 12 + 1;
      const num = m => (m === 0 ? 12 : m / 5);
      if (cm !== t.m) {
        if (t.m % 30 && cm === (60 - t.m) % 60) return `Careful – wrong side! ${t.m < 30 ? 'PAST times are on the RIGHT side' : 'TO times are on the LEFT side'}. The minute hand should point at the ${num(t.m)}.`;
        return t.m % 5 ? `Count the little marks: the red minute hand goes on ${t.m} minutes.` : `The long red minute hand should point at the ${num(t.m)}.`;
      }
      if (t.m > 30 && ch === next) return `So close! "${sayTime(t)}" is BEFORE ${next} o'clock, so the short hand is just before the ${next} – not past it.`;
      if (t.m === 0) return `The short hour hand should point straight at the ${th}.`;
      return t.m <= 30 ? `The short hour hand should be just past the ${th}.` : `The short hour hand should be just before the ${next}.`;
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
      const check = btn('✔ Check', e => { if (T === target()) right(face); else wrong(face, hintSet()); }, 'btn big green');
      const helpBtn = r.helper !== 'none' && btn(helper ? '💡 Helper ON' : '💡 Helper', e => { helper = !helper; e.currentTarget.textContent = helper ? '💡 Helper ON' : '💡 Helper'; sfx.tap(); draw(); }, 'btn gold');
      put(controls,
        h('div', { class: 'clk-nudge' },
          btn('⟲ hour', () => setT(T - 60)), btn(`− ${step} min`, () => setT(T - step)),
          btn(`+ ${step} min`, () => setT(T + step)), btn('hour ⟳', () => setT(T + 60))),
        h('div', { class: 'btn-row' }, helpBtn, check));
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
      if (!read) T = t.start ? (CK.parse(t.start).h % 12) * 60 + CK.parse(t.start).m : (r.start ? (CK.parse(r.start).h % 12) * 60 + CK.parse(r.start).m : 0);
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
    root._test = { set(v) { T = (CK.parse(v).h % 12) * 60 + CK.parse(v).m; draw(); }, get T() { return T; } };
    return root;
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
  function buildWordsearch(words, size, diagonal) {
    const dirs = diagonal ? [[1, 0], [0, 1], [1, 1]] : [[1, 0], [0, 1]];
    for (let attempt = 0; attempt < 300; attempt++) {
      const grid = Array.from({ length: size }, () => Array(size).fill(''));
      const placed = [];
      const ok = words.slice().sort((a, b) => b.word.length - a.word.length).every(w => {
        for (let t = 0; t < 300; t++) {
          const [dx, dy] = pick(dirs);
          const x0 = Math.floor(Math.random() * (size - dx * (w.word.length - 1)));
          const y0 = Math.floor(Math.random() * (size - dy * (w.word.length - 1)));
          const cs = [...w.word].map((_, k) => [x0 + dx * k, y0 + dy * k]);
          if (cs.every(([x, y], k) => !grid[y][x] || grid[y][x] === w.word[k])) {
            cs.forEach(([x, y], k) => { grid[y][x] = w.word[k]; });
            placed.push(Object.assign({}, w, { cells: cs }));
            return true;
          }
        }
        return false;
      });
      if (!ok) continue;
      const ABC = 'ABCDEFGHIJKLMNOPRSTUVWY';
      grid.forEach(row => row.forEach((c, x) => { if (!c) row[x] = ABC[Math.floor(Math.random() * ABC.length)]; }));
      // keep the word list in the same order the lesson gave it
      placed.sort((a, b) => words.indexOf(words.find(w => w.word === a.word)) - words.indexOf(words.find(w => w.word === b.word)));
      return { grid, placed };
    }
    throw new Error('Word hunt: could not fit the words – make the grid bigger.');
  }

  // Builds a small interlocking crossword from {answer, clue} entries (tries many layouts, keeps the most compact).
  function buildCrossword(entries) {
    const words = entries.map(e => Object.assign({}, e, { answer: e.answer.toUpperCase().replace(/[^A-Z]/g, '') }));
    const K = (x, y) => x + ',' + y;
    let best = null;
    for (let attempt = 0; attempt < 400; attempt++) {
      const order = attempt === 0 ? words.slice().sort((a, b) => b.answer.length - a.answer.length) : shuffle(words);
      const grid = {}, dirsAt = {}, placed = [];
      const place = (w, x, y, dir) => {
        const dx = dir === 'across' ? 1 : 0, dy = 1 - dx, cs = [];
        for (let k = 0; k < w.answer.length; k++) {
          const key = K(x + dx * k, y + dy * k);
          grid[key] = w.answer[k]; (dirsAt[key] = dirsAt[key] || []).push(dir); cs.push(key);
        }
        placed.push(Object.assign({}, w, { x, y, dir, cells: cs }));
      };
      const fits = (word, x, y, dir) => {
        const dx = dir === 'across' ? 1 : 0, dy = 1 - dx;
        if (grid[K(x - dx, y - dy)] || grid[K(x + dx * word.length, y + dy * word.length)]) return 0;
        let cross = 0;
        for (let k = 0; k < word.length; k++) {
          const cx = x + dx * k, cy = y + dy * k, c = grid[K(cx, cy)];
          if (c) {
            if (c !== word[k] || (dirsAt[K(cx, cy)] || []).includes(dir)) return 0;
            cross++;
          } else if (grid[K(cx + dy, cy + dx)] || grid[K(cx - dy, cy - dx)]) return 0;
        }
        return cross;
      };
      place(order[0], 0, 0, 'across');
      const left = order.slice(1);
      let progress = true;
      while (left.length && progress) {
        progress = false;
        for (let i = 0; i < left.length; i++) {
          const w = left[i], options = [];
          for (const key of Object.keys(grid)) {
            const [cx, cy] = key.split(',').map(Number);
            if (dirsAt[key].length > 1) continue;
            const dir = dirsAt[key][0] === 'across' ? 'down' : 'across';
            for (let k = 0; k < w.answer.length; k++) {
              if (w.answer[k] !== grid[key]) continue;
              const x = dir === 'across' ? cx - k : cx, y = dir === 'down' ? cy - k : cy;
              const c = fits(w.answer, x, y, dir);
              if (c) options.push({ x, y, dir, c });
            }
          }
          if (options.length) {
            const o = pick(options);
            place(w, o.x, o.y, o.dir); left.splice(i, 1); i--; progress = true;
          }
        }
      }
      const xs = Object.keys(grid).map(k => +k.split(',')[0]), ys = Object.keys(grid).map(k => +k.split(',')[1]);
      const w = Math.max(...xs) - Math.min(...xs) + 1, hgt = Math.max(...ys) - Math.min(...ys) + 1;
      const score = placed.length * 1000 - w * hgt - Math.abs(w - hgt) * 3;
      if (!best || score > best.score) best = { score, placed, grid, minX: Math.min(...xs), minY: Math.min(...ys), w, h: hgt };
      if (attempt > 60 && best.placed.length === words.length) break;
    }
    // shift to start at 0,0 and number the starting squares
    const shift = key => { const [x, y] = key.split(',').map(Number); return K(x - best.minX, y - best.minY); };
    const grid = {};
    Object.entries(best.grid).forEach(([k, v]) => { grid[shift(k)] = v; });
    const ws = best.placed.map(p => Object.assign({}, p, { cells: p.cells.map(shift), x: p.x - best.minX, y: p.y - best.minY }));
    const numbers = {};
    let n = 0;
    ws.slice().sort((a, b) => a.y - b.y || a.x - b.x).forEach(p => {
      const k = K(p.x, p.y);
      if (!numbers[k]) numbers[k] = ++n;
      p.num = numbers[k];
    });
    return { grid, words: ws, numbers, w: best.w, h: best.h };
  }

  // ---------- stage: game (one or more rounds) ----------
  function renderGame(s, i) {
    const rounds = s.rounds || [s];
    let ri = 0;
    const area = h('div');
    const nav = navRow(() => { if (ri > 0) { ri--; show(); } else go(i - 1, true); });
    function show() {
      const r = rounds[ri];
      mistakes = 0;
      const done = () => {
        sfx.win(); confetti(90);
        if (mistakes === 0) achieve('flawless');
        say(r.done || (ri < rounds.length - 1 ? 'Round complete! Ready for the next one?' : 'You did it! Game complete! 🎉'));
        if (ri < rounds.length - 1) nav.set('Next round ▶', () => { ri++; show(); });
        else { complete(i); nav.set(nextLabel(i), () => go(i + 1)); }
      };
      put(area,
        rounds.length > 1 && h('div', { class: 'round-tag' }, `ROUND ${ri + 1}/${rounds.length}${r.title ? ' · ' + r.title : ''}`),
        r.intro && h('p', { class: 'instr', html: fmt(r.intro) }),
        GAMES[r.game](r, `s${i}r${ri}`, done));
      // Already finished this stage before? Let them skip ahead.
      if (state.complete[i]) nav.set(ri < rounds.length - 1 ? 'Skip round ▶' : nextLabel(i), () => { if (ri < rounds.length - 1) { ri++; show(); } else go(i + 1); });
      else nav.set(ri < rounds.length - 1 ? 'Next round ▶' : nextLabel(i), null, false);
      say(r.say || s.say || "Let's play!");
    }
    const el = shell(s, [mascot(''), area, nav.el]);
    show();
    return el;
  }

  // ---------- stage: brain break ----------
  function renderBreak(s, i) {
    complete(i);
    const panels = [], stops = [];
    if (s.wiggle) {
      const w = s.wiggle, secs = w.seconds || 60, per = secs / w.moves.length;
      const timer = h('div', { class: 'timer' }, h('span', null, secs));
      const move = h('div', { class: 'move' }, h('span', null, 'Press start, then copy the moves!'));
      let timerId = null;
      const startBtn = h('button', {
        class: 'btn gold', type: 'button',
        onclick() {
          if (timerId) return;
          sfx.good(); startBtn.disabled = true;
          const t0 = Date.now(); let last = -1;
          timerId = setInterval(() => {
            const el = (Date.now() - t0) / 1000, left = Math.max(0, Math.ceil(secs - el));
            timer.style.setProperty('--p', Math.min(100, el / secs * 100));
            timer.firstChild.textContent = left;
            const mi = Math.min(w.moves.length - 1, Math.floor(el / per));
            if (mi !== last) {
              last = mi; sfx.tap();
              const [emo, ...rest] = w.moves[mi].split(' ');
              move.replaceChildren(h('div', null, h('span', { class: 'move-emoji' }, emo), rest.join(' ')));
            }
            if (el >= secs) {
              clearInterval(timerId); timerId = null; sfx.win(); confetti(80);
              move.replaceChildren(h('div', null, h('span', { class: 'move-emoji' }, '⚡'), 'Energy bar full! Brain recharged!'));
              say('Phew! Your brain is all charged up!');
              startBtn.disabled = false; startBtn.textContent = '↺ Again!';
            }
          }, 200);
        },
      }, '▶ Start');
      stops.push(() => { if (timerId) clearInterval(timerId); });
      panels.push(h('div', { class: 'panel wiggle' }, h('h2', null, w.title || '🕺 Wiggle Break!'), timer, move, startBtn));
    }
    if (s.tryit) {
      const t = s.tryit;
      const CYCLE = ['', '✅', '❌'];
      const tog = () => { let v = 0; const b = h('button', { class: 'tog', type: 'button', 'aria-label': 'tick or cross' }); b.onclick = () => { v = (v + 1) % 3; b.textContent = CYCLE[v]; sfx.tap(); }; return b; };
      panels.push(h('div', { class: 'panel' },
        h('h2', null, t.title),
        t.intro && h('p', { html: fmt(t.intro) }),
        t.steps && h('ol', { class: 'steps' }, t.steps.map(st => h('li', { html: fmt(st) }))),
        t.table && h('table', { class: 'hunt' },
          h('thead', null, h('tr', null, h('th', null, 'Object'), t.table.cols.map(c => h('th', null, c)))),
          h('tbody', null, t.table.items.map(it => h('tr', null, h('td', null, it), t.table.cols.map(() => h('td', null, tog())))))),
        t.tip && h('p', { html: '<strong>Tip:</strong> ' + fmt(t.tip) })));
    }
    if (s.games !== false) { const g = brainGames(s.games); stops.push(g.stop); panels.push(g.el); }
    cleanup = () => stops.forEach(f => f());
    const nav = navRow(() => go(i - 1, true));
    nav.set(nextLabel(i), () => go(i + 1));
    return shell(s, [mascot(s.say || 'Time for a brain break! Get up and move!'), h('div', { class: 'break-grid' }, panels), nav.el]);
  }

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
  const replay = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
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
  function popText(parent, text, cls) {
    const t = h('div', { class: 'pop-text ' + cls, 'aria-hidden': 'true' }, text);
    parent.append(t); setTimeout(() => t.remove(), 1000);
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
  function heroImg(cls) {
    return AV ? h('img', { class: cls, src: AV.dataURL(AV.load().look, { scale: 4 }), alt: 'You' }) : h('div', { class: cls + ' emoji', 'aria-hidden': 'true' }, '🧒');
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
      act('hurt'); shake(stageCard); popText(hero, '-1 ❤️', 'ouch');
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
      runQuestions(qArea, qs, { key: 'quiz', boss, done: score => (boss ? boss.finale(() => results(score)) : results(score)), lost: gameOver, lastLabel: s.boss ? '⚔️ Final blow!' : 'See my score 🏆' });
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
        h('p', { class: 'stars-earned' }, `You collected ${state.stars} ${CUR.icon} in this lesson. You are LEVEL ${player().level}${player().title ? ' – ' + player().title : ''}!`),
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

  // ---------- certificate ----------
  function showCert(score, total) {
    const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    certOverlay.replaceChildren(h('div', { class: 'cert', role: 'dialog', 'aria-label': 'Certificate' },
      h('div', { class: 'cert-inner' },
        h('div', { class: 'cert-top' }, '★ QUEST COMPLETE ★'),
        AV && h('img', { class: 'cert-avatar', src: AV.dataURL(AV.load().look, { scale: 6, pet: true }), alt: '' }),
        h('p', null, 'This certificate is proudly awarded to'),
        h('div', { class: 'cert-name' }, settings.name || 'A Super Learner'),
        h('p', null, 'for completing the lesson'),
        h('div', { class: 'cert-lesson' }, (L.emoji || '') + ' ' + L.title),
        h('p', { class: 'cert-score' }, `Quiz: ${score} / ${total}   •   ${CUR.icon} ${state.stars} ${CUR.name}   •   Level ${player().level}`),
        h('div', { class: 'cert-foot' },
          h('div', null, h('div', { class: 'sig' }, M.name), h('div', { class: 'line' }, 'Teacher')),
          h('div', null, h('div', { class: 'sig' }, date), h('div', { class: 'line' }, 'Date')))),
      h('div', { class: 'cert-actions no-print' },
        h('button', { class: 'btn', type: 'button', onclick() { window.print(); } }, '🖨️ Print'),
        h('button', { class: 'btn ghost', type: 'button', onclick() { certOverlay.hidden = true; } }, 'Close'))));
    certOverlay.hidden = false;
    confetti(150);
  }
  certOverlay.addEventListener('click', e => { if (e.target === certOverlay) certOverlay.hidden = true; });

  render();
})();
