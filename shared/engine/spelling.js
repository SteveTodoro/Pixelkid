/* Pixelkid lesson engine – the Spell Test (listen / look-cover-write-check / fix the mistake), with its scenes.
 * One part of shared/engine.js, which loads it only when a lesson uses it. E is the engine's shared helpers
 * (E.state and E.stageCard are live). See the top of shared/engine.js for how the parts fit together.
 */
PixelkidEngine.part('spelling', E => {
  'use strict';
  const { GAMES, award, canSpeak, confetti, h, praise, put, say, sfx, shake, shuffle, speak, track } = E;

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
      let letters = Array(n).fill(''), locked = Array(n).fill(false), tries = 0, revealed = false, peeked = false, over = false, covered = !peekMode, firstGuess = null;
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
        if (tries === 1 && guess !== target) firstGuess = guess;
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
          track('Spelling', { q: target, answer: target, type: 'type' }, res === 'first', firstGuess ? { guess: firstGuess } : {});
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
});
