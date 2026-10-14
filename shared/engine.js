/* Year 3 Lesson Engine
 * Renders an interactive lesson from the data in window.LESSON.
 * Stage types: welcome, review, read, video, game, break, quiz (optionally a boss battle).
 * Game types: sort, match, label, order, truefalse, questions, wordsearch, crossword, trainai, pixelcopy, pixelstudio.
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
      h('label', { class: 'name-row' }, h('span', null, s.nameLabel || 'Player name:'), name),
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
        const fb = h('div', { class: 'feedback', hidden: true });
        const opts = c.check.options.map((o, oi) => h('button', {
          class: 'opt' + (answered && oi === c.check.answer ? ' right' : ''), type: 'button', disabled: answered,
          onclick(e) {
            const b = e.currentTarget;
            if (oi === c.check.answer) {
              b.classList.add('right'); opts.forEach(x => { x.disabled = true; });
              sfx.good(); award(key, b); say(c.check.yes || praise());
              fb.className = 'feedback good'; fb.hidden = false; fb.innerHTML = '✔ ' + fmt(c.check.explain || 'Correct!', false);
              answered = true; nav.set(label, goNext);
            } else {
              b.classList.add('wrong'); b.disabled = true; shake(b); sfx.bad();
              say(c.check.hint || 'Look back at the page to find the answer!');
            }
          },
        }, o));
        check = h('div', { class: 'check' },
          h('div', { class: 'check-q' }, h('b', null, '🔍 CHECK: '), c.check.q),
          h('div', { class: 'opts' }, opts), fb);
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
    const btns = options.map((o, oi) => h('button', {
      class: 'opt', type: 'button',
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
    }, o));
    return [text, h('div', { class: 'opts' }, btns)];
  }

  // Runs a list of questions one at a time inside `area`; calls done(firstTryScore) at the end.
  function runQuestions(area, qs, { key, done, boss, lastLabel = 'Finish ▶' }) {
    let qi = 0, score = 0;
    function show() {
      const q = qs[qi], isLast = qi === qs.length - 1;
      const fb = h('div', { class: 'feedback', hidden: true });
      const nextBtn = h('button', {
        class: 'btn', type: 'button', hidden: true,
        onclick() { sfx.tap(); qi++; if (qi < qs.length) show(); else done(score); },
      }, isLast ? lastLabel : 'Next question ▶');
      const onRight = (el, first) => {
        if (first) { score++; award(`${key}:${qi}`, el); }
        sfx.good(); say(praise());
        fb.className = 'feedback good'; fb.hidden = false;
        fb.innerHTML = '✔ ' + fmt(q.explain || (first ? 'Correct!' : 'You got there!'), false);
        if (boss) boss.hit();
        nextBtn.hidden = false;
      };
      const onMiss = () => {
        say(q.hint ? '💡 ' + q.hint : oops());
        fb.className = 'feedback try'; fb.hidden = false;
        fb.innerHTML = '💡 ' + fmt(q.hint || 'Not quite – have another go!', false);
        if (boss) boss.zap();
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
    const hintBtn = h('button', { class: 'btn gold', type: 'button', onclick() { const wr = wrongIdx(); ed.flash(wr); sfx.tap(); say(wr.length ? `${wr.length} squares need fixing – they are flashing red!` : 'Everything matches!'); } }, '🔍 Show mistakes');
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
    const panels = [];
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
      cleanup = () => { if (timerId) clearInterval(timerId); };
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
    const nav = navRow(() => go(i - 1, true));
    nav.set(nextLabel(i), () => go(i + 1));
    return shell(s, [mascot(s.say || 'Time for a brain break! Get up and move!'), h('div', { class: 'break-grid' }, panels), nav.el]);
  }

  // ---------- stage: quiz (with optional boss battle) ----------
  function bossPanel(b, total) {
    let hp = total;
    const fillEl = h('div', { class: 'hp-fill', style: 'width:100%' });
    const hpText = h('div', { class: 'boss-sub' }, `HP ${hp}/${total} · Every right answer is a hit!`);
    const sprite = pic(b.sprite || b.emoji || '👾', 'boss-sprite');
    const el = h('div', { class: 'boss' }, sprite, h('div', { class: 'boss-info' }, h('div', { class: 'boss-name' }, b.name), h('div', { class: 'hp' }, fillEl), hpText));
    const flash = cls => { sprite.classList.remove(cls); void sprite.offsetWidth; sprite.classList.add(cls); };
    return {
      el,
      hit() {
        hp = Math.max(0, hp - 1); fillEl.style.width = hp / total * 100 + '%';
        hpText.textContent = hp ? `HP ${hp}/${total} · Keep going!` : 'DEFEATED!';
        flash('hurt'); sfx.hit();
        if (!hp) el.classList.add('defeated');
      },
      zap() { shake(stageCard); sfx.zap(); },
    };
  }
  function renderQuiz(s, i) {
    const qs = s.questions;
    const area = h('div');
    const nav = navRow(() => go(i - 1, true));
    let boss = null;

    function begin() {
      boss = s.boss ? bossPanel(s.boss, qs.length) : null;
      const qArea = h('div');
      put(area, boss && boss.el, qArea);
      runQuestions(qArea, qs, { key: 'quiz', boss, done: results, lastLabel: s.boss ? '⚔️ Final blow!' : 'See my score 🏆' });
      nav.hideNext();
    }

    function results(score) {
      const total = qs.length, pct = score / total;
      complete(i);
      const prev = (store.get(RKEY, {})[L.id] || {}).best || 0;
      saveRecord({ best: Math.max(prev, score), total, done: true });
      if (s.boss) achieve('boss');
      if (score === total) achieve('perfect');
      const msg = pct === 1 ? 'PERFECT SCORE! You are a legend! 🌟'
        : pct >= 0.75 ? 'Brilliant work! 🎉'
          : pct >= 0.5 ? 'Good effort! Play again to beat your score! 💪'
            : 'Nice try! Read the pages again, then have another go! 📖';
      sfx.win(); confetti(pct >= 0.75 ? 220 : 90);
      say(pct >= 0.75 ? `Amazing, {name}! You're a real ${L.subject === 'science' ? 'scientist' : 'star'}!` : 'Every try makes your brain stronger!');
      put(area, h('div', { class: 'results' },
        s.boss && h('h2', null, `${s.boss.name.toUpperCase()} IS DEFEATED!`),
        h('div', { class: 'trophy' }, pct >= 0.75 ? '🏆' : '🎖️'),
        h('div', { class: 'score' }, `${score} / ${total}`),
        h('p', { class: 'lead' }, msg),
        h('p', { class: 'stars-earned' }, `You collected ${state.stars} ${CUR.icon} and reached LEVEL ${levelOf(state.stars)}!`),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn gold big', type: 'button', onclick() { sfx.good(); showCert(score, total); } }, '📜 Get my certificate'),
          h('button', { class: 'btn ghost', type: 'button', onclick: begin }, s.boss ? '↺ Rematch' : '↺ Try again'),
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
