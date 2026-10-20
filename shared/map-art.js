/* Pixelkid quest map – the landscape kit: a Super Mario World–style overworld drawn from the map's own layout.
 * Each row of a lane becomes a terrace (grass on top, a cliff face below), so the road winds down an island. Where the
 * road drops down a cliff it becomes a ladder, and where it crosses water it becomes a bridge. The sea shows round the
 * edge and between the lanes of a fork. Scenery (hills with eyes, trees, flowers…) is painted once onto one canvas; the
 * only moving parts are light CSS animations (drifting clouds, waves, blinking hill eyes).
 * ART[world] switches the look on for a world; shared/map.js keeps the older look for the others.
 *   MapArt.terrain(world, rows, goalRow, W, H, small, rnd) → { ts, at(x, y), land(x, y, rx, ry), pond(x, y, w, h), CH }
 *   MapArt.scenery(world, rnd) → a scenery kind ('hill', 'trees', …); MapArt.FOOT[kind] = its footprint { rx, ry }
 *   MapArt.paint(canvas, T, world, items, W, H, rnd) → the hill eyes [{ x, y, gap }] (painted once)
 *   MapArt.paths(edges, T, world, W, H) → SVG markup for the road; edges: [{ pts, fresh }] (fresh ones draw themselves in)
 *   MapArt.live(map, eyes, W, H, rnd) → adds the water, clouds and eyes layers
 */
(function () {
  'use strict';
  const P = 4; // one art pixel, in CSS pixels
  const snap = v => Math.round(v / P) * P;

  const ART = {
    science: {
      ground: ['#b6ee6a', '#6cc644', '#3f9a2c', '#2a6b1a'], // light, grass, shade, dark
      cliff: ['#e0a05a', '#b0692e', '#713c15'], // light, face, dark
      hill: ['#a6e86e', '#4fbf3f', '#2e8a26'], mountain: ['#e2e6ea', '#a3abb5', '#6b7480'],
      path: 'dirt', sea: '#3d8fe4',
      scenery: { hill: 4, trees: 4, bush: 2, flowers: 2, mushroom: 1, rocks: 1 },
      trees: ['🌳', '🌲'], flowers: ['🌷', '🌼', '🌸', '🌻'],
    },
  };

  // ---------- the ground: terraces ----------
  function terrain(key, rows, goalRow, W, H, small, rnd) {
    const CH = small ? 24 : 32, IN = small ? 6 : 10;
    const ts = rows.concat(goalRow ? [goalRow] : []).map(r => {
      // each terrace is as wide as its stops (and their name tags) need, give or take, so the rows make an uneven island
      const slackL = r.minX != null ? Math.max(0, r.minX - 82 - (r.x0 + IN)) : 8, slackR = r.maxX != null ? Math.max(0, r.x1 - IN - (r.maxX + 82)) : 8;
      const x0 = snap(r.x0 + IN + rnd() * slackL), x1 = snap(r.x1 - IN - rnd() * slackR);
      const top = snap(Math.max(12, r.top)), cb = snap(r.bot);
      // a wobbly coastline: the left and right edges step in and out a little, a band at a time
      const band = () => { const out = []; for (let y = top; y < cb; y += snap(20 + rnd() * 24)) out.push({ y, d: Math.floor(rnd() * 5) * P }); return out; };
      return { x0, x1, top, bot: cb - snap(CH), cb, L: band(), R: band() };
    });
    const edge = (list, y) => { let d = 0; for (const b of list) { if (b.y > y) break; d = b.d; } return d; };
    ts.forEach(t => { t.lx = y => t.x0 + edge(t.L, y); t.rx = y => t.x1 - edge(t.R, y); });
    const ponds = [];
    // what is at a point: 'land' (a terrace top), 'cliff' (a cliff face) or 'water'. Later terraces are in front.
    const at = (x, y) => {
      if (ponds.some(p => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h)) return 'water';
      for (let i = ts.length - 1; i >= 0; i--) {
        const t = ts[i];
        if (y >= t.top + P && y < t.cb && x >= t.lx(y) + P && x < t.rx(y) - P) return y < t.bot ? 'land' : 'cliff';
      }
      return 'water';
    };
    // a patch of open grass: the point and the edges of a box round it are all on a terrace top
    const land = (x, y, rx = 0, ry = 0) => [[0, 0], [rx, 0], [-rx, 0], [0, ry], [0, -ry], [rx, ry], [-rx, ry], [rx, -ry], [-rx, -ry]]
      .every(([dx, dy]) => at(x + dx, y + dy) === 'land');
    // a pond in a big open patch of grass (w × h, centred on x, y)
    const pond = (x, y, w, h) => ponds.push({ x: snap(x - w / 2), y: snap(y - h / 2), w: snap(w), h: snap(h) });
    return { ts, at, land, pond, ponds, CH };
  }

  // a rectangle with stepped pixel corners (c steps)
  function block(g, x, y, w, h, c) {
    for (let i = 0; i < c; i++) {
      const inset = (c - i) * P;
      g.fillRect(x + inset, y + i * P, w - 2 * inset, P);
      g.fillRect(x + inset, y + h - (i + 1) * P, w - 2 * inset, P);
    }
    g.fillRect(x, y + c * P, w, h - 2 * c * P);
  }

  // fill a terrace-shaped area row by row (its wobbly edges), from y0 to y1, inset by k pixels
  function rowsOf(g, t, y0, y1, k) { for (let y = y0; y < y1; y += P) g.fillRect(t.lx(y) + k, y, t.rx(y) - t.lx(y) - 2 * k, P); }
  function terrace(g, t, A, rnd) {
    const { top, bot, cb } = t;
    g.fillStyle = '#000'; rowsOf(g, t, top, cb, 0); // the outline
    g.fillStyle = A.cliff[1]; rowsOf(g, t, bot, cb - P, P); // the cliff face, with layers of rock
    for (let y = bot + 2 * P; y < cb - P; y += 2 * P) {
      for (let x = t.lx(y) + 2 * P; x < t.rx(y) - 2 * P; x += P) {
        const n = rnd();
        if (n < 0.4) { g.fillStyle = A.cliff[0]; g.fillRect(x, y - P, P, P); } else if (n < 0.55) { g.fillStyle = A.cliff[2]; g.fillRect(x, y, P, P); }
      }
    }
    g.fillStyle = A.cliff[2]; rowsOf(g, t, cb - 2 * P, cb - P, P); // a dark foot where the cliff meets the ground below
    g.fillStyle = A.ground[1]; rowsOf(g, t, top + P, bot, P); // the grass top
    g.fillStyle = A.ground[0]; for (let y = top + P; y < bot; y += P) g.fillRect(t.lx(y) + P, y, P, P); // light down its left side…
    g.fillRect(t.lx(top + P) + 2 * P, top + P, t.rx(top + P) - t.lx(top + P) - 4 * P, P); // …and along its top
    g.fillStyle = A.ground[2]; for (let y = top + P; y < bot; y += P) g.fillRect(t.rx(y) - 2 * P, y, P, P); // shade down its right
    g.fillRect(t.lx(bot - P) + P, bot - P, t.rx(bot - P) - t.lx(bot - P) - 2 * P, P); // the grass lip over the cliff, with tufts hanging down
    for (let x = t.lx(bot) + 2 * P; x < t.rx(bot) - 2 * P; x += P) if (rnd() < 0.3) g.fillRect(x, bot, P, rnd() < 0.5 ? P : 2 * P);
    const w = t.x1 - t.x0, n = Math.round(w * (bot - top) / 800); // tufts and light specks in the grass
    for (let k = 0; k < n; k++) {
      const y = snap(top + 4 * P + rnd() * (bot - top - 7 * P)), x = snap(t.lx(y) + 3 * P + rnd() * (t.rx(y) - t.lx(y) - 7 * P));
      if (rnd() < 0.65) { g.fillStyle = A.ground[2]; g.fillRect(x, y, P, P); g.fillRect(x + 2 * P, y - P, P, 2 * P); } else { g.fillStyle = A.ground[0]; g.fillRect(x, y, P, P); }
    }
  }
  function pondArt(g, p, A) {
    g.fillStyle = '#000'; block(g, p.x - P, p.y - P, p.w + 2 * P, p.h + 2 * P, 3);
    g.fillStyle = 'rgba(255,255,255,.85)'; block(g, p.x, p.y, p.w, p.h, 2);
    g.fillStyle = A.sea || '#3d8fe4'; block(g, p.x + P, p.y + P, p.w - 2 * P, p.h - 2 * P, 2);
    g.fillStyle = A.cliff[1]; g.fillRect(p.x + 3 * P, p.y + P, p.w - 6 * P, P); // its far bank
    g.fillStyle = '#a9d6ff'; g.fillRect(p.x + p.w * 0.3, p.y + p.h * 0.5, 3 * P, P); g.fillRect(p.x + p.w * 0.6, p.y + p.h * 0.7, 2 * P, P);
  }

  // ---------- scenery ----------
  // how much open grass each kind of scenery needs round its spot (the spot is its base)
  const FOOT = { hill: { rx: 36, ry: 24 }, trees: { rx: 34, ry: 22 }, bush: { rx: 20, ry: 12 }, flowers: { rx: 20, ry: 12 }, mushroom: { rx: 14, ry: 14 }, rocks: { rx: 16, ry: 12 } };
  function scenery(key, rnd) {
    const S = (ART[key] || ART.science).scenery, all = Object.entries(S), sum = all.reduce((n, [, w]) => n + w, 0);
    let r = rnd() * sum;
    for (const [k, w] of all) { if ((r -= w) < 0) return k; }
    return all[0][0];
  }
  const emoji = (g, e, x, y, size) => {
    if (window.Pixel && Pixel.draw && Pixel.draw(g, e, x, y, size)) return;
    g.font = `${size}px sans-serif`; g.textAlign = 'center'; g.fillText(e, x, y);
  };
  const shadow = (g, x, y, w) => { g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(snap(x - w / 2), snap(y) - P, snap(w), P); };
  // a round hill (Super Mario World style); with eyes: true it gets a face (the eyes are a separate layer, so they can blink)
  function mound(g, cx, base, wu, hu, col, eyes) {
    cx = snap(cx); base = snap(base);
    const half = r => Math.round(wu / 2 * Math.sqrt(Math.max(0, 1 - (r / hu) ** 2)));
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(cx - (half(0) + 1) * P, base, (half(0) + 1) * 2 * P, P);
    g.fillStyle = '#000';
    for (let r = 0; r <= hu; r++) { const hw = half(r) + 1; g.fillRect(cx - hw * P, base - (r + 1) * P, hw * 2 * P, P); }
    for (let r = 0; r < hu; r++) {
      const hw = half(r); if (hw <= 0) continue;
      const y = base - (r + 1) * P;
      g.fillStyle = col[1]; g.fillRect(cx - hw * P, y, hw * 2 * P, P);
      g.fillStyle = col[2]; g.fillRect(cx + (hw - 1) * P, y, P, P); // shade on the right
      if (r > hu * 0.35 && hw > 2) { g.fillStyle = col[0]; g.fillRect(cx - (hw - 1) * P, y, P * Math.min(2, hw - 1), P); } // light on the left
    }
    if (eyes) eyes.push({ x: cx, y: base - Math.round(hu * 0.55) * P, gap: Math.max(10, Math.round(wu * 0.22) * P) });
  }
  // a big rocky mountain with a snowy top (a topic's landmark), with a smaller peak behind it
  function peak(g, cx, base, wu, hu, A) {
    cx = snap(cx); base = snap(base);
    const M = A.mountain || ['#e2e6ea', '#a3abb5', '#6b7480'], half = r => Math.round(wu / 2 * Math.pow(1 - r / hu, 0.8)) + (r >= hu - 1 ? 1 : 0);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(cx - (half(0) + 1) * P, base, (half(0) + 1) * 2 * P, P);
    g.fillStyle = '#000';
    for (let r = 0; r <= hu; r++) { const hw = half(Math.min(r, hu - 1)) + 1; g.fillRect(cx - hw * P, base - (r + 1) * P, hw * 2 * P, P); }
    for (let r = 0; r < hu; r++) {
      const hw = half(r), y = base - (r + 1) * P, snow = r > hu * 0.68;
      g.fillStyle = snow ? '#ffffff' : M[1]; g.fillRect(cx - hw * P, y, hw * 2 * P, P);
      g.fillStyle = snow ? '#cfe6ff' : M[2]; g.fillRect(cx + Math.max(0, Math.floor(hw / 3)) * P, y, Math.ceil(hw * 2 / 3) * P, P); // shade on the right
      if (!snow && r % 3 === 1 && hw > 3) { g.fillStyle = M[0]; g.fillRect(cx - (hw - 1) * P, y, 2 * P, P); } // light ledges on the left
    }
    for (let x = -half(Math.ceil(hu * 0.68)); x < half(Math.ceil(hu * 0.68)); x += 2) { // the snow's jagged lower edge
      g.fillStyle = '#ffffff'; g.fillRect(cx + x * P, base - Math.ceil(hu * 0.68) * P, P, P);
    }
  }
  const PAINT = {
    mountain(g, it, A) { peak(g, it.x - 26, it.y - 10, 14, 10, A); peak(g, it.x + 6, it.y, 22, 16, A); },
    hill(g, it, A, rnd, eyes) { mound(g, it.x, it.y, 14 + Math.floor(rnd() * 3) * 2, 9 + Math.floor(rnd() * 3), A.hill, eyes); },
    bush(g, it, A, rnd) { mound(g, it.x - 8, it.y, 6, 3, [A.ground[1], A.ground[2], A.ground[3]]); mound(g, it.x + 8, it.y, 7, 4, [A.ground[1], A.ground[2], A.ground[3]]); },
    trees(g, it, A, rnd) {
      const n = 2 + Math.floor(rnd() * 3), list = [];
      for (let k = 0; k < n; k++) list.push({ x: it.x + (k - (n - 1) / 2) * 18 + (rnd() - 0.5) * 8, y: it.y - (k % 2) * 10, s: 30 + Math.floor(rnd() * 3) * 4 });
      list.sort((a, b) => a.y - b.y).forEach(t => { shadow(g, t.x, t.y + 2, t.s * 0.7); emoji(g, A.trees[Math.floor(rnd() * A.trees.length)], t.x, t.y, t.s); });
    },
    flowers(g, it, A, rnd) {
      const n = 3 + Math.floor(rnd() * 3);
      for (let k = 0; k < n; k++) emoji(g, A.flowers[Math.floor(rnd() * A.flowers.length)], it.x + (rnd() - 0.5) * 30, it.y + (rnd() - 0.5) * 12, 16);
    },
    mushroom(g, it, A, rnd) { shadow(g, it.x, it.y + 2, 18); emoji(g, '🍄', it.x, it.y, 22); if (rnd() < 0.5) emoji(g, '🍄', it.x + 14, it.y + 4, 14); },
    rocks(g, it, A, rnd) { shadow(g, it.x, it.y + 2, 20); emoji(g, '🪨', it.x, it.y, 22); if (rnd() < 0.6) emoji(g, '🪨', it.x - 14, it.y + 3, 14); },
  };

  function paint(cv, T, key, items, W, H, rnd) {
    const A = ART[key] || ART.science, dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const g = cv.getContext('2d');
    if (!g || !g.fillRect) return [];
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.imageSmoothingEnabled = false;
    // white foam where the land meets the sea, then the terraces from the back to the front
    g.fillStyle = 'rgba(255,255,255,.6)';
    T.ts.forEach(t => { for (let y = t.top - P; y < t.cb + P; y += P) { const yy = Math.min(t.cb - P, Math.max(t.top, y)); g.fillRect(t.lx(yy) - P, y, t.rx(yy) - t.lx(yy) + 2 * P, P); } });
    T.ts.forEach(t => terrace(g, t, A, rnd));
    T.ponds.forEach(p => pondArt(g, p, A));
    const eyes = [];
    items.slice().sort((a, b) => a.y - b.y).forEach(it => (PAINT[it.kind] || PAINT.bush)(g, it, A, rnd, eyes));
    return eyes;
  }

  // ---------- the road ----------
  // Each edge is split into runs: over a terrace top it is the path, down a cliff a ladder, over water a bridge.
  function paths(edges, T, key, W, H) {
    const A = ART[key] || ART.science;
    let defs = '', out = '';
    edges.forEach((e, k) => {
      const land = [], ladders = [], bridges = [];
      for (let i = 1; i < e.pts.length; i++) {
        const a = e.pts[i - 1], b = e.pts[i], len = Math.hypot(b.x - a.x, b.y - a.y);
        if (!len) continue;
        const vert = a.x === b.x, n = Math.ceil(len / 2);
        const kind = (x, y) => { const t = T.at(x, y); return t === 'water' ? 'bridge' : t === 'cliff' && vert ? 'ladder' : 'land'; };
        let type = kind(a.x, a.y), sx = a.x, sy = a.y;
        const close = (x, y) => (type === 'land' ? land : type === 'ladder' ? ladders : bridges).push([sx, sy, x, y]);
        for (let j = 1; j <= n; j++) {
          const x = a.x + (b.x - a.x) * j / n, y = a.y + (b.y - a.y) * j / n, t = kind(x, y);
          if (t !== type) { close(x, y); type = t; sx = x; sy = y; }
        }
        close(b.x, b.y);
      }
      const d = list => list.map(([x1, y1, x2, y2]) => `M${x1} ${y1}L${x2} ${y2}`).join('');
      const S = (dd, a) => (dd ? `<path d="${dd}" ${a}/>` : '');
      let g = '';
      if (land.length) g += S(d(land), 'stroke="#000" stroke-width="14"') + S(d(land), 'stroke="#b8793a" stroke-width="10"') + S(d(land), 'stroke="#f1cd7c" stroke-width="6"');
      if (bridges.length) g += S(d(bridges), 'stroke="#000" stroke-width="20" stroke-linecap="butt"') + S(d(bridges), 'stroke="#8a5a32" stroke-width="16" stroke-linecap="butt"')
        + S(d(bridges), 'stroke="#e0a85e" stroke-width="16" stroke-dasharray="6 2" stroke-linecap="butt"');
      ladders.forEach(([x, y1, , y2]) => {
        g += S(`M${x} ${y1}V${y2}`, 'stroke="#000" stroke-width="18" stroke-dasharray="4 4" stroke-linecap="butt"')
          + S(`M${x} ${y1}V${y2}`, 'stroke="#e0a85e" stroke-width="14" stroke-dasharray="2 6" stroke-dashoffset="-1" stroke-linecap="butt"')
          + S(`M${x - 8} ${y1}V${y2}M${x + 8} ${y1}V${y2}`, 'stroke="#000" stroke-width="4"') + S(`M${x - 8} ${y1}V${y2}M${x + 8} ${y1}V${y2}`, 'stroke="#8a5a32" stroke-width="2"');
      });
      if (e.fresh) { // a new stretch of road draws itself in, from the stop before to the new stop
        const line = `M${e.pts.map(p => `${p.x} ${p.y}`).join('L')}`;
        defs += `<mask id="qrv${k}" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><path class="qreveal" d="${line}" pathLength="1" stroke="#fff" stroke-width="44" stroke-dasharray="1" stroke-dashoffset="1" stroke-linecap="butt" fill="none"/></mask>`;
        out += `<g class="qrv" mask="url(#qrv${k})">${g}</g>`;
      } else out += g;
    });
    return `<defs>${defs}</defs><g fill="none" stroke-linecap="square" shape-rendering="crispEdges">${out}</g>`;
  }

  // ---------- the living layers: the sea, drifting clouds, blinking hill eyes ----------
  function live(map, eyes, W, H, rnd) {
    const add = (cls, x, y) => { const d = document.createElement('div'); d.className = cls; d.style.left = x + 'px'; d.style.top = y + 'px'; map.append(d); return d; };
    const sea = document.createElement('div'); sea.className = 'qsea'; sea.innerHTML = '<i class="qglint"></i>'; map.prepend(sea);
    eyes.forEach(e => {
      const d = add('qeyes', e.x, e.y);
      d.style.setProperty('--gap', e.gap + 'px'); d.style.animationDelay = -(rnd() * 6).toFixed(2) + 's';
      d.innerHTML = '<i></i><i></i>';
    });
    for (let k = 0, n = H > 900 ? 4 : 3; k < n; k++) {
      const c = add('qcloud', 0, snap(30 + (k + rnd() * 0.8) * (H - 120) / n));
      c.style.setProperty('--w', W + 'px'); c.style.setProperty('--s', (0.7 + rnd() * 0.5).toFixed(2));
      const dur = 80 + rnd() * 60;
      c.style.animationDuration = dur.toFixed(0) + 's'; c.style.animationDelay = -(rnd() * dur).toFixed(1) + 's';
    }
  }
  // everything stops moving while the page is hidden
  document.addEventListener('visibilitychange', () => document.documentElement.classList.toggle('q-paused', document.hidden));

  window.MapArt = { has: key => !!ART[key], ART, P, FOOT, terrain, scenery, paint, paths, live };
})();
