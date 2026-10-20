/* Pixelkid lesson engine – the Spell Test (listen / look-cover-write-check / fix the mistake), with its scenes,
 * Speech Marks (tap the gaps where the speech marks go) and the Syllable Drum (tap a beat for each syllable).
 * One part of shared/engine.js, which loads it only when a lesson uses it. E is the engine's shared helpers
 * (E.state and E.stageCard are live). See the top of shared/engine.js for how the parts fit together.
 */
PixelkidEngine.part('spelling', E => {
  'use strict';
  const { GAMES, award, canSpeak, confetti, fmt, h, pic, praise, put, say, sfx, shake, shuffle, speak, track } = E;

  // ===== Spell test: hear (or look at) a word, then spell it on the pixel keyboard =====
  // r.words: [{ word, sentence ('… ___ …', read aloud with the word filled in), clue, hint, wrong (mode 'fix'), emoji }]
  // r.mode: 'listen' (default: hear the word and a sentence) | 'peek' (look, cover, write, check) | 'fix' (correct a misspelt word)
  // r.scene: 'potion' (default: each word adds an ingredient to a cauldron) | 'egg' (each word cracks a dragon egg)
  //   | 'castle' (each word builds a row of a castle tower) | 'rocket' (each word fuels a rocket, which blasts off at the end)
  //   | 'train' (each word couples a carriage) | 'balloon' (each word fills a hot-air balloon, which floats away at the end)
  //   | 'snowman' (each word builds a snowman from the bottom up, hat last)
  //   | 'ship' (each word builds Theseus's ship under a black sail, which turns white when it's finished)
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
  // balloon: each word fills the hot-air balloon with another band of colour, bottom up; full = it floats away
  const BALLOON = ['....kkkkkk....', '..kkAAAAAAkk..', '.kAAAAAAAAAAk.', '.kBBBBBBBBBBk.', 'kBBBBBBBBBBBBk', 'kCCCCCCCCCCCCk', 'kCCCCCCCCCCCCk',
    'kDDDDDDDDDDDDk', '.kDDDDDDDDDDk.', '.kEEEEEEEEEEk.', '..kEEEEEEEEk..', '...kFFFFFFk...', '....kFFFFk....', '....k....k....', '....k....k....', '....kbbbbk....', '....kbbbbk....', '.....kkkk.....'];
  const BALLOON_BANDS = ['F', 'E', 'D', 'C', 'B', 'A']; // filled from the bottom
  function balloonSVG(p) {
    const filled = new Set(BALLOON_BANDS.slice(0, Math.round(p * BALLOON_BANDS.length)));
    return Pixel.svg(BALLOON.map(r => r.replace(/[A-F]/g, c => (filled.has(c) ? c : 'g'))),
      { k: '#1b1b1b', g: '#dfe3e8', b: '#8a5a32', A: '#e53935', B: '#ff8c1a', C: '#ffd43b', D: '#4caf2a', E: '#2b6fd6', F: '#8e5cff' });
  }
  // snowman: each word packs on another row of snow, from the bottom up; the hat goes on last
  const SNOWMAN = ['.....kkkk.....', '.....kHHk.....', '.....kHHk.....', '...kkkkkkkk...', '....kwwwwk....', '...kwkwwkwk...', '...kwwoowwk...', '....kwwwwk....', '..kkrrrrrrkk..', '..kwwrwwwwwk..', '.kwwwwkwwwwwk.', '.kwwwwwwwwwwk.', '.kwwwwkwwwwwk.', '..kwwwwwwwwk..', '.kwwwwwwwwwwk.', 'kwwwwwkwwwwwwk', 'kwwwwwwwwwwwwk', 'kwwwwwkwwwwwwk', '.kwwwwwwwwwwk.', '..kkkkkkkkkk..'];
  const snowmanSVG = p => { const built = Math.round(p * SNOWMAN.length);
    return Pixel.svg(SNOWMAN.map((r, y) => (y >= SNOWMAN.length - built ? r : r.replace(/[^.]/g, 'g'))), { k: '#1b1b1b', w: '#ffffff', H: '#2b2f3a', o: '#ff8c1a', r: '#e53935', g: '#dfe8f2' }); };
  // ship: each word builds Theseus's ship from the waterline up, under a black sail; full = the sail turns white (he's safe!)
  const SHIP = ['.........k..........', '.........kr.........', '....kkkkkkkkkkk.....', '....kSSSSkSSSSk.....', '....kSSSSkSSSSk.....', '....kSSSSkSSSSk.....',
    '....kSSSSkSSSSk.....', '....kkkkkkkkkkk.....', '.........k..........', 'kk.......k........kk', 'kHkkkkkkkkkkkkkkkkHk', '.kHHHHHHHHHHHHHHHHk.',
    '.kHyHHyHHyHHyHHyHHk.', '..kHHHHHHHHHHHHHHk..', '...kkkkkkkkkkkkkk...', 'wwwwwwwwwwwwwwwwwwww', 'WwwwWwwwwWwwwwWwwwwW'];
  const shipSVG = (p, full) => { const built = 2 + Math.round(p * (SHIP.length - 2)); // the sea is always there
    return Pixel.svg(SHIP.map((r, y) => (y >= SHIP.length - built ? r : r.replace(/[^.]/g, 'g'))),
      { k: '#1b1b1b', S: full ? '#ffffff' : '#2b2f3a', H: '#8a5a32', y: '#ffd43b', r: '#e53935', w: '#2f7fd8', W: '#7fc3ff', g: '#dfe3e8' }); };
  // r.scene → how the picture, caption and finish banner look
  const SP_SCENES = {
    potion: { prize: 'the magic potion', draw: (p, n, full) => (full ? POTION : cauldronSVG(p, n)), cap: (n, of, prize) => `🧪 ${n}/${of} ingredients in ${prize}`, made: prize => `🧪 ${prize} is ready!`, done: '🧪 POTION BREWED!', anim: 'bubbling' },
    egg: { prize: 'your baby dragon', draw: (p, n, full) => (full ? BABY_DRAGON : eggSVG(p)), cap: (n, of) => `🥚 ${n}/${of} words · each one cracks the egg`, made: prize => `🐲 ${prize} has hatched!`, done: '🐲 IT HATCHED!', anim: 'wobble' },
    castle: { prize: 'your word castle', draw: (p, n, full) => (full ? CASTLE_DONE : castleSVG(p)), cap: (n, of) => `🧱 ${n}/${of} words · each one builds a row of stones`, made: prize => `🏰 ${prize} is built!`, done: '🏰 CASTLE BUILT!' },
    train: { prize: 'the word train', draw: (p, n, full) => trainSVG(p, full), cap: (n, of) => `🚃 ${n}/${of} words · each one couples a carriage`, made: prize => `🚂 ${prize} is full steam ahead!`, done: '🚂 ALL ABOARD!' },
    balloon: { prize: 'your hot-air balloon', draw: p => balloonSVG(p), cap: (n, of) => `🎈 ${n}/${of} words · each one fills the balloon`, made: prize => `🎈 ${prize} is floating away!`, done: '🎈 UP, UP AND AWAY!', anim: 'launch' },
    snowman: { prize: 'your snowman', draw: p => snowmanSVG(p), cap: (n, of) => `⛄ ${n}/${of} words · each one packs on more snow`, made: prize => `⛄ ${prize} is finished!`, done: '⛄ SNOWMAN BUILT!', anim: 'wobble' },
    ship: { prize: 'Theseus\'s ship', draw: (p, n, full) => shipSVG(p, full), cap: (n, of) => `⛵ ${n}/${of} words · each one builds the ship`, made: prize => `⛵ ${prize} has its WHITE sail up – sail home safely!`, done: '⛵ WHITE SAIL UP!', anim: 'wobble' },
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

  // ===== Speech Marks: tap the gaps where the speech marks go =====
  // r.items: [{ text: '“Look out!” shouted Sam.' (the right answer, written with curly marks “ ”), who (emoji, svg or 'me'),
  //   bubble: true (show the spoken words in a speech bubble first), hint, why }]
  //   or { text: 'Sam said that he was hungry.', none: true, why } – reported speech, which needs no speech marks.
  // The sentence is shown without its speech marks, with a gap between every word and every punctuation mark. Tap a gap
  // to put a speech mark in it (tap again to take it out); the first mark opens “ and the next one closes ”. Two wrong
  // tries show the answer. Wrong answers get a hint about the rule they broke (pairs, only the spoken words, punctuation inside).
  GAMES.speechmarks = function (r, key, done) {
    const root = h('div', { class: 'game speechmarks' });
    const anyNone = r.items.some(it => it.none);
    let ii = 0;
    function parse(text) { // pieces (words and punctuation, each knowing if a space comes before it) + the gaps the marks sit in
      const pieces = [], marks = [];
      let space = false;
      for (const m of text.matchAll(/\s+|[“”"]|[A-Za-z0-9'’-]+|[^\sA-Za-z0-9'’“”"-]/g)) {
        const t = m[0];
        if (/^\s+$/.test(t)) { space = true; continue; }
        if (/^[“”"]$/.test(t)) { marks.push(pieces.length); continue; } // a mark sits in the gap before piece n
        pieces.push({ t, space: space && pieces.length > 0, word: /[A-Za-z0-9]/.test(t) });
        space = false;
      }
      return { pieces, marks };
    }
    function show() {
      const it = r.items[ii];
      const { pieces, marks: answer } = parse(it.text);
      let placed = [], tries = 0, over = false;
      const why = h('div', { class: 'why', hidden: true });
      const nextBtn = h('button', { class: 'btn big ready', type: 'button', hidden: true, onclick() { sfx.tap(); ii++; if (ii < r.items.length) show(); } }, 'Next sentence ▶');
      const line = h('p', { class: 'sm-line' });
      const gaps = [];
      function paint(final) {
        const on = (final || placed).slice().sort((a, b) => a - b);
        gaps.forEach((g, k) => {
          const n = on.indexOf(k);
          g.textContent = n < 0 ? '' : n % 2 ? '”' : '“';
          g.classList.toggle('on', n >= 0);
        });
        checkBtn.disabled = over || (!placed.length && !anyNone);
      }
      function gap(k) {
        const tight = k > 0 && k < pieces.length && !pieces[k].space; // between a word and its punctuation
        const g = h('button', { class: 'sm-gap' + (tight ? ' tight' : ''), type: 'button', 'aria-label': `gap ${k + 1}` });
        g.addEventListener('click', () => {
          if (over) return;
          const at = placed.indexOf(k);
          if (at >= 0) placed.splice(at, 1); else placed.push(k);
          sfx.tap(); paint();
        });
        gaps.push(g);
        return g;
      }
      pieces.forEach((pc, k) => line.append(h('span', { class: 'sm-unit' }, // a gap and the piece after it never split across lines
        gap(k), h('span', { class: 'sm-piece' + (pc.word ? '' : ' punct') }, pc.t), k === pieces.length - 1 && gap(k + 1))));
      // why a guess is wrong: the first rule it breaks
      function hint(got) {
        if (it.none) return it.hint || 'Look closely: are these the EXACT words someone said, or is the sentence just telling us about what they said?';
        if (!got.length) return 'Someone is speaking in this sentence! Which words come out of their mouth?';
        if (got.length % 2) return 'Speech marks come in pairs – one to open the speech and one to close it.';
        if (got.length !== answer.length) return it.hint || 'Put speech marks round ONLY the words that are spoken.';
        const [o, c] = got, [O, C] = answer;
        const NAME = { ',': 'comma', '.': 'full stop', '?': 'question mark', '!': 'exclamation mark' };
        if (c === C - 1 && !pieces[C - 1].word) return `The ${NAME[pieces[C - 1].t] || 'punctuation'} belongs INSIDE the speech marks – close them after it.`;
        if (o < O) return it.hint || 'Too much! Only the words that are actually SAID go inside – not who said them.';
        if (o > O || c < C) return it.hint || 'Some of the spoken words are left outside the speech marks. Where does the speaking start and end?';
        return it.hint || 'Not quite. Speech marks go round only the words that are spoken, with their punctuation inside.';
      }
      function finish(first) {
        over = true;
        if (first) { sfx.good(); award(`${key}:${ii}`, line); say(praise()); }
        track('Speech marks', { q: 'Speech marks: ' + it.text.replace(/[“”"]/g, ''), type: 'type', answer: it.text }, first);
        paint(answer);
        line.classList.add('done');
        why.innerHTML = (first ? '✔ ' : '👀 ') + fmt(it.why || (it.none ? 'No speech marks needed – this sentence only TELLS us what was said.' : it.text), false);
        why.hidden = false;
        checkBtn.hidden = true; noneBtn.hidden = true;
        if (ii < r.items.length - 1) nextBtn.hidden = false; else { confetti(80); done(); }
      }
      function check(sayNone) {
        if (over) return;
        const got = sayNone ? [] : placed.slice().sort((a, b) => a - b);
        const right = got.length === answer.length && got.every((g, k) => g === answer[k]);
        tries++;
        if (right) return finish(tries === 1);
        sfx.bad(); shake(line);
        if (tries >= 2) { say('Here is where they go. Have a good look!'); return finish(false); }
        say('💡 ' + hint(got));
      }
      const checkBtn = h('button', { class: 'btn green', type: 'button', onclick: () => check(false) }, '✔ Check');
      const noneBtn = h('button', { class: 'btn ghost', type: 'button', hidden: !anyNone, onclick: () => check(true) }, '🚫 No speech marks needed');
      const who = it.who === 'me' ? E.heroImg('sm-who') : it.who && pic(it.who, 'sm-who');
      const spoken = !it.none && answer.length >= 2 && pieces.slice(answer[0], answer[1]).map((pc, k) => (k && pc.space ? ' ' : '') + pc.t).join('');
      put(root,
        h('div', { class: 'tf-count' }, `${ii + 1} of ${r.items.length}`),
        it.bubble && spoken && h('div', { class: 'sm-comic' }, who, h('div', { class: 'sm-bubble' }, spoken)),
        h('div', { class: 'fx-label' }, r.label || '👆 Tap the gaps where the speech marks go'),
        line, why,
        h('div', { class: 'btn-row' }, checkBtn, noneBtn, nextBtn));
      paint();
      root._test = { gaps, answer, check, none: () => check(true), get over() { return over; }, next: () => nextBtn.click() };
    }
    show();
    return root;
  };

  // ===== Syllable Drum: tap the drum once for every syllable (beat) in a word or a line of a poem =====
  // r.items: [{ word: 'butterfly', parts: ['but', 'ter', 'fly'], emoji }] – the word (or a short line) and its syllables.
  // Tap the drum (or press the space bar) for each beat, then check. Two misses show the beats.
  GAMES.syllables = function (r, key, done) {
    const root = h('div', { class: 'game syllables' });
    let ii = 0;
    function show() {
      const it = r.items[ii], want = it.parts.length;
      let taps = 0, tries = 0, over = false;
      const dots = h('div', { class: 'sy-dots' });
      const why = h('div', { class: 'why', hidden: true });
      const nextBtn = h('button', { class: 'btn big ready', type: 'button', hidden: true, onclick() { sfx.tap(); ii++; show(); } }, 'Next ▶');
      const drum = h('button', { class: 'sy-drum', type: 'button', 'aria-label': 'Tap the drum' }, '🥁');
      const paint = () => put(dots, Array.from({ length: Math.max(taps, 1) }, (_, k) => h('i', { class: k < taps ? 'on' : '' })));
      const beat = () => { if (over) return; taps = Math.min(taps + 1, 12); sfx.tap(); drum.classList.remove('hit'); void drum.offsetWidth; drum.classList.add('hit'); paint(); };
      drum.addEventListener('pointerdown', e => { e.preventDefault(); beat(); });
      drum.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); beat(); } });
      const again = h('button', { class: 'btn ghost', type: 'button', onclick() { if (!over) { taps = 0; paint(); } } }, '↺ Start again');
      const check = h('button', { class: 'btn green', type: 'button', onclick() {
        if (over) return;
        if (!taps) { say('Tap the drum once for every beat!'); return; }
        tries++;
        if (taps === want) return finish(tries === 1);
        sfx.bad(); shake(dots);
        if (tries >= 2) return finish(false);
        say(`💡 Not quite – you tapped ${taps}. Say "${it.word}" slowly and clap it… then tap again.`);
        speak(it.parts.join(' - '), { rate: 0.6 });
        taps = 0; paint();
      } }, '✔ Check');
      function finish(first) {
        over = true;
        track('Syllables', { q: `How many syllables in "${it.word}"?`, type: 'type', answer: String(want) }, first);
        if (first) { sfx.good(); award(`${key}:${ii}`, drum); say(praise()); } else say(`It has ${want} beat${want > 1 ? 's' : ''}. Clap along!`);
        why.innerHTML = `${first ? '✔' : '👀'} <b>${it.parts.join(' · ')}</b> – ${want} syllable${want > 1 ? 's' : ''}`;
        why.hidden = false;
        speak(it.parts.join(' - '), { rate: 0.7 });
        check.hidden = true; again.hidden = true;
        if (ii < r.items.length - 1) nextBtn.hidden = false; else { confetti(70); done(); }
      }
      put(root, h('div', { class: 'tf-count' }, `${ii + 1} of ${r.items.length}`),
        h('div', { class: 'sy-word' }, it.emoji ? h('span', { class: 'sy-emoji' }, it.emoji) : null, h('span', null, it.word)),
        h('div', { class: 'btn-row' }, h('button', { class: 'btn', type: 'button', onclick() { speak(it.word, { force: true, rate: 0.8 }); } }, '🔊 Hear it')),
        drum, dots, why, h('div', { class: 'btn-row' }, again, check, nextBtn));
      paint();
      root._test = { tap: n => { for (let k = 0; k < n; k++) beat(); }, check: () => check.click(), want, get over() { return over; }, next: () => nextBtn.click() };
    }
    show();
    return root;
  };
});
