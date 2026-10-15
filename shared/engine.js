/* Year 3 Lesson Engine
 * Renders an interactive lesson from the data in window.LESSON.
 * Stage types: welcome, review, read, video, game, break, quiz (optionally a boss battle).
 * Brain breaks also get mini games (boss tic-tac-toe, steady hand, maze, hangman) unless the stage sets games: false.
 * Game types: sort, match, label, order, truefalse, questions, wordsearch, crossword, trainai, pixelcopy, pixelstudio, poster,
 *   spelltest (spelling test: listen / look-cover-write-check / fix the mistake),
 *   and arcade games: invaders, platformer, blocks.
 * Questions can set optionsHtml: true to show pictures (HTML) as the answer buttons.
 * Question types (quiz, video, questions game): mcq, tf, gap, order.
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
  function shake(el) { if (!el) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }

  // ---------- storage (optional; everything works without it) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  };
  const PKEY = 'y3:progress:' + L.id, RKEY = 'y3:records', SKEY = 'y3:settings';
  const fresh = () => ({ stage: 0, maxStage: 0, stars: 0, awarded: {}, complete: {}, ach: {} });
  let state = Object.assign(fresh(), store.get(PKEY, {}));
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
    hit: () => { seq([150, 90], 0.06, 'sawtooth', 0.08); },
    zap: () => seq([1200, 900, 600, 300], 0.04, 'sawtooth', 0.04),
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
  const levelOf = n => Math.floor(n / PER_LEVEL) + 1;
  function updateStars(bump) {
    starCount.textContent = state.stars;
    xpLevel.textContent = 'LEVEL ' + levelOf(state.stars);
    xpFill.style.width = (state.stars % PER_LEVEL) / PER_LEVEL * 100 + '%';
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
    const before = levelOf(state.stars);
    state.awarded[key] = true; state.stars++;
    if (AV) {
      const total = AV.earn(1); // add to the wallet first, so a brand-new wallet never counts this gem twice
      if (total % 25 === 0) setTimeout(() => { sfx.achieve(); toast('NEW GEAR TIME!', `💎 ${AV.wallet().balance} gems to spend in the Wardrobe`, '🛍️'); }, 1500);
    }
    save(); saveRecord({});
    flyStar(fromEl); sfx.star();
    setTimeout(() => updateStars(true), 650);
    const lvl = levelOf(state.stars);
    if (lvl > before) setTimeout(() => {
      sfx.levelup(); confetti(60);
      toast('LEVEL UP!', `You reached level ${lvl}!`, '⬆️', 'level');
      if (lvl >= 5) achieve('level5');
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
  function navRow(onBack) {
    const back = h('button', { class: 'btn ghost', type: 'button', onclick() { sfx.tap(); onBack(); } }, '◀ Back');
    const next = h('button', { class: 'btn big', type: 'button' }, 'Next ▶');
    let handler = null;
    next.addEventListener('click', () => { if (!next.disabled && handler) { sfx.tap(); handler(); } });
    return {
      el: h('div', { class: 'navrow' }, back, next),
      set(label, fn, enabled = true) {
        next.textContent = label; handler = fn; next.disabled = !enabled;
        next.classList.toggle('ready', enabled);
      },
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
      sfx.good();
      say('Notes hidden! How much can you remember?');
      runQuestions(area, s.questions, {
        key: `s${i}rv`,
        done(score) {
          sfx.win(); confetti(80); complete(i);
          say(score === s.questions.length ? 'Your memory is EPIC! Now for something new…' : 'Great recap! Now for something new…');
          put(area, h('div', { class: 'results' }, h('div', { class: 'trophy' }, '🧠'), h('h2', null, 'RECAP COMPLETE!'),
            h('p', { class: 'lead' }, `You remembered ${score} of ${s.questions.length} first time.`)));
          nav.set(nextLabel(i), () => go(i + 1));
        },
      });
    };
    put(area,
      h('div', { class: 'panel-inner recap' },
        h('h3', null, `⏪ Last time: ${from.emoji || ''} ${from.title || 'our last lesson'}`),
        h('ul', null, (s.facts || []).map(f => h('li', { html: fmt(f, false) }))),
        from.url && h('a', { class: 'recap-link', href: from.url }, '↺ Replay that lesson')),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn big green ready', type: 'button', onclick: start }, '🧠 Test my memory!')));
    nav.set(nextLabel(i), () => go(i + 1), !!state.complete[i]);
    return shell(s, [mascot(s.say || 'Welcome back! First, a quick recap of last time. Read the notes, then test your memory!'), area, nav.el]);
  }

  // ---------- stage: read ----------
  function renderRead(s, i) {
    let ci = enteringBackwards ? s.cards.length - 1 : 0;
    const area = h('div');
    const dots = h('div', { class: 'dots', 'aria-hidden': 'true' });
    const nav = navRow(() => { if (ci > 0) { ci--; show(); } else go(i - 1, true); });

    function show() {
      const c = s.cards[ci];
      const key = `s${i}c${ci}`;
      let answered = !c.check || !!state.awarded[key];
      const goNext = () => {
        if (ci < s.cards.length - 1) { ci++; show(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
        else { complete(i); go(i + 1); }
      };
      const label = ci < s.cards.length - 1 ? 'Next page ▶' : nextLabel(i);

      let check = null;
      if (c.check) {
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

      put(area, h('div', { class: 'story-anim' },
        h('div', { class: 'panel-inner story' },
          pic(c.pic),
          h('div', { class: 'story-text' },
            c.title && h('h2', { class: 'story-title' }, c.title),
            [].concat(c.text).map(p => h('p', { html: fmt(p) })))),
        check));
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
    let wrong = false;
    if (q.type === 'order') {
      const text = h('p', { class: 'q-text', html: fmt(q.q, false) });
      const body = GAMES.order({ items: q.items, hint: q.hint }, '', () => onRight(body, !wrong), { noStars: true, quiet: true, wrong: el => { wrong = true; onMiss(el); } });
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

  // Runs a list of questions one at a time inside `area`; calls done(firstTryScore) at the end.
  // In a boss battle, boss.zap(qi) returns true when the last heart is gone; then lost(score) is called.
  function runQuestions(area, qs, { key, done, boss, lost, lastLabel = 'Finish ▶' }) {
    let qi = 0, score = 0;
    function show() {
      const q = qs[qi], isLast = qi === qs.length - 1;
      const fb = h('div', { class: 'feedback', hidden: true });
      const nextBtn = h('button', {
        class: 'btn', type: 'button', hidden: true,
        onclick() {
          sfx.tap(); qi++;
          const next = () => { if (qi < qs.length) show(); else done(score); };
          if (boss && boss.dodgeDue()) boss.dodge(area, dead => (dead ? lost(score) : next()));
          else next();
        },
      }, isLast ? lastLabel : 'Next question ▶');
      const onRight = (el, first) => {
        if (first) { score++; award(`${key}:${qi}`, el); }
        sfx.good(); say(praise());
        fb.className = 'feedback good'; fb.hidden = false;
        fb.innerHTML = '✔ ' + fmt(q.explain || (first ? 'Correct!' : 'You got there!'), false);
        if (boss) { boss.hit(); if (boss.dodgeDue()) nextBtn.textContent = '⚠️ Get ready to DODGE! ▶'; }
        nextBtn.hidden = false;
      };
      const onMiss = () => {
        say(q.hint ? '💡 ' + q.hint : oops());
        fb.className = 'feedback try'; fb.hidden = false;
        fb.innerHTML = '💡 ' + fmt(q.hint || 'Not quite – have another go!', false);
        if (boss && boss.zap(qi)) {
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
        const b = h('button', { class: 'match-item', type: 'button', html: fmt(r.pairs[idx][side], false) });
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

    order(r, key, done, hooks = {}) {
      let n = 0;
      const slots = r.items.map(() => h('li', null, '…'));
      const pool = shuffle(r.items).map(t => h('button', {
        class: 'opt', type: 'button', html: fmt(t, false),
        onclick(e) {
          const b = e.currentTarget;
          if (t === r.items[n]) {
            slots[n].textContent = t; slots[n].classList.add('filled');
            b.remove();
            if (!hooks.noStars) award(key + ':' + n, slots[n]);
            n++;
            if (n === r.items.length) done();
            else if (hooks.quiet) sfx.tap(); else { sfx.good(); say(n === 1 ? 'Great start! What comes next?' : praise()); }
          } else {
            shake(b); sfx.bad();
            if (hooks.wrong) hooks.wrong(b);
            else say(r.hint || (n === 0 ? 'Hmm, what happens first?' : 'What happens next?'));
          }
        },
      }));
      return h('div', { class: 'game order' },
        h('ol', { class: 'order-list' }, slots),
        h('div', { class: 'tray-label' }, '👇 Tap them in the right order'),
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
      el: h('div', { class: 'px-editor' }, tools, h('div', { class: 'px-palette' }, swatches), h('div', { class: 'px-board' }, grid, mirrorLine)),
      get cells() { return cells; },
      load(c) { undo.push(cells.slice()); cells = c.slice(); draw(); },
      flash(indexes) { indexes.forEach(i => cellEls[i].classList.add('px-wrong')); setTimeout(() => indexes.forEach(i => cellEls[i].classList.remove('px-wrong')), 1600); },
    };
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

  // Copy the picture: paint the grid until it matches the target sprite.
  GAMES.pixelcopy = function (r, key, done) {
    const rowsT = r.target, w = Math.max(...rowsT.map(x => x.length)), rows = rowsT.length;
    const want = [];
    rowsT.forEach(row => { for (let x = 0; x < w; x++) want.push(r.colors[row[x]] || null); });
    const used = [...new Set(want.filter(Boolean))];
    const names = r.names || {};
    const palette = used.map(c => [c, names[c] || 'colour']);
    const meter = h('div', { class: 'px-meter' });
    let finished = false;
    const wrongIdx = () => want.map((c, i) => (ed.cells[i] || null) === c ? -1 : i).filter(i => i >= 0);
    const check = () => {
      const wrong = wrongIdx();
      const ok = want.length - wrong.length;
      put(meter, h('div', { class: 'px-meter-bar' }, h('div', { style: `width:${ok / want.length * 100}%` })), `${ok} of ${want.length} squares match`);
      if (!wrong.length && !finished) { finished = true; sfx.good(); award(key + ':done', meter); confetti(60); say(r.done || 'PERFECT COPY! You are a real pixel artist!'); done(); }
    };
    const ed = pixelEditor({ w, h: rows, palette, mirror: !!r.mirror, mirrorToggle: true, onStroke: check });
    const hintBtn = h('button', { class: 'btn gold', type: 'button', onclick() { const wr = wrongIdx(); ed.flash(wr); sfx.tap(); const empties = wr.filter(i => !ed.cells[i] || !want[i]).length;
      say(!wr.length ? 'Everything matches!' : `${wr.length} square${wr.length > 1 ? 's need' : ' needs'} fixing – look for the flashing red!` + (empties ? ' Blue-checked squares are empty – they are not white!' : '')); } }, '🔍 Show mistakes');
    check();
    return h('div', { class: 'game pixelcopy' },
      h('div', { class: 'px-wrap' },
        h('div', { class: 'panel-inner px-target' }, h('h3', null, '🎯 Copy this'), pic(Pixel.svg(rowsT, r.colors), 'px-target-pic'),
          r.tips && h('ul', { class: 'px-tips' }, r.tips.map(t => h('li', { html: fmt(t, false) })))),
        h('div', null, ed.el, meter, h('div', { class: 'btn-row' }, hintBtn))));
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
        lines.forEach((ln, i) => ctx.fillText(ln, cx, cy + (i - (lines.length - 1) / 2) * px * 1.15));
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

  const canSpeak = 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
  // read words aloud in a British voice (the 🔊 button always speaks; automatic reading respects mute)
  function speak(text, { rate = 0.85, force = false } = {}) {
    if (!canSpeak || (settings.muted && !force)) return false;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text), vs = speechSynthesis.getVoices();
      const v = vs.find(x => /en[-_]GB/i.test(x.lang)) || vs.find(x => /^en/i.test(x.lang));
      if (v) u.voice = v;
      u.lang = v ? v.lang : 'en-GB'; u.rate = rate;
      speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  }

  GAMES.spelltest = function (r, key, done) {
    const mode = r.mode || 'listen', scene = r.scene || 'potion';
    const prize = r.prize || (scene === 'egg' ? 'your baby dragon' : 'the magic potion');
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
      sceneBox.classList.toggle('wobble', scene === 'egg' && !full && count > 0);
      if (scene === 'egg') sceneBox.innerHTML = full ? BABY_DRAGON : eggSVG(p);
      else sceneBox.innerHTML = full ? POTION : cauldronSVG(p, count);
      sceneBox.classList.toggle('bubbling', scene === 'potion' && count > 0 && !full);
      sceneCap.textContent = full ? (scene === 'egg' ? `🐲 ${prize} has hatched!` : `🧪 ${prize} is ready!`)
        : scene === 'egg' ? `🥚 ${count}/${words.length} words · each one cracks the egg` : `🧪 ${count}/${words.length} ingredients in ${prize}`;
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
          h('h2', null, scene === 'egg' ? '🐲 IT HATCHED!' : '🧪 POTION BREWED!'),
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
  function pxText(ctx, text, x, y, size, color = '#fff', align = 'center') {
    ctx.font = `700 ${size}px "Pixelify Sans", monospace`;
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
    ship: ['.....r.....', '....www....', '....wcw....', '..wwwwwww..', '.wwwwwwwww.', 'wwwwwwwwwww', 'rr.r...r.rr'],
    robot: ['.....yy.....', '.....kk.....', '..kkkkkkkk..', '.kllllllllk.', '.klccllcclk.', '.klccllcclk.', '.kllllllllk.', '.kllkkkkllk.', '.kllllllllk.', '..kkkkkkkk..', '.kkggggggkk.', 'kgkgrggygkgk', 'kgkggggggkgk', '..kggggggk..', '..kgk..kgk..', '..kkk..kkk..'],
    robotRun: ['.....yy.....', '.....kk.....', '..kkkkkkkk..', '.kllllllllk.', '.klccllcclk.', '.klccllcclk.', '.kllllllllk.', '.kllkkkkllk.', '.kllllllllk.', '..kkkkkkkk..', '.kkggggggkk.', 'kgkgrggygkgk', 'kgkggggggkgk', '..kggggggk..', '.kgk....kgk.', '.kkk....kkk.'],
    flag: ['k.......', 'kggggg..', 'kgggggg.', 'kggggg..', 'k.......', 'k.......', 'k.......', 'k.......', 'k.......', 'k.......'],
  };
  const ROBOT_PAL = { k: '#1b1b1b', l: '#d9dde3', c: '#2ee6d6', g: '#8e9aa8', y: '#ffcc33', r: '#ff5252' };

  // ===== Answer Invaders: shoot the aliens carrying the right answers =====
  // r.waves: [{ prompt, items: [{ label, ok, why }] }]
  // Spelling waves: { spell: 'unlock', clue: 'open with a key', decoys: 'ae' } – shoot the letters in order to spell the word.
  GAMES.invaders = function (r, key, done) {
    const W = 640, H = 440;
    const { cv, ctx } = arcadeCanvas(W, H);
    const colors = ['#7cfc3a', '#ff7eb6', '#2ee6d6', '#ffb800', '#b44dff', '#ff8c1a'];
    const alienSpr = colors.map(c => [SPR.alienA, SPR.alienB].map(rows => spriteCanvas(rows, { g: c, p: '#ffffff', k: '#1b1b1b', w: '#ffffff' }, 4)));
    const shipSpr = spriteCanvas(SPR.ship, { w: '#e8f4ff', c: '#2ee6d6', r: '#ff5252' }, 4);
    const stars = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: Math.random() < 0.2 ? 3 : 2, t: Math.random() * 6 }));
    let wi = -1, aliens = [], ox = 0, oy = 0, dir = 1, shot = null, cool = 0, banner = null, finished = false, time = 0;
    const ship = { x: W / 2, target: null, fireOnArrive: false, move: 0 };
    const parts = [];
    let autopilot = false, spellAt = 0, misses = 0;

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
      banner = { text: `WAVE ${wi + 1}`, t: 1.4 };
      if (wave.spell) { say(`Spell the word: ${wave.clue || wave.spell}. Shoot the letters in order!`); speak(wave.spell); }
      else say(wave.prompt);
    }
    // in a spelling wave only the NEXT letter counts
    const isRight = a => { const w = r.waves[wi]; return a.it.ok && (!w || !w.spell || a.it.label === w.spell.toLowerCase()[spellAt]); };
    const promptText = w => w.spell ? `${w.clue ? w.clue + ': ' : 'SPELL: '}${[...w.spell.toLowerCase()].map((c, k) => (k < spellAt ? c : '_')).join(' ')}` : w.prompt;
    const alienPos = a => [W / 2 + a.bx + ox, a.by + oy];
    function fire() {
      if (shot || cool > 0 || finished) return;
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
          banner = { text: 'WAVE CLEAR!', t: 1.6 }; sfx.win();
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
      // shot
      if (shot) {
        shot.y -= 640 * dt;
        for (const a of aliens) {
          if (!a.alive || a.leaving) continue;
          const [x, y] = alienPos(a);
          if (Math.abs(shot.x - x) < 44 && shot.y < y + 36 && shot.y > y - 24) { hit(a); shot = null; break; }
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
        ctx.font = '700 15px "Pixelify Sans", monospace';
        const tw = ctx.measureText(a.it.label).width + 14;
        ctx.fillStyle = a.flash ? 'rgba(229,57,53,.9)' : 'rgba(0,0,0,.7)';
        ctx.fillRect(x - tw / 2, y + 22, tw, 24);
        pxText(ctx, a.it.label, x, y + 34, 15, '#fff');
      });
      if (shot) { ctx.fillStyle = '#7cfc3a'; ctx.fillRect(shot.x - 2, shot.y - 12, 4, 16); ctx.fillStyle = '#e8ffe0'; ctx.fillRect(shot.x - 1, shot.y - 12, 2, 6); }
      parts.forEach(p => { ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, 5, 5); });
      ctx.drawImage(shipSpr, ship.x - shipSpr.width / 2, H - 52);
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
      h('p', { class: 'arc-tip' }, '👆 Tap above an alien to fly there and fire – or use ◀ 🔥 ▶. Only shoot the RIGHT answers!'));
    keys(root, {
      ArrowLeft: [() => { ship.move = -1; }, () => { if (ship.move < 0) ship.move = 0; }],
      ArrowRight: [() => { ship.move = 1; }, () => { if (ship.move > 0) ship.move = 0; }],
      ' ': [fire],
    });
    root._test = { frames(n) { for (let i = 0; i < n; i++) step(1 / 60); }, autopilot() { autopilot = true; }, shootWrong() { const a = aliens.find(o => o.alive && !o.it.ok); if (a) hit(a); }, get finished() { return finished; } };
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
        ctx.font = '700 14px "Pixelify Sans", monospace';
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
      c.font = `${Math.round(r() * 1.5)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🏁', ex, ey);
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
      c.fillText('💎', M + (n - 0.5) * cs, M + (n - 0.5) * cs);
      const px = M + me[0] * cs, py = M + me[1] * cs;
      if (hero) {
        const hh = cs * 0.84, hw = hh * hero.width / hero.height;
        c.imageSmoothingEnabled = false; c.drawImage(hero, px + (cs - hw) / 2, py + (cs - hh) / 2, hw, hh);
      } else c.fillText('🙂', px + cs / 2, py + cs / 2);
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
  };
  const HERO_LINES = {
    hit: ['Take that!', 'Pow!', 'Bullseye!', 'Got you!', 'Hi-yah!', 'Boom!', 'Easy!'],
    hurt: ['Ouch!', 'Oof!', 'Eek!', 'Yikes!', 'I\'ll get the next one!'],
    win: 'Victory! 🏆',
  };
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
    const p = h('div', { class: 'projectile ' + cls, 'aria-hidden': 'true' }, emoji);
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
  function heroImg(cls) {
    return AV ? h('img', { class: cls, src: AV.dataURL(AV.load().look, { scale: 4 }), alt: 'You' }) : h('div', { class: cls + ' emoji', 'aria-hidden': 'true' }, '🧒');
  }
  function heartsRow(n) {
    return Array.from({ length: LIVES }, (_, k) => h('span', { class: 'heart' + (k < n ? '' : ' lost') }, k < n ? '❤️' : '🖤'));
  }

  // Undertale-style dodge round: the avatar is the "soul" in a box and the boss fires its attack emoji in patterns.
  // Arrow keys / WASD or drag anywhere on the box. A hit costs at most one heart per round; a perfect dodge earns gems.
  // end({ hit, dead }) is called when the round is over.
  function dodgeRound(area, b, round, { loseHeart, end }) {
    const W = 360, H = 240, DUR = 7.5, speed = 1 + 0.15 * round;
    const cvs = h('canvas', { class: 'dodge-box', width: W * 2, height: H * 2, 'aria-label': 'Dodge the attacks! Use the arrow keys or drag to move.' });
    const ctx = cvs.getContext('2d'); ctx.scale(2, 2); ctx.imageSmoothingEnabled = false;
    const timer = h('div', { class: 'dodge-timer' }, h('div', { class: 'dodge-timer-fill' }));
    const status = h('div', { class: 'dodge-status' }, '3…');
    put(area, h('div', { class: 'dodge' },
      h('div', { class: 'dodge-title' }, `⚠️ ${b.name} attacks! DODGE!`),
      h('div', { class: 'dodge-help' }, '⬅️⬆️⬇️➡️ arrow keys, or drag your finger on the box'),
      cvs, timer, status));
    // sprites: the avatar (or a heart) and the boss's attack, drawn once
    const me = AV ? AV.draw(AV.load().look, { scale: 2 }) : null;
    const pw = me ? me.width : 22, ph = me ? me.height : 22;
    const shot = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 48;
      const g = c.getContext('2d'); g.font = '36px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(b.attack || '💥', 24, 27); return c;
    })();
    const p = { x: W / 2, y: H / 2 }, keys = {}, bullets = [];
    let t = -1.5, last = 0, hitAt = -9, hit = false, over = false, raf = 0, spawnT = 0;
    // two random patterns per round
    const PATTERNS = {
      rain(dt) { if ((spawnT += dt) > 0.32 / speed) { spawnT = 0; bullets.push({ x: 10 + Math.random() * (W - 20), y: -12, vx: 0, vy: (80 + Math.random() * 50) * speed, r: 10 }); } },
      sweep(dt) {
        if ((spawnT += dt) > 0.9 / speed) {
          spawnT = 0; const left = Math.random() < 0.5, gap = 30 + Math.random() * (H - 100);
          for (let y = 12; y < H; y += 26) if (y < gap || y > gap + 64) bullets.push({ x: left ? -12 : W + 12, y, vx: (left ? 1 : -1) * 95 * speed, vy: 0, r: 9 });
        }
      },
      aimed(dt) {
        if ((spawnT += dt) > 0.5 / speed) {
          spawnT = 0; const a = Math.random() * Math.PI * 2, x = W / 2 + Math.cos(a) * 220, y = H / 2 + Math.sin(a) * 160;
          const d = Math.hypot(p.x - x, p.y - y) || 1, v = 110 * speed;
          bullets.push({ x, y, vx: (p.x - x) / d * v, vy: (p.y - y) / d * v, r: 10 });
        }
      },
      ring(dt) {
        if ((spawnT += dt) > 1.3 / speed) {
          spawnT = 0; const cx = 40 + Math.random() * (W - 80), n = 10, off = Math.random();
          for (let k = 0; k < n; k++) { const a = (k + off) / n * Math.PI * 2; bullets.push({ x: cx, y: 20, vx: Math.cos(a) * 80 * speed, vy: Math.sin(a) * 80 * speed + 30, r: 9 }); }
        }
      },
    };
    const plan = shuffle(Object.keys(PATTERNS)).slice(0, 2);

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

    function finish(dead) {
      stop();
      if (dead) return end({ hit, dead });
      if (!hit) { status.textContent = '✨ PERFECT DODGE! +2 💎'; award(`dodge:${round}:a`, status); award(`dodge:${round}:b`, status); sfx.win(); }
      else status.textContent = 'Phew! Back to the questions!';
      setTimeout(() => end({ hit, dead }), 1300);
    }
    function frame(now) {
      if (over) return;
      if (!cvs.isConnected) return stop(); // left the stage mid-round
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0); last = now; t += dt;
      if (t < 0) status.textContent = t < -1 ? '3… 2…' : '1…';
      else {
        status.textContent = hit ? 'Ouch! Keep dodging!' : 'Dodge!';
        const phase = t < DUR / 2 ? 0 : 1;
        if (t < DUR - 0.6) PATTERNS[plan[phase]](dt);
        timer.firstChild.style.width = Math.max(0, 100 - t / DUR * 100) + '%';
      }
      const v = 150 * dt;
      p.x += ((keys.r ? 1 : 0) - (keys.l ? 1 : 0)) * v; p.y += ((keys.d ? 1 : 0) - (keys.u ? 1 : 0)) * v;
      p.x = Math.max(pw / 2, Math.min(W - pw / 2, p.x)); p.y = Math.max(ph / 2, Math.min(H - ph / 2, p.y));
      for (const q of bullets) { q.x += q.vx * dt; q.y += q.vy * dt; }
      for (let k = bullets.length - 1; k >= 0; k--) { const q = bullets[k]; if (q.x < -30 || q.x > W + 30 || q.y < -30 || q.y > H + 30) bullets.splice(k, 1); }
      // a small, forgiving hitbox in the middle of the avatar
      const safe = t - hitAt < 1.2;
      if (!safe) for (const q of bullets) {
        if (Math.abs(q.x - p.x) < q.r * 0.7 + pw * 0.28 && Math.abs(q.y - p.y) < q.r * 0.7 + ph * 0.3) {
          hitAt = t; sfx.hit(); shake(cvs);
          if (!hit) { hit = true; if (loseHeart()) return finish(true); }
          break;
        }
      }
      // draw
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      if (!(t - hitAt < 1.2 && Math.floor(t * 12) % 2)) {
        if (me) ctx.drawImage(me, Math.round(p.x - pw / 2), Math.round(p.y - ph / 2));
        else { ctx.font = '22px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('❤️', p.x, p.y); }
      }
      for (const q of bullets) ctx.drawImage(shot, q.x - q.r * 1.2, q.y - q.r * 1.2, q.r * 2.4, q.r * 2.4);
      if (t >= DUR) return finish(false);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    cvs.scrollIntoView({ block: 'center', behavior: calm() ? 'auto' : 'smooth' });
  }

  function bossFight(b, total) {
    const lines = Object.assign({}, BOSS_LINES, b.lines);
    let hp = total, lives = LIVES, half = false, dodgeDue = false, rounds = 0, sinceDodge = 0;
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
    const hero = h('div', { class: 'hero' }, avatar,
      h('div', { class: 'hero-info' },
        h('div', { class: 'hero-top' }, h('div', { class: 'hero-name' }, settings.name || 'You'), hearts,
          h('div', { class: 'boss-sub' }, `Lose all ${LIVES} hearts and ${b.name} wins!`)),
        heroTalk.el));

    function breakHeart() {
      const heart = hearts.children[lives];
      heart.textContent = '🖤'; heart.classList.add('lost'); replay(heart, 'break');
      hearts.setAttribute('aria-label', `Lives: ${lives} of ${LIVES}`);
      replay(avatar, 'hurt'); shake(stageCard); popText(hero, '-1 ❤️', 'ouch');
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
        replay(avatar, 'lunge'); heroTalk.say(pick(HERO_LINES.hit), 1400);
        projectile(b.heroAttack || '⚡', avatar, sprite);
        setTimeout(() => {
          fillEl.style.width = hp / total * 100 + '%';
          replay(sprite, 'hurt'); sfx.hit(); replay(el, 'flash');
          popText(el, hp ? 'HIT!' : 'K.O.!', 'dmg');
          if (!hp) {
            hpText.textContent = 'DEFEATED!'; el.classList.remove('enraged'); el.classList.add('defeated');
            banner(el, 'K.O.!', 'ko'); bossTalk.say(lines.defeat, 0); heroTalk.say(HERO_LINES.win, 0);
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
          loseHeart() { lives--; breakHeart(); return !lives; },
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
      runQuestions(qArea, qs, { key: 'quiz', boss, done: results, lost: gameOver, lastLabel: s.boss ? '⚔️ Final blow!' : 'See my score 🏆' });
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
      const prev = (store.get(RKEY, {})[L.id] || {}).best || 0;
      saveRecord({ best: Math.max(prev, score), total, done: true });
      if (s.boss) achieve('boss');
      if (L.finishAch) achieve(L.finishAch); // e.g. every Wonders lesson unlocks the explorer hat
      if (score === total) achieve('perfect');
      const msg = pct === 1 ? 'PERFECT SCORE! You are a legend! 🌟'
        : pct >= 0.75 ? 'Brilliant work! 🎉'
          : pct >= 0.5 ? 'Good effort! Play again to beat your score! 💪'
            : 'Nice try! Read the pages again, then have another go! 📖';
      sfx.win(); confetti(pct >= 0.75 ? 220 : 90);
      say(pct >= 0.75 ? `Amazing, {name}! You're a real ${L.subject === 'science' ? 'scientist' : 'star'}!` : 'Every try makes your brain stronger!');
      put(area, h('div', { class: 'results' },
        s.boss && h('h2', null, `${s.boss.name.toUpperCase()} IS DEFEATED!`),
        s.boss && h('div', { class: 'victory' }, heroImg('hero-sprite cheer'), pic(s.boss.sprite || s.boss.emoji || '👾', 'boss-sprite ko')),
        s.boss && h('div', { class: 'hearts big', role: 'img', 'aria-label': `${livesLeft} of ${LIVES} hearts left` }, heartsRow(livesLeft)),
        !s.boss && h('div', { class: 'trophy' }, pct >= 0.75 ? '🏆' : '🎖️'),
        h('div', { class: 'score' }, `${score} / ${total}`),
        h('p', { class: 'lead' }, msg),
        h('p', { class: 'stars-earned' }, `You collected ${state.stars} ${CUR.icon} and reached LEVEL ${levelOf(state.stars)}!`),
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
        h('p', { class: 'cert-score' }, `Quiz: ${score} / ${total}   •   ${CUR.icon} ${state.stars} ${CUR.name}   •   Level ${levelOf(state.stars)}`),
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
