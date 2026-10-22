/* Year 3 Lesson Engine
 * Renders an interactive lesson from the data in window.LESSON.
 * This file is the core (stages, questions, navigation, gems, shared helpers). The games and the boss battle are
 * parts in shared/engine/*.js, and a lesson only loads the parts it uses: see PARTS at the bottom of this file.
 * A new game goes in the part for its kind (or a new part added to PARTS); a part gets the helpers it needs from E.
 * Stage types: welcome, review, read, video, game, break, quiz (optionally a boss battle),
 *   and three that can take the place of a read stage: teach (teach the robot: fix its mistakes), case (a detective case:
 *   answers uncover clue cards, then solve it) and investigate (predict, test it in a simulation, explain the result).
 * Brain breaks also get mini games (boss tic-tac-toe, steady hand, maze, hangman) unless the stage sets games: false.
 * A quick 'Games' break is added after the first game stage automatically (L.midBreak: false turns it off).
 * Game types: sort, match, label, order, truefalse, questions, wordsearch, crossword, trainai, pixelcopy, pixelstudio, poster,
 *   spelltest (spelling test: listen / look-cover-write-check / fix the mistake), speechmarks (tap the gaps for speech marks), syllables (tap a drum for each syllable),
 *   and arcade games: invaders, runner (two-lane word runner), platformer, blocks, labyrinth (walk a dark maze unrolling a thread; questions open gates).
 *   Simulated experiments (with missions): forces, ramp, garden, pollinate, windtest (how far the wind carries seeds),
 *   rocklab (test rocks: look closely, scratch, water drop, sink or float), fossildig (brush rock layers to uncover fossils),
 *   soillab (shake a soil in a jar of water to see its layers; pour water through it to see how much drains).
 *   clock (needs shared/clock.js): set the clock by dragging the hands, or read a clock and type the time.
 *   daydial (24-hour Day Dial), timehops (durations on a time line), knuckles (days in each month).
 *   placeblocks (Place Value Blocks: build, read and swap hundreds, tens and ones), columnsum (column method with exchanging),
 *   shop (Shop Till: pay exact amounts with coins, give change).
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
  const PKEY = 'y3:progress:' + L.id, RKEY = 'y3:records', SKEY = 'y3:settings', TKEY = 'y3:tries';

  // ---------- what he finds hard: the first try at every question, for the parent page (parents.html) ----------
  // y3:tries = { [lesson id]: { title, subject, qs: { [kind:question]: { kind, q, a, n: times asked, miss: first-try misses,
  //   at: last time, missAt: last miss, last: 'right' | 'miss', guess: his first wrong spelling } } } }
  const plain = t => String(t == null ? '' : t).replace(/<[^>]+>/g, '').replace(/\[\[([^\]|]+)(\|[^\]]*)?\]\]/g, '$1').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  function answerText(q) {
    const t = q.type || 'mcq', a = q.answer;
    if (t === 'predict') return q.then ? answerText(q.then) : '';
    if (t === 'tf') return a ? 'True' : 'False';
    if (t === 'type') return plain([].concat(a)[0]);
    if (t === 'slider') return plain((q.format ? q.format(a) : a) + (q.unit ? ' ' + q.unit : ''));
    if (t === 'build') return plain(a.join(q.join ?? ''));
    if (t === 'order') return plain((q.items || []).join(' → '));
    if (t === 'oddone') return plain(q.items[a]) + (q.reasons ? ' – ' + plain(q.reasons[q.reason]) : '');
    if (t === 'hotspot') return plain([].concat(a).map(k => q.spots[k] && q.spots[k].label).filter(Boolean).join(' / '));
    if (t === 'evidence') return `the sentence with "${plain([].concat(a)[0])}"`;
    return q.options && typeof a === 'number' ? plain(q.options[a]) : '';
  }
  function track(kind, q, first, extra) {
    try {
      const all = store.get(TKEY, {}), les = all[L.id] || (all[L.id] = { qs: {} });
      les.title = L.title; les.subject = L.subject;
      const text = plain(q.q) || plain(q.then && q.then.q), k = `${kind}:${text}`, now = Date.now();
      const r = les.qs[k] || (les.qs[k] = { kind, q: text, a: answerText(q), n: 0, miss: 0 });
      r.n++; r.at = now; r.last = first ? 'right' : 'miss';
      if (!first) { r.miss++; r.missAt = now; }
      Object.assign(r, extra);
      store.set(TKEY, all);
    } catch (e) { /* never get in the way of the lesson */ }
  }
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
  // the lesson's stages were rearranged (L.layout went up): saved stage numbers point at the wrong stages now, so start
  // again from the top. Gems, stars and badges already earned stay.
  if (L.layout && state.layout !== L.layout) {
    if (store.get(PKEY, null)) Object.assign(state, { stage: 0, maxStage: 0, complete: {} });
    state.layout = L.layout; store.set(PKEY, state);
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
  const ICON = { welcome: '🏁', review: '⏪', read: '📖', video: '🎬', game: '🎮', break: '🤸', quiz: '⚔️', teach: '🤖', case: '🕵️', investigate: '🧪' };
  const KIND = { welcome: 'Start', review: 'Recap', read: 'Reading quest', video: 'Video quest', game: 'Game', break: 'Brain break', quiz: 'Quiz', teach: 'Teach the robot', case: 'Detective case', investigate: 'Investigation' };
  const RENDER = { welcome: renderWelcome, review: renderReview, read: renderRead, video: renderVideo, game: renderGame, break: renderBreak, quiz: (s, i) => E.renderQuiz(s, i), teach: (s, i) => E.renderTeach(s, i), case: (s, i) => E.renderCase(s, i), investigate: (s, i) => E.renderInvestigate(s, i) };
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
  // A lesson that starts a new topic has a warm-up instead: the same stage, but `from` names what the child already knows
  // and has no url (e.g. { title: 'Clocks you already know', emoji: '🕐' }).
  function renderReview(s, i) {
    const area = h('div');
    const nav = navRow(() => go(i - 1, true));
    const from = s.from || {}, warm = !from.url && !!from.title;
    const start = () => {
      stopReading();
      sfx.good();
      say('Notes hidden! How much can you remember?');
      runQuestions(area, s.questions, {
        key: `s${i}rv`, kind: warm ? 'Warm-up' : 'Recap',
        done(score) {
          const finish = () => {
            sfx.win(); confetti(80); complete(i);
            say(score === s.questions.length ? 'Your memory is EPIC! Now for something new…' : warm ? 'Brain warmed up! Now for something new…' : 'Great recap! Now for something new…');
            put(area, h('div', { class: 'results' }, h('div', { class: 'trophy' }, '🧠'), h('h2', null, warm ? 'WARM-UP COMPLETE!' : 'RECAP COMPLETE!'),
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
        h('h3', null, warm ? `🔥 Warm-up: ${from.emoji || ''} ${from.title}` : `⏪ Last time: ${from.emoji || ''} ${from.title || 'our last lesson'}`),
        h('ul', null, factEls),
        h('div', { class: 'read-row' }, reader.btn),
        from.url && h('a', { class: 'recap-link', href: from.url }, '↺ Replay that lesson')),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn big green ready', type: 'button', onclick: start }, '🧠 Test my memory!')));
    nav.set(nextLabel(i), () => go(i + 1), !!state.complete[i]);
    return shell(s, [mascot(s.say || (warm ? 'New topic! First, a quick warm-up with what you already know. Read the notes, then test your memory!' : 'Welcome back! First, a quick recap of last time. Read the notes, then test your memory!')), area, nav.el]);
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
      btn.textContent = '🔊 Read to me'; btn.classList.remove('on'); btn.disabled = false;
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
      if (playing) return; // locked until the whole page has been read (no spamming)
      if (!canSpeak) { say('Sorry – this device can\'t read aloud.'); return; }
      stopReading();
      try { speechSynthesis.cancel(); } catch (e) { /* ignore */ }
      playing = true; btn.textContent = '🔊 Reading…'; btn.classList.add('on'); btn.disabled = true;
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
        let tracked = false;
        const onRight = (el, first) => {
          if (!tracked) { tracked = true; track('Reading check', c.check, first); }
          sfx.good();
          if (first) { award(key, el); say(c.check.yes || praise()); } else say('You got there! Next time, read carefully first to win the gem.');
          fb.className = 'feedback good'; fb.hidden = false; fb.innerHTML = '✔ ' + fmt(c.check.explain || 'Correct!', false);
          answered = true; nav.set(label, goNext);
          if (!c.check.explain) nav.auto();
        };
        const onMiss = () => {
          if (!tracked) { tracked = true; track('Reading check', c.check, false); }
          say(c.check.hint || 'Not quite! Read the page again to find the answer.');
        };
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
                if (firstTry) track('Reading check', c.check, true);
                if (firstTry) { award(key, b); say(c.check.yes || praise()); } else say('You got there! Next time, read carefully first to win the gem.');
                fb.className = 'feedback good'; fb.hidden = false; fb.innerHTML = '✔ ' + fmt(c.check.explain || 'Correct!', false);
                answered = true; nav.set(label, goNext);
                if (!c.check.explain) nav.auto();
              } else {
                if (firstTry) track('Reading check', c.check, false);
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
    // each tile keeps its own value: pixel icons may swap the emoji in its text for a picture
    const pool = h('div', { class: 'bld-pool' }, shuffle(q.answer.concat(q.extra || [])).map(t => Object.assign(h('button', { class: 'bld-tile', type: 'button', onclick: e => place(e.currentTarget) }, t), { _t: t })));
    const btn = checkBtn('✔ Check', () => {
      if (done) return;
      const built = [...row.querySelectorAll('.bld-tile')].map(b => b._t);
      if (!built.length) { shake(pool); return; }
      if (built.join(join) === q.answer.join(join)) { done = true; btn.disabled = true; row.classList.add('right'); onRight(row, !wrong); }
      else { wrong = true; shake(row); sfx.bad(); onMiss(row); }
    });
    return [row, pool, h('div', { class: 'btn-row' }, btn)];
  };

  // type: write the answer. { q, answer: 'word' or ['word', 'other spelling'], before, after, placeholder }
  // Capitals, spaces and punctuation don't matter (so 'Half past 3' = 'half past 3.').
  // After two wrong tries the answer is shown, with a button to use it and carry on, so nobody gets stuck.
  QTYPES.type = (q, onRight, onMiss) => {
    const clean = t => String(t).toLowerCase().replace(/[^a-z0-9£:]+/g, ' ').trim();
    const ok = [].concat(q.answer).map(clean);
    let misses = 0, done = false;
    const box = h('input', { class: 'q-type', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Your answer', placeholder: q.placeholder || 'Type your answer' });
    const reveal = h('div', { class: 'q-reveal', hidden: true });
    const right = () => { done = true; box.classList.add('right'); box.disabled = btn.disabled = true; reveal.hidden = true; onRight(box, !misses); };
    const go = () => {
      if (done) return;
      const v = clean(box.value);
      if (!v) { box.focus(); return; }
      if (ok.includes(v)) return right();
      misses++; replay(box, 'wrong'); shake(box); sfx.bad(); onMiss(box); box.select();
      if (misses === 2) {
        put(reveal, h('span', null, '💡 The answer is: ', h('b', null, [].concat(q.answer)[0])),
          h('button', { class: 'btn', type: 'button', onclick() { sfx.tap(); box.value = [].concat(q.answer)[0]; right(); } }, '✔ Use it and carry on'));
        reveal.hidden = false;
      }
    };
    const btn = checkBtn('✔ Check', go);
    box.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    return h('div', { class: 'q-type-wrap' },
      h('div', { class: 'q-type-row' }, q.before && h('span', null, q.before), box, q.after && h('span', null, q.after), btn), reveal);
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
  // kind: what the parent page calls these questions (see track)
  // countLabel: a heading to show instead of "Question 1 of 3"
  function runQuestions(area, qs, { key, done, boss, lost, lastLabel = 'Finish ▶', kind = boss ? 'Boss battle' : 'Game question', countLabel = null }) {
    let qi = 0, score = 0;
    function show() {
      const q = qs[qi], isLast = qi === qs.length - 1;
      let tracked = false; // only the first try counts
      const log = first => { if (!tracked) { tracked = true; track(kind, q, first); } };
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
        log(first);
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
        log(false);
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
        h('div', { class: 'q-count' }, countLabel || `Question ${qi + 1} of ${qs.length}`),
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
        key: `s${i}v`, kind: 'Video quest',
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
  // tapPlaces: with only one place to drop on, tapping a chip puts it straight there (no second tap needed)
  function dropGame({ items, makeChip, targets, check, onRight, onWrong, tapHint, tapPlaces = false }) {
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
      draggable(chip, { tap: () => (tapPlaces && targets.length === 1 ? !chip.classList.contains('placed') && attempt(chip, targets[0]) : select(chip)), drop: z => { if (z) attempt(chip, z); } });
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
  // Each game: (round, gemKeyPrefix, done, hooks) → element. The parts in shared/engine/ fill this in:
  // the everyday games (sort, match, order …) are in games.js, which every lesson loads.
  const GAMES = {};

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
  // a 🔊 press (force) while the last line is still being spoken is ignored, so it can't be spammed;
  // speakingUntil is a time-out in case a device never fires onend
  let speakingUntil = 0, lastSpoken = null;
  function speak(text, { rate = 0.85, force = false, lang = null } = {}) {
    if (!canSpeak || (settings.muted && !force)) return false;
    if (force && Date.now() < speakingUntil) return true;
    try {
      const v = voiceFor(lang || 'en-GB');
      if (lang && !v) return false;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (v) u.voice = v;
      u.lang = v ? v.lang : 'en-GB'; u.rate = rate;
      speakingUntil = Date.now() + 1500 + String(text).length * 90 / rate;
      u.onend = u.onerror = () => { if (speakingUntil && u === lastSpoken) speakingUntil = 0; };
      lastSpoken = u;
      speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  }

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

  // ---------- stage: game (one or more rounds) ----------
  function renderGame(s, i) {
    if (s.pick && s.rounds) return renderPick(s, i);
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
  // A game stage with pick: true lets the player choose which round to play: one finished round completes the stage,
  // and the rest stay open to play for fun. Rounds add emoji + blurb for their menu card; pick can be { title, say }.
  function renderPick(s, i) {
    const opt = typeof s.pick === 'object' ? s.pick : {};
    const played = new Set(s.rounds.map((r, ri) => ri).filter(ri => state.awarded[`pick:s${i}:${ri}`]));
    const area = h('div');
    let inRound = false;
    const nav = navRow(() => { if (inRound) menu(); else go(i - 1, true); });
    const ready = () => state.complete[i] ? nav.set(nextLabel(i), () => go(i + 1)) : nav.set(nextLabel(i), null, false);
    function menu() {
      inRound = false; mistakes = 0;
      say(played.size ? (opt.again || 'Brilliant! Play another game, or carry on when you are ready.') : (opt.say || s.say || 'Pick a game!'));
      put(area, h('h3', { class: 'px-pick-title' }, opt.title || '🕹️ Which game do you want to play?'),
        h('div', { class: 'px-choices pick-games' }, s.rounds.map((r, ri) =>
          h('button', { class: 'px-choice', type: 'button', onclick() { sfx.tap(); play(ri); } },
            h('span', { class: 'pick-game-emoji', 'aria-hidden': 'true' }, r.emoji || '🎮'),
            h('span', { class: 'px-choice-name' }, r.title),
            r.blurb && h('span', { class: 'pick-game-blurb' }, r.blurb),
            played.has(ri) && h('span', { class: 'px-choice-done' }, '✔')))));
      ready();
    }
    function play(ri) {
      const r = s.rounds[ri];
      inRound = true; mistakes = 0;
      const other = h('button', { class: 'btn', type: 'button', onclick() { sfx.tap(); menu(); } }, '↩ Pick a different game');
      const done = () => {
        sfx.win(); confetti(90);
        if (mistakes === 0) achieve('flawless');
        played.add(ri); state.awarded[`pick:s${i}:${ri}`] = true; save(); complete(i);
        say(r.done || 'You did it! Game complete! 🎉');
        other.textContent = '↩ Play another game';
        ready();
      };
      put(area,
        h('div', { class: 'btn-row px-back' }, other),
        r.intro && h('p', { class: 'instr', html: fmt(r.intro) }),
        GAMES[r.game](r, `s${i}r${ri}`, done));
      ready();
      say(r.say || "Let's play!");
    }
    const el = shell(s, [mascot(''), area, nav.el]);
    menu();
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
    if (s.games !== false) { const g = E.brainGames(s.games); stops.push(g.stop); panels.push(g.el); }
    cleanup = () => stops.forEach(f => f());
    const nav = navRow(() => go(i - 1, true));
    nav.set(nextLabel(i), () => go(i + 1));
    return shell(s, [mascot(s.say || 'Time for a brain break! Get up and move!'), h('div', { class: 'break-grid' }, panels), nav.el]);
  }

  const replay = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
  function popText(parent, text, cls) {
    const t = h('div', { class: 'pop-text ' + cls, 'aria-hidden': 'true' }, text);
    parent.append(t); setTimeout(() => t.remove(), 1000);
  }
  function heroImg(cls) {
    return AV ? h('img', { class: cls, src: AV.dataURL(AV.load().look, { scale: 4 }), alt: 'You' }) : h('div', { class: cls + ' emoji', 'aria-hidden': 'true' }, '🧒');
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

  // ---------- the engine's parts (shared/engine/*.js) ----------
  // The games and the boss battle live in their own files, and a lesson only loads the ones it uses: PARTS says which
  // file holds which game (games, breaks, boss and finishers – the boss's finishing moves – are used by every lesson; stages holds the teach, case and investigate stages). Each part is a function that gets E, the helpers
  // it needs from here, and adds its games to GAMES (or returns what the core calls, like renderQuiz).
  const E = { AV, CUR, GAMES, L, M, RKEY, ROBOT_PAL, SPR, WARDROBE, achieve, arcadeCanvas, award, canSpeak,
    canvasFont, complete, confetti, draggable, dropGame, emojiAt, esc, fill, fmt, gameLoop, go, h, heroImg, holdButton, keys,
    mascot, missionRunner, navRow, nextLabel, oops, pic, pick, player, popText, praise, put, pxDraw, pxText, questionWidget, replay,
    resultsTable, runQuestions, save, saveRecord, say, seq, settings, sfx, shake, shell, showCert, shuffle, skyAndGround,
    speak, spriteCanvas, store, toGame, toast, tone, track };
  Object.defineProperties(E, { // reassigned here, so the parts read them live
    state: { get: () => state, set: v => { state = v; } },
    stageCard: { get: () => stageCard, set: v => { stageCard = v; } },
  });
  const PARTS = {
    future: ['trainai', 'pixelcopy', 'pixelstudio', 'poster'],
    spelling: ['spelltest', 'speechmarks', 'syllables'],
    arcade: ['invaders', 'platformer', 'runner', 'blocks', 'labyrinth'],
    science: ['forces', 'ramp', 'garden', 'windtest', 'pollinate', 'rocklab', 'fossildig'],
    time: ['clock', 'daydial', 'timehops', 'knuckles'],
    number: ['placeblocks', 'columnsum', 'shop'],
    earth: ['soillab'],
    world: ['worldmap', 'cook', 'phrases'],
  };
  function partsFor(lesson) {
    const games = new Set();
    (function walk(o) { // every game: rounds, recap games, investigation tests, anywhere in the stages
      if (Array.isArray(o)) o.forEach(walk);
      else if (o && typeof o === 'object') { if (typeof o.game === 'string') games.add(o.game); Object.values(o).forEach(walk); }
    })(lesson.stages);
    const stages = lesson.stages.some(s => ['teach', 'case', 'investigate'].includes(s.type)) ? ['stages'] : [];
    return ['games', 'breaks', 'boss', 'finishers', ...stages, ...Object.keys(PARTS).filter(p => PARTS[p].some(g => games.has(g)))];
  }
  window.PixelkidEngine = { part(name, make) { Object.assign(E, make(E) || {}); } };
  const here = document.currentScript && document.currentScript.src;
  Promise.all(partsFor(L).map(p => new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = new URL(`engine/${p}.js`, here || location.href).href;
    s.onload = ok; s.onerror = () => fail(new Error(`couldn't load shared/engine/${p}.js`));
    document.head.append(s);
  }))).then(render, e => { main.replaceChildren(h('p', { class: 'lead' }, '⚠️ This lesson could not load. Check your internet connection and refresh the page.')); console.error(e); });
})();
