/* Clock helper for time lessons: draws analogue clock faces as SVG and turns times into words.
 * Clock.svg('3:45', opts) or Clock.svg(3, 45, opts) → SVG string (use as a pic, a question picture or optionsHtml).
 *   opts: roman (I–XII numbers), ring: 'pastto' (5–25 past on the right, 25–5 to on the left) | 'minutes' (5–55),
 *         halves (shade the PAST and TO sides), ticks (minute marks, default on), hands: false (empty face),
 *         geared (default true: the hour hand creeps between numbers like a real clock), size (px width).
 * Clock.words('3:45') → 'quarter to 4'.  Clock.digital('3:45') → '3:45'.  Clock.parse('3:45') → { h: 3, m: 45 }.
 */
(function () {
  'use strict';
  const ROMAN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  const NUM = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven'];

  function parse(t, m) {
    if (typeof t === 'number') return { h: t, m: m || 0 };
    if (t && typeof t === 'object') return { h: t.h, m: t.m || 0 };
    const [hh, mm] = String(t).split(':').map(Number);
    return { h: hh, m: mm || 0 };
  }
  const h12 = h => ((h % 12) + 12) % 12 || 12;
  const digital = (t, m) => { const p = parse(t, m); return `${h12(p.h)}:${String(p.m).padStart(2, '0')}`; };

  // UK-style words: o'clock, past, to. 'numbers' spells the hour as a numeral by default ("quarter to 4").
  function words(t, m, { spell = false } = {}) {
    const p = parse(t, m);
    const hr = n => (spell ? NUM[h12(n) % 12] : String(h12(n)));
    const mins = n => (n === 15 ? 'quarter' : n === 30 ? 'half' : n % 5 === 0 ? String(n) : n + (n === 1 ? ' minute' : ' minutes'));
    if (p.m === 0) return `${hr(p.h)} o'clock`;
    if (p.m <= 30) return `${mins(p.m)} past ${hr(p.h)}`;
    return `${mins(60 - p.m)} to ${hr(p.h + 1)}`;
  }

  function svg(t, m, opts) {
    if (typeof m === 'object') { opts = m; m = undefined; }
    const o = Object.assign({ ticks: true, geared: true, hands: true }, opts);
    const p = parse(t, m);
    const C = 100, R = o.ring ? 70 : 88;
    const pt = (deg, r) => [C + r * Math.sin(deg * Math.PI / 180), C - r * Math.cos(deg * Math.PI / 180)];
    let s = `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Clock showing ${digital(p)}"${o.size ? ` width="${o.size}"` : ''} class="clock-svg">`;
    if (o.ring) s += `<circle cx="${C}" cy="${C}" r="97" fill="#fff8e1" stroke="#1b1b1b" stroke-width="3"/>`;
    // face
    s += `<circle cx="${C}" cy="${C}" r="${R + 6}" fill="#1b1b1b"/><circle cx="${C}" cy="${C}" r="${R}" fill="#ffffff"/>`;
    if (o.halves) {
      s += `<path d="M${C} ${C - R} A${R} ${R} 0 0 1 ${C} ${C + R} Z" fill="#c8f7b0"/>`;
      s += `<path d="M${C} ${C + R} A${R} ${R} 0 0 1 ${C} ${C - R} Z" fill="#ffd9a8"/>`;
      s += `<line x1="${C}" y1="${C - R}" x2="${C}" y2="${C + R}" stroke="#1b1b1b" stroke-width="2" stroke-dasharray="5 4"/>`;
      s += `<text x="${C + 22}" y="${C + 30}" font-family="Lexend, Arial, sans-serif" font-weight="800" font-size="10" fill="#2e7d32" text-anchor="middle">PAST</text>`;
      s += `<text x="${C - 22}" y="${C + 30}" font-family="Lexend, Arial, sans-serif" font-weight="800" font-size="10" fill="#c25e00" text-anchor="middle">TO</text>`;
    }
    if (o.ticks) for (let i = 0; i < 60; i++) {
      const big = i % 5 === 0, [x1, y1] = pt(i * 6, R - (big ? 9 : 5)), [x2, y2] = pt(i * 6, R - 1);
      s += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#1b1b1b" stroke-width="${big ? 3 : 1.5}"/>`;
    }
    for (let i = 0; i < 12; i++) {
      const lab = o.roman ? ROMAN[i] : String(i || 12);
      const [x, y] = pt(i * 30, R - (o.roman ? 21 : 20));
      const fs = o.roman ? (lab.length > 3 ? 11 : 13) * (R / 88) + 1 : 17 * (R / 88) + 2;
      s += `<text x="${x.toFixed(1)}" y="${(y + fs * 0.36).toFixed(1)}" font-family="Lexend, Arial, sans-serif" font-weight="700" font-size="${fs.toFixed(1)}" fill="#1b1b1b" text-anchor="middle">${lab}</text>`;
    }
    if (o.ring) for (let i = 1; i < 12; i++) {
      const lab = o.ring === 'pastto' ? (i <= 6 ? (i === 6 ? 'half' : i === 3 ? '¼' : i * 5) : (i === 9 ? '¼' : (12 - i) * 5)) : i * 5;
      const col = o.ring === 'pastto' ? (i < 6 ? '#2e7d32' : i > 6 ? '#c25e00' : '#1b1b1b') : '#5a3d00';
      const [x, y] = pt(i * 30, 86);
      const fs = String(lab).length > 2 ? 9 : 12;
      s += `<text x="${x.toFixed(1)}" y="${(y + fs * 0.36).toFixed(1)}" font-family="Lexend, Arial, sans-serif" font-weight="800" font-size="${fs}" fill="${col}" text-anchor="middle">${lab}</text>`;
    }
    if (o.hands !== false) {
      const hourDeg = (p.h % 12) * 30 + (o.geared ? p.m * 0.5 : 0), minDeg = p.m * 6;
      const [hx, hy] = pt(hourDeg, R * 0.5), [mx, my] = pt(minDeg, R * 0.82);
      s += `<line class="hand-h" x1="${C}" y1="${C}" x2="${hx.toFixed(1)}" y2="${hy.toFixed(1)}" stroke="#1b1b1b" stroke-width="9" stroke-linecap="round"/>`;
      s += `<line class="hand-m" x1="${C}" y1="${C}" x2="${mx.toFixed(1)}" y2="${my.toFixed(1)}" stroke="#d9433b" stroke-width="5" stroke-linecap="round"/>`;
    }
    s += `<circle cx="${C}" cy="${C}" r="6" fill="#ffb800" stroke="#1b1b1b" stroke-width="2.5"/></svg>`;
    return s;
  }

  window.Clock = { svg, words, digital, parse, roman: n => ROMAN[n % 12] };
})();
