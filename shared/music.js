/* Pixelkid music – looping chiptune themes made with Web Audio (no sound files).
 * Music.play('map-science' … 'map-world' | 'boss'), Music.stop(), Music.faster() (the boss gets angry).
 * Music is on unless y3:settings has music: false (the 🎵 button on the home page) or muted: true (the lesson 🔊).
 * Pages with no Web Audio (or the smoke tests' jsdom) just stay silent.
 *
 * A song: bpm, chords (one per bar: 'C', 'Am', 'F#m'…), a melody (bars split by |, notes as NAME:sixteenths,
 * r = rest; every bar adds up to 16), a lead wave, and styles for the bass, the arpeggio and the drums.
 * The bass, arpeggio and drums are built from the chords, so a new theme only needs chords and a tune.
 */
(function () {
  'use strict';
  const SONGS = {
    // Science: a sunny walk across the fields to the castle
    'map-science': { bpm: 132, lead: 'pulse25', bass: 'walk', arp: 'none', drums: 'march',
      chords: 'C G Am F C G F G',
      tune: 'E5:2 G5:2 C6:4 B5:2 G5:2 E5:4 | D5:2 G5:2 B5:4 A5:2 G5:2 D5:4 | C5:2 E5:2 A5:4 G5:2 E5:2 C5:4 | A4:2 C5:2 F5:4 E5:2 F5:2 A5:4 |' +
        'G5:3 E5:1 C5:2 E5:2 G5:4 C6:4 | B5:3 A5:1 G5:2 D5:2 B4:4 D5:4 | A5:2 G5:2 F5:2 E5:2 F5:2 A5:2 C6:4 | D6:4 B5:2 G5:2 D5:4 r:4' },
    // Maths: rattling along the mine-cart rails
    'map-maths': { bpm: 120, lead: 'square', bass: 'gallop', arp: 'none', drums: 'rails',
      chords: 'Am Am F G Am Am Dm E',
      tune: 'A4:2 C5:2 E5:2 A5:2 G5:2 E5:2 C5:2 E5:2 | A5:4 B5:2 C6:2 B5:2 A5:2 E5:4 | F5:2 A5:2 C6:2 A5:2 G5:2 F5:2 E5:2 F5:2 | G5:4 D5:2 G5:2 B5:4 r:4 |' +
        'E5:2 A5:2 C6:2 A5:2 E5:2 A5:2 C6:2 E6:2 | D6:2 C6:2 B5:2 A5:2 C6:4 A5:4 | F5:2 A5:2 D6:2 A5:2 F5:2 D5:2 F5:2 A5:2 | G#5:4 B5:2 E6:2 D6:2 B5:2 G#5:4' },
    // English: a storybook kingdom, like a little minstrel tune
    'map-english': { bpm: 112, lead: 'triangle', bass: 'pluck', arp: 'broken', drums: 'tabor',
      chords: 'Dm C Bb C Dm C Bb A',
      tune: 'D5:4 F5:2 A5:2 G5:2 F5:2 E5:4 | E5:4 G5:2 C6:2 B5:2 G5:2 E5:4 | F5:4 D5:2 Bb4:2 C5:2 D5:2 F5:4 | E5:6 D5:2 C5:4 r:4 |' +
        'A5:4 F5:2 A5:2 D6:4 C6:2 A5:2 | G5:4 E5:2 G5:2 C6:4 B5:2 G5:2 | F5:2 G5:2 A5:2 Bb5:2 D6:4 C6:2 Bb5:2 | A5:4 C#5:2 E5:2 A4:4 r:4' },
    // Future Skills: floating between the asteroids
    'map-future': { bpm: 104, lead: 'pulse12', bass: 'pad', arp: 'fast', drums: 'space',
      chords: 'Em C G D Em C Am B',
      tune: 'B4:4 E5:4 G5:4 F#5:2 E5:2 | G5:8 E5:4 r:4 | D5:4 G5:4 B5:4 A5:2 G5:2 | F#5:8 A5:4 r:4 |' +
        'B5:4 G5:2 E5:2 B5:4 C6:2 B5:2 | G5:4 E5:4 C5:4 E5:4 | A5:4 C6:4 E6:4 D6:2 C6:2 | B5:8 D#5:4 F#5:4' },
    // Wonders: a lazy lagoon with palm trees
    'map-wonders': { bpm: 100, lead: 'triangle', bass: 'calypso', arp: 'stabs', drums: 'island',
      chords: 'G Em C D G Em C D',
      tune: 'B4:2 D5:2 G5:3 F#5:1 G5:2 B5:2 A5:4 | G5:2 E5:2 B4:4 E5:2 G5:2 B5:4 | C6:3 B5:1 A5:2 G5:2 E5:2 G5:2 C5:4 | D5:2 F#5:2 A5:4 C6:2 A5:2 F#5:4 |' +
        'D6:4 B5:2 G5:2 D6:3 B5:1 G5:4 | E6:4 B5:2 G5:2 E5:4 G5:4 | A5:2 G5:2 E5:2 G5:2 A5:2 C6:2 E6:4 | D6:4 C6:2 A5:2 F#5:4 D5:4' },
    // Brain Dojo: calm and steady, on the five notes of a pentatonic scale
    'map-brain': { bpm: 92, lead: 'triangle', bass: 'pad', arp: 'broken', drums: 'tabor',
      chords: 'Am G F G Am G Em Am',
      tune: 'E5:4 G5:2 A5:2 C6:4 A5:4 | D5:4 E5:2 G5:2 A5:4 G5:4 | C5:4 D5:2 E5:2 G5:4 E5:4 | D5:8 r:4 G4:4 |' +
        'A5:4 C6:2 D6:2 E6:4 D6:4 | C6:4 A5:2 G5:2 A5:4 r:4 | E5:2 G5:2 A5:2 G5:2 E5:4 D5:4 | A4:8 r:8' },
    // Around the World: off on a trip, island to island
    'map-world': { bpm: 126, lead: 'pulse25', bass: 'walk', arp: 'stabs', drums: 'travel',
      chords: 'D A Bm G D A G A',
      tune: 'D5:3 F#5:3 A5:2 D6:3 C#6:1 A5:4 | E5:3 A5:3 C#6:2 E6:3 D6:1 C#6:4 | D6:3 B5:3 F#5:2 D5:4 F#5:4 | G5:3 B5:3 D6:2 B5:4 r:4 |' +
        'A5:2 F#5:2 A5:2 D6:2 F#6:4 E6:2 D6:2 | C#6:4 A5:2 E5:2 C#6:4 E6:4 | D6:2 B5:2 G5:2 B5:2 D6:2 G6:2 F#6:2 E6:2 | E6:6 C#6:2 A5:4 r:4' },
    // the boss battle: fast and dramatic, but not scary
    boss: { bpm: 160, lead: 'square', bass: 'drive', arp: 'fast', drums: 'battle',
      chords: 'Dm Dm Bb C Dm Dm Bb A',
      tune: 'D5:2 F5:2 A5:2 D6:2 C6:2 A5:2 F5:2 A5:2 | E5:2 F5:2 G5:2 A5:4 F5:2 D5:4 | Bb4:2 D5:2 F5:2 Bb5:4 A5:2 F5:4 | G5:2 E5:2 C5:2 E5:2 G5:2 C6:2 E6:4 |' +
        'F6:2 E6:2 D6:2 A5:2 F6:2 E6:2 D6:2 A5:2 | D6:3 C6:1 A5:2 F5:2 D5:4 F5:2 A5:2 | Bb5:2 A5:2 F5:2 D5:2 Bb5:2 C6:2 D6:4 | C#6:4 E6:2 C#6:2 A5:2 E5:2 C#5:2 E5:2' },
  };
  // drum patterns, one bar of 16 steps: k kick, s snare, h hi-hat, . nothing
  const DRUMS = {
    march: 'k.h.s.h.k.h.s.hh', rails: 'k.hhs.hhk.hhs.hh', tabor: 'k...h...s...h.h.', space: 'k.......s.......',
    island: 'k..h..k.s..h..h.', travel: 'k.h.s.hkk.h.s.h.', battle: 'khhhskhhkhhhskhs',
  };
  // bass rhythms: [step, 0 root | 1 fifth | 2 octave, length in steps]
  const BASS = {
    walk: [[0, 0, 3], [4, 1, 3], [8, 0, 3], [12, 1, 3]],
    gallop: [[0, 0, 1], [2, 2, 1], [3, 0, 1], [4, 1, 1], [6, 2, 1], [7, 0, 1], [8, 0, 1], [10, 2, 1], [11, 0, 1], [12, 1, 1], [14, 2, 1], [15, 0, 1]],
    pluck: [[0, 0, 6], [6, 1, 2], [8, 0, 4], [12, 1, 4]],
    pad: [[0, 0, 14], [14, 1, 2]],
    calypso: [[0, 0, 3], [3, 0, 3], [6, 1, 2], [8, 0, 3], [11, 0, 3], [14, 1, 2]],
    drive: [0, 2, 4, 6, 8, 10, 12, 14].map((s, k) => [s, k % 2 ? 2 : 0, 1]),
  };
  const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const midi = name => { const m = /^([A-G])(#|b)?(-?\d)$/.exec(name); return 12 * (+m[3] + 1) + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); };
  const hz = n => 440 * Math.pow(2, (n - 69) / 12);
  const chord = c => { const m = /^([A-G])(#|b)?(m?)$/.exec(c), root = midi(m[1] + (m[2] || '') + '2'); return [root, root + (m[3] ? 3 : 4), root + 7]; };

  // turns a song into one list of notes per step: [channel, midi, length in steps]
  function compile(s) {
    const chords = s.chords.split(/\s+/).map(chord), bars = chords.length, len = bars * 16;
    const steps = Array.from({ length: len }, () => []);
    let at = 0;
    s.tune.split('|').forEach((bar, b) => {
      let sum = 0;
      bar.trim().split(/\s+/).forEach(tok => {
        const [n, d] = tok.split(':'); const dur = +d;
        if (n !== 'r') steps[at % len].push(['lead', midi(n), dur]);
        at += dur; sum += dur;
      });
      if (sum !== 16) console.warn(`music: bar ${b + 1} of a song adds up to ${sum}, not 16`);
    });
    chords.forEach((c, b) => {
      const o = b * 16;
      BASS[s.bass].forEach(([st, which, l]) => steps[o + st].push(['bass', c[0] + (which === 1 ? 7 : which === 2 ? 12 : 0), l]));
      const up = c.map(n => n + 24); // the chord two octaves up, for the arpeggio
      if (s.arp === 'fast') for (let k = 0; k < 16; k++) steps[o + k].push(['arp', up[[0, 1, 2, 1][k % 4]] + (k >= 8 ? 12 : 0), 1]);
      if (s.arp === 'broken') for (let k = 0; k < 16; k += 2) steps[o + k].push(['arp', up[[0, 2, 1, 2][(k / 2) % 4]], 2]);
      if (s.arp === 'stabs') [2, 6, 10, 14].forEach(k => up.forEach(n => steps[o + k].push(['arp', n, 1])));
      [...DRUMS[s.drums]].forEach((d, k) => { if (d !== '.') steps[o + k].push(['drum', d, 1]); });
    });
    return { bpm: s.bpm, lead: s.lead, steps };
  }

  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx = null, master = null, noise = null, waves = {};
  let song = null, name = null, step = 0, nextT = 0, timer = 0, speed = 1;
  const settings = () => { try { return JSON.parse(localStorage.getItem('y3:settings') || '{}'); } catch (e) { return {}; } };
  const allowed = () => { const s = settings(); return s.music !== false && !s.muted; };

  function setup() {
    if (ctx || !AC) return !!ctx;
    try {
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0;
      master.connect(ctx.destination);
      // pulse waves (12.5% and 25% wide) sound like a real games console
      const pulse = duty => {
        const n = 32, re = new Float32Array(n), im = new Float32Array(n);
        for (let k = 1; k < n; k++) re[k] = 2 / (k * Math.PI) * Math.sin(k * Math.PI * duty);
        return ctx.createPeriodicWave(re, im);
      };
      waves = { pulse25: pulse(0.25), pulse12: pulse(0.125) };
      noise = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
      const d = noise.getChannelData(0); for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
      document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else if (song) ctx.resume(); });
      return true;
    } catch (e) { ctx = null; return false; }
  }

  function note(type, n, t, dur, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    if (waves[type]) o.setPeriodicWave(waves[type]); else o.type = type;
    o.frequency.value = hz(n);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.setValueAtTime(vol, t + dur * 0.75);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.98);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur);
  }
  function drum(d, t) {
    if (d === 'k') { // kick: a quick falling thump
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      o.connect(g).connect(master); o.start(t); o.stop(t + 0.16);
      return;
    }
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), len = d === 's' ? 0.12 : 0.03;
    src.buffer = noise; f.type = 'highpass'; f.frequency.value = d === 's' ? 1500 : 7000;
    g.gain.setValueAtTime(d === 's' ? 0.12 : 0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(f).connect(g).connect(master); src.start(t); src.stop(t + len + 0.01);
  }
  function tick() {
    const sd = 60 / (song.bpm * speed) / 4;
    while (nextT < ctx.currentTime + 0.15) {
      for (const [ch, n, l] of song.steps[step]) {
        if (ch === 'lead') note(song.lead, n, nextT, l * sd, 0.05);
        else if (ch === 'bass') note('triangle', n, nextT, l * sd, 0.16);
        else if (ch === 'arp') note('square', n, nextT, l * sd, 0.012);
        else drum(n, nextT);
      }
      nextT += sd; step = (step + 1) % song.steps.length;
    }
  }

  const compiled = {};
  const Music = {
    songs: Object.keys(SONGS),
    playing: () => name,
    // start a song (or carry on if it's already playing); safe to call again and again
    play(which) {
      if (!SONGS[which] || !allowed() || !setup()) return;
      if (ctx.state === 'suspended') ctx.resume();
      if (name === which && timer) return;
      clearInterval(timer);
      song = compiled[which] = compiled[which] || compile(SONGS[which]);
      name = which; step = 0; speed = 1;
      nextT = ctx.currentTime + 0.1;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(0.0001, ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 0.4);
      timer = setInterval(tick, 40); tick();
    },
    // fade out and stop
    stop() {
      if (!timer) { name = null; return; }
      clearInterval(timer); timer = 0; name = null;
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(0, t + 0.3);
    },
    faster() { speed = 1.12; },
    // the settings changed (the 🔊 or 🎵 button): stop, or start `which` again
    refresh(which) { if (!allowed()) Music.stop(); else if (which) Music.play(which); },
    _compile: k => compile(SONGS[k]),
  };
  window.Music = Music;
})();
