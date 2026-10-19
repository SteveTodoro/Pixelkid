/* Pixelkid quest-map NPCs: people standing by the road who talk in an Undertale-style text box.
 *   challenger – 3 quick questions on the lessons cleared on the road up to them. Their own item the first time,
 *                then a few gems once a day (so reviewing old lessons keeps paying a little, but can't be farmed).
 *   trader     – sells items you can only get from them, for gems.
 *   quest NPCs – ask "Could you help me?" (YES / NO) and want an item someone else has: a side quest. Handing it over
 *                ends with one quick question, then a thank-you item.
 * Quest items live in the 🎒 backpack (the slot next to the gems on the home page).
 * Needs avatar.js and question-bank.js (made by tools/build-question-bank.js). The home page's map places the NPCs:
 *   NPC.forWorld(key)   the NPCs in a world: { id, name, at: '<lesson title they live by>' (null: by START), look }
 *   NPC.marker(npc)     what floats over their head: '!' (something for you), '?' (they want what you carry), '🛒', '⚔️' or ''
 *   NPC.talk(npc, { pool: [lesson ids cleared up to them], changed() })   open the conversation
 *   NPC.backpack()      show what you carry and the quests you're on · NPC.bagCount()
 * Saved in localStorage 'y3:npc': { quests: { id: 'active' | 'done' }, bag: [item ids], got: { npc: true }, day: { npc: date } }
 */
(function () {
  'use strict';
  const KEY = 'y3:npc';
  const fresh = () => ({ quests: {}, bag: [], got: {}, day: {} });
  const load = () => { try { return Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return fresh(); } };
  const save = st => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignore */ } };
  const update = fn => { const st = load(); fn(st); save(st); };
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  const playerName = () => { try { return JSON.parse(localStorage.getItem('y3:settings') || '{}').name || 'explorer'; } catch (e) { return 'explorer'; } };
  const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

  // ---------- things you can carry ----------
  const BAG = {
    'watering-can': { icon: '🚿', name: 'Watering can', note: 'Take it to Gardener Rosa.' },
  };
  const QUESTS = {
    sunflower: {
      name: 'The Drooping Sunflowers',
      step: st => (st.bag.includes('watering-can') ? 'Take the watering can to Gardener Rosa.' : 'Find a watering can for Gardener Rosa. Tinker Max might have one.'),
    },
  };

  // ---------- who lives where ----------
  const NPCS = {
    science: [
      { id: 'mo', name: 'Market Mo', at: null, stock: ['field-vest', 'magnifier', 'pet-worm'],
        look: { skin: 'skin3', hair: 'hair-curly', hairColor: 'hc-black', top: 'tee-red', legs: 'trousers-black', shoes: 'boots', hat: 'cap' } },
      { id: 'pip', name: 'Professor Pip', at: 'Magnet Magic!', prize: 'lab-goggles',
        look: { skin: 'skin1', hair: 'hair-spiky', hairColor: 'hc-blonde', top: 'labcoat', legs: 'trousers-black', shoes: 'trainers', extra: 'glasses' } },
      { id: 'max', name: 'Tinker Max', at: 'Pushes, Pulls & Friction',
        look: { skin: 'skin2', hair: 'hair-short', hairColor: 'hc-black', top: 'hoodie-blue', legs: 'jeans', shoes: 'boots', hat: 'beanie', extra: 'pocket-watch' } },
      { id: 'rosa', name: 'Gardener Rosa', at: 'Plant Detectives',
        look: { skin: 'skin2', hair: 'hair-plaits', hairColor: 'hc-brown', top: 'jumper-green', legs: 'jeans', shoes: 'boots', hat: 'straw-hat' } },
    ],
  };
  const byId = id => Object.values(NPCS).flat().find(n => n.id === id);

  function marker(n) {
    const st = load(), q = st.quests.sunflower, can = st.bag.includes('watering-can');
    switch (n.id) {
      case 'mo': return '🛒';
      case 'pip': return !st.got.pip ? '!' : st.day.pip === today() ? '' : '⚔️';
      case 'max': return q === 'active' && !can ? '!' : '';
      case 'rosa': return !q ? '!' : q === 'active' && can ? '?' : '';
      default: return '';
    }
  }

  // ---------- the text box ----------
  // Every step returns a promise; closing the box (✕ or Esc) stops the conversation wherever it is.
  const CLOSED = new Error('closed');
  const still = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let audio = null;
  const blip = () => { // a soft "talking" blip every couple of letters, like an RPG
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = 'square'; o.frequency.value = 520 + Math.random() * 60; g.gain.value = 0.025;
      o.connect(g); g.connect(audio.destination); o.start(); o.stop(audio.currentTime + 0.03);
    } catch (e) { /* no sound */ }
  };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  function textBox(n) {
    let closed = false, typing = null, waiters = [];
    const back = el('div', 'npc-back'), box = el('div', 'npc-box');
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', n.name);
    const face = el('div', 'npc-face');
    if (n.look && window.Avatar) face.append(Avatar.draw(Object.assign({}, Avatar.DEFAULT_LOOK, n.look), { scale: 6 }));
    else face.append(el('span', 'npc-face-icon', n.icon || '🎒'));
    const main = el('div', 'npc-main'), name = el('div', 'npc-name', n.name), text = el('div', 'npc-text'), act = el('div', 'npc-act');
    text.setAttribute('aria-live', 'polite');
    const x = el('button', 'npc-x', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Close');
    main.append(name, text, act); box.append(face, main, x); back.append(box);
    document.body.append(back);
    const close = () => { if (closed) return; closed = true; clearInterval(typing); back.remove(); document.removeEventListener('keydown', onKey); waiters.forEach(w => w(CLOSED)); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    x.onclick = close;
    document.addEventListener('keydown', onKey);
    // wait for something; rejects if the box is closed first
    const wait = setup => new Promise((ok, no) => { if (closed) return no(CLOSED); const w = v => (v === CLOSED ? no(CLOSED) : ok(v)); waiters.push(w); setup(v => { waiters = waiters.filter(f => f !== w); ok(v); }); });

    // type a line out letter by letter (a tap finishes it straight away)
    function type(line) {
      clearInterval(typing);
      const full = line.replace(/\{name\}/g, playerName());
      text.textContent = '';
      return wait(done => {
        let i = 0;
        const finish = () => { clearInterval(typing); typing = null; text.textContent = full; box.onclick = null; done(); };
        box.onclick = e => { if (e.target === x) return; finish(); };
        if (still()) return finish();
        typing = setInterval(() => { i++; text.textContent = full.slice(0, i); if (i % 2 && /\w/.test(full[i - 1])) blip(); if (i >= full.length) finish(); }, 28);
      });
    }
    const button = (label, cls) => { const b = el('button', 'npc-btn' + (cls ? ' ' + cls : ''), label); b.type = 'button'; return b; };

    const api = {
      close,
      // say a line, then wait for a tap (or the ▶ button)
      async say(line) {
        act.replaceChildren();
        await type(line);
        const more = button('▶'); more.classList.add('npc-more');
        act.replaceChildren(more); more.focus();
        await wait(done => { more.onclick = done; box.onclick = e => { if (e.target !== x) done(); }; });
        box.onclick = null;
      },
      // say a line, then pick one of the answers; returns its index
      async choose(line, labels) {
        act.replaceChildren();
        await type(line);
        const bs = labels.map(l => button(l));
        act.replaceChildren(...bs); bs[0].focus();
        return wait(done => bs.forEach((b, k) => { b.onclick = e => { e.stopPropagation(); done(k); }; }));
      },
      // one quick question. retry: wrong answers only get a hint and are crossed out; otherwise a miss shows the answer
      async ask(q, label, { retry = false } = {}) {
        act.replaceChildren();
        const type_ = q.type || 'mcq', truth = type_ === 'tf' ? (q.answer ? 'True' : 'False') : type_ === 'type' ? [].concat(q.answer)[0] : q.options[q.answer];
        const qline = (label ? label + ': ' : '') + (type_ === 'tf' ? `True or false? ${q.q}` : q.q.replace('___', '_____'));
        await type(qline);
        const hint = () => { text.textContent = qline.replace(/\{name\}/g, playerName()) + '\n💡 ' + (q.hint || 'Not quite – try again!'); };
        const verdict = async (ok, picked) => {
          if (ok) { picked && picked.classList.add('right'); await api.say(q.explain ? `✔ ${q.explain}` : '✔ Correct!'); return true; }
          await api.say(`✘ Not quite! The answer is: ${truth}.`);
          return false;
        };
        if (type_ === 'type') {
          const inp = el('input', 'npc-input'); inp.type = 'text'; inp.autocomplete = 'off'; inp.setAttribute('aria-label', 'Your answer');
          const ok = button('OK');
          act.replaceChildren(inp, ok); inp.focus();
          const clean = t => String(t).toLowerCase().replace(/[^a-z0-9£:]+/g, ' ').trim();
          for (;;) {
            const v = await wait(done => { ok.onclick = () => done(inp.value); inp.onkeydown = e => { if (e.key === 'Enter') done(inp.value); }; });
            if (!clean(v)) { inp.focus(); continue; }
            const right = [].concat(q.answer).map(clean).includes(clean(v));
            if (right || !retry) return verdict(right);
            hint(); inp.select();
          }
        }
        const opts = type_ === 'tf' ? [['True', q.answer === true], ['False', q.answer === false]] : shuffle(q.options.map((o, k) => [o, k === q.answer]));
        const bs = opts.map(([o]) => button(o));
        act.replaceChildren(...bs); bs[0].focus();
        for (;;) {
          const k = await wait(done => bs.forEach((b, j) => { b.onclick = e => { e.stopPropagation(); done(j); }; }));
          if (opts[k][1]) { bs.forEach(b => { b.disabled = true; }); return verdict(true, bs[k]); }
          bs[k].classList.add('wrong'); bs[k].disabled = true;
          if (!retry) { bs.forEach(b => { b.disabled = true; }); return verdict(false); }
          hint();
        }
      },
      // show an avatar item they've just been given, with "wear it now?"
      async reward(item, line) {
        act.replaceChildren();
        await type(line);
        const a = Avatar.load(), look = Object.assign({}, a.look, { [item.cat]: item.id });
        const card = el('div', 'npc-prize');
        card.append(Avatar.draw(look, { scale: 4, pet: item.cat === 'pet' }), el('div', 'npc-prize-name', `NEW! ${item.name}`));
        const wear = button('👕 Wear it now'), later = button('Later');
        act.replaceChildren(card, wear, later); wear.focus();
        const k = await wait(done => { wear.onclick = e => { e.stopPropagation(); done(0); }; later.onclick = e => { e.stopPropagation(); done(1); }; });
        if (k === 0) { Avatar.wear(item.id); if (window.heroAnim) heroAnim.redraw(); }
      },
      // a quest item goes into the backpack
      async gift(id, line) {
        act.replaceChildren();
        await type(line);
        const it = BAG[id], card = el('div', 'npc-prize');
        card.append(el('div', 'npc-prize-icon', it.icon), el('div', 'npc-prize-name', `🎒 ${it.name} – in your backpack!`));
        const ok = button('▶');
        act.replaceChildren(card, ok); ok.focus();
        await wait(done => { ok.onclick = e => { e.stopPropagation(); done(); }; });
      },
      // a trader's stall: returns the item picked, or null to leave
      async shop(line, items) {
        act.replaceChildren();
        await type(line);
        const a = Avatar.load(), cards = items.map(it => {
          const b = button('', 'npc-ware'), owned = Avatar.owns(it);
          b.append(Avatar.draw(Object.assign({}, a.look, { [it.cat]: it.id }), { scale: 3, pet: it.cat === 'pet' }), el('span', 'npc-ware-name', it.name), el('span', 'npc-ware-price', owned ? '✔ OWNED' : `💎 ${it.price}`));
          if (owned) b.classList.add('owned');
          return b;
        });
        const leave = button('Just looking');
        act.replaceChildren(el('div', 'npc-wares'), leave);
        act.firstChild.append(...cards);
        (cards.find(c => !c.classList.contains('owned')) || leave).focus();
        return wait(done => { cards.forEach((c, k) => { c.onclick = e => { e.stopPropagation(); done(items[k]); }; }); leave.onclick = e => { e.stopPropagation(); done(null); }; });
      },
    };
    return api;
  }

  // three quick questions from the lessons cleared up to this NPC; stops at the first miss
  async function challenge(box, pool) {
    const bank = window.QUESTION_BANK || {};
    const qs = shuffle(pool.flatMap(id => bank[id] || [])).slice(0, 3);
    for (let i = 0; i < qs.length; i++) if (!(await box.ask(qs[i], `Question ${i + 1} of ${qs.length}`))) return false;
    return qs.length > 0;
  }
  // keep trying: a fresh set each time, until they win or say "later"
  async function challengeUntil(box, pool, again, later) {
    for (;;) {
      if (await challenge(box, pool)) return true;
      if ((await box.choose(again, ['Try again', 'Later'])) === 1) { await box.say(later); return false; }
    }
  }

  // ---------- what each NPC says and does ----------
  const SCRIPTS = {
    async mo(box, n, ctx) {
      const met = load().got.mo;
      update(st => { st.got.mo = true; });
      let line = met ? 'Welcome back, {name}! Fancy something new?' : "Hello there, explorer! I'm Mo. I sell things you won't find in any shop!";
      for (;;) {
        const pick = await box.shop(line + `  (You have 💎 ${Avatar.wallet().balance}.)`, n.stock.map(Avatar.byId));
        if (!pick) return box.say('Come back any time!');
        if (Avatar.owns(pick)) { line = 'You already have that one! Anything else?'; continue; }
        if (!Avatar.spend(pick.price)) { line = `That one costs 💎 ${pick.price}. You need ${pick.price - Avatar.wallet().balance} more – clear a quest and come back!`; continue; }
        Avatar.give(pick.id); ctx.changed();
        await box.reward(pick, 'Pleasure doing business!');
        line = 'Anything else?';
      }
    },
    async pip(box, n, ctx) {
      const st = load(), first = !st.got.pip;
      if (!first && st.day.pip === today()) return box.say("You've beaten me today, {name}! Come back tomorrow for a rematch.");
      const go = await box.choose(first
        ? "Ah, a young scientist! I'm Professor Pip. Answer my three quick questions about what you've learned, and I'll give you something special."
        : "Back for a rematch? Win again and I'll give you 3 💎. (Once a day!)", ["Let's go!", 'Not now']);
      if (go === 1) return box.say('Off you go, then. My questions will be waiting!');
      if (!(await challengeUntil(box, ctx.pool, "Not quite! A good scientist checks and tries again. Another go? I'll ask different questions.", 'Come back any time!'))) return;
      update(s => { s.got.pip = true; s.day.pip = today(); });
      if (first) { Avatar.give(n.prize); ctx.changed(); return box.reward(Avatar.byId(n.prize), 'Splendid! All three right! Here are my spare lab goggles – every scientist needs a pair.'); }
      Avatar.earn(3); ctx.changed();
      return box.say('Brilliant! Here are your 3 💎. See you tomorrow!');
    },
    async max(box, n, ctx) {
      const st = load(), q = st.quests.sunflower;
      if (q !== 'active') return box.say(q === 'done' ? 'Rosa says her sunflowers are standing tall again. Nice work, {name}!' : "I'm Tinker Max. I fix things! Push a lever, pull a rope – forces make everything work.");
      if (st.bag.includes('watering-can')) return box.say('Take that watering can to Rosa – her sunflowers are thirsty!');
      const go = await box.choose("A watering can for Rosa? I've got a spare one! But first, show me you know your forces. Three quick questions!", ["I'm ready!", 'Not now']);
      if (go === 1) return box.say("No rush. I'll keep the can safe.");
      if (!(await challengeUntil(box, ctx.pool, "So close! Try again? I'll ask different ones.", "Come back when you're ready!"))) return;
      update(s => { if (!s.bag.includes('watering-can')) s.bag.push('watering-can'); });
      ctx.changed();
      return box.gift('watering-can', 'Here you go – one watering can, good as new! Take it to Gardener Rosa.');
    },
    async rosa(box, n, ctx) {
      const st = load(), q = st.quests.sunflower;
      if (q === 'done') return box.say('My sunflowers have never looked happier. Thank you, {name}!');
      if (!q) {
        await box.say('Oh dear, oh dear… my sunflowers are drooping! My watering can has a hole in it.');
        if ((await box.choose('Could you help me find another one?', ['Yes, I can help!', 'Sorry, not now'])) === 1) return box.say("That's all right. Come back if you change your mind!");
        update(s => { s.quests.sunflower = 'active'; });
        ctx.changed();
        return box.say('Thank you! Tinker Max lives by the Pushes, Pulls & Friction stop. He might have a spare watering can!');
      }
      if (!st.bag.includes('watering-can')) return box.say('Any luck? Tinker Max, by the Pushes, Pulls & Friction stop, might have a watering can.');
      await box.say('You found one! Thank you! Before I water them… a quick question.');
      await box.ask({ type: 'mcq', q: 'Which part of the sunflower drinks up the water?', options: ['the roots', 'the petals', 'the leaves'], answer: 0, hint: "It's the part hidden under the soil!" }, null, { retry: true });
      await box.say("The roots soak up water from the soil, and the stem carries it up to the leaves and flowers. Look – they're standing tall already!");
      update(s => { s.bag = s.bag.filter(b => b !== 'watering-can'); s.quests.sunflower = 'done'; });
      Avatar.give('sunflower-hat'); Avatar.give('pet-ladybird'); ctx.changed();
      await box.reward(Avatar.byId('sunflower-hat'), 'Please take my sunflower hat to say thank you…');
      return box.reward(Avatar.byId('pet-ladybird'), '…and this little ladybird. She loves sunflowers!');
    },
  };

  async function talk(n, ctx = {}) {
    const box = textBox(n);
    ctx = Object.assign({ pool: [], changed() {} }, ctx);
    try { await SCRIPTS[n.id](box, n, ctx); box.close(); } catch (e) { if (e !== CLOSED) { box.close(); throw e; } }
  }

  // the backpack: quest items and the quests you're on
  async function backpack() {
    const st = load(), box = textBox({ name: 'My backpack', icon: '🎒' });
    const items = st.bag.map(id => BAG[id]).filter(Boolean), on = Object.keys(st.quests).filter(q => st.quests[q] === 'active' && QUESTS[q]);
    const lines = [];
    if (items.length) lines.push(items.map(it => `${it.icon} ${it.name} – ${it.note}`).join('\n'));
    if (on.length) lines.push(on.map(q => `📜 ${QUESTS[q].name}: ${QUESTS[q].step(st)}`).join('\n'));
    try { await box.say(lines.join('\n\n') || 'Your backpack is empty. Talk to people on the map – some of them need your help!'); box.close(); } catch (e) { if (e !== CLOSED) throw e; }
  }

  window.NPC = {
    forWorld: key => NPCS[key] || [],
    marker,
    look: n => Object.assign({}, window.Avatar ? Avatar.DEFAULT_LOOK : {}, n.look),
    talk,
    backpack,
    bagCount: () => load().bag.length,
    _byId: byId,
  };

  // the text box's look: black box, white border, pixel font (the Undertale feel)
  const css = document.createElement('style');
  css.textContent = `
  .npc-back { position: fixed; inset: 0; z-index: 60; display: flex; align-items: flex-end; justify-content: center; padding: 16px; background: rgba(0,0,0,.35); }
  .npc-box { position: relative; width: min(700px, 100%); display: flex; gap: 14px; align-items: flex-start; padding: 14px 16px 16px; background: #000; color: #fff;
    border: 4px solid #fff; box-shadow: 0 0 0 4px #000, 0 10px 0 rgba(0,0,0,.35); font-family: var(--pixel, monospace); cursor: default;
    max-height: calc(100vh - 32px); overflow-y: auto; }
  .npc-face { flex: none; width: 76px; height: 76px; overflow: hidden; display: grid; place-items: start center; border: 3px solid #fff; background: #2a2a2a; }
  .npc-face canvas { image-rendering: pixelated; margin-top: 2px; }
  .npc-face-icon { place-self: center; font-size: 2.6rem; }
  .npc-main { flex: 1; min-width: 0; }
  .npc-name { margin-bottom: 4px; color: #ffd43b; font-weight: 700; font-size: .95rem; }
  .npc-text { min-height: 3.6em; white-space: pre-wrap; font-size: 1.15rem; font-weight: 700; line-height: 1.4; }
  .npc-act { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 10px; }
  .npc-btn { padding: 6px 12px; font: inherit; font-weight: 700; font-size: 1rem; color: #fff; background: #000; border: 3px solid #fff; cursor: pointer; }
  .npc-btn:hover:not(:disabled), .npc-btn:focus-visible { color: #ffd43b; border-color: #ffd43b; outline: none; }
  .npc-btn:hover:not(:disabled)::before, .npc-btn:focus-visible::before { content: "♥ "; color: #e53935; }
  .npc-btn.right { color: #7cfc3a; border-color: #7cfc3a; }
  .npc-btn.wrong { color: #ff8a80; border-color: #ff8a80; text-decoration: line-through; opacity: .7; }
  .npc-btn.npc-more { margin-left: auto; animation: npc-blink 1s steps(2) infinite; }
  @keyframes npc-blink { 50% { opacity: .35; } }
  .npc-x { position: absolute; top: -18px; right: -14px; width: 34px; height: 34px; font-size: 1rem; font-weight: 700; color: #fff; background: #000; border: 3px solid #fff; cursor: pointer; }
  .npc-input { flex: 1; min-width: 140px; padding: 6px 10px; font: inherit; font-size: 1.1rem; color: #fff; background: #111; border: 3px solid #fff; }
  .npc-prize { display: flex; align-items: center; gap: 12px; width: 100%; padding: 8px; border: 3px dashed #ffd43b; }
  .npc-prize canvas { image-rendering: pixelated; }
  .npc-prize-icon { font-size: 3rem; }
  .npc-prize-name { color: #ffd43b; font-weight: 700; }
  .npc-wares { display: flex; flex-wrap: wrap; gap: 8px; width: 100%; }
  .npc-ware { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 118px; padding: 8px 6px; }
  .npc-ware canvas { image-rendering: pixelated; }
  .npc-ware-name { font-size: .85rem; text-align: center; }
  .npc-ware-price { color: #ffd43b; font-size: .85rem; }
  .npc-ware.owned { opacity: .55; }
  @media (max-width: 520px) {
    .npc-back { padding: 10px; }
    .npc-box { gap: 10px; padding: 12px; }
    .npc-face { width: 56px; height: 56px; }
    .npc-face canvas { width: 54px; height: auto; }
    .npc-text { font-size: 1rem; }
    .npc-ware { width: calc(50% - 4px); }
  }`;
  document.head.append(css);
})();
