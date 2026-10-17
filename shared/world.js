/* PixelKid world: the pixel world map, countries, continents and oceans for the Around the World lessons.
 * Needs shared/world-map.js (the generated map grid) loaded first.
 * Used by the `worldmap` game in engine.js:  World.render(view, opts) draws a map; World.hit(...) says what is at a point.
 */
(function () {
  'use strict';
  const D = window.WORLD_DATA;
  if (!D) return;

  // where the player lives: a 🏠 pin shows on every map
  const HOME = 'THA';

  const CONTINENTS = {
    asia: { name: 'Asia', col: '#f2b33d', at: [88, 46] },
    europe: { name: 'Europe', col: '#e8584e', at: [18, 53] },
    africa: { name: 'Africa', col: '#8cc63f', at: [20, 6] },
    namerica: { name: 'North America', col: '#f57f2a', at: [-100, 45] },
    samerica: { name: 'South America', col: '#3fae5a', at: [-60, -14] },
    oceania: { name: 'Oceania', col: '#b65bd1', at: [134, -25] },
    antarctica: { name: 'Antarctica', col: '#eef4f8', at: [40, -76] },
  };
  // map values 0–5 are water
  const OCEANS = {
    pacific: { v: 1, name: 'Pacific Ocean', at: [-145, 8] },
    atlantic: { v: 2, name: 'Atlantic Ocean', at: [-38, 22] },
    indian: { v: 3, name: 'Indian Ocean', at: [76, -24] },
    arctic: { v: 4, name: 'Arctic Ocean', at: [-30, 77] },
    southern: { v: 5, name: 'Southern Ocean', at: [-100, -63] },
  };
  const OCEAN_BY_V = Object.fromEntries(Object.entries(OCEANS).map(([id, o]) => [o.v, id]));

  // Countries the lessons talk about (map unit id → facts). `cap` = capital city [lon, lat].
  const COUNTRIES = {
    THA: { name: 'Thailand', flag: '🇹🇭', capital: 'Bangkok', cap: [100.5, 13.75] },
    JPN: { name: 'Japan', flag: '🇯🇵', capital: 'Tokyo', cap: [139.7, 35.7] },
    ENG: { name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', capital: 'London', cap: [-0.13, 51.5] },
    SCT: { name: 'Scotland', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', capital: 'Edinburgh', cap: [-3.19, 55.95] },
    WLS: { name: 'Wales', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', capital: 'Cardiff', cap: [-3.18, 51.48] },
    NIR: { name: 'Northern Ireland', flag: '🇬🇧', capital: 'Belfast', cap: [-5.93, 54.6] },
    IRL: { name: 'Ireland', flag: '🇮🇪', capital: 'Dublin', cap: [-6.26, 53.35] },
    FXX: { name: 'France', flag: '🇫🇷', capital: 'Paris', cap: [2.35, 48.86] },
    CHN: { name: 'China', flag: '🇨🇳', capital: 'Beijing', cap: [116.4, 39.9] },
    KOR: { name: 'South Korea', flag: '🇰🇷', capital: 'Seoul', cap: [127, 37.55] },
    PRK: { name: 'North Korea', flag: '🇰🇵', capital: 'Pyongyang', cap: [125.75, 39.03] },
    RUS: { name: 'Russia', flag: '🇷🇺', capital: 'Moscow', cap: [37.6, 55.75] },
    MMR: { name: 'Myanmar', flag: '🇲🇲', capital: 'Naypyidaw', cap: [96.1, 19.75] },
    LAO: { name: 'Laos', flag: '🇱🇦', capital: 'Vientiane', cap: [102.6, 17.97] },
    KHM: { name: 'Cambodia', flag: '🇰🇭', capital: 'Phnom Penh', cap: [104.9, 11.55] },
    MYS: { name: 'Malaysia', flag: '🇲🇾', capital: 'Kuala Lumpur', cap: [101.7, 3.14] },
    VNM: { name: 'Vietnam', flag: '🇻🇳', capital: 'Hanoi', cap: [105.85, 21.03] },
    USA: { name: 'the USA', flag: '🇺🇸', capital: 'Washington, D.C.', cap: [-77, 38.9] },
    AUS: { name: 'Australia', flag: '🇦🇺', capital: 'Canberra', cap: [149.1, -35.3] },
    EGY: { name: 'Egypt', flag: '🇪🇬', capital: 'Cairo', cap: [31.2, 30.05] },
    ITA: { name: 'Italy', flag: '🇮🇹', capital: 'Rome', cap: [12.5, 41.9] },
    IND: { name: 'India', flag: '🇮🇳', capital: 'New Delhi', cap: [77.2, 28.6] },
    BRA: { name: 'Brazil', flag: '🇧🇷', capital: 'Brasília', cap: [-47.9, -15.8] },
    KEN: { name: 'Kenya', flag: '🇰🇪', capital: 'Nairobi', cap: [36.8, -1.3] },
    MEX: { name: 'Mexico', flag: '🇲🇽', capital: 'Mexico City', cap: [-99.1, 19.4] },
  };
  // groups of map units that count as one place
  const GROUPS = { GBR: ['ENG', 'SCT', 'WLS', 'NIR'], UK: ['ENG', 'SCT', 'WLS', 'NIR'] };

  // Ready-made views: which map to use and the box [west, south, east, north] to show.
  const VIEWS = {
    world: { map: 'world', box: [-180, -66, 180, 80] },
    europe: { map: 'world', box: [-26, 34, 46, 71] },
    asia: { map: 'world', box: [58, -12, 150, 58] },
    eastasia: { map: 'world', box: [95, 15, 150, 50] },
    uk: { map: 'uk', box: [-10.8, 49.8, 2.2, 59.2] },
    ukfrance: { map: 'world', box: [-12, 42, 12, 61] },
    japan: { map: 'japan', box: [124, 24, 148, 46] },
    home: { map: 'sea', box: [90, -2, 114, 26] },
    thailand: { map: 'sea', box: [94, 4, 110, 22] },
    usa: { map: 'world', box: [-130, 14, -58, 56] },
  };

  // ---------- decode the run-length rows once per map ----------
  const cache = {};
  function grid(name) {
    if (cache[name]) return cache[name];
    const m = D.maps[name];
    const cells = new Int16Array(m.w * m.h);
    m.rows.forEach((row, r) => {
      let c = r * m.w;
      row.split(',').forEach(t => {
        const dot = t.indexOf('.'), v = parseInt(dot < 0 ? t : t.slice(0, dot), 36), n = dot < 0 ? 1 : parseInt(t.slice(dot + 1), 36);
        cells.fill(v, c, c + n); c += n;
      });
    });
    return (cache[name] = Object.assign({ name, cells }, m));
  }
  const unit = v => (v >= 10 ? D.units[v - 10] : null);

  // what is at a map value: { kind: 'land' | 'ocean' | 'water', id, name, continent }
  function info(v) {
    const u = unit(v);
    if (u) { const c = COUNTRIES[u[0]]; return { kind: 'land', id: u[0], name: c ? c.name : u[1], continent: u[2] }; }
    const o = OCEAN_BY_V[v];
    return o ? { kind: 'ocean', id: o, name: OCEANS[o].name } : { kind: 'water', id: 'water', name: 'a sea' };
  }
  // does map value v belong to the target? target = continent id, ocean id, unit id, group (GBR) or an array of these
  function matches(v, target) {
    if (Array.isArray(target)) return target.some(t => matches(v, t));
    if (OCEANS[target]) return v === OCEANS[target].v;
    const u = unit(v);
    if (!u) return false;
    if (CONTINENTS[target]) return u[2] === target;
    if (GROUPS[target]) return GROUPS[target].includes(u[0]);
    return u[0] === target;
  }
  // a good spot to put a label or pin for a target
  function labelAt(target) {
    if (Array.isArray(target)) target = target[0];
    if (CONTINENTS[target]) return CONTINENTS[target].at;
    if (OCEANS[target]) return OCEANS[target].at;
    if (target === 'GBR' || target === 'UK') return [-2.5, 54];
    const u = D.units.find(x => x[0] === target);
    return u ? [u[3], u[4]] : [0, 0];
  }
  const nameOf = target => {
    if (Array.isArray(target)) target = target[0];
    if (CONTINENTS[target]) return CONTINENTS[target].name;
    if (OCEANS[target]) return OCEANS[target].name;
    if (target === 'GBR' || target === 'UK') return 'the United Kingdom';
    if (COUNTRIES[target]) return COUNTRIES[target].name;
    const u = D.units.find(x => x[0] === target);
    return u ? u[1] : target;
  };

  // great-circle distance in km, and a rough non-stop flight time (about 800 km an hour, plus take-off and landing)
  function distanceKm([lon1, lat1], [lon2, lat2]) {
    const R = 6371, rad = Math.PI / 180, dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }
  const flightHours = km => Math.max(1, Math.round((km / 800 + 0.5) * 2) / 2);
  const capitalOf = id => (COUNTRIES[id] ? COUNTRIES[id].cap : labelAt(id));

  // ---------- drawing ----------
  const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const shadeHex = (c, k) => hex(c).map(x => Math.max(0, Math.min(255, Math.round(x + k))));
  const CLEAR = [];
  const SEA = [47, 124, 214];

  // Render a view to an offscreen canvas.
  // opts: { width, maxHeight, colour: 'continents' | 'countries', paint(v) → '#hex' | null (override a cell's colour), borders,
  //         mask(v) → '#hex' | null: draw only these cells (everything else see-through) – for flashing hints }
  // Returns { canvas, W, H, scale, toXY([lon, lat]) → [x, y], at(x, y) → map value, near(x, y, px, target) → bool }
  function render(viewName, opts = {}) {
    const view = typeof viewName === 'string' ? (VIEWS[viewName] || VIEWS.world) : viewName;
    const g = grid(view.map);
    const [w0, s0, e0, n0] = view.box;
    const c0 = Math.max(0, Math.floor((w0 - g.x0) / g.res)), c1 = Math.min(g.w, Math.ceil((e0 - g.x0) / g.res));
    const r0 = Math.max(0, Math.floor((g.y0 - n0) / g.res)), r1 = Math.min(g.h, Math.ceil((g.y0 - s0) / g.res));
    const cols = c1 - c0, rows = r1 - r0;
    // close-ups squash east–west by cos(latitude) so countries keep their real shape
    const squash = view.map === 'world' && (e0 - w0) > 120 ? 1 : Math.cos(((n0 + s0) / 2) * Math.PI / 180);
    const maxW = opts.width || 720, maxH = opts.maxHeight || 560;
    let sy = Math.min(maxH / rows, maxW / (cols * squash)), sx = sy * squash;
    const W = Math.round(cols * sx), H = Math.round(rows * sy);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // 1. one pixel per cell
    const small = document.createElement('canvas');
    small.width = cols; small.height = rows;
    const sctx = small.getContext('2d'), img = sctx.createImageData(cols, rows), px = img.data;
    const colourOf = v => {
      if (opts.mask) { const m = opts.mask(v); return m ? hex(m) : CLEAR; }
      const o = opts.paint && opts.paint(v);
      if (o) return hex(o);
      if (v < 10) return SEA; // inland seas (value 0) look the same as the oceans
      const u = unit(v), base = (CONTINENTS[u[2]] || CONTINENTS.asia).col;
      if (opts.colour === 'countries') return shadeHex(base, ((v * 7919) % 5) * 12 - 24); // neighbours get slightly different shades
      return hex(base);
    };
    const memo = new Map();
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const v = g.cells[(r0 + r) * g.w + c0 + c];
      let col = memo.get(v); if (!col) { col = colourOf(v); memo.set(v, col); }
      const i = (r * cols + c) * 4;
      if (col === CLEAR) { px[i + 3] = 0; continue; }
      px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2]; px[i + 3] = 255;
    }
    sctx.putImageData(img, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(small, 0, 0, W, H);

    // 2. chunky outlines: black coastlines and dark borders when zoomed in enough to see them
    if (opts.borders !== false && !opts.mask && sx >= 2.5) {
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const v = g.cells[(r0 + r) * g.w + c0 + c];
        if (v < 10) continue;
        const x = c * sx, y = r * sy;
        const right = c + 1 < cols ? g.cells[(r0 + r) * g.w + c0 + c + 1] : v, down = r + 1 < rows ? g.cells[(r0 + r + 1) * g.w + c0 + c] : v;
        const left = c > 0 ? g.cells[(r0 + r) * g.w + c0 + c - 1] : v, up = r > 0 ? g.cells[(r0 + r - 1) * g.w + c0 + c] : v;
        const lw = Math.max(1, Math.min(3, sx / 2.5));
        ctx.fillStyle = '#1b1b1b';
        if (left < 10) ctx.fillRect(x, y, lw, sy); if (right < 10) ctx.fillRect(x + sx - lw, y, lw, sy);
        if (up < 10) ctx.fillRect(x, y, sx, lw); if (down < 10) ctx.fillRect(x, y + sy - lw, sx, lw);
        ctx.fillStyle = 'rgba(40,20,0,.55)';
        if (right >= 10 && unit(right)[0] !== unit(v)[0]) ctx.fillRect(x + sx - 1, y, 2, sy);
        if (down >= 10 && unit(down)[0] !== unit(v)[0]) ctx.fillRect(x, y + sy - 1, sx, 2);
      }
    }

    const toXY = ([lon, lat]) => [((lon - g.x0) / g.res - c0) * sx, ((g.y0 - lat) / g.res - r0) * sy];
    const cellAt = (x, y) => {
      const c = Math.floor(x / sx), r = Math.floor(y / sy);
      if (c < 0 || r < 0 || c >= cols || r >= rows) return -1;
      return g.cells[(r0 + r) * g.w + c0 + c];
    };
    // is the target within `pxR` pixels of (x, y)? (small islands are easy to miss with a finger)
    const near = (x, y, pxR, target) => {
      const rc = Math.ceil(pxR / sx), rr = Math.ceil(pxR / sy), c = Math.floor(x / sx), r = Math.floor(y / sy);
      for (let dr = -rr; dr <= rr; dr++) for (let dc = -rc; dc <= rc; dc++) {
        if ((dc * sx) ** 2 + (dr * sy) ** 2 > pxR * pxR) continue;
        const cc = c + dc, rw = r + dr;
        if (cc < 0 || rw < 0 || cc >= cols || rw >= rows) continue;
        if (matches(g.cells[(r0 + rw) * g.w + c0 + cc], target)) return true;
      }
      return false;
    };
    return { canvas, W, H, sx, sy, toXY, at: cellAt, near, view };
  }

  window.World = { HOME, CONTINENTS, OCEANS, COUNTRIES, GROUPS, VIEWS, grid, info, matches, labelAt, nameOf, distanceKm, flightHours, capitalOf, render };
})();
