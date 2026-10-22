/* Pixelkid quest map – the landscape kit: a Super Mario World–style overworld drawn from the map's own layout.
 * Each row of a lane becomes a terrace (ground on top, a cliff face below), so the road winds down an island. Where the
 * road drops down a cliff it becomes a ladder, and where it crosses water it becomes a bridge. Water shows round the
 * edge and between the lanes of a fork. Scenery (hills with eyes, trees, houses…) is painted once onto one canvas; the
 * only moving parts are light CSS animations (drifting clouds, waves, blinking hill eyes, boats bobbing).
 * Every world is its own biome (ART[world]): its colours, cliffs, path, scenery, what floats in its water, and whether
 * its "sea" is water or space.
 *   MapArt.terrain(world, rows, goalRow, W, H, small, rnd) → { ts, at(x, y), land(x, y, rx, ry), pond(x, y, w, h), CH }
 *   MapArt.scenery(world, rnd) → a scenery kind ('hill', 'trees', …); MapArt.FOOT[kind] = its footprint { rx, ry }
 *   MapArt.paint(canvas, T, world, items, W, H, rnd) → the hill eyes [{ x, y, gap }] (painted once)
 *   MapArt.paths(edges, T, world, W, H) → SVG markup for the road; edges: [{ pts, fresh }] (fresh ones draw themselves in)
 *   MapArt.frame(canvas, w, h, F, world) → paints the treasure-map border round the map: parchment, F pixels wide, singed edges
 *   MapArt.live(map, eyes, W, H, rnd, rivers, world, T) → adds the water, clouds, eyes and floating things; rivers: [{ x, top, bot }]
 *     (between a fork's branches) get falling water and a foam splash where they reach the land below, in a world with waterfall: true
 */
(function () {
  'use strict';
  const P = 4; // one art pixel, in CSS pixels
  const snap = v => Math.round(v / P) * P;

  // ground / cliff / hill / mountain: [light, main, shade(, dark)]. peak: the mountain top (snow, sand…). path: dirt | rail | cobble |
  // circuit | boardwalk | flight. scenery: how often each kind appears. floaters: things in the water (or space). ponds: how many.
  // waterfall: the gap between a fork's branches gets falling water and a splash (elsewhere it is just open water).
  // pond: a frozen pond's colour. snowfall: snow drifts down over the map. critters: false – no butterflies.
  const ART = {
    science: { // green hills by the sea
      ground: ['#b6ee6a', '#6cc644', '#3f9a2c', '#2a6b1a'], cliff: ['#e0a05a', '#b0692e', '#713c15'],
      hill: ['#a6e86e', '#4fbf3f', '#2e8a26'], mountain: ['#e2e6ea', '#a3abb5', '#6b7480'], peak: ['#ffffff', '#cfe6ff'],
      path: 'dirt', sea: '#3d8fe4', ponds: 2, waterfall: true, // (the river between a fork's branches falls like a waterfall)
      scenery: { hill: 4, trees: 4, bush: 2, flowers: 2, mushroom: 1, rocks: 1 },
      trees: ['🌳', '🌲'], flowers: ['🌷', '🌼', '🌸', '🌻'],
    },
    maths: { // a mine: dusty rock ledges over dark underground pools, a minecart track, lanterns and timber
      ground: ['#f0c88f', '#d29a5c', '#a46c38', '#6e4722'], cliff: ['#9a6a48', '#6b4630', '#3d271a'], strata: true,
      hill: ['#d8c8b8', '#9c8b7a', '#64584c'], mountain: ['#e3bf8f', '#b07f50', '#734d2e'], peak: ['#f3dcaf', '#d7b783'],
      path: 'rail', sea: '#1d3560', ponds: 1, clouds: false,
      scenery: { hill: 3, rocks: 4, props: 3, mushroom: 2, bush: 1 },
      props: ['⛏️', '🪵', '🕯️', '🪨'], floaters: [],
    },
    english: { // a snowy storybook kingdom: snow-covered meadows on walls of ice blocks, snowy pines, cottages, snowmen, falling snow
      ground: ['#ffffff', '#eef6ff', '#c9def2', '#9dbad8'], cliff: ['#e4f6ff', '#9fd3f2', '#5a9cc8'], bricks: true,
      hill: ['#ffffff', '#e3eef9', '#b3cbe3'], mountain: ['#e8f0f8', '#a9bdd3', '#6f86a3'], peak: ['#ffffff', '#dceeff'],
      path: 'cobble', sea: '#2f6fb5', pond: '#bfe7ff', ponds: 1, snowfall: true, critters: false,
      scenery: { hill: 3, pines: 6, houses: 2, props: 1, rocks: 1 },
      houses: ['🏠', '🏡'], props: ['⛄', '🛷'], floaters: ['🧊', '🐧'],
    },
    future: { // floating asteroid islands in space, joined by a glowing circuit line
      ground: ['#e4dff7', '#b2a8dd', '#8579bb', '#5d5293'], cliff: ['#6a58b0', '#46388a', '#271c57'], strata: true,
      hill: ['#d6d0ee', '#a097cf', '#71689f'], mountain: ['#efe6ff', '#b9a2f2', '#7a5fd0'], peak: ['#ffffff', '#e2d8ff'],
      path: 'circuit', sea: '#120e2e', space: true, ponds: 0, clouds: false, critters: false,
      scenery: { hill: 3, crater: 4, rocks: 2, props: 2 },
      props: ['🚀', '🔭', '🤖'], floaters: ['🪐', '🌙'],
    },
    wonders: { // sandy islands in a turquoise lagoon: palms, shells and a boardwalk
      ground: ['#fff3c4', '#f2d684', '#d8b354', '#a8862e'], cliff: ['#f2a983', '#cc7552', '#8a4a30'],
      hill: ['#98e47e', '#3fb05a', '#21803a'], mountain: ['#a6dc8c', '#5aa05a', '#2f6a3a'], peak: ['#7cd06a', '#58b04c'],
      path: 'boardwalk', sea: '#1fb5c4', ponds: 0,
      scenery: { trees: 5, hill: 2, props: 2, flowers: 1 },
      trees: ['🌴'], props: ['🐚', '🪨'], flowers: ['🌺', '🌸'], floaters: ['🐠', '🐬', '🐢'],
    },
    world: { // green islands with sandy beaches in a deep blue sea, joined by a dotted flight path
      ground: ['#c8f28e', '#82d052', '#519f34', '#30691f'], cliff: ['#bcc6d2', '#808c9b', '#4e5967'], beach: '#f4d98c',
      hill: ['#b2ec7e', '#58bf3f', '#2e8a26'], mountain: ['#e2e6ea', '#a3abb5', '#6b7480'], peak: ['#ffffff', '#cfe6ff'],
      path: 'flight', sea: '#1e5fbf', ponds: 1,
      scenery: { trees: 3, houses: 2, hill: 2, flowers: 1, props: 1 },
      trees: ['🌳', '🌴'], houses: ['🏠'], flowers: ['🌼'], props: ['⛲', '🗿'], floaters: ['⛵', '🐳', '🐬'],
    },
  };
  const art = key => ART[key] || ART.science;

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
    g.fillStyle = A.cliff[1]; rowsOf(g, t, bot, cb - P, P); // the cliff face: stone blocks, long layers of rock, or speckled earth
    if (A.bricks) {
      for (let y = bot + P, row = 0; y < cb - 2 * P; y += 3 * P, row++) {
        g.fillStyle = A.cliff[2]; g.fillRect(t.lx(y) + P, y + 2 * P, t.rx(y) - t.lx(y) - 2 * P, P);
        for (let x = t.lx(y) + (row % 2 ? 3 : 6) * P; x < t.rx(y) - 2 * P; x += 6 * P) g.fillRect(x, y, P, 2 * P);
        g.fillStyle = A.cliff[0]; for (let x = t.lx(y) + 2 * P; x < t.rx(y) - 2 * P; x += 6 * P) g.fillRect(x + (row % 2 ? 3 : 0) * P, y, 2 * P, P);
      }
    } else {
      for (let y = bot + 2 * P; y < cb - P; y += 2 * P) {
        for (let x = t.lx(y) + 2 * P; x < t.rx(y) - 2 * P; x += P) {
          const n = rnd();
          if (A.strata) { if (n < 0.75) { g.fillStyle = (y / (2 * P)) % 2 ? A.cliff[0] : A.cliff[2]; g.fillRect(x, y - P, P, P); } } else if (n < 0.4) { g.fillStyle = A.cliff[0]; g.fillRect(x, y - P, P, P); } else if (n < 0.55) { g.fillStyle = A.cliff[2]; g.fillRect(x, y, P, P); }
        }
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
    g.fillStyle = A.pond || A.sea; block(g, p.x + P, p.y + P, p.w - 2 * P, p.h - 2 * P, 2);
    g.fillStyle = A.cliff[1]; g.fillRect(p.x + 3 * P, p.y + P, p.w - 6 * P, P); // its far bank
    g.fillStyle = A.pond ? '#ffffff' : '#a9d6ff'; g.fillRect(snap(p.x + p.w * 0.3), snap(p.y + p.h * 0.5), 3 * P, P); g.fillRect(snap(p.x + p.w * 0.6), snap(p.y + p.h * 0.7), 2 * P, P);
  }

  // ---------- scenery ----------
  // how much open grass each kind of scenery needs round its spot (the spot is its base)
  const FOOT = { pines: { rx: 34, ry: 22 }, hill: { rx: 36, ry: 24 }, trees: { rx: 34, ry: 22 }, bush: { rx: 20, ry: 12 }, flowers: { rx: 20, ry: 12 }, mushroom: { rx: 14, ry: 14 }, rocks: { rx: 16, ry: 12 },
    props: { rx: 16, ry: 14 }, houses: { rx: 30, ry: 20 }, fields: { rx: 26, ry: 14 }, crater: { rx: 24, ry: 12 } };
  function scenery(key, rnd) {
    const S = art(key).scenery, all = Object.entries(S), sum = all.reduce((n, [, w]) => n + w, 0);
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
    const M = A.mountain, top = A.peak || ['#ffffff', '#cfe6ff'], half = r => Math.round(wu / 2 * Math.pow(1 - r / hu, 0.8)) + (r >= hu - 1 ? 1 : 0);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(cx - (half(0) + 1) * P, base, (half(0) + 1) * 2 * P, P);
    g.fillStyle = '#000';
    for (let r = 0; r <= hu; r++) { const hw = half(Math.min(r, hu - 1)) + 1; g.fillRect(cx - hw * P, base - (r + 1) * P, hw * 2 * P, P); }
    for (let r = 0; r < hu; r++) {
      const hw = half(r), y = base - (r + 1) * P, snow = r > hu * 0.68;
      g.fillStyle = snow ? top[0] : M[1]; g.fillRect(cx - hw * P, y, hw * 2 * P, P);
      g.fillStyle = snow ? top[1] : M[2]; g.fillRect(cx + Math.max(0, Math.floor(hw / 3)) * P, y, Math.ceil(hw * 2 / 3) * P, P); // shade on the right
      if (!snow && r % 3 === 1 && hw > 3) { g.fillStyle = M[0]; g.fillRect(cx - (hw - 1) * P, y, 2 * P, P); } // light ledges on the left
    }
    for (let x = -half(Math.ceil(hu * 0.68)); x < half(Math.ceil(hu * 0.68)); x += 2) { // the snow's jagged lower edge
      g.fillStyle = top[0]; g.fillRect(cx + x * P, base - Math.ceil(hu * 0.68) * P, P, P);
    }
  }
  // a snowy pine: three tiers of dark green, each with snow along its top, on a brown trunk
  function pine(g, cx, base, s) {
    cx = snap(cx); base = snap(base);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(cx - 4 * P, base, 8 * P, P);
    g.fillStyle = '#000'; g.fillRect(cx - 2 * P, base - 3 * P, 4 * P, 3 * P); g.fillStyle = '#8a5a32'; g.fillRect(cx - P, base - 3 * P, 2 * P, 2 * P);
    for (let t = 0; t < 3; t++) {
      const w = (5 - t) * s, top = base - 3 * P - (t + 1) * 4 * P;
      for (let r = 0; r < 5; r++) {
        const hw = Math.max(1, Math.round(w * (r + 1) / 5)), y = top + r * P;
        g.fillStyle = '#000'; g.fillRect(cx - (hw + 1) * P, y, (hw + 1) * 2 * P, P);
        g.fillStyle = r < 2 ? '#ffffff' : '#2f7a3c'; g.fillRect(cx - hw * P, y, hw * 2 * P, P);
        if (r >= 2) { g.fillStyle = '#1f5a2a'; g.fillRect(cx + (hw - 1) * P, y, P, P); g.fillStyle = '#ffffff'; g.fillRect(cx - hw * P, y, P, P); }
      }
    }
    g.fillStyle = '#000'; g.fillRect(cx - P, base - 3 * P - 13 * P, 2 * P, P);
  }
  const PAINT = {
    pines(g, it, A, rnd) { const n = 1 + Math.floor(rnd() * 3); for (let k = 0; k < n; k++) pine(g, it.x + (k - (n - 1) / 2) * 22 + (rnd() - 0.5) * 6, it.y - (k % 2) * 8, 1); },
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
    props(g, it, A, rnd) { const e = A.props[Math.floor(rnd() * A.props.length)]; shadow(g, it.x, it.y + 2, 20); emoji(g, e, it.x, it.y, 26); },
    houses(g, it, A, rnd) {
      const n = 1 + Math.floor(rnd() * 2);
      for (let k = 0; k < n; k++) { const x = it.x + (k - (n - 1) / 2) * 30, y = it.y - k * 6; shadow(g, x, y + 2, 26); emoji(g, A.houses[Math.floor(rnd() * A.houses.length)], x, y, 30); }
    },
    fields(g, it, A, rnd) { for (let k = 0; k < 5; k++) emoji(g, '🌾', it.x + (k - 2) * 11 + (rnd() - 0.5) * 4, it.y - (k % 2) * 6, 20); },
    crater(g, it, A, rnd) { // a crater: a dark dip with a light rim
      const cx = snap(it.x), cy = snap(it.y - 8), w = 4 + Math.floor(rnd() * 2), h = 3;
      g.fillStyle = '#000'; block(g, cx - (w + 1) * P, cy - (h + 1) * P, (w + 1) * 2 * P, (h + 1) * 2 * P, 2);
      g.fillStyle = A.ground[0]; block(g, cx - w * P, cy - h * P, w * 2 * P, h * 2 * P, 2);
      g.fillStyle = A.ground[2]; block(g, cx - (w - 1) * P, cy - (h - 1) * P, (w - 1) * 2 * P, (h - 1) * 2 * P, 1);
      g.fillStyle = A.ground[3]; g.fillRect(cx - (w - 2) * P, cy - (h - 1) * P, (w - 2) * 2 * P, P); // shadow inside its far rim
    },
  };

  function paint(cv, T, key, items, W, H, rnd) {
    const A = art(key), dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const g = cv.getContext('2d');
    if (!g || !g.fillRect) return [];
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.imageSmoothingEnabled = false;
    // round each island: white foam where it meets the sea (a soft glow in space), and a sandy beach if the world has one
    const ring = (k, col) => { g.fillStyle = col; T.ts.forEach(t => { for (let y = t.top - k; y < t.cb + k; y += P) { const yy = Math.min(t.cb - P, Math.max(t.top, y)); g.fillRect(t.lx(yy) - k, y, t.rx(yy) - t.lx(yy) + 2 * k, P); } }); };
    if (A.space) ring(2 * P, 'rgba(160,140,255,.18)');
    else { ring(A.beach ? 3 * P : P, 'rgba(255,255,255,.6)'); if (A.beach) ring(2 * P, A.beach); }
    T.ts.forEach(t => terrace(g, t, A, rnd));
    T.ponds.forEach(p => pondArt(g, p, A));
    const eyes = [];
    items.slice().sort((a, b) => a.y - b.y).forEach(it => (PAINT[it.kind] || PAINT.bush)(g, it, A, rnd, eyes));
    return eyes;
  }

  // ---------- the road ----------
  // Each edge is split into runs: over a terrace top it is the path, down a cliff a ladder, over water a bridge.
  // Each world has its own path; a circuit line or a flight path just carries on over cliffs and water.
  const STYLE = {
    dirt: L => L('stroke="#000" stroke-width="14"') + L('stroke="#b8793a" stroke-width="10"') + L('stroke="#f1cd7c" stroke-width="6"'),
    rail: L => L('stroke="#000" stroke-width="16"') + L('stroke="#4a3b2c" stroke-width="12"') + L('stroke="#a8763f" stroke-width="12" stroke-dasharray="3 5" stroke-linecap="butt"')
      + L('stroke="#d5dae2" stroke-width="10"') + L('stroke="#4a3b2c" stroke-width="6"') + L('stroke="#a8763f" stroke-width="6" stroke-dasharray="3 5" stroke-linecap="butt"'),
    cobble: L => L('stroke="#000" stroke-width="14"') + L('stroke="#77736c" stroke-width="10"') + L('stroke="#c2bdb3" stroke-width="10" stroke-dasharray="4 2" stroke-linecap="butt"'),
    circuit: L => L('stroke="#2ee6d6" stroke-opacity=".25" stroke-width="16"') + L('stroke="#000" stroke-width="8"') + L('stroke="#2ee6d6" stroke-width="4"') + L('stroke="#e6fffd" stroke-width="2" stroke-dasharray="3 9" stroke-linecap="butt"'),
    boardwalk: L => L('stroke="#000" stroke-width="16"') + L('stroke="#6b4425" stroke-width="12"') + L('stroke="#d29a5c" stroke-width="12" stroke-dasharray="6 2" stroke-linecap="butt"'),
    flight: L => L('stroke="rgba(0,0,0,.35)" stroke-width="8" stroke-dasharray="10 8" stroke-linecap="butt"') + L('stroke="#fff" stroke-width="4" stroke-dasharray="10 8" stroke-linecap="butt"'),
  };
  const OVER = { circuit: 1, flight: 1 }; // paths that need no ladders or bridges
  function paths(edges, T, key, W, H) {
    const A = art(key), style = STYLE[A.path] || STYLE.dirt, over = OVER[A.path];
    let defs = '', out = '';
    edges.forEach((e, k) => {
      const land = [], ladders = [], bridges = [];
      for (let i = 1; i < e.pts.length; i++) {
        const a = e.pts[i - 1], b = e.pts[i], len = Math.hypot(b.x - a.x, b.y - a.y);
        if (!len) continue;
        const vert = a.x === b.x, n = Math.ceil(len / 2);
        const kind = (x, y) => { if (over) return 'land'; const t = T.at(x, y); return t === 'water' ? 'bridge' : t === 'cliff' && vert ? 'ladder' : 'land'; };
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
      if (land.length) g += style(a => S(d(land), a));
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

  // ---------- the treasure-map frame: a parchment border round the map, its outer edge burnt ----------
  // Along each edge the burn eats in a little way (a wandering depth, with now and then a deeper notch), the corners burn
  // rounder, and from the burnt edge inwards the paper goes char black, scorched brown, singed orange, then parchment.
  // Its own seeded randomness, so it doesn't move the scenery, and each world's edge stays the same between visits.
  function frame(cv, w, h, F, key) {
    const cols = Math.ceil(w / P), rows = Math.ceil(h / P), B = Math.round(F / P), max = B >= 7 ? 3 : 2;
    cv.width = cols * P; cv.height = rows * P; cv.style.width = cols * P + 'px'; cv.style.height = rows * P + 'px';
    const g = cv.getContext('2d');
    if (!g || !g.fillRect || !cols || !rows) return;
    let seed = [...key].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 99);
    const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296;
    const burns = n => {
      const a = []; let d = 1, notch = 0;
      for (let i = 0; i < n; i++) {
        if (!notch && rnd() < 0.04) notch = 1 + Math.floor(rnd() * 3);
        d = Math.max(0, Math.min(max - 1, d + Math.floor(rnd() * 3) - 1));
        a.push(notch ? (notch--, max) : d);
      }
      return a;
    };
    const top = burns(cols), bot = burns(cols), left = burns(rows), right = burns(rows);
    const SINGE = ['#24160b', '#4a2a12', '#8a4f1f', '#c98b45'];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      if (i === B && j >= B && j < rows - B) i = cols - B; // (the middle is under the map)
      const corner = Math.max(0, 3 - Math.min(i, cols - 1 - i) - Math.min(j, rows - 1 - j));
      const dist = Math.min(j - top[i], rows - 1 - j - bot[i], i - left[j], cols - 1 - i - right[j]) - corner;
      if (dist < 0) continue;
      g.fillStyle = dist < SINGE.length ? SINGE[dist] : rnd() < 0.07 ? '#dfc086' : '#efd7a3';
      g.fillRect(i * P, j * P, P, P);
    }
  }

  // ---------- the living layers: the sea, drifting clouds, blinking hill eyes ----------
  function live(map, eyes, W, H, rnd, rivers = [], key, T) {
    const A = art(key);
    const add = (cls, x, y) => { const d = document.createElement('div'); d.className = cls; d.style.left = x + 'px'; d.style.top = y + 'px'; map.append(d); return d; };
    map.style.setProperty('--sea', A.sea); map.classList.add('b-' + key, A.space ? 'space' : 'water');
    const sea = document.createElement('div'); sea.className = 'qsea'; sea.innerHTML = '<i class="qglint"></i>'; map.prepend(sea);
    // a river between a fork's branches: water streaming down (under the land, so it only shows in the gap), foam where it lands
    if (A.waterfall) rivers.forEach(r => {
      const d = document.createElement('div'); d.className = 'qriver';
      Object.assign(d.style, { left: snap(r.x) + 'px', top: snap(r.top) + 'px', height: snap(r.bot - r.top) + 'px' });
      sea.after(d);
      add('qsplash', snap(r.x), snap(r.bot));
    });
    eyes.forEach(e => {
      const d = add('qeyes', e.x, e.y);
      d.style.setProperty('--gap', e.gap + 'px'); d.style.animationDelay = -(rnd() * 6).toFixed(2) + 's';
      d.innerHTML = '<i></i><i></i>';
    });
    // things in the water (boats, fish, turtles) or floating in space (planets, a moon), bobbing gently
    if (T && A.floaters && A.floaters.length) {
      let left = Math.max(2, Math.round(W * H / 260000)), tries = 0;
      while (left > 0 && tries++ < 400) {
        const x = 30 + rnd() * (W - 60), y = 30 + rnd() * (H - 60);
        if (![[0, 0], [-26, 0], [26, 0], [0, -22], [0, 18]].every(([dx, dy]) => T.at(x + dx, y + dy) === 'water')) continue;
        if (rivers.some(r => Math.abs(x - r.x) < 44)) continue; // not in a river
        const f = add('qfloat', snap(x), snap(y)); f.textContent = A.floaters[Math.floor(rnd() * A.floaters.length)];
        f.style.animationDelay = -(rnd() * 3).toFixed(1) + 's';
        left--;
      }
    }
    if (A.snowfall) { const f = document.createElement('div'); f.className = 'qsnowfall'; map.append(f); } // snow drifting down
    if (A.clouds !== false) for (let k = 0, n = H > 900 ? 4 : 3; k < n; k++) {
      const c = add('qcloud', 0, snap(30 + (k + rnd() * 0.8) * (H - 120) / n));
      c.style.setProperty('--w', W + 'px'); c.style.setProperty('--s', (0.7 + rnd() * 0.5).toFixed(2));
      const dur = 80 + rnd() * 60;
      c.style.animationDuration = dur.toFixed(0) + 's'; c.style.animationDelay = -(rnd() * dur).toFixed(1) + 's';
    }
  }
  // everything stops moving while the page is hidden
  document.addEventListener('visibilitychange', () => document.documentElement.classList.toggle('q-paused', document.hidden));

  window.MapArt = { has: key => !!ART[key], ART, P, FOOT, terrain, scenery, paint, paths, frame, live, ponds: key => art(key).ponds ?? 1 };
})();
