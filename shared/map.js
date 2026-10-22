/* Pixelkid quest map – draws a world's road of lessons on the home page (index.html) as a Super Mario World–style
 * overworld, walks the hero along it and opens the quest cards. index.html provides LIBRARY, records, get(), refreshHud()
 * and render(), and calls drawMap(world, lessons, stateOf). The landscape itself (terraces, path, scenery, water, each
 * world's biome) is drawn by shared/map-art.js (MapArt). Styles: shared/map.css.
 */
'use strict';
// ---------- the quest map ----------
// Each world is a road from START to its goal, and every lesson is a stop on it. A lesson follows the one listed before it,
// unless it names another with `after: '<title>'`: two lessons after the same one make a fork, and the road splits into
// lanes (with a river between them) that meet again at the goal. A stop opens once the stop before it is cleared (lessons
// already started stay open), so picking a branch is the player's choice while each lesson can still build on (and recap)
// the one before it. Like Super Mario World, the road only shows as far as the open stops; clearing a quest draws the next
// stretch in. Never scenery that looks collectable (gems, coins, stars, keys): children want to pick it up and can't.
// Each topic's landmark: a mountain with a little sign on top (tap it for the topic); the sign shows this icon.
const LANDMARK = {
  'Forces & Magnets': '🪁', Plants: '🏡', 'Animals incl. Humans': '🐢', Rocks: '🏔️', Light: '🌈',
  Time: '🔔', 'Numbers to 1,000': '🧮', Number: '🧱', 'Addition & Subtraction': '⚖️', 'Multiplication & Division': '🚂', Fractions: '🍰', Measurement: '📏', Geometry: '📐', Statistics: '📈',
  // the Word Kingdom's landmarks are places: the Great Library, the town fountain, a scribe's cottage, Dragon Mountain,
  // the Enchanted Wood, the poets' garden, the map room and the wise owl
  'Spelling & Vocabulary': '🏛️', Grammar: '⛲', Punctuation: '🏡', 'Myths & Legends': '⛰️', Fiction: '🌳', Poetry: '🌷', 'Non-fiction': '🗺️', 'Reading Skills': '🦉',
  'AI & Computers': '🖥️', 'Creative Tech': '📺', 'Thinking Online': '🔭', Coding: '🤖', 'Life Skills': '🏡',
  'Amazing Animals': '🐳', 'Your Amazing Body': '🧠', 'Incredible Inventions': '💡', 'Ancient Wonders': '🏛️', 'Wild Planet': '🗻',
  Asia: '🐘', 'Asia – home!': '🏠', Europe: '🏰', 'North America': '🗽', Africa: '🦒', 'South America': '🌴', Oceania: '🦘',
};
// the goal at the end of each world's road
const GOAL = { science: ['🏰', 'Castle of Science'], maths: ['👑', 'Crown of the Mine'], english: ['🏰', 'Word Kingdom Castle'], future: ['🚀', 'Rocket Launch Pad'], wonders: ['🏆', 'Hall of Wonders'], world: ['🏝️', 'Treasure Island'] };
const mapWrap = document.getElementById('shelf');
const reducedMotion = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
let mapWidth = 0, mapHero = null, walking = 0;

// the road as a tree: each stop's parent is the stop before it
function roadTree(lessons) {
  const stops = lessons.map((l, i) => ({ l, i, kids: [] }));
  const byTitle = Object.fromEntries(stops.map(s => [s.l.title, s]));
  stops.forEach((s, i) => {
    s.parent = s.l.after ? byTitle[s.l.after] || null : stops[i - 1] || null;
    if (s.l.after && !s.parent) console.warn(`"${s.l.title}" is after "${s.l.after}", which isn't in this world`);
    if (s.parent) s.parent.kids.push(s);
  });
  return stops;
}
// what state each stop is in: done · going · new · locked (the stop before isn't cleared yet) · soon (not built yet).
// The map and Lesson mode's grid (shared/lesson-grid.js) both use this, so a quest opens at the same time in both.
function questStops(lessons, stateOf) {
  const stops = roadTree(lessons);
  const cleared = s => !!(s && s.l.file && stateOf(s.l) === 'done');
  stops.forEach(s => {
    const st = s.l.file ? stateOf(s.l) : 'soon';
    s.st = st === 'new' && s.parent && s.parent.l.file && !cleared(s.parent) ? 'locked' : st;
    s.vis = ['done', 'going', 'new'].includes(s.st); // only open stops show on the map
  });
  return stops;
}
// the quest that glows: the one already started, else every open one
const glowsNext = (stops, s) => { const going = stops.find(t => t.st === 'going'); return s === going || (!going && s.st === 'new'); };

function drawMap(key, lessons, stateOf) {
  if (mapHero) { mapHero.stop(); mapHero = null; }
  cancelAnimationFrame(walking);
  const map = document.createElement('div');
  map.className = 'qmap';
  const banner = document.createElement('div'); // SMW-style: the name of the stop the hero is on (or you pointed at)
  banner.className = 'qbanner'; banner.setAttribute('aria-live', 'polite');
  // the map is drawn on an old treasure map: a parchment border with singed edges (painted by MapArt.frame below)
  const frame = document.createElement('div'), edge = document.createElement('canvas');
  frame.className = 'qframe'; edge.className = 'qedge';
  const F = mapWrap.clientWidth < 640 ? 20 : 32; // (the border's width)
  frame.style.padding = F + 'px';
  frame.append(edge, map);
  mapWrap.replaceChildren(banner, frame);
  const W = mapWidth = map.clientWidth;
  const small = W < 600, S = 3; // S: the hero's pixel size
  // HALF: half a stop dot's height (the hero stands on top of it). CELL: the least room a stop needs across a row.
  const ROW = small ? 176 : 208, HALF = small ? 20 : 24, HERO_H = 20 * S + 26, CELL = small ? 130 : 160;
  let seed = [...key].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7); // seeded, so the scenery stays put between visits
  const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296;

  const stops = questStops(lessons, stateOf);
  const cleared = s => !!(s && s.l.file && stateOf(s.l) === 'done');

  // Lay the road out in rows across the page, so a whole world fits on about one screen. A lane is a stretch of road with
  // no fork in it: it fills its share of the width with rows of stops, one topic to a row (a long topic carries on in the
  // next row), and each row runs the opposite way to the one before, so the road winds down the page. At a fork the
  // width is split and the branches go on side by side, each starting on the side nearest the fork. START is the first
  // spot in the first row, and a topic's landmark takes the spot after its last stop when the row has room for it.
  // A short row keeps a natural spacing and sits a little to one side, so each row's terrace is its own width.
  const start = { x: 0, y: 0 }, spots4marks = [], pad = small ? 12 : 28;
  const rowBoxes = [], rivers = []; // each row's strip of ground (a terrace), and where the forks' rivers run
  let bottom = 0;
  const lane = (first, x0, x1, y, from) => {
    const fit = Math.max(1, Math.floor((x1 - x0) / CELL));
    const run = [first];
    for (let s = first; s.kids.length === 1;) run.push(s = s.kids[0]);
    const rows = [];
    let row = null;
    (from ? run : [start, ...run]).forEach(t => {
      const unit = t === start ? first.l.unit : t.l.unit;
      if (!row || row.unit !== unit || row.cells.length >= fit) rows.push(row = { unit, cells: [] });
      row.cells.push(t);
    });
    let dir = from && from.x > (x0 + x1) / 2 ? -1 : 1;
    rows.forEach((r, k) => {
      const lastOfUnit = k === rows.length - 1 || rows[k + 1].unit !== r.unit;
      const n = r.cells.length + (lastOfUnit && LANDMARK[r.unit] && r.cells.length < fit ? 1 : 0);
      const w = Math.min((x1 - x0) / n, CELL * 1.25), off = rnd() * ((x1 - x0) - n * w);
      const at = j => (dir > 0 ? x0 + off + (j + 0.5) * w : x1 - off - (j + 0.5) * w);
      r.cells.forEach((t, j) => Object.assign(t, { x: at(j), y, x0, x1 }));
      if (n > r.cells.length) spots4marks.push({ x: at(n - 1), y, unit: r.unit });
      const xs = r.cells.map(t => t.x).concat(n > r.cells.length ? [at(n - 1)] : []);
      const minX = Math.min(...xs), maxX = Math.max(...xs), side = Math.max(w / 2, 100);
      rowBoxes.push({ x0: Math.max(x0, minX - side), x1: Math.min(x1, maxX + side), top: y - ROW / 2, bot: y + ROW / 2, minX, maxX, cells: r.cells }); // (minX/maxX: where its stops are)
      bottom = Math.max(bottom, y);
      dir = -dir; y += ROW;
    });
    const last = run[run.length - 1], w = (x1 - x0) / (last.kids.length || 1);
    last.kids.forEach((c, j) => { if (j) rivers.push({ x: x0 + j * w, top: y - ROW / 2 }); lane(c, x0 + j * w, x0 + (j + 1) * w, y, last); }); // (a river runs between the branches)
  };
  const roots = stops.filter(s => !s.parent), Y0 = HALF + HERO_H + 34;
  if (roots.length === 1) lane(roots[0], pad, W - pad, Y0, null);
  else { // more than one road from START: START stands alone above them
    Object.assign(start, { x: W / 2, y: Y0 });
    rowBoxes.push({ x0: W / 2 - 90, x1: W / 2 + 90, top: Y0 - ROW / 2, bot: Y0 + ROW / 2 });
    roots.forEach((r, j) => lane(r, pad + j * (W - 2 * pad) / roots.length, pad + (j + 1) * (W - 2 * pad) / roots.length, Y0 + ROW, start));
  }
  const leaves = stops.filter(s => !s.kids.length);
  // the goal has its own strip of ground below the lowest row, and the lanes meet on it
  const goalTop = bottom + ROW / 2, CLIFF = small ? 24 : 32; // (CLIFF: as tall as shared/map-art.js draws the cliffs)
  const meet = goalTop + 26, goal = { x: W / 2, y: meet + 86 }, H = goal.y + 66 + CLIFF + 20;
  map.style.height = H + 'px';
  MapArt.frame(edge, frame.clientWidth, frame.clientHeight, F, key);

  // the road: square pixel corners. Along a row it runs straight; from one row to the next it drops down the cliff (a ladder),
  // runs across just below it, then on to the next stop. The lanes meet just above the goal.
  const jog = (a, b) => Math.min(a.y + ROW / 2 + (small ? 18 : 24), b.y - HALF - 24); // just below the cliff, on the next terrace
  const corners = (a, b) => (a.y === b.y ? [a, b] : [a, { x: a.x, y: jog(a, b) }, { x: b.x, y: jog(a, b) }, b]);
  const toGoal = s => [s, { x: s.x, y: meet }, { x: goal.x, y: meet }, goal];
  const T = MapArt.terrain(key, rowBoxes, { x0: pad, x1: W - pad, top: goalTop, bot: H - 16 }, W, H, small, rnd);
  // newly opened stops since the last visit (y3:mapSeen): their stretch of road draws itself in. A first visit just remembers.
  const seenAll = get('y3:mapSeen', {}), seen = seenAll[key];
  const visIds = stops.filter(s => s.vis && s.l.id).map(s => s.l.id);
  const fresh = new Set(seen && !reducedMotion() ? visIds.filter(id => !seen.includes(id)) : []);
  seenAll[key] = [...new Set([...(seen || []), ...visIds])];
  try { localStorage.setItem('y3:mapSeen', JSON.stringify(seenAll)); } catch (e) { /* ignore */ }
  const edges = [];
  roots.forEach(r => { if (r.vis) edges.push({ pts: corners(start, r), fresh: fresh.has(r.l.id) }); });
  stops.forEach(s => s.kids.forEach(c => { if (s.vis && c.vis) edges.push({ pts: corners(s, c), fresh: fresh.has(c.l.id) }); }));
  if (stops.every(t => cleared(t))) leaves.forEach(s => edges.push({ pts: toGoal(s), fresh: false }));
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', W); svg.setAttribute('height', H);
  svg.innerHTML = MapArt.paths(edges, T, key, W, H);
  const ground = document.createElement('canvas'); // the landscape is painted onto this once (after the scenery is placed)
  ground.className = 'qground';
  map.append(ground, svg);

  const put = (cls, x, y, text) => {
    const d = document.createElement('div');
    d.className = cls; d.style.left = x + 'px'; d.style.top = y + 'px'; d.textContent = text;
    map.append(d);
    return d;
  };

  // scenery keeps clear of the road, the stops (with their name tags and the hero's spot), the landmarks and people
  const boxes = [];
  const roadBox = pts => pts.slice(1).forEach((b, i) => { const a = pts[i]; boxes.push([Math.min(a.x, b.x) - 26, Math.min(a.y, b.y) - 26, Math.max(a.x, b.x) + 26, Math.max(a.y, b.y) + 26]); });
  roots.forEach(r => roadBox(corners(start, r))); // every stretch of road, even ones still hidden, so nothing grows on it
  stops.forEach(s => s.kids.forEach(c => roadBox(corners(s, c))));
  leaves.forEach(s => roadBox(toGoal(s)));
  [start, goal, ...stops].forEach(s => {
    if (s.vis === false) { boxes.push([s.x - 24, s.y - 24, s.x + 24, s.y + 24]); return; } // a hidden stop: just its dot, so scenery can grow round it
    boxes.push([s.x - 80, s.y - HALF - 8, s.x + 80, s.y + HALF + 66]); // the stop and its name tag
    boxes.push([s.x - 50, s.y - HALF - HERO_H, s.x + 50, s.y - HALF]); // where the hero stands on it (and its tag)
  });
  boxes.push([goal.x - 70, goal.y - 80, goal.x + 70, goal.y + 60]); // the goal is bigger, with its flag
  const room = (x, y) => Math.min(x, W - x, y, H - y, ...boxes.map(([a, b, c, d]) => Math.hypot(Math.max(a - x, 0, x - c), Math.max(b - y, 0, y - d))));
  const spots = []; // open ground (terrace tops), on a jittered grid
  for (let y = 30; y < H - 20; y += 20) for (let x = 20; x < W - 10; x += 20) {
    const p = { x: x + (rnd() - 0.5) * 8, y: y + (rnd() - 0.5) * 8 };
    if (T.land(p.x, p.y, 8, 6)) spots.push(p);
  }
  const landmarks = [];
  // the world ahead lies under fog (like SMW's unexplored map): a row with no open stop yet is covered, with a "?" where
  // each of its quests will be, so the player can see how far there is to go. When a row's first stop opens, its fog lifts.
  const openHere = c => c === start || c.vis, freshHere = c => c !== start && fresh.has(c.l.id);
  const fogs = rowBoxes.map((r, i) => {
    if (!r.cells) return null; // (START standing alone above the roads)
    const lifts = r.cells.some(freshHere) && !r.cells.some(c => openHere(c) && !freshHere(c));
    return r.cells.some(openHere) && !lifts ? null : { t: T.ts[i], lifts };
  }).filter(Boolean);
  const fogged = (x, y) => fogs.some(({ t, lifts }) => !lifts && x > t.x0 - 12 && x < t.x1 + 12 && y > t.top - 20 && y < t.cb + 20);

  // each topic's landmark: in its spot at the end of the topic's last row, or else the roomiest spot near the topic's open stops
  // (or, with no room for a mountain, just its ribbon).
  // Tap it to see the topic's name and how much of it is cleared. Topics not reached yet have none.
  const unitStops = s => { const run = [s]; for (let c = s; (c = c.kids.find(k => k.l.unit === s.l.unit));) run.push(c); return run; };
  stops.filter(s => !s.parent || s.parent.l.unit !== s.l.unit).forEach(s => {
    const run = unitStops(s), icon = LANDMARK[s.l.unit];
    if (!icon || !run.some(t => t.vis)) return;
    let best = spots4marks.find(m => m.unit === s.l.unit && m.x >= s.x0 && m.x <= s.x1 && m.y >= s.y && m.y <= run[run.length - 1].y); // (on a row still in fog, its sign and ribbon show through)
    let flat = false;
    if (!best) {
      const lastY = run.filter(t => t.vis).reduce((y, t) => Math.max(y, t.y), s.y);
      const near = p => p.x >= s.x0 && p.x <= s.x1 && p.y >= s.y - ROW / 2 && p.y <= lastY + ROW / 2;
      let br = 0;
      spots.forEach(p => { if (near(p)) { const r = room(p.x, p.y); if (r > br) { br = r; best = p; } } });
      if (br < (small ? 34 : 40)) { // no room for a mountain: just the ribbon, flat on the nearest open patch of ground
        const first = run.find(t => t.vis), clearOf = (x0, y0, x1, y1) => !boxes.some(([a, b, c, d]) => c > x0 && a < x1 && d > y0 && b < y1);
        best = null;
        for (const half of [74, 36]) { // the whole ribbon, or else a short one: just the icon and the count
          let bd = Infinity;
          spots.forEach(p => {
            const d = Math.hypot(p.x - first.x, p.y - first.y);
            if (d < bd && near(p) && !fogged(p.x, p.y) && T.land(p.x, p.y, half - 8, 12) && clearOf(p.x - half, p.y - 16, p.x + half, p.y + 16)) { bd = d; best = p; }
          });
          if (best) { flat = half; break; }
        }
        if (!best) return;
      }
    }
    const ready = run.filter(t => t.l.file), n = ready.filter(cleared).length;
    if (flat) { boxes.push([best.x - flat, best.y - 18, best.x + flat, best.y + 18]); } else boxes.push([best.x - 66, best.y - 62, best.x + 66, best.y + 68]); // (with its ribbon underneath)
    landmarks.push({ x: best.x, y: best.y, icon, title: s.l.unit, n, of: ready.length, flat,
      card: () => openCard({ icon, tag: 'TOPIC', title: s.l.unit, stat: `${n} of ${ready.length} quest${ready.length === 1 ? '' : 's'} cleared here` + (run.length > ready.length ? `, and ${run.length - ready.length} more coming soon.` : '.') }) });
  });

  // people by the road (shared/npcs.js): each one turns up once the stop they live by is cleared
  const npcAt = {}; // where each person by the road stands, and the stop they live by
  const clear = p => Math.min(room(p.x, p.y), room(p.x, p.y - 10 * S), room(p.x, p.y - 20 * S - 24)); // feet, middle and the marker over their head
  const stand = p => T.land(p.x, p.y - 30, 12, 30) && !fogged(p.x, p.y - 30); // all of them on the ground, out of the fog
  if (window.NPC && window.Avatar) NPC.forWorld(key).forEach(n => {
    const home = n.at ? stops.find(s => s.l.title === n.at) : null;
    if (n.at && !cleared(home)) return;
    const base = home || start;
    let best = null, br = -1;
    spots.forEach(p => {
      const d = Math.hypot(p.x - base.x, p.y - base.y);
      if (d < 60 || d > 220 || p.y < 20 * S + 46 || !stand(p)) return; // keep their head and the marker over it well inside the map
      const r = Math.min(clear(p), 50) - d * 0.08; // roomy, but close to home
      if (r > br) { br = r; best = p; }
    });
    if (!best || br < 4) spots.forEach(p => { // nowhere roomy close by: the roomiest spot a bit further away
      const d = Math.hypot(p.x - base.x, p.y - base.y), r = clear(p) - d * 0.03;
      if (p.y >= 20 * S + 46 && d < 420 && r > br && stand(p)) { br = r; best = p; }
    });
    if (!best) best = { x: Math.min(W - 30, base.x + 60), y: Math.max(base.y, 20 * S + 46) }; // no room anywhere: just beside their stop
    boxes.push([best.x - 40, best.y - 20 * S - 40, best.x + 40, best.y + 20]); // their marker too, and a gap before the next person
    const pool = []; // the lessons cleared on the road up to here: what a challenger asks about
    for (let s = home; s; s = s.parent) if (cleared(s) && s.l.id) pool.push(s.l.id);
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'qnpc'; b.style.left = best.x + 'px'; b.style.top = best.y + 'px';
    b.setAttribute('aria-label', `Talk to ${n.name}`); b.title = n.name;
    b.append(Avatar.draw(NPC.look(n), { scale: S })); // the same size as the hero
    const mk = NPC.marker(n);
    if (mk) { const m = document.createElement('span'); m.className = 'qnpc-mark' + (mk === '!' || mk === '?' ? ' ask' : ''); m.textContent = mk; b.append(m); }
    npcAt[n.id] = { x: best.x, y: best.y, home: base };
    b.onclick = () => goTo({ npc: n.id }, () => NPC.talk(n, { pool, changed() { refreshHud(); render(); } }));
    map.append(b);
  });

  // then the world's scenery on the open ground (hills with eyes, trees, houses…), a pond or two, and the landmarks'
  // mountains, all painted once onto the ground canvas with the terraces; then the moving bits (water, clouds, eyes…)
  for (let k = 0, ponds = Math.min(small ? 1 : 2, MapArt.ponds(key)); k < spots.length && ponds > 0; k++) {
    const p = spots[Math.floor(rnd() * spots.length)];
    if (room(p.x, p.y) < 64 || !T.land(p.x, p.y, 62, 34)) continue;
    T.pond(p.x, p.y, small ? 72 : 96, 44); boxes.push([p.x - 60, p.y - 34, p.x + 60, p.y + 34]); ponds--;
  }
  const scenery = [], order = spots.map(p => ({ p, r: room(p.x, p.y) + rnd() * 25 })).sort((a, b) => b.r - a.r);
  let left = Math.round((W * H) / (small ? 16000 : 18000));
  for (const { p } of order) {
    if (left <= 0) break;
    const kind = MapArt.scenery(key, rnd), f = MapArt.FOOT[kind];
    if (room(p.x, p.y) < f.rx * 0.75 || !T.land(p.x, p.y, f.rx, f.ry)) continue;
    scenery.push({ kind, x: p.x, y: p.y + f.ry * 0.6 });
    boxes.push([p.x - f.rx - 6, p.y - f.ry - 10, p.x + f.rx + 6, p.y + f.ry + 6]);
    left--;
  }
  landmarks.forEach(it => { if (!it.flat) scenery.push({ kind: 'mountain', x: it.x, y: it.y + 34 }); });
  MapArt.live(map, MapArt.paint(ground, T, key, scenery, W, H, rnd), W, H, rnd, rivers.map(r => Object.assign({ bot: goalTop }, r)), key, T);
  if ((MapArt.ART[key] || {}).critters !== false) for (let k = 0, n = 1 + Math.floor(rnd() * 2); k < n; k++) { // a butterfly or two
    const p = spots[Math.floor(rnd() * spots.length)];
    if (p && room(p.x, p.y) > 20) put('qdeco small qflutter', p.x, p.y - 20, '🦋').style.animationDelay = -(rnd() * 3).toFixed(1) + 's';
  }
  // the fog over the rows not reached yet (see fogs above)
  fogs.forEach(({ t, lifts }) => {
    const f = document.createElement('div');
    f.className = 'qfog' + (lifts ? ' lift' : '');
    Object.assign(f.style, { left: t.x0 - 12 + 'px', top: t.top - 4 + 'px', width: t.x1 - t.x0 + 24 + 'px', height: t.cb - t.top + 4 + 'px', animationDelay: -(rnd() * 30).toFixed(1) + 's' });
    map.append(f);
    if (lifts) setTimeout(() => f.remove(), 1400);
  });
  // the landmarks: the topic's sign on the mountain top and a ribbon at its foot with the topic's name and how much of it
  // is cleared (gold once it all is), so each row of the road says what it is about. Tap either for the topic's card.
  landmarks.forEach(it => {
    const d = document.createElement('button');
    d.type = 'button'; d.className = 'qmark ' + (it.flat ? 'flat' : 'peak'); d.style.left = it.x + 'px'; d.style.top = it.y + 'px'; d.title = it.title;
    d.innerHTML = '<span class="qpk"></span><span class="qrib"><b></b><span class="qrib-n"></span></span>';
    d.querySelector('.qpk').textContent = it.icon;
    if (it.flat) d.querySelector('.qrib').prepend(d.querySelector('.qpk')); // (no mountain: the sign's icon goes in the ribbon)
    if (it.flat && it.flat < 74) d.classList.add('short'); // (no room for its name either)
    d.querySelector('b').textContent = it.title;
    d.querySelector('.qrib-n').textContent = it.of && it.n === it.of ? '★' : `${it.n}/${it.of}`;
    if (it.of && it.n === it.of) d.querySelector('.qrib').classList.add('done');
    d.setAttribute('aria-label', `${it.title}: ${it.n} of ${it.of} cleared`); d.onclick = it.card; map.append(d);
  });

  // where the hero stands: on a quest already started; else, when the only open quests are the branches of one fork,
  // at the fork ("pick a path"); else at the first open quest. Once everything built is cleared, at the last built stop.
  const going = stops.find(s => s.st === 'going'), open = stops.filter(s => s.st === 'new');
  const fork = !going && open.length > 1 && open.every(s => s.parent && s.parent === open[0].parent) ? open[0].parent : null;
  const at = going || fork || open[0] || [...stops].reverse().find(s => s.l.file);

  // the stops
  const builtStops = stops.filter(s => s.l.file), nCleared = builtStops.filter(cleared).length, allClear = nCleared === stops.length;
  const [goalIcon, goalName] = GOAL[key] || ['🏰', 'The Castle'];
  const goalCard = () => openCard({
    icon: goalIcon, tag: 'THE GOAL', title: goalName,
    stat: `Clear every quest on the road to reach it! ${nCleared} of ${builtStops.length} cleared so far` + (builtStops.length < stops.length ? `, and ${stops.length - builtStops.length} more are being built.` : '.'),
  });
  // the banner: what the hero is standing on (or what you pointed at)
  const showBanner = n => {
    if (!n) return;
    const rec = n.l ? records[n.l.id] || {} : {};
    const [icon, title, sub] = n === start ? ['🏡', 'START', (LIBRARY[key] || {}).label || '']
      : n === goal ? [goalIcon, goalName, `${nCleared} of ${builtStops.length} quests cleared`]
        : [n.l.emoji, n.l.title, `${n.l.unit} · ` + (n.st === 'done' ? `🏆 ${rec.best}/${rec.total}` : n.st === 'going' ? `⭐ ${rec.stars} gems so far` : 'NEW QUEST!')];
    banner.innerHTML = '<span class="qb-icon"></span><span class="qb-text"><b></b><small></small></span>';
    banner.querySelector('.qb-icon').textContent = icon;
    banner.querySelector('b').textContent = title;
    banner.querySelector('small').textContent = sub;
  };
  // Super Mario World–style stops: a small round dot with the lesson's icon and its name underneath. A cleared one
  // gets a star. START is a little house and the goal a big castle (or rocket, or island) on a red ring.
  const dot = (cls, p, icon, label) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'qdot ' + cls; b.style.left = p.x + 'px'; b.style.top = p.y + 'px';
    b.innerHTML = '<span class="qi"></span><span class="qlabel"></span>';
    b.querySelector('.qi').textContent = icon;
    b.querySelector('.qlabel').textContent = label;
    b.addEventListener('pointerenter', () => showBanner(p));
    b.addEventListener('focus', () => showBanner(p));
    map.append(b);
    return b;
  };
  dot('start', start, '🏡', 'START').onclick = () => goTo(start, () => showBanner(start));
  stops.forEach(s => {
    if (!s.vis) { const q = put('qdot hidden', s.x, s.y, '?'); q.setAttribute('aria-hidden', 'true'); return; } // a quest still in the fog
    const glow = glowsNext(stops, s);
    const b = dot(s.st + (glow ? ' next' : '') + (fresh.has(s.l.id) ? ' fresh' : ''), s, s.l.emoji, mapName(s.l));
    if (s.st === 'done') { // a cleared stop's star is a medal for the boss score: gold, silver or bronze
      const rec = records[s.l.id] || {}, score = rec.total ? rec.best / rec.total : 1;
      const st = document.createElement('span'); st.className = 'qstar ' + (score >= 0.9 ? 'gold' : score >= 0.7 ? 'silver' : 'bronze'); st.textContent = '★'; b.append(st);
    }
    b.setAttribute('aria-label', `${s.l.title}: ${{ done: 'cleared', going: 'started', new: 'open' }[s.st]}`);
    b.onclick = () => { showBanner(s); goTo(s, () => questCard(s, glow)); };
  });
  const g = dot('goal' + (allClear ? ' clear' : ''), goal, goalIcon, allClear ? 'WORLD CLEAR!' : goalName);
  g.insertAdjacentHTML('afterbegin', '<span class="qflag"></span>'); // a pennant flying over the goal (it glows once the world is clear)
  g.onclick = () => { showBanner(goal); goalCard(); };
  // a stretch of road that opened since the last visit draws itself in, then its new stop pops up with a sparkle
  if (fresh.size) {
    setTimeout(() => stops.forEach(s => {
      if (!fresh.has(s.l.id)) return;
      for (let k = 0; k < 10; k++) {
        const sp = put('qspark', s.x, s.y, ''), a = k / 10 * Math.PI * 2;
        sp.style.setProperty('--dx', Math.round(Math.cos(a) * 34) + 'px'); sp.style.setProperty('--dy', Math.round(Math.sin(a) * 34) + 'px');
        setTimeout(() => sp.remove(), 900);
      }
    }), 900);
    setTimeout(() => svg.querySelectorAll('.qrv').forEach(el => el.removeAttribute('mask')), 1400);
  }

  showBanner(at || start); // (the hero updates it as it moves)

  // the hero. Tap an open stop or someone by the road and the hero walks there along the road first (goTo).
  // It stays where it was walked to (y3:mapStand), until a quest is finished: then it walks on to the next stop by itself
  // (y3:mapAt remembers the stop it was pointing at before).
  const still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const up = n => (n === start ? null : n.parent || start);
  const line = n => { const a = []; for (let k = n; k; k = up(k)) a.push(k); return a; };
  // the corners of the road from one stop to another (START counts as a stop): back to where their roads meet, then on
  function route(a, b) {
    const A = line(a), B = line(b), c = A.find(n => B.includes(n)), pts = [];
    A.slice(0, A.indexOf(c)).forEach(n => pts.push(...corners(up(n), n).slice(0, -1).reverse()));
    B.slice(0, B.indexOf(c)).reverse().forEach(n => pts.push(...corners(up(n), n).slice(1)));
    return pts;
  }
  // How high the hero stands above the point it is at: on a stop it stands on top of the stop's badge (HALF);
  // on the road (and beside people) its feet are on the road (FOOT). It steps up and down near the ends of a walk.
  const FOOT = -2;
  // beside someone by the road, on the road's side of them, feet level with theirs
  const npcSpot = sp => ({ x: sp.x + (sp.x > sp.home.x ? -46 : 46), y: sp.y + FOOT - 4 });
  let hero = null; // { cv, tag, node (the stop it is on or nearest to), npc (who it stands beside), x, y, busy }
  function goTo(target, then) {
    if (!hero) return then();
    if (hero.busy) return;
    const sp = target.npc ? npcAt[target.npc] : null, node = sp ? sp.home : target;
    const pts = [];
    if (hero.npc) pts.push({ x: hero.node.x, y: hero.node.y }); // back onto the road first
    pts.push(...route(hero.node, node));
    if (sp) pts.push(npcSpot(sp));
    const stand = get('y3:mapStand', {});
    stand[key] = sp ? 'npc:' + target.npc : node === start ? 'start' : node.l.id;
    try { localStorage.setItem('y3:mapStand', JSON.stringify(stand)); } catch (e) { /* ignore */ }
    hero.node = node; hero.npc = sp ? target.npc : null;
    walk(pts, then, 0, sp ? FOOT : HALF);
  }
  // walk through the points, then call done(). endLift: how high it stands at the end (see FOOT).
  // Long walks speed up so none takes much more than 2.5 seconds.
  function walk(pts, done, pause = 0, endLift = HALF) {
    cancelAnimationFrame(walking);
    const end = pts.length ? pts[pts.length - 1] : hero;
    if (still || !pts.length) { hero.place(end.x, end.y, pts.length ? endLift : hero.lift); hero.settle(); return done && done(); }
    let dist = 0, q = { x: hero.x, y: hero.y };
    pts.forEach(p => { dist += Math.hypot(p.x - q.x, p.y - q.y); q = p; });
    const SPEED = Math.max(220, dist / 2.5); // pixels a second
    const L0 = hero.lift, R = Math.min(40, dist / 2), lerp = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));
    const liftAt = gone => (gone < R ? lerp(L0, FOOT, gone / R) : dist - gone < R ? lerp(FOOT, endLift, 1 - (dist - gone) / R) : FOOT);
    let w = 0, last = 0, t0 = 0, gone = 0;
    hero.busy = true; hero.tag.hidden = true;
    const step = now => {
      if (!hero.cv.isConnected) return;
      if (!last) last = t0 = now;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (now - t0 >= pause) {
        let go = SPEED * dt, x = hero.x, y = hero.y;
        while (go > 0 && w < pts.length) {
          const p = pts[w], dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy);
          if (dx) mapHero.look(dx < 0 ? -1 : 1);
          if (d <= go) { x = p.x; y = p.y; go -= d; gone += d; w++; } else { x += dx / d * go; y += dy / d * go; gone += go; go = 0; }
        }
        hero.place(x, y, w < pts.length ? liftAt(gone) : endLift);
        hero.cv.style.marginTop = Math.floor(now / 120) % 2 ? '-3px' : '0'; // a little hop with each step
        const r = hero.cv.getBoundingClientRect(), want = r.top + r.height / 2 - innerHeight * 0.5;
        if (Math.abs(want) > innerHeight * 0.2) window.scrollBy(0, want * 0.06); // follow the hero along the map
      }
      if (w < pts.length) walking = requestAnimationFrame(step);
      else { hero.busy = false; hero.cv.style.marginTop = '0'; hero.settle(); if (done) done(); }
    };
    walking = requestAnimationFrame(step);
  }

  if (!window.Avatar || !at) return;
  const shade = put('qshade', 0, 0, ''); // the hero's shadow on the ground
  const cv = document.createElement('canvas');
  cv.className = 'qhero';
  map.append(cv);
  mapHero = Avatar.animate(cv, { scale: S, pet: true });
  const tag = put('qhero-tag', 0, 0, going ? 'KEEP GOING!' : fork ? 'PICK A PATH!' : open.length ? 'NEXT QUEST!' : 'MORE SOON!');
  hero = {
    cv, tag, node: at, npc: null, x: at.x, y: at.y, lift: HALF, busy: false,
    place(x, y, lift = this.lift) {
      this.x = x; this.y = y; this.lift = lift;
      cv.style.left = x - 6 * S + 'px'; cv.style.top = y - lift - 20 * S + 4 + 'px';
      shade.style.left = x + 'px'; shade.style.top = y - lift + 2 + 'px';
      tag.style.left = x + 'px'; tag.style.top = y - lift - 20 * S - 4 + 'px';
    },
    // standing still: the "NEXT QUEST!" tag only shows on the stop it is about
    // (beside its head instead, when above it the tag would cover a stop's name or a topic's sign)
    settle() {
      tag.hidden = !!this.npc || this.node !== at; tag.classList.remove('side', 'left');
      if (!tag.hidden && covers(tag)) { tag.classList.add('side'); if (covers(tag) || tag.getBoundingClientRect().right > map.getBoundingClientRect().right) tag.classList.add('left'); }
      mapHero.look(0); showBanner(this.node);
    },
  };
  function covers(el) {
    const r = el.getBoundingClientRect();
    return [...map.querySelectorAll('.qlabel, .qrib, .qpk')].some(o => { const q = o.getBoundingClientRect(); return q.width && r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top; });
  }
  const inView = () => { const r = cv.getBoundingClientRect(); return r.top > 60 && r.bottom < innerHeight - 20; };
  const marks = get('y3:mapAt', {}), from = stops.find(s => s.l.id && s.l.id === marks[key]);
  if (at.l.id) { marks[key] = at.l.id; try { localStorage.setItem('y3:mapAt', JSON.stringify(marks)); } catch (e) { /* ignore */ } }
  // where it was walked to last time
  const stood = get('y3:mapStand', {})[key] || '';
  const npcThere = stood.startsWith('npc:') && npcAt[stood.slice(4)];
  const stopThere = stood === 'start' ? start : stops.find(s => s.l.id && s.l.id === stood && ['done', 'going', 'new'].includes(s.st));
  if (npcThere) { hero.node = npcThere.home; hero.npc = stood.slice(4); const p = npcSpot(npcThere); hero.place(p.x, p.y, FOOT); }
  else if (stopThere) { hero.node = stopThere; hero.place(stopThere.x, stopThere.y); }
  else hero.place(at.x, at.y);
  hero.settle();
  if (from && from !== at && !still) {
    // a quest was finished since the last visit: walk on to the next stop
    const stand = get('y3:mapStand', {}); delete stand[key];
    try { localStorage.setItem('y3:mapStand', JSON.stringify(stand)); } catch (e) { /* ignore */ }
    const pts = (hero.npc ? [{ x: hero.node.x, y: hero.node.y }] : []).concat(route(hero.node, at));
    hero.node = at; hero.npc = null;
    if (!inView()) cv.scrollIntoView({ block: 'center' });
    walk(pts, () => mapHero.play() || mapHero.blink(), fresh.size ? 1500 : 700); // a short pause first, so the eye finds the hero (and new road draws in)
  } else if (!inView()) setTimeout(() => cv.scrollIntoView({ block: 'center', behavior: 'smooth' }), 400);
}

// a stop's name on the map: its title up to the colon, or its `mapTitle` (the banner and quest card show the whole title)
const mapName = l => l.mapTitle || l.title.split(': ')[0];

// a stop's quest card: what it is, how far you got, and the button to play it
function questCard(s, isNext) {
  const l = s.l, rec = records[l.id] || {}, st = s.st;
  const branches = s.kids.length > 1 && st === 'done' ? `The road splits here: ${s.kids.map(k => `“${k.l.title}”`).join(' or ')}. You choose!` : '';
  openCard({
    icon: l.emoji, title: l.title, unit: l.unit, soon: st === 'soon' || st === 'locked',
    tag: isNext ? (st === 'going' ? 'KEEP GOING!' : 'NEXT QUEST') : { done: 'CLEARED!', going: 'STARTED', new: 'OPEN', locked: 'LOCKED', soon: 'COMING SOON' }[st],
    stat: {
      done: `🏆 Boss score ${rec.best}/${rec.total} · ⭐ ${rec.stars || 0} gems`, going: `⭐ ${rec.stars} gems so far`, new: 'A brand-new quest!',
      locked: `🔒 Clear “${s.parent && s.parent.l.title}” to open this quest.`, soon: '🔒 This quest is still being built.',
    }[st],
    tip: branches,
    play: st === 'soon' || st === 'locked' ? null : l.file,
    playLabel: { done: '▶ PLAY AGAIN', going: '▶ CONTINUE', new: '▶ PLAY' }[st],
  });
}
const qBack = document.getElementById('qcard-back');
function openCard(o) {
  const card = document.createElement('div');
  card.className = 'qcard' + (o.soon ? ' soon' : '');
  card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true');
  card.innerHTML = '<div class="le"></div><div class="qc-body"><span class="qc-tag"></span><h2></h2><div class="qc-unit"></div><p class="qc-stat"></p><p class="qc-tip"></p><div class="qc-btns"></div></div>';
  const set = (sel, t) => { const e = card.querySelector(sel); if (t) e.textContent = t; else e.remove(); };
  set('.le', o.icon); set('.qc-tag', o.tag); set('h2', o.title); set('.qc-unit', o.unit); set('.qc-stat', o.stat); set('.qc-tip', o.tip);
  card.setAttribute('aria-label', o.title);
  const btns = card.querySelector('.qc-btns');
  if (o.play) { const a = document.createElement('a'); a.className = 'btn big ready'; a.href = o.play; a.textContent = o.playLabel; btns.append(a); }
  const close = document.createElement('button');
  close.type = 'button'; close.className = 'btn ghost'; close.textContent = o.play ? 'Not now' : 'OK';
  close.onclick = closeCard;
  btns.append(close);
  qBack.replaceChildren(card); qBack.hidden = false;
  btns.firstChild.focus();
}
function closeCard() { qBack.hidden = true; qBack.replaceChildren(); }
qBack.addEventListener('click', e => { if (e.target === qBack) closeCard(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !qBack.hidden) closeCard(); });
// a new width (phone turned, window resized) lays the road out again
let resizeT = 0;
window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { const m = mapWrap.querySelector('.qmap'); if (m && m.clientWidth !== mapWidth) render(); }, 200); });
