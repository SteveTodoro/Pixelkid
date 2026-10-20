/* Pixelkid quest map – draws a world's road of lessons on the home page (index.html), walks the hero along it and
 * opens the quest cards. index.html provides LIBRARY, records, get(), refreshHud() and render(), and calls
 * drawMap(world, lessons, stateOf). Worlds with a look in shared/map-art.js (MapArt) get the Super Mario World–style
 * landscape; the rest keep the older road and scenery. Styles: shared/map.css.
 */
'use strict';
// ---------- the quest map ----------
// Each world is a road from START to its goal, and every lesson is a stop on it. A lesson follows the one listed before it,
// unless it names another with `after: '<title>'`: two lessons after the same one make a fork, and the road splits into
// lanes that meet again at the goal. A stop opens once the stop before it is cleared (lessons already started stay open),
// so picking a branch is the player's choice while each lesson can still build on (and recap) the one before it.
// Lessons still being made are grey stops on a faded stretch of road.
// Each world's look: its road, the little groups of scenery dotted around it and a few one-off pieces. Never scenery that
// looks collectable (gems, coins, stars, keys): children want to pick it up and can't.
const MAP_LOOK = {
  science: { road: 'dirt', groups: { wood: ['🌳', '🌲', '🌳'], flowers: ['🌷', '🌼', '🌻', '🌸'], rocks: ['🪨'], mushrooms: ['🍄'] },
    units: { Plants: ['flowers', 'flowers', 'wood'], Rocks: ['rocks', 'wood'], 'Animals incl. Humans': ['wood', 'flowers'] }, critters: ['🦋', '🐝', '🐌', '🐸'] },
  maths: { road: 'rail', groups: { rocks: ['🪨'], timber: ['🪵'], mushrooms: ['🍄'] }, mix: ['rocks', 'rocks', 'timber', 'timber', 'mushrooms'], singles: ['⛏️', '🕯️'] },
  // English is a storybook kingdom drawn on an old map: forests, wheat fields, hills and cottages (no animal heads)
  english: { road: 'cobble', groups: { wood: ['🌳', '🌲', '🌳'], fields: ['🌾', '🌾'], hills: ['⛰️'], village: ['🏠', '🏡'], flowers: ['🌷', '🌼'] },
    mix: ['wood', 'wood', 'fields', 'fields', 'hills', 'village', 'flowers'], critters: ['🦋'] },
  future: { road: 'circuit', groups: { asteroids: ['🪨'] }, singles: ['🪐', '🌙'] },
  wonders: { road: 'boardwalk', groups: { reef: ['🪸', '🐠'], fish: ['🐠', '🐬'] }, singles: ['🐳', '⛵'] },
  world: { road: 'flight', groups: { waves: ['🌊'], fish: ['🐬', '🐠'] }, singles: ['⛵', '🐳'] },
};
// one big landmark stands in each unit's part of the map
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
// the road's layers for each style (an SVG path `d`; `id` names the rail mask)
function roadLayers(style, d, id, W, H) {
  const P = a => `<path d="${d}" ${a}/>`, butt = 'stroke-linecap="butt"';
  switch (style) {
    case 'rail': // sleepers on dark ballast, two steel rails
      return P('stroke="#000" stroke-width="30"') + P('stroke="#4a3b2c" stroke-width="26"') + P(`stroke="#8a5a32" stroke-width="26" stroke-dasharray="5 9" ${butt}`)
        + `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><path d="${d}" fill="none" stroke="#fff" stroke-width="20"/><path d="${d}" fill="none" stroke="#000" stroke-width="12"/></mask>`
        + P(`stroke="#cfd4dc" stroke-width="20" mask="url(#${id})"`);
    case 'cobble': // grey cobblestones
      return P('stroke="#000" stroke-width="34"') + P('stroke="#6f6f6f" stroke-width="28"') + P(`stroke="#a9a9a9" stroke-width="22" stroke-dasharray="9 3" ${butt}`)
        + P(`stroke="#c4c4c4" stroke-width="8" stroke-dasharray="9 3" stroke-dashoffset="6" ${butt}`);
    case 'circuit': // a glowing circuit-board line
      return P('stroke="#2ee6d6" stroke-opacity=".22" stroke-width="22"') + P('stroke="#000" stroke-width="12"') + P('stroke="#2ee6d6" stroke-width="6"')
        + P(`stroke="#e6fffd" stroke-width="2" stroke-dasharray="3 9" ${butt}`);
    case 'boardwalk': // wooden planks over the water
      return P('stroke="#000" stroke-width="32"') + P('stroke="#6b4425" stroke-width="26"') + P(`stroke="#c08a52" stroke-width="22" stroke-dasharray="7 2" ${butt}`);
    case 'flight': // a dotted flight path across the sea
      return P(`stroke="rgba(0,0,0,.35)" stroke-width="9" stroke-dasharray="12 10" ${butt}`) + P(`stroke="#fff" stroke-width="5" stroke-dasharray="12 10" ${butt}`);
    default: // a sandy dirt path with a dashed middle line
      return P('stroke="#000" stroke-width="34"') + P('stroke="#b8925a" stroke-width="26"') + P('stroke="#e8cf98" stroke-width="18"')
        + P(`stroke="#fff" stroke-opacity=".7" stroke-width="3" stroke-dasharray="8 12" ${butt}`);
  }
}
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

function drawMap(key, lessons, stateOf) {
  if (mapHero) { mapHero.stop(); mapHero = null; }
  cancelAnimationFrame(walking);
  const art = !!(window.MapArt && MapArt.has(key)); // the Super Mario World–style landscape (shared/map-art.js)
  const map = document.createElement('div');
  map.className = 'qmap' + (art ? ' art' : '');
  const banner = art ? document.createElement('div') : null; // SMW-style: the name of the stop the hero is on (or you pointed at)
  if (banner) { banner.className = 'qbanner'; banner.setAttribute('aria-live', 'polite'); }
  mapWrap.replaceChildren(...[banner, map].filter(Boolean));
  const W = mapWidth = map.clientWidth;
  const small = W < 600, S = 3; // S: the hero's pixel size
  // HALF: half a stop's height (the hero stands on top of it). The landscape's stops are small round dots.
  const ROW = art ? (small ? 168 : 196) : small ? 160 : 216, HALF = art ? (small ? 13 : 16) : small ? 32 : 38;
  const HERO_H = 20 * S + 26, CELL = small ? 130 : 150; // CELL: the least room a stop needs across a row
  let seed = [...key].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7); // seeded, so the scenery stays put between visits
  const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296;

  // what state each stop is in: done · going · new · locked (the stop before isn't cleared yet) · soon (not built yet)
  const stops = roadTree(lessons);
  const cleared = s => !!(s && s.l.file && stateOf(s.l) === 'done');
  stops.forEach(s => {
    const st = s.l.file ? stateOf(s.l) : 'soon';
    s.st = st === 'new' && s.parent && s.parent.l.file && !cleared(s.parent) ? 'locked' : st;
  });

  // Lay the road out in rows across the page, so a whole world fits on about one screen. A lane is a stretch of road with
  // no fork in it: it fills its share of the width with rows of stops, one topic to a row (a long topic carries on in the
  // next row), and each row runs the opposite way to the one before, so the road winds down the page. At a fork the
  // width is split and the branches go on side by side, each starting on the side nearest the fork. START is the first
  // spot in the first row, and a topic's landmark takes the spot after its last stop when the row has room for it.
  const start = { x: 0, y: 0 }, spots4marks = [], pad = art ? (small ? 12 : 28) : small ? 8 : 24;
  const rowBoxes = [], rivers = []; // each row's strip of ground (for the landscape's terraces), and where the forks' rivers run
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
      // in the landscape a short row doesn't stretch across the whole lane: its stops keep a natural spacing and the row
      // sits a little to one side, so each terrace is its own width and the island gets an uneven coastline
      const w = art ? Math.min((x1 - x0) / n, CELL * 1.25) : (x1 - x0) / n, off = art ? rnd() * ((x1 - x0) - n * w) : 0;
      const at = j => (dir > 0 ? x0 + off + (j + 0.5) * w : x1 - off - (j + 0.5) * w);
      r.cells.forEach((t, j) => Object.assign(t, { x: at(j), y, x0, x1 }));
      if (n > r.cells.length) spots4marks.push({ x: at(n - 1), y, unit: r.unit });
      const xs = r.cells.map(t => t.x).concat(n > r.cells.length ? [at(n - 1)] : []);
      const minX = Math.min(...xs), maxX = Math.max(...xs), side = Math.max(w / 2, 100);
      rowBoxes.push({ x0: Math.max(x0, minX - side), x1: Math.min(x1, maxX + side), top: y - ROW / 2, bot: y + ROW / 2, minX, maxX }); // (minX/maxX: where its stops are)
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
  // the landscape: the goal has its own strip of ground below the lowest row, and the lanes meet on it
  const goalTop = bottom + ROW / 2, CLIFF = small ? 24 : 32; // (CLIFF: as tall as shared/map-art.js draws the cliffs)
  const meet = art ? goalTop + 26 : bottom + ROW * 0.85 - 70;
  const goal = { x: W / 2, y: art ? meet + 76 : bottom + ROW * 0.85 };
  const H = art ? goal.y + 50 + CLIFF + 20 : goal.y + 110;
  map.style.height = H + 'px';

  // the road: square pixel corners, styled for the world. Along a row it runs straight; from one row to the next it goes
  // down below the name tags, across, then down. A stretch leading to a stop that isn't built yet is faded. The lanes meet just
  // above the goal. In the landscape the drop between rows is a ladder down the cliff, and the road only shows as far as the
  // stops that are open: clearing a quest draws the next stretch in.
  const look = MAP_LOOK[key] || MAP_LOOK.science;
  const jog = art ? (a, b) => Math.min(a.y + ROW / 2 + (small ? 18 : 24), b.y - HALF - 24) // just below the cliff, on the next terrace
    : (a, b) => Math.min(a.y + HALF + 84, b.y - HALF - 24); // below the stop's name tag (up to 3 lines), above the next row
  const corners = (a, b) => (a.y === b.y ? [a, b] : [a, { x: a.x, y: jog(a, b) }, { x: b.x, y: jog(a, b) }, b]);
  const toGoal = s => [s, { x: s.x, y: meet }, { x: goal.x, y: meet }, goal];
  const T = art ? MapArt.terrain(key, rowBoxes, { x0: pad, x1: W - pad, top: goalTop, bot: H - 16 }, W, H, small, rnd) : null;
  // which stops show in the landscape: the open ones (built, and the stop before is cleared). START always shows.
  stops.forEach(s => { s.vis = !art || ['done', 'going', 'new'].includes(s.st); });
  const seenAll = get('y3:mapSeen', {}), seen = seenAll[key];
  const visIds = stops.filter(s => s.vis && s.l.id).map(s => s.l.id);
  const fresh = new Set(art && seen && !reducedMotion() ? visIds.filter(id => !seen.includes(id)) : []); // newly opened since the last visit
  if (art) { seenAll[key] = [...new Set([...(seen || []), ...visIds])]; try { localStorage.setItem('y3:mapSeen', JSON.stringify(seenAll)); } catch (e) { /* ignore */ } }
  const allClear0 = stops.every(t => cleared(t));
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', W); svg.setAttribute('height', H);
  if (art) {
    const edges = [];
    roots.forEach(r => { if (r.vis) edges.push({ pts: corners(start, r), fresh: fresh.has(r.l.id) }); });
    stops.forEach(s => s.kids.forEach(c => { if (s.vis && c.vis) edges.push({ pts: corners(s, c), fresh: fresh.has(c.l.id) }); }));
    if (allClear0) leaves.forEach(s => edges.push({ pts: toGoal(s), fresh: false }));
    svg.innerHTML = MapArt.paths(edges, T, key, W, H);
  } else {
    const dOf = pts => ` M${pts[0].x} ${pts[0].y}` + pts.slice(1).map((p, i) => (p.x !== pts[i].x ? ` H${p.x}` : ` V${p.y}`)).join('');
    let built = '', todo = '';
    const edge = (pts, ok) => { if (ok) built += dOf(pts); else todo += dOf(pts); };
    roots.forEach(r => edge(corners(start, r), r.l.file));
    stops.forEach(s => s.kids.forEach(c => edge(corners(s, c), c.l.file)));
    leaves.forEach(s => edge(toGoal(s), s.l.file && stops.every(t => t.l.file)));
    svg.innerHTML = `<g fill="none" stroke-linejoin="miter" stroke-linecap="square" shape-rendering="crispEdges">
      ${todo ? `<g opacity=".45">${roadLayers(look.road, todo, `rail-todo-${key}`, W, H)}</g>` : ''}
      ${built ? roadLayers(look.road, built, `rail-${key}`, W, H) : ''}</g>`;
  }
  const ground = art ? document.createElement('canvas') : null; // the landscape is painted onto this once (after the scenery is placed)
  if (ground) { ground.className = 'qground'; map.append(ground); }
  map.append(svg);

  const put = (cls, x, y, text) => {
    const d = document.createElement('div');
    d.className = cls; d.style.left = x + 'px'; d.style.top = y + 'px'; d.textContent = text;
    map.append(d);
    return d;
  };
  // roadworks where a built stretch of road runs out: a little way along the road from the last built stop
  const along = (pts, d) => {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], len = Math.hypot(b.x - a.x, b.y - a.y);
      if (d <= len) return { x: a.x + (b.x - a.x) * d / len, y: a.y + (b.y - a.y) * d / len };
      d -= len;
    }
    return pts[pts.length - 1];
  };
  const works = [];
  if (!art && look.road !== 'flight') stops.forEach(s => s.kids.forEach(c => {
    if (!s.l.file || c.l.file) return;
    const pts = corners(s, c), len = pts.slice(1).reduce((n, p, i) => n + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0);
    const p = along(pts, Math.min(len / 2, HALF + 44));
    put('qdeco', p.x, p.y, '🚧'); works.push(p);
  }));

  // scenery keeps clear of the road, the stops (with their name tags and the hero's spot), the landmarks and people
  const boxes = [];
  const roadBox = pts => pts.slice(1).forEach((b, i) => { const a = pts[i]; boxes.push([Math.min(a.x, b.x) - 26, Math.min(a.y, b.y) - 26, Math.max(a.x, b.x) + 26, Math.max(a.y, b.y) + 26]); });
  roots.forEach(r => roadBox(corners(start, r))); // every stretch of road, even ones still hidden, so nothing grows on it
  stops.forEach(s => s.kids.forEach(c => roadBox(corners(s, c))));
  leaves.forEach(s => roadBox(toGoal(s)));
  [start, goal, ...stops].forEach(s => {
    if (s.vis === false) { boxes.push([s.x - 24, s.y - 24, s.x + 24, s.y + 24]); return; } // a hidden stop: just its dot, so scenery can grow round it
    boxes.push([s.x - 75, s.y - HALF - 8, s.x + 75, s.y + HALF + 58]); // the stop and its name tag
    boxes.push([s.x - 50, s.y - HALF - HERO_H, s.x + 50, s.y - HALF]); // where the hero stands on it (and its tag)
  });
  works.forEach(p => boxes.push([p.x - 22, p.y - 22, p.x + 22, p.y + 22]));
  const room = (x, y) => Math.min(x, W - x, y, H - y, ...boxes.map(([a, b, c, d]) => Math.hypot(Math.max(a - x, 0, x - c), Math.max(b - y, 0, y - d))));
  const spots = [];
  for (let y = 30; y < H - 20; y += 20) for (let x = 20; x < W - 10; x += 20) {
    const p = { x: x + (rnd() - 0.5) * 8, y: y + (rnd() - 0.5) * 8 };
    if (!art || T.land(p.x, p.y, 8, 6)) spots.push(p); // in the landscape: only on open grass
  }
  const nearest = (x, y) => stops.reduce((b, s) => (!b || Math.hypot(s.x - x, s.y - y) < Math.hypot(b.x - x, b.y - y) ? s : b), null);
  const items = [];

  // each topic's landmark: in its spot at the end of the topic's row, or else the roomiest spot near the topic's stops.
  // Tap it to see the topic's name and how much of it is cleared.
  const unitStops = s => { const run = [s]; for (let c = s; (c = c.kids.find(k => k.l.unit === s.l.unit));) run.push(c); return run; };
  stops.filter(s => !s.parent || s.parent.l.unit !== s.l.unit).forEach(s => {
    const run = unitStops(s), icon = LANDMARK[s.l.unit];
    if (!icon || run.every(t => t.st === 'soon') || !run.some(t => t.vis)) return; // (the landscape hides topics not reached yet)
    let best = spots4marks.find(m => m.unit === s.l.unit && m.x >= s.x0 && m.x <= s.x1 && m.y >= s.y && m.y <= run[run.length - 1].y
      && (!art || run.some(t => t.vis && t.y === m.y))); // (in the landscape: only on a row that is open)
    if (!best) {
      let br = 0;
      spots.forEach(p => {
        const lastY = (art ? run.filter(t => t.vis) : run).reduce((y, t) => Math.max(y, t.y), s.y); // (in the landscape: near the open stops)
        if (p.x < s.x0 || p.x > s.x1 || p.y < s.y - ROW / 2 || p.y > lastY + ROW / 2) return;
        const r = room(p.x, p.y); if (r > br) { br = r; best = p; }
      });
      if (br < (small ? 34 : 40)) return;
    }
    const ready = run.filter(t => t.l.file), n = ready.filter(cleared).length;
    items.push({ cls: 'qmark', x: best.x, y: best.y, icon, title: s.l.unit,
      card: () => openCard({ icon, tag: 'TOPIC', title: s.l.unit, stat: `${n} of ${ready.length} quest${ready.length === 1 ? '' : 's'} cleared here` + (run.length > ready.length ? `, and ${run.length - ready.length} more coming soon.` : '.') }) });
    boxes.push([best.x - 50, best.y - 50, best.x + 50, best.y + 40]);
  });

  // people by the road (shared/npcs.js): each one turns up once the stop they live by is cleared
  const npcAt = {}; // where each person by the road stands, and the stop they live by
  const clear = p => Math.min(room(p.x, p.y), room(p.x, p.y - 10 * S), room(p.x, p.y - 20 * S - 24)); // feet, middle and the marker over their head
  if (window.NPC && window.Avatar) NPC.forWorld(key).forEach(n => {
    const home = n.at ? stops.find(s => s.l.title === n.at) : null;
    if (n.at && !cleared(home)) return;
    const base = home || start;
    let best = null, br = -1;
    const stand = p => !art || T.land(p.x, p.y - 30, 12, 30); // in the landscape: all of them on the grass
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

  // then scenery in the open ground. In the landscape it is hills with eyes, trees, bushes and flowers on the terraces,
  // painted once onto the ground canvas (with the terraces), plus a butterfly or two; elsewhere little groups of emoji.
  if (art) {
    // a pond or two in the biggest open patches of grass
    for (let k = 0, ponds = small ? 1 : 2; k < spots.length && ponds > 0; k++) {
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
    items.forEach(it => { if (it.card) scenery.push({ kind: 'mountain', x: it.x, y: it.y + 34 }); }); // each topic's landmark is a mountain
    MapArt.live(map, MapArt.paint(ground, T, key, scenery, W, H, rnd), W, H, rnd, rivers.map(r => Object.assign({ bot: goalTop }, r)));
    for (let k = 0, n = 1 + Math.floor(rnd() * 2); k < n; k++) {
      const p = spots[Math.floor(rnd() * spots.length)];
      if (p && room(p.x, p.y) > 20) put('qdeco small qflutter', p.x, p.y - 20, '🦋').style.animationDelay = -(rnd() * 3).toFixed(1) + 's';
    }
  } else {
    const gkeys = Object.keys(look.groups), MIN = small ? 40 : 46;
    const order = spots.map(p => ({ p, r: room(p.x, p.y) + rnd() * 25 })).filter(o => o.r >= MIN).sort((a, b) => b.r - a.r);
    let groupsLeft = Math.round((W * H) / (small ? 90000 : 110000));
    for (const { p } of order) {
      if (groupsLeft <= 0) break;
      const r = room(p.x, p.y);
      if (r < MIN) continue;
      groupsLeft--;
      const unit = (nearest(p.x, p.y) || {}).l?.unit, pref = (look.units && look.units[unit]) || look.mix || gkeys; // mix: how often each group appears
      if (look.singles && rnd() < 0.3) { // a one-off piece: a fountain, a ship, a planet…
        items.push({ cls: 'qdeco big', x: p.x, y: p.y, icon: look.singles[Math.floor(rnd() * look.singles.length)] });
        boxes.push([p.x - 40, p.y - 40, p.x + 40, p.y + 40]);
        continue;
      }
      const pool = look.groups[pref[Math.floor(rnd() * pref.length)]] || look.groups[gkeys[0]];
      const spread = Math.min(r - 16, small ? 30 : 40), n = 2 + Math.floor(rnd() * (spread > 32 ? 4 : 3));
      for (let k = 0; k < n; k++) {
        const a = rnd() * Math.PI * 2, d = k ? spread * (0.45 + rnd() * 0.55) : 0;
        items.push({ cls: 'qdeco', x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * 0.7, icon: pool[Math.floor(rnd() * pool.length)], s: 0.8 + rnd() * 0.45 });
      }
      if (look.critters && rnd() < 0.35) items.push({ cls: 'qdeco small', x: p.x + spread + 6, y: p.y - spread * 0.5, icon: look.critters[Math.floor(rnd() * look.critters.length)] });
      boxes.push([p.x - spread - 26, p.y - spread - 22, p.x + spread + 26, p.y + spread + 22]);
    }
  }
  // back to front, so nearer things overlap the ones behind them
  items.sort((a, b) => a.y - b.y).forEach(it => {
    let d;
    if (it.card) { // a landmark: tap it for its topic
      d = document.createElement('button'); d.type = 'button'; d.className = it.cls + (art ? ' peak' : ''); d.style.left = it.x + 'px'; d.style.top = it.y + 'px';
      if (art) { const sign = document.createElement('span'); sign.className = 'qpk'; sign.textContent = it.icon; d.append(sign); } // a little sign on the mountain top
      else d.textContent = it.icon;
      d.setAttribute('aria-label', it.title); d.onclick = it.card; map.append(d);
    } else d = put(it.cls, it.x, it.y, it.icon);
    if (it.s) d.style.setProperty('--s', it.s);
    if (it.title) d.title = it.title;
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
  // the landscape's banner: what the hero is standing on (or what you pointed at)
  const showBanner = n => {
    if (!banner || !n) return;
    const rec = n.l ? records[n.l.id] || {} : {};
    const [icon, title, sub] = n === start ? ['🏡', 'START', (LIBRARY[key] || {}).label || '']
      : n === goal ? [goalIcon, goalName, `${nCleared} of ${builtStops.length} quests cleared`]
        : [n.l.emoji, n.l.title, `${n.l.unit} · ` + (n.st === 'done' ? `🏆 ${rec.best}/${rec.total}` : n.st === 'going' ? `⭐ ${rec.stars} gems so far` : 'NEW QUEST!')];
    banner.innerHTML = '<span class="qb-icon"></span><span class="qb-text"><b></b><small></small></span>';
    banner.querySelector('.qb-icon').textContent = icon;
    banner.querySelector('b').textContent = title;
    banner.querySelector('small').textContent = sub;
  };
  if (art) {
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
      if (!s.vis) return;
      const glow = s === going || (!going && s.st === 'new');
      const b = dot(s.st + (glow ? ' next' : '') + (fresh.has(s.l.id) ? ' fresh' : ''), s, s.l.emoji, s.l.title);
      if (s.st === 'done') { const st = document.createElement('span'); st.className = 'qstar'; st.textContent = '★'; b.append(st); }
      b.setAttribute('aria-label', `${s.l.title}: ${{ done: 'cleared', going: 'started', new: 'open' }[s.st]}`);
      b.onclick = () => { showBanner(s); goTo(s, () => questCard(s, glow)); };
    });
    const g = dot('goal' + (allClear ? ' clear' : ''), goal, goalIcon, allClear ? 'WORLD CLEAR!' : goalName);
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
  } else {
    const node = (tag, cls, p, icon, label, badge) => {
      const b = document.createElement(tag);
      b.className = 'qnode ' + cls; b.style.left = p.x + 'px'; b.style.top = p.y + 'px';
      if (tag === 'button') b.type = 'button';
      b.innerHTML = '<span class="qi"></span><span class="qlabel"></span>';
      b.querySelector('.qi').textContent = icon;
      b.querySelector('.qlabel').textContent = label;
      if (badge) { const s = document.createElement('span'); s.className = 'qbadge'; s.textContent = badge; b.append(s); }
      map.append(b);
      return b;
    };
    node('div', 'start', start, '🏁', 'START');
    stops.forEach(s => {
      const l = s.l, rec = records[l.id];
      const badge = s.st === 'done' ? `🏆 ${rec.best}/${rec.total}` : s.st === 'going' ? `⭐ ${rec.stars}` : s.st === 'soon' || s.st === 'locked' ? '🔒' : null;
      const glow = s === going || (!going && s.st === 'new');
      const b = node('button', s.st + (glow ? ' next' : ''), s, l.emoji, l.title, badge);
      b.setAttribute('aria-label', `${l.title}: ${{ done: 'cleared', going: 'started', new: 'open', locked: 'locked', soon: 'coming soon' }[s.st]}`);
      // an open stop: walk there first. Locked and unbuilt stops just show their card
      b.onclick = () => (['done', 'going', 'new'].includes(s.st) ? goTo(s, () => questCard(s, glow)) : questCard(s, glow));
    });
    node('button', 'end', goal, goalIcon, allClear ? 'WORLD CLEAR!' : goalName, allClear ? '👑' : null).onclick = goalCard;
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
      tag.style.left = x + 'px'; tag.style.top = y - lift - 20 * S - 4 + 'px';
    },
    // standing still: the "NEXT QUEST!" tag only shows on the stop it is about
    settle() { tag.hidden = !!this.npc || this.node !== at; mapHero.look(0); showBanner(this.node); },
  };
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
window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (mapWrap.firstChild && mapWrap.firstChild.clientWidth !== mapWidth) render(); }, 200); });
