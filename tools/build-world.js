// Builds shared/world-map.js (the PixelKid pixel world map) from Natural Earth map units.
// Usage: curl -L -o mu50.geojson https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@v5.1.2/geojson/ne_50m_admin_0_map_units.geojson
//        node tools/build-world.js mu50.geojson shared/world-map.js
// Rasterise Natural Earth map units into a 0.5° pixel grid for Pixelkid's world map.
const fs = require('fs');
const [,, src, out] = process.argv;
const g = JSON.parse(fs.readFileSync(src));
const RES = 0.5, TOP = 84, BOT = -80, W = 360 / RES, H = (TOP - BOT) / RES;
const CONT = { 'Asia': 'asia', 'Europe': 'europe', 'Africa': 'africa', 'North America': 'namerica', 'South America': 'samerica', 'Oceania': 'oceania', 'Antarctica': 'antarctica' };
const SEVEN = { 'Eastern Africa': 'africa', 'Southern Asia': 'asia', 'Western Africa': 'africa', 'Southern Africa': 'africa', 'Middle Africa': 'africa', 'Australia and New Zealand': 'oceania', 'Melanesia': 'oceania', 'Polynesia': 'oceania', 'Micronesia': 'oceania', 'South America': 'samerica', 'Caribbean': 'namerica' };
const units = [];
g.features.forEach(f => {
  const p = f.properties;
  let cont = CONT[p.CONTINENT] || SEVEN[p.SUBREGION] || 'oceania';
  if (p.GU_A3 === 'RUS' || p.ADM0_A3 === 'RUS') cont = 'europe'; // split below by longitude
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const boxes = polys.map(rings => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; rings[0].forEach(([x, y]) => { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); }); return [a, b, c, d]; });
  units.push({ id: p.GU_A3, name: p.NAME, sov: p.ADM0_A3, cont, lx: p.LABEL_X, ly: p.LABEL_Y, polys, boxes });
});
function inRing(x, y, r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
function inPoly(x, y, rings) { if (!inRing(x, y, rings[0])) return false; for (let k = 1; k < rings.length; k++) if (inRing(x, y, rings[k])) return false; return true; }
const grid = new Int16Array(W * H).fill(-1);
for (let r = 0; r < H; r++) {
  const lat = TOP - (r + 0.5) * RES;
  for (let c = 0; c < W; c++) {
    const lon = -180 + (c + 0.5) * RES;
    for (let u = 0; u < units.length && grid[r * W + c] < 0; u++) {
      const U = units[u];
      for (let k = 0; k < U.polys.length; k++) {
        const b = U.boxes[k];
        if (lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3]) continue;
        if (inPoly(lon, lat, U.polys[k])) { grid[r * W + c] = u; break; }
      }
    }
  }
}
// tiny islands with no cell: stamp their label point so every country can be found
units.forEach((U, u) => {
  if (grid.includes(u)) return;
  const c = Math.floor((U.lx + 180) / RES), r = Math.floor((TOP - U.ly) / RES);
  if (r >= 0 && r < H && c >= 0 && c < W && grid[r * W + c] < 0) grid[r * W + c] = u;
});
// oceans: flood fill water connected to the open sea, then name each cell by rules
const OCEAN = { lake: 0, pacific: 1, atlantic: 2, indian: 3, arctic: 4, southern: 5 };
const sea = new Uint8Array(W * H);
const stack = [[0, Math.floor(H / 2)]]; // open Pacific
while (stack.length) {
  const [c0, r] = stack.pop(); const c = (c0 + W) % W;
  if (r < 0 || r >= H) continue;
  const i = r * W + c; if (sea[i] || grid[i] >= 0) continue;
  sea[i] = 1; stack.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
}
const isAmericas = u => u >= 0 && (units[u].cont === 'namerica' || units[u].cont === 'samerica');
function oceanOf(r, c) {
  const lat = TOP - (r + 0.5) * RES, lon = -180 + (c + 0.5) * RES;
  if (lat < -60) return OCEAN.southern;
  if (lat > 66) return OCEAN.arctic;
  if (lon >= 20 && lon < 100 && lat < 30) return OCEAN.indian;
  if (lon >= 100 && lon < 147 && lat < -8 && !(lon > 128 && lat > -12) && !(lon > 141 && lat > -30)) return OCEAN.indian;
  if (lon >= 100 || lon < -170) return OCEAN.pacific;
  // between Asia/Australia and Africa/Europe: west of the Americas = Pacific, east of their west coast = Atlantic
  let west = null;
  // the first long stretch of American land (so islands such as Hawaii or the Galapagos don't count)
  for (let cc = Math.floor((-170 + 180) / RES), run = 0; cc < Math.floor((-30 + 180) / RES); cc++) {
    run = isAmericas(grid[r * W + cc]) ? run + 1 : 0;
    if (run >= 6) { west = -180 + (cc - 5 + 0.5) * RES; break; }
  }
  if (west == null) west = lat < 0 ? -68 : -80;
  return lon < west ? OCEAN.pacific : OCEAN.atlantic;
}
// Russia: Europe west of the Urals (~60°E), Asia east
const NU = units.length;
const out_ = [], out_raw = [];
for (let r = 0; r < H; r++) {
  const row = [];
  for (let c = 0; c < W; c++) {
    const i = r * W + c, u = grid[i];
    let v;
    if (u >= 0) v = 10 + u;
    else v = sea[i] ? oceanOf(r, c) : OCEAN.lake;
    if (u >= 0 && units[u].sov === 'RUS' && -180 + (c + 0.5) * RES > 60) v = 10 + NU; // Asian Russia
    row.push(v); out_raw.push(v);
  }
  // RLE as base-36 tokens "v.n" separated by ','
  const toks = []; let k = 0;
  while (k < W) { let n = 1; while (k + n < W && row[k + n] === row[k]) n++; toks.push(row[k].toString(36) + (n > 1 ? '.' + n.toString(36) : '')); k += n; }
  out_.push(toks.join(','));
}
// sharper detail maps for zoomed-in views: land cells by unit, water named from the world grid
const DETAIL = { uk: [-11, 49.5, 3, 61, 0.1], japan: [124, 24, 148, 46, 0.15], sea: [90, -2, 114, 26, 0.15] };
function rle(row) { const toks = []; let k = 0; const n0 = row.length; while (k < n0) { let n = 1; while (k + n < n0 && row[k + n] === row[k]) n++; toks.push(row[k].toString(36) + (n > 1 ? '.' + n.toString(36) : '')); k += n; } return toks.join(','); }
const maps = { world: { x0: -180, y0: TOP, res: RES, w: W, h: H, rows: out_ } };
for (const [name, [a, b, c2, d, res]] of Object.entries(DETAIL)) {
  const w = Math.round((c2 - a) / res), hh = Math.round((d - b) / res), rows = [];
  for (let r = 0; r < hh; r++) {
    const lat = d - (r + 0.5) * res, row = [];
    for (let c = 0; c < w; c++) {
      const lon = a + (c + 0.5) * res;
      let v = -1;
      for (let u = 0; u < units.length && v < 0; u++) {
        const U = units[u];
        for (let k = 0; k < U.polys.length; k++) { const bx = U.boxes[k]; if (lon < bx[0] || lon > bx[2] || lat < bx[1] || lat > bx[3]) continue; if (inPoly(lon, lat, U.polys[k])) { v = 10 + u; break; } }
      }
      if (v >= 10 && units[v - 10].sov === 'RUS' && lon > 60) v = 10 + NU; // Asian Russia
      if (v < 0) { // water: take the ocean name from the nearest water cell of the world grid
        const wr = Math.floor((TOP - lat) / RES), wc = Math.floor((lon + 180) / RES);
        v = 0;
        for (let d = 0; d < 6 && !v; d++) for (let dr = -d; dr <= d && !v; dr++) for (let dc = -d; dc <= d && !v; dc++) {
          const rr = wr + dr, cc = (wc + dc + W) % W; if (rr < 0 || rr >= H) continue;
          const wv = out_raw[rr * W + cc]; if (wv > 0 && wv < 10) v = wv;
        }
      }
      row.push(v);
    }
    rows.push(rle(row));
  }
  maps[name] = { x0: a, y0: d, res, w, h: hh, rows };
}
const meta = units.map(U => [U.id, U.name, U.cont, +U.lx.toFixed(1), +U.ly.toFixed(1)]);
const rus = units.find(U => U.sov === 'RUS');
meta.push(['RUS', rus.name, 'asia', 100, 62]);
// note: index NU (Asian Russia) shares the id RUS so a tap anywhere in Russia counts as Russia
const js = `/* PixelKid world map – generated from Natural Earth 1:50m map units (public domain) by a build script.
 * maps.world is a ${W}×${H} grid of ${RES}° cells from ${TOP}°N to ${-BOT}°S; uk/japan/sea are sharper close-ups. Each row is run-length encoded: "value.count" in base 36.
 * Values: 0 lake/inland sea, 1 Pacific, 2 Atlantic, 3 Indian, 4 Arctic, 5 Southern Ocean, 10+ = UNITS[value-10].
 * UNITS: [id, name, continent, labelLon, labelLat]. */
window.WORLD_DATA = {
units: ${JSON.stringify(meta)},
maps: {
${Object.entries(maps).map(([k, m]) => `${k}: { x0: ${m.x0}, y0: ${m.y0}, res: ${m.res}, w: ${m.w}, h: ${m.h},\nrows: ${JSON.stringify(m.rows)} }`).join(',\n')}
} };
`;
fs.writeFileSync(out, js);
console.log('units', meta.length, 'bytes', js.length);
