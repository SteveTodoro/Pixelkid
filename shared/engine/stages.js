/* Pixelkid lesson engine – the stages that can take the place of a read stage: teach (teach the robot: fix its
 * mistakes), case (a detective case: answers uncover clue cards, then solve it) and investigate (predict, test it
 * in a simulation, explain the result). One part of shared/engine.js, loaded only by lessons that use one of them.
 * E is the engine's shared helpers (E.state is live). See the top of shared/engine.js.
 */
PixelkidEngine.part('stages', E => {
  'use strict';
  const { GAMES, award, complete, confetti, fmt, go, h, mascot, navRow, nextLabel, pic, put, runQuestions, save, say, sfx, shell, track } = E;

  // ---------- stage: teach the robot ----------
  // { type: 'teach', title, robot: { name, emoji }, say, intro, lines: [...], outro }
  // lines are fixit sentences: { text, wrong, fix, options, why, hint, wrongAt } or { text, ok: true, why }.
  // The robot teaches the topic one line at a time, but some lines are wrong: tap the wrong word and drag in the right
  // one, or press "That's right!". At the end the robot reads back its notes with every mistake fixed.
  const fixedLine = st => {
    if (st.ok) return st.text;
    const bare = w => w.toLowerCase().replace(/^[^a-z']+|[^a-z']+$/gi, '');
    const tokens = st.text.split(/\s+/);
    const wi = st.wrongAt != null ? st.wrongAt : tokens.findIndex(t => bare(t) === st.wrong.toLowerCase());
    return tokens.map((t, k) => {
      if (k !== wi) return t;
      const [, pre, post] = t.match(/^([^a-z']*)[a-z']+(.*)$/i) || [, '', ''];
      return pre + '**' + (/^[^a-z]*[A-Z]/.test(t) ? st.fix[0].toUpperCase() + st.fix.slice(1) : st.fix) + '**' + post;
    }).join(' ');
  };
  function renderTeach(s, i) {
    const R = Object.assign({ name: 'Professor Bolt', emoji: '🤖' }, s.robot);
    const area = h('div');
    const nav = navRow(() => go(i - 1, true));
    const robot = text => h('div', { class: 'tb-robot' }, h('div', { class: 'tb-face', 'aria-hidden': 'true' }, R.emoji),
      h('div', { class: 'tb-bubble' }, h('b', null, R.name + ': '), h('span', { html: fmt(text, false) })));
    function notes(quiet) {
      complete(i);
      if (!quiet) { sfx.win(); confetti(60); }
      put(area, robot(s.outro || 'Thank you! Now my notes are right. I will remember them forever!'),
        h('div', { class: 'panel-inner tb-notes' }, h('h3', null, `📝 ${R.name}'s notes, all fixed`),
          h('ul', null, s.lines.map(l => h('li', { html: fmt(fixedLine(l), false) })))));
      say('Read the fixed notes – that is what you taught the robot!');
      nav.set(nextLabel(i), () => go(i + 1));
    }
    function start() {
      const game = GAMES.fixit({
        sentences: s.lines, noOk: s.lines.every(l => !l.ok),
        label: `🔍 Is ${R.name} right? Tap a wrong word, or press "That's right!"`, okLabel: "✔ That's right!",
        onResult: (k, first) => { const l = s.lines[k]; track('Teach the robot', { q: l.text, type: 'type', answer: l.ok ? 'nothing wrong' : `${l.wrong} → ${l.fix}` }, first); },
      }, `s${i}tb`, () => nav.set('📝 See the fixed notes ▶', notes));
      put(area, robot(s.intro || `Hello! I am ${R.name}. I have learned all about this – let me teach YOU! (I might get a few things wrong…)`), h('div', { class: 'tb-lesson' }, game));
      say(s.say || `Listen to ${R.name}. If something is wrong, tap the wrong word and fix it!`);
    }
    const el = shell(s, [mascot(''), area, nav.el]);
    if (E.state.complete[i]) { notes(true); area.append(h('div', { class: 'btn-row' }, h('button', { class: 'btn', type: 'button', onclick() { sfx.tap(); start(); nav.set(nextLabel(i), () => go(i + 1)); } }, '🔁 Teach it again'))); }
    else { nav.set(nextLabel(i), null, false); start(); }
    return el;
  }

  // ---------- stage: detective case ----------
  // { type: 'case', title, say, mystery: 'the case file' (text or a list of paragraphs), pic,
  //   clues: [{ icon, clue: 'what the clue card says', q: one question (any type), say }],
  //   solve: the final question (who / what / why) + proof: [clue indexes that prove it], proofQ, proofHint,
  //   closed: 'what really happened' }
  // Each right answer uncovers a clue card on the evidence board; then the clues solve the case. Solve options are
  // just the suspects (no reasons), so the case file has to be read. With proof, the child then taps the clue card
  // that proves it, and the case closes with a detective rank: first-try accusation + first-try proof = Super Sleuth.
  const RANKS = [
    { icon: '🥉', name: 'JUNIOR DETECTIVE', say: 'Case closed! Next time, read the case file and your clues before you choose – real detectives check the evidence.' },
    { icon: '🥈', name: 'SHARP DETECTIVE', say: 'Case closed! Sharp detective work!' },
    { icon: '🥇', name: 'SUPER SLEUTH', say: 'Case closed! Right first time, with the proof – you\'re a Super Sleuth!' },
  ];
  function renderCase(s, i) {
    const area = h('div');
    const nav = navRow(() => go(i - 1, true));
    const proof = s.solve.proof != null ? [].concat(s.solve.proof) : null;
    const cards = s.clues.map((c, k) => h('div', { class: 'cs-clue' },
      h('div', { class: 'cs-back' }, '🔍', h('small', null, `CLUE ${k + 1}`)),
      h('div', { class: 'cs-front' }, h('span', { class: 'cs-icon' }, c.icon || '🧩'), h('span', { html: fmt(c.clue, false) }))));
    const board = h('div', { class: 'cs-board' }, h('div', { class: 'cs-tag' }, '📌 EVIDENCE BOARD'), h('div', { class: 'cs-clues' }, cards));
    const file = h('div', { class: 'cs-file' }, h('div', { class: 'cs-tag' }, '📁 CASE FILE'), s.pic && pic(s.pic, 'cs-pic'),
      [].concat(s.mystery).map(t => h('p', { html: fmt(t) })));
    const open = k => cards[k].classList.add('open');
    let rank = 0; // this run: +1 for a first-try accusation, +1 for first-try proof
    function clue(k) {
      if (k >= s.clues.length) return solve();
      const c = s.clues[k];
      say(c.say || `Clue ${k + 1}! Answer this to uncover it.`);
      runQuestions(area, [c.q], {
        key: `s${i}k${k}`, kind: 'Detective case', countLabel: `🔍 CLUE ${k + 1} OF ${s.clues.length}`, lastLabel: '🔍 Uncover the clue',
        done() {
          open(k); sfx.achieve();
          say('A new clue for the board!');
          put(area, h('div', { class: 'cs-found' }, h('span', { class: 'cs-icon' }, c.icon || '🧩'), h('span', { html: fmt(c.clue, false) })),
            h('div', { class: 'btn-row' }, h('button', { class: 'btn big ready', type: 'button', onclick() { sfx.tap(); clue(k + 1); } }, k < s.clues.length - 1 ? 'Next clue ▶' : '🕵️ Solve the case ▶')));
        },
      });
    }
    function solve() {
      rank = 0;
      say(s.solveSay || (proof ? 'Read the case file and your clues again. Then choose – a real detective will have to prove it!' : 'Look at all your clues. Time to solve the case!'));
      file.scrollIntoView && file.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // with a proof step the explanation waits for the case-closed screen, so it can't give the proof away
      const q = proof ? Object.assign({}, s.solve, { explain: null }) : s.solve;
      runQuestions(area, [q], {
        key: `s${i}solve`, kind: 'Detective case', countLabel: '🕵️ SOLVE THE CASE', lastLabel: proof ? '🔍 Prove it ▶' : '🔒 Close the case',
        done: score => { rank += score; proof ? prove() : closed(); },
      });
    }
    function prove() {
      let misses = 0;
      board.classList.add('picking');
      say(s.solve.proofSay || 'Now prove it! Tap the clue on the evidence board that proves it.');
      put(area, h('div', { class: 'cs-prove' }, h('div', { class: 'cs-prove-tag' }, '🔍 PROVE IT!'),
        h('p', { html: fmt(s.solve.proofQ || 'Which clue on your evidence board proves it? Tap it!', false) })));
      board.scrollIntoView && board.scrollIntoView({ behavior: 'smooth', block: 'center' });
      cards.forEach((card, k) => {
        card.setAttribute('role', 'button'); card.tabIndex = 0;
        card.onclick = () => {
          if (!board.classList.contains('picking')) return;
          if (proof.includes(k)) {
            track('Detective case', { q: 'proof: ' + (s.solve.proofQ || s.solve.q) }, misses === 0);
            if (misses === 0) { rank++; award(`s${i}proof`, card); }
            sfx.good(); card.classList.add('proof');
            board.classList.remove('picking');
            cards.forEach(c => { c.onclick = null; c.removeAttribute('role'); c.removeAttribute('tabindex'); c.classList.remove('hint'); });
            setTimeout(() => closed(), 900);
          } else {
            misses++; sfx.bad();
            card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
            const tip = s.solve.proofHint || 'That clue is true – but does it prove it? Read the clues again!';
            say('💡 ' + tip);
            if (misses >= 2) proof.forEach(p => cards[p].classList.add('hint')); // never stuck: the proof card glows
          }
        };
        card.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.onclick && card.onclick(); } };
      });
    }
    function closed(quiet) {
      complete(i);
      cards.forEach((_, k) => open(k));
      const parts = [h('div', { class: 'cs-stamp' }, 'CASE CLOSED')];
      if (proof) {
        if (!quiet) for (let b = 0; b < rank; b++) award(`s${i}sleuth${b}`); // bonus gems, earned once each
        const R = RANKS[quiet ? (E.state.awarded[`s${i}sleuth1`] ? 2 : E.state.awarded[`s${i}sleuth0`] ? 1 : 0) : rank];
        parts.push(h('div', { class: 'cs-rank r' + RANKS.indexOf(R) }, h('span', { class: 'cs-rank-icon' }, R.icon), h('span', null, h('small', null, 'DETECTIVE RANK'), R.name)));
        if (!quiet && rank < 2) parts.push(h('p', { class: 'cs-rank-tip' }, rank ? 'Right first time on the accusation AND the proof makes you a Super Sleuth – and wins bonus gems!' : 'Choosing first time AND tapping the right proof wins bonus gems. Read the evidence!'));
        if (s.solve.explain) parts.push(h('p', { class: 'cs-why', html: fmt('✔ ' + s.solve.explain) }));
        if (!quiet) say(R.say);
      } else if (!quiet) say('Case closed! Brilliant detective work!');
      if (!quiet) { sfx.win(); confetti(proof && rank === 2 ? 140 : 90); }
      parts.push([].concat(s.closed || []).map(t => h('p', { html: fmt(t) })));
      put(area, h('div', { class: 'cs-closed' }, parts));
      nav.set(nextLabel(i), () => go(i + 1));
    }
    const el = shell(s, [mascot(''), file, board, area, nav.el]);
    if (E.state.complete[i]) { closed(true); area.append(h('div', { class: 'btn-row' }, h('button', { class: 'btn', type: 'button', onclick() { sfx.tap(); cards.forEach(c => c.classList.remove('open', 'proof')); clue(0); } }, '🔁 Solve it again'))); }
    else { nav.set(nextLabel(i), null, false); clue(0); }
    return el;
  }

  // ---------- stage: investigation ----------
  // { type: 'investigate', title, say, question: 'the big question',
  //   predict: { q, options, answer (index of what really happens, optional) },
  //   test: a game round to find out (usually a simulation with missions: windtest, garden, ramp, pollinate, timehops …),
  //   explain: [questions about what happened], result: 'what we found out' (text or a list of paragraphs) }
  // Predict first (never wrong), test it, then explain the result and compare it with the prediction.
  function renderInvestigate(s, i) {
    const area = h('div');
    const nav = navRow(() => go(i - 1, true));
    const steps = ['🔮 Predict', '🧪 Test', '💡 Explain'].map(t => h('div', { class: 'iv-step' }, t));
    const setStep = n => steps.forEach((el, k) => { el.classList.toggle('now', k === n); el.classList.toggle('done', k < n); });
    const guess = () => (E.state.predict || {})[i];
    const P = s.predict;
    function predict() {
      setStep(0);
      say(P.say || 'What do you think will happen? Scientists always make a guess first – it is never wrong!');
      const opts = P.options.map((o, k) => h('button', { class: 'opt', type: 'button', onclick(e) {
        sfx.tap(); opts.forEach(b => { b.disabled = true; }); e.currentTarget.classList.add('right');
        E.state.predict = Object.assign({}, E.state.predict, { [i]: k }); save(); award(`s${i}p`, e.currentTarget);
        setTimeout(test, 700);
      } }, o));
      put(area, h('div', { class: 'q-tag' }, '🔮 Make a prediction – there is no wrong answer!'), h('p', { class: 'q-text', html: fmt(P.q, false) }), h('div', { class: 'opts' }, opts));
    }
    function test() {
      setStep(1);
      const t = s.test, after = h('div', { class: 'btn-row' });
      put(area, guess() != null && h('div', { class: 'iv-recall' }, '🔮 You predicted: ', h('b', null, P.options[guess()])),
        t.intro && h('p', { class: 'instr', html: fmt(t.intro) }),
        GAMES[t.game](t, `s${i}t`, () => { sfx.win(); put(after, h('button', { class: 'btn big ready', type: 'button', onclick() { sfx.tap(); explain(); } }, '💡 Explain what happened ▶')); }),
        after);
      say(t.say || 'Now test it and see what really happens!');
    }
    function explain() {
      setStep(2);
      say('What did you find out? Explain it!');
      runQuestions(area, s.explain, { key: `s${i}x`, kind: 'Investigation', lastLabel: '🔬 What we found out ▶', done: () => found() });
    }
    function found(quiet) {
      complete(i);
      setStep(3);
      if (!quiet) { sfx.win(); confetti(70); }
      const g = guess(), right = P.answer != null && g === P.answer;
      const verdict = g == null || P.answer == null ? null
        : right ? '✔ Your prediction was right – great thinking!'
          : `You predicted “${P.options[g]}”, but really “${P.options[P.answer]}”. Guessing first, then checking, is how we find things out!`;
      put(area, h('div', { class: 'panel-inner iv-result' }, h('h3', null, '🔬 What we found out'), verdict && h('p', { class: 'iv-verdict' + (right ? ' right' : '') }, verdict),
        [].concat(s.result || []).map(t => h('p', { html: fmt(t) }))),
        h('div', { class: 'btn-row' }, h('button', { class: 'btn', type: 'button', onclick() { sfx.tap(); test(); } }, '🔁 Test it again')));
      if (!quiet) say(right ? 'You predicted it! Brilliant!' : 'Investigation complete! Read what we found out.');
      nav.set(nextLabel(i), () => go(i + 1));
    }
    const top = h('div', { class: 'iv-head' }, s.question && h('div', { class: 'iv-question' }, '❓ ', h('span', { html: fmt(s.question, false) })), h('div', { class: 'iv-steps' }, steps));
    const el = shell(s, [mascot(''), top, area, nav.el]);
    if (E.state.complete[i]) found(true);
    else { nav.set(nextLabel(i), null, false); if (guess() != null) test(); else predict(); }
    return el;
  }

  return { renderTeach, renderCase, renderInvestigate };
});
