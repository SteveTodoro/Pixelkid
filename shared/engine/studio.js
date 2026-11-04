/* Pixelkid lesson engine – Game Builder (Future Skills): a pretend game-building studio on the iPad, and Studio missions
 * the child does on the real computer. One part of shared/engine.js, which loads it only when a lesson uses it.
 * E is the engine's shared helpers (E.state and E.stageCard are live). See the top of shared/engine.js.
 *
 * studiosim  – a 3D (isometric) building viewport with the real tools: Select, Move (arrows), Scale (balls), Rotate
 *              (ring), camera keys (W A S D Q E F, drag to turn), Explorer, Properties, ▶ Play with gravity, a jump test
 *              for obbies and a tiny script panel. Missions are lists of things to do ("need" tokens) or a ghost to match.
 * studiotask – a Studio mission: steps to do on the computer, each checked by typing what Studio shows.
 */
PixelkidEngine.part('studio', E => {
  'use strict';
  const { GAMES, L, arcadeCanvas, award, confetti, emojiAt, fmt, gameLoop, h, holdButton, keys, missionRunner, pic, put, pxText, questionWidget, resultsTable, say, sfx, shake, store, toGame } = E;

  // bring studio.css along
  if (![...document.querySelectorAll('link[rel=stylesheet]')].some(l => /studio\.css$/.test(l.href))) {
    const here = [...document.scripts].map(s => s.src).find(s => /engine\/studio\.js/.test(s));
    if (here) document.head.append(h('link', { rel: 'stylesheet', href: new URL('../studio.css', here).href }));
  }

  // ---------- colours and materials (the names Studio uses) ----------
  const COLORS = {
    'Medium stone grey': '#a3a2a5', 'Bright red': '#c4281c', 'Bright orange': '#da8541', 'New Yeller': '#ffff00',
    'Lime green': '#00ff00', 'Dark green': '#287f47', 'Bright blue': '#0d69ac', 'Toothpaste': '#00ffff',
    'Hot pink': '#ff66cc', 'Bright violet': '#6b327c', 'Reddish brown': '#694028', 'Institutional white': '#f8f8f8', 'Really black': '#111111',
  };
  const colorHex = c => COLORS[c] || c || '#a3a2a5';
  const MATERIALS = ['Plastic', 'Wood', 'Brick', 'Grass', 'Glass', 'Neon', 'Ice', 'CrackedLava'];
  const MAT_LABEL = { CrackedLava: 'Cracked Lava' };
  const AXES = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
  const AX_COL = { x: '#ff3b30', y: '#34c759', z: '#2f80ff' }; // red X, green Y (up), blue Z, like Studio
  const D2R = Math.PI / 180;
  const round = (v, n = 1) => Math.round(v * n) / n;
  const num = v => { const r = Math.round(v * 100) / 100; return String(Object.is(r, -0) ? 0 : r); };
  const clone = o => JSON.parse(JSON.stringify(o));
  const mix = (hex, f) => { // darken (f < 1) or lighten (f > 1) a #rrggbb colour
    const p = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    return '#' + p.map(v => Math.max(0, Math.min(255, Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f))).toString(16).padStart(2, '0')).join('');
  };

  // ---------- part shapes: faces in local coordinates (each corner from -0.5 to 0.5 of the size) ----------
  const BLOCK = [
    [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]], // top
    [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], // +z (front)
    [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]], // -z (back)
    [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]], // +x
    [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]], // -x
  ];
  const BLOCK_FACE = ['top', '+z', '-z', '+x', '-x'];
  const WEDGE = [ // a ramp: high at the back (-z), low at the front (+z)
    [[-1, -1, 1], [1, -1, 1], [1, 1, -1], [-1, 1, -1]], // the slope
    [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]], // -z (back wall)
    [[1, -1, 1], [1, -1, -1], [1, 1, -1]], // +x side
    [[-1, -1, -1], [-1, -1, 1], [-1, 1, -1]], // -x side
  ];
  const WEDGE_FACE = ['slope', '-z', '+x', '-x'];

  // a new part, filled in with Studio's defaults: a 4 × 1 × 2 grey plastic block called "Part"
  const makePart = p => Object.assign({ name: 'Part', x: 0, y: 0.5, z: 0, sx: 4, sy: 1, sz: 2, rot: 0, color: 'Medium stone grey', material: 'Plastic', transparency: 0, anchored: false, shape: 'block' }, p);
  const SPAWN = { id: 'spawn', name: 'SpawnLocation', x: 0, y: 0.5, z: 0, sx: 6, sy: 1, sz: 6, color: 'Medium stone grey', anchored: true, spawn: true };

  function corners(p, face) {
    const c = Math.cos(p.rot * D2R), s = Math.sin(p.rot * D2R);
    return face.map(([a, b, d]) => {
      const lx = a * p.sx / 2, ly = b * p.sy / 2, lz = d * p.sz / 2;
      return [p.x + lx * c + lz * s, p.y + ly, p.z - lx * s + lz * c];
    });
  }
  const shapeOf = p => (p.shape === 'wedge' ? WEDGE : BLOCK);
  const faceNames = p => (p.shape === 'wedge' ? WEDGE_FACE : BLOCK_FACE);
  // footprint box on the ground (x and z), for gravity and the jump test
  function foot(p) {
    const pts = corners(p, BLOCK[0]);
    const xs = pts.map(q => q[0]), zs = pts.map(q => q[2]);
    return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
  }
  const overlap = (a, b, pad = 0) => a.x0 < b.x1 - pad && a.x1 > b.x0 + pad && a.z0 < b.z1 - pad && a.z1 > b.z0 + pad;
  const gapBetween = (a, b) => Math.hypot(Math.max(0, b.x0 - a.x1, a.x0 - b.x1), Math.max(0, b.z0 - a.z1, a.z0 - b.z1));
  const top = p => p.y + p.sy / 2, bottom = p => p.y - p.sy / 2;

  // ======================================================================================================
  // studiosim: the pretend studio
  // r.scene: { parts: [{ id, name, x, y, z, sx, sy, sz, rot, color, material, transparency, anchored, shape: 'block'|'wedge',
  //            sign: { text, face: '-z' } (writing on one side), goal: true (a 🏁 on top), spawn: true }], spawn: false }
  // r.tools: which buttons the toolbar shows (default: select, move, scale, rotate, part, play) – also 'camera', 'dup',
  //          'delete', 'undo', 'anchor', 'color', 'material', 'wedge'
  // r.panels: ['explorer', 'properties'] · r.edit: which properties can be changed ('color', 'material', 'transparency', 'anchored', 'name')
  // r.keys: true shows the camera keys (W A S D Q E F) · r.snap (studs, default 1) · r.rotSnap (degrees, default 15)
  // r.avatar: true puts a player on the SpawnLocation when ▶ Play runs; r.obby: true makes him hop along the platforms to the 🏁
  // r.code: { part, lines: ['lava.Touched…', 'humanoid.Health = {hp}'], slots: { hp: { options: ['100', '0'], kill: true }
  //          | { options, prop: 'transparency' | 'color' | 'material' | 'anchored' } | { options, spin: true } } }
  // r.missions: [{ text, need: [tokens], match: { part, to: { x, y, z, sx, sy, sz, rot }, tol }, ghost: { … }, tool, select,
  //               scene (start again from this scene), yes, ask }]
  // Tokens: insert · select:<id> · explore:<id> · tool:<name> · key:<w a s d q e f> · turn · zoom · focus:<id> · move:<id> ·
  //   scale:<id> · rotate:<id> · match · dup · delete · undo · play · stop · fell:<id> · stayed:<id> · goal · toofar · died ·
  //   prop:<id>:<prop>:<value> · code:<slot>:<value> · see:<id> (read the writing on its side) · rename:<name>
  // ======================================================================================================
  GAMES.studiosim = function (r, key, done) {
    const W = 720, H = 440;
    const { cv, ctx } = arcadeCanvas(W, H);
    const snap = r.snap || 1, rotSnap = r.rotSnap || 15;
    const toolList = r.tools || ['select', 'move', 'scale', 'rotate', 'part', 'play'];
    const panels = r.panels || [];
    const edit = r.edit || [];
    let parts = [], nextId = 1, selected = null, tool = toolList.includes('select') ? 'select' : (toolList.includes('camera') ? 'camera' : toolList[0]);
    let yaw = 0, zoom = 13, panX = 0, panY = 0, turned = 0;
    let did = new Set(), undo = [], playing = null, flash = 0, msg = '', msgT = 0, time = 0;
    const flying = {}; // camera keys being held
    const table = resultsTable(r.caption || '🎮 Our test runs', ['Run', 'What happened']);
    let runN = 0;
    let ghost = null, match = null, seen = new Set();
    const code = r.code ? { lines: r.code.lines, slots: Object.fromEntries(Object.entries(r.code.slots || {}).map(([k, s]) => [k, s.start != null ? s.start : s.options[0]])) } : null;

    function load(scene) {
      parts = (scene && scene.parts || []).map((p, k) => makePart(Object.assign({ id: p.id || 'p' + k }, p)));
      if (!(scene && scene.spawn === false) && !parts.some(p => p.spawn)) parts.unshift(makePart(clone(SPAWN)));
      nextId = parts.length + 1; selected = null; undo = [];
    }
    const byId = id => parts.find(p => p.id === id);
    const remember = () => { undo.push(clone(parts)); if (undo.length > 40) undo.shift(); };
    function token(t) {
      did.add(t);
      const m = missions.m;
      if (!m) return;
      if (match && !did.has('match') && matches()) did.add('match');
      const need = m.need || (m.match ? ['match'] : []);
      if (need.length && need.every(n => did.has(n))) { ghost = null; draw(); missions.win(cv); }
    }
    function matches() {
      const cands = match.part === 'any' ? parts.filter(p => !p.spawn) : [byId(match.part)].filter(Boolean);
      const tol = match.tol != null ? match.tol : 0.6;
      return cands.some(p => Object.entries(match.to).every(([k, v]) => {
        if (k === 'rot') { const d = (((p.rot - v) % 360) + 360) % 360; const sym = p.shape === 'wedge' ? 360 : 180; return Math.min(d % sym, sym - (d % sym)) < 1; }
        if (typeof v === 'string') return p[k] === v;
        if (typeof v === 'boolean') return p[k] === v;
        return Math.abs(p[k] - v) <= tol;
      }));
    }
    const note = (t, s = 2.2) => { msg = t; msgT = s; };

    // ---------- the camera: world → screen ----------
    function P(x, y, z) {
      const c = Math.cos(yaw * D2R), s = Math.sin(yaw * D2R);
      const rx = x * c - z * s, rz = x * s + z * c;
      return [W / 2 + panX + (rx - rz) * 0.866 * zoom, H * 0.58 + panY + (rx + rz) * 0.5 * zoom - y * zoom, rx + rz];
    }
    // screen → a point on the flat plane at height y
    function unP(sx, sy, y) {
      const a = (sx - W / 2 - panX) / (0.866 * zoom), b = (sy - H * 0.58 - panY + y * zoom) / (0.5 * zoom);
      const rx = (a + b) / 2, rz = (b - a) / 2;
      const c = Math.cos(yaw * D2R), s = Math.sin(yaw * D2R);
      return [rx * c + rz * s, -rx * s + rz * c];
    }
    // which way is the camera looking at a face? > 0 means we can see it
    function facing(pts) {
      const a = pts[0], b = pts[1], c = pts[2];
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const cy = Math.cos(yaw * D2R), sy = Math.sin(yaw * D2R);
      const nrx = n[0] * cy - n[2] * sy, nrz = n[0] * sy + n[2] * cy;
      const len = Math.hypot(...n) || 1;
      return { see: (nrx + nrz) / len * 0.7 + n[1] / len, light: n[1] / len > 0.5 ? 1 : 0.62 + 0.2 * (nrx - nrz) / len };
    }
    function poly(pts, fill, stroke, lw = 2) {
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
    }
    const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    function texture(sp, mat, base) { // the material's pattern, drawn across one face
      ctx.save(); ctx.beginPath(); sp.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.clip();
      const [a, b, c, d] = sp.length === 4 ? sp : [sp[0], sp[1], sp[2], sp[2]];
      ctx.lineWidth = 1.5;
      if (mat === 'Wood') { ctx.strokeStyle = mix(base, 0.7); for (let t = 0.2; t < 1; t += 0.2) { const p = lerp(a, d, t), q = lerp(b, c, t); ctx.beginPath(); ctx.moveTo(...p); ctx.lineTo(...q); ctx.stroke(); } }
      if (mat === 'Brick') {
        ctx.strokeStyle = mix(base, 1.5);
        for (let t = 0.25; t < 1; t += 0.25) { const p = lerp(a, d, t), q = lerp(b, c, t); ctx.beginPath(); ctx.moveTo(...p); ctx.lineTo(...q); ctx.stroke(); }
        for (let row = 0; row < 4; row++) for (let t = (row % 2 ? 0.17 : 0.33); t < 1; t += 0.33) {
          const p = lerp(lerp(a, d, row / 4), lerp(b, c, row / 4), t), q = lerp(lerp(a, d, (row + 1) / 4), lerp(b, c, (row + 1) / 4), t);
          ctx.beginPath(); ctx.moveTo(...p); ctx.lineTo(...q); ctx.stroke();
        }
      }
      if (mat === 'Grass') { ctx.fillStyle = mix(base, 0.7); for (let k = 0; k < 18; k++) { const u = (k * 0.618) % 1, v = (k * 0.381 + 0.1) % 1; const p = lerp(lerp(a, d, v), lerp(b, c, v), u); ctx.fillRect(p[0], p[1], 3, 3); } }
      if (mat === 'CrackedLava') { ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = 2; for (let k = 0; k < 3; k++) { const p = lerp(lerp(a, d, 0.2 + k * 0.3), lerp(b, c, 0.2 + k * 0.3), 0.1), q = lerp(lerp(a, d, 0.35 + k * 0.25), lerp(b, c, 0.35 + k * 0.25), 0.9); ctx.beginPath(); ctx.moveTo(...p); ctx.lineTo((p[0] + q[0]) / 2 + 6, (p[1] + q[1]) / 2 - 4); ctx.lineTo(...q); ctx.stroke(); } }
      if (mat === 'Ice') { ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; const p = lerp(a, c, 0.25), q = lerp(a, c, 0.5); ctx.beginPath(); ctx.moveTo(...p); ctx.lineTo(...q); ctx.stroke(); }
      if (mat === 'Glass') { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3; const p = lerp(a, c, 0.15), q = lerp(a, c, 0.4); ctx.beginPath(); ctx.moveTo(...p); ctx.lineTo(...q); ctx.stroke(); }
      ctx.restore();
    }
    function drawPart(p, opts = {}) {
      const faces = shapeOf(p), names = faceNames(p);
      let base = colorHex(p.color);
      if (p.material === 'CrackedLava') base = p.color === 'Medium stone grey' ? '#c4281c' : base;
      const alpha = p.material === 'Glass' ? Math.max(0.35, 1 - Math.max(p.transparency, 0.4)) : 1 - p.transparency * 0.85;
      ctx.save(); ctx.globalAlpha = opts.ghost ? 0.35 : alpha;
      if (p.material === 'Neon') { ctx.shadowColor = base; ctx.shadowBlur = 16; }
      faces.forEach((f, k) => {
        const w = corners(p, f), F = facing(w);
        if (F.see <= 0.02) return;
        const sp = w.map(q => P(...q));
        poly(sp, opts.ghost ? '#ffffff' : (p.material === 'Neon' ? mix(base, 1.25) : mix(base, F.light)), opts.ghost ? '#ffd43b' : '#000', opts.ghost ? 3 : 2);
        if (!opts.ghost && p.material && p.material !== 'Plastic' && p.material !== 'Neon') texture(sp, p.material, mix(base, F.light));
        if (p.sign && names[k] === p.sign.face) {
          seen.add(p.id);
          const cx = sp.reduce((s, q) => s + q[0], 0) / sp.length, cy = sp.reduce((s, q) => s + q[1], 0) / sp.length;
          ctx.globalAlpha = 1; ctx.shadowBlur = 0;
          ctx.font = `700 ${Math.max(12, zoom * 1.1)}px Lexend, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 4; ctx.strokeText(p.sign.text, cx, cy); ctx.fillText(p.sign.text, cx, cy);
          ctx.globalAlpha = alpha;
        }
      });
      if (p.spawn) { const c = P(p.x, top(p) + 0.05, p.z); ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.fillStyle = '#1b1b1b'; ctx.beginPath(); ctx.ellipse(c[0], c[1], zoom * 1.6, zoom * 0.9, 0, 0, Math.PI * 2); ctx.fill(); emojiAt(ctx, '⭐', c[0], c[1] + 7, Math.max(14, zoom * 1.4)); }
      if (p.goal) { const c = P(p.x, top(p), p.z); ctx.globalAlpha = 1; ctx.shadowBlur = 0; emojiAt(ctx, '🏁', c[0], c[1] - 8, Math.max(20, zoom * 2.4)); }
      ctx.restore();
      if (selected === p.id && !playing) { // a blue selection box, like Studio
        ctx.save(); ctx.globalAlpha = 0.9;
        BLOCK.forEach(f => { const w = corners(p, f); poly(w.map(q => P(...q)), null, '#38b6ff', 2); });
        ctx.restore();
      }
    }
    // draw order: things resting on another part go after it; otherwise furthest first
    function order(list) {
      return list.slice().sort((a, b) => {
        const fa = foot(a), fb = foot(b);
        if (overlap(fa, fb, 0.05)) { if (bottom(a) >= top(b) - 0.05) return 1; if (bottom(b) >= top(a) - 0.05) return -1; }
        return (P(a.x, 0, a.z)[2] + a.y * 0.01) - (P(b.x, 0, b.z)[2] + b.y * 0.01);
      });
    }
    function drawGround() {
      const S = 26;
      const g = [[-S, 0, -S], [S, 0, -S], [S, 0, S], [-S, 0, S]].map(q => P(...q));
      poly(g, '#5a9e3a', '#000', 3);
      ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1;
      for (let k = -S; k <= S; k += 4) {
        let a = P(k, 0, -S), b = P(k, 0, S); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        a = P(-S, 0, k); b = P(S, 0, k); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      // a little axis compass in the corner: red X, green Y, blue Z
      const o = [56, H - 46];
      const c = Math.cos(yaw * D2R), s = Math.sin(yaw * D2R);
      [['x', [1, 0, 0]], ['z', [0, 0, 1]], ['y', [0, 1, 0]]].forEach(([n, [x, y, z]]) => {
        const rx = x * c - z * s, rz = x * s + z * c, d = [(rx - rz) * 0.866 * 26, (rx + rz) * 0.5 * 26 - y * 26];
        ctx.strokeStyle = AX_COL[n]; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(...o); ctx.lineTo(o[0] + d[0], o[1] + d[1]); ctx.stroke();
        pxText(ctx, n.toUpperCase(), o[0] + d[0] * 1.35, o[1] + d[1] * 1.35, 13, AX_COL[n]);
      });
    }

    // ---------- the tool handles ----------
    function handles() {
      const p = byId(selected);
      if (!p || playing) return [];
      const out = [], c = [p.x, p.y, p.z];
      if (tool === 'move') ['x', 'y', 'z'].forEach(ax => [1, -1].forEach(sg => {
        const a = AXES[ax], ext = Math.abs(a[0]) * (foot(p).x1 - foot(p).x0) / 2 + a[1] * p.sy / 2 + Math.abs(a[2]) * (foot(p).z1 - foot(p).z0) / 2;
        const from = c.map((v, i) => v + a[i] * sg * (ext + 0.4)), to = c.map((v, i) => v + a[i] * sg * (ext + 0.4 + Math.max(2.2, 34 / zoom)));
        out.push({ kind: 'move', ax, sg, from: P(...from), at: P(...to), col: AX_COL[ax] });
      }));
      if (tool === 'scale') {
        const cr = Math.cos(p.rot * D2R), sr = Math.sin(p.rot * D2R);
        const local = { x: [cr, 0, -sr], y: [0, 1, 0], z: [sr, 0, cr] }, half = { x: p.sx / 2, y: p.sy / 2, z: p.sz / 2 };
        ['x', 'y', 'z'].forEach(ax => [1, -1].forEach(sg => {
          const a = local[ax], at = c.map((v, i) => v + a[i] * sg * (half[ax] + 0.9));
          out.push({ kind: 'scale', ax, sg, dir: a, at: P(...at), col: AX_COL[ax] });
        }));
      }
      if (tool === 'rotate') {
        const R = Math.max(p.sx, p.sz) * 0.75 + 1.5;
        const pts = []; for (let k = 0; k <= 48; k++) { const a = k / 48 * Math.PI * 2; pts.push(P(p.x + Math.cos(a) * R, p.y, p.z + Math.sin(a) * R)); }
        out.push({ kind: 'rotate', ax: 'y', ring: pts, at: pts[6], col: AX_COL.y, R });
      }
      return out;
    }
    function drawHandles() {
      handles().forEach(hd => {
        ctx.lineCap = 'round';
        if (hd.kind === 'move') {
          ctx.strokeStyle = '#000'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(...hd.from); ctx.lineTo(...hd.at); ctx.stroke();
          ctx.strokeStyle = hd.col; ctx.lineWidth = 5; ctx.stroke();
          const ang = Math.atan2(hd.at[1] - hd.from[1], hd.at[0] - hd.from[0]);
          ctx.save(); ctx.translate(...hd.at); ctx.rotate(ang);
          poly([[12, 0], [-6, -10], [-6, 10]], hd.col, '#000', 2.5); ctx.restore();
        }
        if (hd.kind === 'scale') { ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(...hd.at, 11, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = hd.col; ctx.beginPath(); ctx.arc(...hd.at, 8, 0, Math.PI * 2); ctx.fill(); }
        if (hd.kind === 'rotate') {
          ctx.strokeStyle = '#000'; ctx.lineWidth = 8; ctx.beginPath(); hd.ring.forEach((q, i) => (i ? ctx.lineTo(...q) : ctx.moveTo(...q))); ctx.stroke();
          ctx.strokeStyle = hd.col; ctx.lineWidth = 4.5; ctx.stroke();
          ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(...hd.at, 12, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = hd.col; ctx.beginPath(); ctx.arc(...hd.at, 9, 0, Math.PI * 2); ctx.fill();
        }
      });
      if (drag && drag.kind === 'rotate') { const p = byId(selected); if (p) { const c = P(p.x, top(p) + 2, p.z); pxText(ctx, `${num(((p.rot % 360) + 360) % 360)}°`, c[0], c[1] - 10, 18, '#ffd43b'); } }
      if (drag && (drag.kind === 'move' || drag.kind === 'scale')) {
        const p = byId(selected);
        if (p) { const c = P(p.x, top(p) + 1.5, p.z); pxText(ctx, drag.kind === 'move' ? `moved ${num(drag.moved)} studs` : `${drag.ax.toUpperCase()} size ${num({ x: p.sx, y: p.sy, z: p.sz }[drag.ax])}`, c[0], c[1] - 10, 16, '#ffd43b'); }
      }
    }

    // ---------- the player (for ▶ Play) ----------
    function drawAvatar(a) {
      if (!a) return;
      const b = P(a.x, a.y, a.z), u = zoom;
      ctx.save(); if (a.dead) ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#000';
      const R = (x, y, w, hh, col) => { ctx.fillStyle = '#000'; ctx.fillRect(b[0] + x * u - 1, b[1] - y * u - 1, w * u + 2, hh * u + 2); ctx.fillStyle = col; ctx.fillRect(b[0] + x * u, b[1] - y * u, w * u, hh * u); };
      R(-0.9, 2, 0.8, 2, '#2f6fd6'); R(0.1, 2, 0.8, 2, '#2f6fd6'); // legs
      R(-0.9, 4, 1.8, 2, a.dead ? '#888' : '#ff8a3d'); // body
      R(-0.6, 5.2, 1.2, 1.2, '#ffd9a8'); // head
      ctx.restore();
    }

    // ---------- drawing everything ----------
    function draw() {
      const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#7ec8ff'); sky.addColorStop(1, '#cfeaff');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      drawGround();
      // shadows on the ground under raised parts, so you can see how high they float
      parts.forEach(p => { if (bottom(p) > 0.3) poly(corners(p, BLOCK[0]).map(([x, , z]) => P(x, 0, z)), `rgba(0,0,0,${Math.max(0.12, 0.35 - bottom(p) * 0.012)})`); });
      const list = order(parts);
      if (ghost) { const g = makePart(Object.assign({}, ghost)); drawPart(g, { ghost: true }); }
      list.forEach(q => {
        drawPart(q);
        // shadows of raised parts falling on this part's top
        const above = parts.filter(r => r !== q && bottom(r) > top(q) + 0.3 && overlap(foot(r), foot(q)));
        if (!above.length) return;
        ctx.save(); ctx.beginPath(); corners(q, BLOCK[0]).map(c => P(...c)).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.clip();
        above.forEach(r => poly(corners(r, BLOCK[0]).map(([x, , z]) => P(x, top(q), z)), 'rgba(0,0,0,.28)'));
        ctx.restore();
      });
      if (playing) drawAvatar(playing.av);
      drawHandles();
      // the top bar: mode and tool
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, 30);
      pxText(ctx, playing ? '▶ PLAYING – press ■ Stop to go back to building' : `EDIT MODE · tool: ${tool.toUpperCase()}`, 12, 16, 15, playing ? '#7cfc3a' : '#fff', 'left');
      if (msgT > 0) { ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillRect(W / 2 - 250, H - 64, 500, 40); pxText(ctx, msg, W / 2, H - 44, 17, '#ffd43b'); }
      if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash})`; ctx.fillRect(0, 0, W, H); }
    }

    // ---------- fingers on the viewport ----------
    let drag = null;
    function hitPart(x, y) {
      const list = order(parts).reverse();
      for (const p of list) for (const f of shapeOf(p)) {
        const w = corners(p, f); if (facing(w).see <= 0.02) continue;
        const sp = w.map(q => P(...q)); ctx.beginPath(); sp.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.closePath();
        if (ctx.isPointInPath(x * (cv.width / W), y * (cv.height / H))) return p;
      }
      return null;
    }
    cv.addEventListener('pointerdown', e => {
      e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      const [x, y] = toGame(cv, W, H, e);
      down(x, y);
    });
    cv.addEventListener('pointermove', e => { if (drag) { const [x, y] = toGame(cv, W, H, e); moveTo(x, y); } });
    const up = () => { if (drag) end(); };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('wheel', e => { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1); }, { passive: false });

    function down(x, y) {
      if (playing) return;
      const hd = handles().find(q => Math.hypot(q.at[0] - x, q.at[1] - y) < 26 || (q.ring && q.ring.some(pt => Math.hypot(pt[0] - x, pt[1] - y) < 14)));
      const p = byId(selected);
      if (hd && p) {
        remember();
        drag = { kind: hd.kind, ax: hd.ax, sg: hd.sg, dir: hd.dir, sx: x, sy: y, start: clone(p), moved: 0, ang0: angleAt(p, x, y) };
        sfx.tap(); return;
      }
      const hit = tool === 'camera' ? null : hitPart(x, y);
      if (hit) {
        if (selected !== hit.id) { selected = hit.id; sfx.tap(); token('select:' + hit.id); sync(); }
        if (tool === 'select' && !hit.spawn) { remember(); const g = unP(x, y, hit.y); drag = { kind: 'slide', sx: x, sy: y, g0: g, start: clone(hit), moved: 0 }; }
        draw(); return;
      }
      if (tool !== 'camera' && selected) { selected = null; sync(); }
      drag = { kind: 'turn', sx: x, sy: y, yaw0: yaw };
    }
    function angleAt(p, x, y) { const g = unP(x, y, p.y); return Math.atan2(g[1] - p.z, g[0] - p.x) / D2R; }
    function moveTo(x, y) {
      const p = byId(selected);
      if (drag.kind === 'turn') { const d = (x - drag.sx) * 0.5; turned += Math.abs(yaw - (drag.yaw0 + d)); yaw = drag.yaw0 + d; if (turned > 150 && !did.has('turn')) token('turn'); return; }
      if (!p) return;
      const s0 = drag.start;
      if (drag.kind === 'slide') {
        const g = unP(x, y, s0.y);
        const dx = Math.round((g[0] - drag.g0[0]) / snap) * snap, dz = Math.round((g[1] - drag.g0[1]) / snap) * snap;
        p.x = s0.x + dx; p.z = s0.z + dz; drag.moved = Math.hypot(dx, dz);
      }
      if (drag.kind === 'move') {
        const a = AXES[drag.ax], o = P(s0.x, s0.y, s0.z), q = P(s0.x + a[0], s0.y + a[1], s0.z + a[2]);
        const v = [q[0] - o[0], q[1] - o[1]], len2 = v[0] * v[0] + v[1] * v[1] || 1;
        let st = ((x - drag.sx) * v[0] + (y - drag.sy) * v[1]) / len2;
        st = Math.round(st / snap) * snap;
        p.x = s0.x + a[0] * st; p.y = s0.y + a[1] * st; p.z = s0.z + a[2] * st; drag.moved = Math.abs(st);
      }
      if (drag.kind === 'scale') {
        const a = drag.dir, o = P(s0.x, s0.y, s0.z), q = P(s0.x + a[0] * drag.sg, s0.y + a[1] * drag.sg, s0.z + a[2] * drag.sg);
        const v = [q[0] - o[0], q[1] - o[1]], len2 = v[0] * v[0] + v[1] * v[1] || 1;
        let st = ((x - drag.sx) * v[0] + (y - drag.sy) * v[1]) / len2;
        const k = 's' + drag.ax;
        st = Math.round(st / snap) * snap;
        st = Math.max(1 - s0[k], Math.min(40 - s0[k], st));
        p[k] = s0[k] + st;
        p.x = s0.x + a[0] * drag.sg * st / 2; p.y = s0.y + a[1] * drag.sg * st / 2; p.z = s0.z + a[2] * drag.sg * st / 2;
      }
      if (drag.kind === 'rotate') {
        let d = angleAt(s0, x, y) - drag.ang0;
        d = ((d + 540) % 360) - 180;
        p.rot = s0.rot - Math.round(d / rotSnap) * rotSnap;
      }
      sync(); draw();
    }
    function end() {
      const d = drag; drag = null;
      const p = byId(selected);
      if (d.kind === 'turn') return;
      if (p && d.start) {
        const same = ['x', 'y', 'z', 'sx', 'sy', 'sz', 'rot'].every(k => Math.abs(p[k] - d.start[k]) < 1e-6);
        if (same) { undo.pop(); return; }
        sfx.tap();
        token((d.kind === 'slide' ? 'move' : d.kind) + ':' + p.id);
        if (d.kind === 'rotate') p.rot = ((p.rot % 360) + 360) % 360;
      }
      sync(); draw();
    }

    // ---------- camera keys ----------
    function zoomBy(f) { zoom = Math.max(5, Math.min(34, zoom * f)); token('zoom'); draw(); }
    function camKey(k, dt) {
      const sp = 260 * dt;
      if (k === 'w') zoom = Math.min(34, zoom * (1 + 1.2 * dt));
      if (k === 's') zoom = Math.max(5, zoom / (1 + 1.2 * dt));
      if (k === 'a') panX += sp; if (k === 'd') panX -= sp;
      if (k === 'e') panY += sp; if (k === 'q') panY -= sp;
    }
    function focus() {
      const p = byId(selected);
      if (!p) { note('Select a part first, then press F!'); sfx.bad && sfx.bad(); return; }
      zoom = Math.max(10, Math.min(30, 120 / Math.max(p.sx, p.sy, p.sz, 4)));
      const c = P(p.x, p.y, p.z); panX += W / 2 - c[0]; panY += H * 0.55 - c[1];
      token('key:f'); token('focus:' + p.id); sfx.good(); draw();
    }
    const camKeys = r.keys ? ['q', 'w', 'e', 'a', 's', 'd'].map(k => holdButton(k.toUpperCase(), 'st-key', () => { flying[k] = true; sfx.tap(); }, () => { if (flying[k]) { flying[k] = false; token('key:' + k); } })) : [];
    const fKey = r.keys ? h('button', { class: 'arc-btn st-key st-key-f', type: 'button', onclick() { focus(); } }, 'F') : null;

    // ---------- toolbar ----------
    const TOOLS = {
      select: ['↖', 'Select', '1'], move: ['✥', 'Move', '2'], scale: ['⤢', 'Scale', '3'], rotate: ['⟳', 'Rotate', '4'], camera: ['🎥', 'Camera'],
    };
    const toolBtns = {};
    Object.keys(TOOLS).filter(t => toolList.includes(t)).forEach(t => {
      const [ic, label, kk] = TOOLS[t];
      toolBtns[t] = h('button', { class: 'st-tool', type: 'button', onclick() { setTool(t); } }, h('span', { class: 'st-ic' }, ic), h('span', null, label), kk && h('kbd', null, kk));
    });
    function setTool(t) { tool = t; sfx.tap(); token('tool:' + t); sync(); draw(); }
    const actions = [];
    const act = (id, label, fn, cls = '') => { if (toolList.includes(id)) actions.push(h('button', { class: 'st-tool ' + cls, type: 'button', 'data-act': id, onclick: fn }, label)); };
    act('part', '🧱 Part', () => insert('block'));
    act('wedge', '📐 Wedge', () => insert('wedge'));
    act('dup', h('span', null, '⧉ Duplicate ', h('kbd', null, '⌘D')), () => duplicate());
    act('delete', '🗑️ Delete', () => del());
    act('undo', h('span', null, '↶ Undo ', h('kbd', null, '⌘Z')), () => doUndo());
    act('anchor', '⚓ Anchor', () => { const p = byId(selected); if (!p) return note('Select a part first!'); setProp(p, 'anchored', !p.anchored); });
    const playBtn = toolList.includes('play') ? h('button', { class: 'st-tool st-play', type: 'button', onclick() { playing ? stop() : play(); } }, '▶ Play') : null;

    function insert(shape) {
      if (playing) return;
      remember();
      const id = 'part' + nextId++;
      const at = unP(W / 2, H * 0.5, 0);
      const p = makePart({ id, shape, x: Math.round(at[0]), z: Math.round(at[1]), sz: shape === 'wedge' ? 4 : 2, sy: shape === 'wedge' ? 2 : 1, y: shape === 'wedge' ? 1 : 0.5, name: shape === 'wedge' ? 'Wedge' : 'Part' });
      // land it on top of whatever is there (Studio drops a new part where you look)
      const under = parts.filter(q => overlap(foot(q), foot(p), 0.05)).reduce((m, q) => Math.max(m, top(q)), 0);
      p.y = under + p.sy / 2;
      parts.push(p); selected = id; sfx.good();
      token('insert'); sync(); draw();
    }
    function duplicate() {
      const p = byId(selected);
      if (!p || p.spawn) return note('Select a part first, then Duplicate!');
      remember();
      const q = Object.assign(clone(p), { id: 'part' + nextId++ });
      parts.push(q); selected = q.id; sfx.good();
      note('A copy! It sits right on top of the first one – move it to see both.', 3);
      token('dup'); sync(); draw();
    }
    function del() {
      const p = byId(selected);
      if (!p || p.spawn) return note('Select a part first!');
      remember(); parts = parts.filter(q => q !== p); selected = null; sfx.tap();
      token('delete'); sync(); draw();
    }
    function doUndo() {
      if (!undo.length) return note('Nothing to undo.');
      parts = undo.pop(); if (!byId(selected)) selected = null; sfx.tap();
      token('undo'); sync(); draw();
    }
    function setProp(p, k, v) {
      if (playing) return;
      remember(); p[k] = v; sfx.tap();
      token(`prop:${p.id}:${k}:${v}`); sync(); draw();
    }

    // ---------- ▶ Play: gravity, the player, and the scripts ----------
    function play() {
      if (playing) return;
      const saved = clone(parts);
      const start0 = Object.fromEntries(parts.map(p => [p.id, p.y]));
      playing = { saved, start0, t: 0, av: null, path: null, seg: 0, segT: 0, done: false, hp: 100, result: null, kill: new Set(), spin: {} };
      selected = null;
      // run the script: each slot's value does something
      if (code) {
        Object.entries(r.code.slots || {}).forEach(([k, s]) => {
          const v = code.slots[k], p = byId(s.part || r.code.part);
          token(`code:${k}:${v}`);
          if (!p) return;
          if (s.kill && Number(v) <= 0) playing.kill.add(p.id);
          if (s.spin) playing.spin[p.id] = Number(v) || 0;
          if (s.prop === 'transparency') p.transparency = Number(v);
          if (s.prop === 'anchored') p.anchored = v === 'true';
          if (s.prop === 'color') p.color = v.replace(/^"|"$/g, '');
          if (s.prop === 'material') p.material = v.replace(/^Enum\.Material\./, '');
        });
      }
      if (r.avatar) {
        const sp = parts.find(p => p.spawn) || makePart(SPAWN);
        playing.av = { x: sp.x, y: top(sp), z: sp.z };
        playing.path = r.obby ? obbyPath() : walkPath();
      }
      flash = 0.6; sfx.good(); token('play'); sync();
      if (playBtn) playBtn.textContent = '■ Stop';
    }
    function stop() {
      if (!playing) return;
      parts = playing.saved; // like Studio: what happened while playing is put back
      playing = null; sfx.tap(); token('stop'); sync(); draw();
      if (playBtn) playBtn.textContent = '▶ Play';
    }
    function supportUnder(p, list) {
      const f = foot(p);
      return list.filter(q => q !== p && overlap(foot(q), f, 0.05) && top(q) <= bottom(p) + 0.05).reduce((m, q) => Math.max(m, top(q)), 0);
    }
    function physics(dt) {
      const list = parts.slice().sort((a, b) => bottom(a) - bottom(b));
      list.forEach(p => {
        if (playing.spin[p.id]) p.rot = (p.rot + playing.spin[p.id] * 60 * dt) % 360;
        if (p.anchored || p.spawn) return;
        const floor = supportUnder(p, list);
        p.vy = (p.vy || 0) - 90 * dt;
        p.y += p.vy * dt;
        if (bottom(p) <= floor) { p.y = floor + p.sy / 2; p.vy = 0; }
      });
    }
    // the obby run: from the spawn, hop from platform to platform towards the 🏁 (the nearest platform each time)
    const JUMP_UP = 7, JUMP_ACROSS = 8; // about what a default Roblox player can do
    function obbyPath() {
      const spawn = parts.find(p => p.spawn), goal = parts.find(p => p.goal);
      const plats = parts.filter(p => !p.spawn && !p.goal && p.material !== 'CrackedLava' && !p.floor); // never hop onto lava
      const chain = [spawn]; let cur = spawn, guard = 0;
      while (goal && cur !== goal && guard++ < 40) {
        const toGoal = q => Math.hypot(goal.x - q.x, goal.z - q.z);
        const next = [goal, ...plats].filter(q => !chain.includes(q) && toGoal(q) < toGoal(cur) - 0.5)
          .sort((a, b) => gapBetween(foot(cur), foot(a)) - gapBetween(foot(cur), foot(b)) || toGoal(a) - toGoal(b))[0];
        if (!next) break;
        chain.push(next); cur = next;
      }
      return chain.map((p, k) => ({ p, gap: k ? gapBetween(foot(chain[k - 1]), foot(p)) : 0, rise: k ? top(p) - top(chain[k - 1]) : 0 }));
    }
    function walkPath() { // a straight walk from the spawn to the 🏁 (or 20 studs ahead)
      const spawn = parts.find(p => p.spawn), goal = parts.find(p => p.goal);
      return [{ p: spawn }, { p: goal || makePart({ x: spawn.x + 20, z: spawn.z, y: 0.5, sx: 2, sz: 2, sy: 1 }), walk: true }];
    }
    function standingOn(x, z, y) { // the highest part top under a point that isn't above the player
      const pt = { x0: x - 0.6, x1: x + 0.6, z0: z - 0.6, z1: z + 0.6 };
      return parts.filter(q => overlap(foot(q), pt) && top(q) <= y + 1.6).sort((a, b) => top(b) - top(a))[0] || null; // a player steps up small ledges
    }
    function avatarStep(dt) {
      const pl = playing, a = pl.av;
      if (!a || pl.done || !pl.path || pl.path.length < 2) return;
      const k = pl.seg + 1;
      if (k >= pl.path.length) return finishRun(parts.find(p => p.goal) ? 'goal' : 'end');
      const A = pl.path[pl.seg].p, B = pl.path[k], bp = B.p;
      if (B.walk) { // walk along the ground and over parts
        const dx = bp.x - a.x, dz = bp.z - a.z, d = Math.hypot(dx, dz);
        if (d < 0.5) return finishRun(bp.goal ? 'goal' : 'end');
        a.x += dx / d * 12 * dt; a.z += dz / d * 12 * dt;
        const on = standingOn(a.x, a.z, a.y);
        const want = on ? top(on) : 0;
        a.y = want > a.y ? Math.min(want, a.y + 1.2) : Math.max(want, a.y - 20 * dt);
        if (on && pl.kill.has(on.id)) return die(`💀 Touched ${on.name}: Health = 0!`);
        return;
      }
      if (B.gap > JUMP_ACROSS - Math.max(0, B.rise) * 0.5 || B.rise > JUMP_UP) { // too far: jump and fall
        pl.segT += dt;
        const t = Math.min(1, pl.segT / 0.8);
        a.x = A.x + (bp.x - A.x) * t * 0.55; a.z = A.z + (bp.z - A.z) * t * 0.55;
        a.y = top(A) + Math.sin(Math.min(t, 0.5) * Math.PI) * 3 - Math.max(0, t - 0.5) * 18;
        if (t >= 1) return die(B.rise > JUMP_UP ? `Too high! That jump goes up ${num(B.rise)} studs.` : `Too far! That gap is ${num(B.gap)} studs.`, 'toofar');
        return;
      }
      pl.segT += dt;
      const t = Math.min(1, pl.segT / 0.7);
      a.x = A.x + (bp.x - A.x) * t; a.z = A.z + (bp.z - A.z) * t;
      a.y = top(A) + (top(bp) - top(A)) * t + Math.sin(t * Math.PI) * (3 + Math.max(0, B.rise));
      if (t >= 1) {
        a.y = top(bp); pl.seg = k; pl.segT = 0; sfx.tap();
        if (pl.kill.has(bp.id) || bp.material === 'CrackedLava' && r.lavaKills) return die(`💀 Landed on ${bp.name}!`);
      }
    }
    function die(text, tok) {
      const pl = playing; pl.done = true; pl.av.dead = true;
      sfx.bad && sfx.bad(); note(text, 3.5);
      record(text); token('died'); if (tok) token(tok);
    }
    function finishRun(how) {
      const pl = playing; pl.done = true;
      if (how === 'goal') { sfx.win(); confetti(40); note('🏁 Made it to the finish!', 3); record('🏁 Reached the finish'); token('goal'); }
      else { note('Made it across safely!', 3); record('Walked across safely'); token('safe'); }
    }
    function record(what) { runN++; table.add([runN, what]); }
    function settled() { // after a second of Play, which parts fell and which stayed put
      const pl = playing;
      parts.forEach(p => {
        if (p.spawn) return;
        if (pl.start0[p.id] - p.y > 0.4) { if (!did.has('fell:' + p.id)) { record(`${p.name} fell down (not anchored)`); token('fell:' + p.id); } }
        else token('stayed:' + p.id);
      });
    }

    function step(dt) {
      time += dt;
      seen.forEach(id => { if (!did.has('see:' + id)) token('see:' + id); }); // he read the writing on a part's side
      let moved = false;
      Object.keys(flying).forEach(k => { if (flying[k]) { camKey(k, dt); moved = true; } });
      if (moved) did.add('fly');
      if (playing) {
        playing.t += dt;
        physics(dt);
        if (playing.t > 1 && !playing.checked) { playing.checked = true; settled(); }
        if (playing.t > 0.4) avatarStep(dt);
      }
      flash = Math.max(0, flash - dt * 2); msgT = Math.max(0, msgT - dt);
      draw();
    }

    // ---------- Explorer and Properties (HTML panels beside the viewport) ----------
    const explorer = h('div', { class: 'st-panel st-explorer' });
    const props = h('div', { class: 'st-panel st-props' });
    function drawExplorer() {
      put(explorer, h('div', { class: 'st-panel-title' }, 'Explorer'),
        h('div', { class: 'st-tree' },
          h('div', { class: 'st-row st-root' }, '🌍 Workspace'),
          h('div', { class: 'st-row st-kid st-dim' }, '🎥 Camera'),
          h('div', { class: 'st-row st-kid st-dim' }, '⬜ Baseplate'),
          parts.map(p => [h('button', {
            class: 'st-row st-kid' + (selected === p.id ? ' on' : ''), type: 'button',
            onclick() { if (playing) return; selected = p.id; sfx.tap(); token('explore:' + p.id); token('select:' + p.id); sync(); draw(); },
          }, (p.spawn ? '⭐ ' : '🧱 ') + p.name), p.script && h('div', { class: 'st-row st-kid2' }, '📜 Script')])));
    }
    function drawProps() {
      const p = byId(selected);
      if (!p) { put(props, h('div', { class: 'st-panel-title' }, 'Properties'), h('p', { class: 'st-empty' }, 'Select a part to see its properties.')); return; }
      const can = k => edit.includes(k) && !playing;
      const row = (k, v) => h('div', { class: 'st-prop' }, h('span', { class: 'st-pk' }, k), h('span', { class: 'st-pv' }, v));
      const colour = can('color')
        ? h('div', { class: 'st-swatches' }, Object.keys(COLORS).filter(c => !r.colors || r.colors.includes(c)).map(c => h('button', { class: 'st-sw' + (p.color === c ? ' on' : ''), type: 'button', title: c, 'aria-label': c, style: `--sw:${COLORS[c]}`, onclick() { setProp(p, 'color', c); } })))
        : h('span', null, h('i', { class: 'st-dot', style: `--sw:${colorHex(p.color)}` }), ' ', p.color);
      const material = can('material')
        ? h('select', { class: 'st-select', 'aria-label': 'Material', onchange(e) { setProp(p, 'material', e.target.value); } }, MATERIALS.map(m => h('option', { value: m, selected: p.material === m }, MAT_LABEL[m] || m)))
        : (MAT_LABEL[p.material] || p.material);
      const transp = can('transparency')
        ? h('span', { class: 'st-slide' }, h('input', { type: 'range', min: 0, max: 1, step: 0.1, value: p.transparency, 'aria-label': 'Transparency', onchange(e) { setProp(p, 'transparency', Number(e.target.value)); }, oninput(e) { p.transparency = Number(e.target.value); draw(); e.target.nextSibling.textContent = num(p.transparency); } }), h('b', null, num(p.transparency)))
        : num(p.transparency);
      const anch = h('input', { type: 'checkbox', checked: p.anchored, disabled: !can('anchored') || p.spawn, 'aria-label': 'Anchored', onchange(e) { setProp(p, 'anchored', e.target.checked); } });
      put(props, h('div', { class: 'st-panel-title' }, 'Properties – ' + p.name),
        h('div', { class: 'st-group' }, 'Appearance'),
        row('Color', colour), row('Material', material), row('Transparency', transp),
        h('div', { class: 'st-group' }, 'Transform'),
        row('Size', `${num(p.sx)}, ${num(p.sy)}, ${num(p.sz)}`),
        row('Position', `${num(p.x)}, ${num(p.y)}, ${num(p.z)}`),
        row('Orientation', `0, ${num(((p.rot % 360) + 360) % 360)}, 0`),
        h('div', { class: 'st-group' }, 'Behavior'),
        row('Anchored', anch));
    }
    // ---------- the script panel ----------
    const codeBox = h('div', { class: 'st-code' });
    function drawCode() {
      if (!code) return;
      put(codeBox, h('div', { class: 'st-panel-title' }, '📜 Script (inside ' + ((byId(r.code.part) || {}).name || 'the part') + ')'),
        h('pre', { class: 'st-lines' }, code.lines.map((ln, n) => h('div', { class: 'st-line' }, h('span', { class: 'st-ln' }, String(n + 1)),
          ...ln.split(/(\{\w+\})/).map(bit => {
            const m = /^\{(\w+)\}$/.exec(bit);
            if (!m) return colourise(bit);
            const s = r.code.slots[m[1]];
            return h('button', {
              class: 'st-slot', type: 'button', disabled: !!playing, 'aria-label': 'Change this value',
              onclick() { const o = s.options, v = o[(o.indexOf(code.slots[m[1]]) + 1) % o.length]; code.slots[m[1]] = v; sfx.tap(); drawCode(); },
            }, code.slots[m[1]]);
          })))),
        h('p', { class: 'st-code-tip' }, 'Tap a yellow value to change it, then press ▶ Play to run the script.'));
    }
    function colourise(t) { // simple Luau colours: keywords, strings, numbers, comments
      const out = [];
      t.split(/(--.*$|"[^"]*"|\b(?:local|function|end|if|then|while|do|true|false|wait|task)\b|\b\d+(?:\.\d+)?\b)/).forEach(b => {
        if (!b) return;
        const cls = /^--/.test(b) ? 'c' : /^"/.test(b) ? 's' : /^\d/.test(b) ? 'n' : /^(local|function|end|if|then|while|do|true|false|wait|task)$/.test(b) ? 'k' : '';
        out.push(cls ? h('span', { class: 'st-' + cls }, b) : b);
      });
      return out;
    }
    function sync() {
      Object.entries(toolBtns).forEach(([t, b]) => b.classList.toggle('on', tool === t));
      if (panels.includes('explorer')) drawExplorer();
      if (panels.includes('properties')) drawProps();
      if (code) drawCode();
    }

    // ---------- missions ----------
    const missions = missionRunner(r, key, done, m => {
      did = new Set(); turned = 0; seen = new Set();
      if (playing) stop();
      if (m.scene) load(m.scene);
      ghost = m.ghost || (m.match && m.match.part !== 'any' && m.showGhost !== false ? Object.assign({}, byId(m.match.part) || {}, m.match.to) : null);
      if (ghost && ghost.id) ghost = Object.assign({}, ghost, { id: 'ghost', sign: null, goal: false, spawn: false });
      match = m.match || null;
      if (m.tool) tool = m.tool;
      if (m.select) selected = m.select;
      sync(); draw();
    });

    // keyboard (if one is plugged in): the same keys as Studio
    const kmap = {};
    ['w', 'a', 's', 'd', 'q', 'e'].forEach(k => { if (r.keys) { kmap[k] = [() => { flying[k] = true; }, () => { flying[k] = false; token('key:' + k); }]; kmap[k.toUpperCase()] = kmap[k]; } });
    if (r.keys) kmap.f = kmap.F = [focus];
    ['select', 'move', 'scale', 'rotate'].forEach((t, k) => { if (toolBtns[t]) kmap[String(k + 1)] = [() => setTool(t)]; });

    load(r.scene);
    const bar = h('div', { class: 'st-toolbar' }, Object.values(toolBtns), actions.length ? h('span', { class: 'st-sep' }) : null, actions, playBtn && h('span', { class: 'st-sep' }), playBtn);
    const side = panels.length ? h('div', { class: 'st-side' }, panels.includes('explorer') && explorer, panels.includes('properties') && props) : null;
    const root = h('div', { class: 'game arcade lab studiosim' },
      missions.box, bar,
      h('div', { class: 'st-work' + (side ? ' with-side' : '') }, h('div', { class: 'arc-screen st-screen' }, cv), side),
      r.keys && h('div', { class: 'st-keys' }, h('div', { class: 'st-keyrow' }, camKeys.slice(0, 3)), h('div', { class: 'st-keyrow' }, camKeys.slice(3), fKey),
        h('p', { class: 'st-keyhelp' }, 'W/S = closer/further · A/D = left/right · Q/E = down/up · F = focus on the selected part · drag the empty sky or ground to turn')),
      code && codeBox,
      missions.ask, table.el);
    keys(root, kmap);
    sync();
    root._stop = gameLoop(cv, step);
    root._test = {
      frames(n) { for (let k = 0; k < n; k++) step(1 / 60); },
      tool: setTool, insert, duplicate, del, undo: doUndo, start: play, stop, focus,
      select(id) { selected = id; token('select:' + id); sync(); },
      explore(id) { selected = id; token('explore:' + id); token('select:' + id); sync(); },
      key(k) { if (k === 'f') return focus(); flying[k] = true; for (let n = 0; n < 20; n++) step(1 / 60); flying[k] = false; token('key:' + k); },
      turn(deg) { yaw += deg; turned += Math.abs(deg); if (turned > 150) token('turn'); draw(); },
      move(ax, studs) { const p = byId(selected); remember(); p.x += AXES[ax][0] * studs; p.y += AXES[ax][1] * studs; p.z += AXES[ax][2] * studs; token('move:' + p.id); sync(); },
      moveTo(id, to) { const p = byId(id); remember(); Object.assign(p, to); token('move:' + id); sync(); },
      scale(ax, studs) { const p = byId(selected); remember(); p['s' + ax] = Math.max(1, p['s' + ax] + studs); if (ax === 'y') p.y += studs / 2; token('scale:' + p.id); sync(); },
      rotate(deg) { const p = byId(selected); remember(); p.rot = (((p.rot + deg) % 360) + 360) % 360; token('rotate:' + p.id); sync(); },
      prop(id, k, v) { setProp(byId(id), k, v); },
      slot(k, v) { code.slots[k] = v; drawCode(); },
      run(seconds = 6) { play(); for (let n = 0; n < seconds * 60; n++) step(1 / 60); },
      get parts() { return parts; }, get selected() { return selected; }, get did() { return [...did]; }, get mission() { return missions.i; },
      get playing() { return !!playing; }, get seen() { return [...seen]; }, get tool() { return tool; },
    };
    missions.next();
    return root;
  };

  // ======================================================================================================
  // studiotask: a Studio mission, done on the real computer while the iPad shows the steps
  // r.steps: [{ title, do: ['line', …] (what to do, in order), keys: ['⌘', 'D'] (a shortcut to show), where: 'toolbar' |
  //   'play' | 'explorer' | 'properties' | 'viewport' | 'file' | 'part' | 'tools' | 'color' | 'material' | 'anchor' | 'test' |
  //   'assistant' (lights up that part of the Studio map), tip (💡 Show me), clip: { id, title, time } (a short how-to video),
  //   grownup (a note for the grown-up), check: { a question: what Studio shows, usually typed } }]
  // r.intro, r.finish. The step he is on is saved, so the mission carries on where it left off after a break.
  // ======================================================================================================
  const MAP = { // where things are in the Studio window (our own simple map of it, not a screenshot)
    file: [4, 4, 34, 14, 'File'], play: [42, 4, 50, 14, '▶ Play'], test: [94, 4, 50, 14, 'Test Here'], assistant: [266, 4, 50, 14, 'Assistant'],
    tools: [4, 22, 104, 22, 'Select Move Scale Rotate'], part: [112, 22, 34, 22, 'Part'], color: [150, 22, 34, 22, 'Color'],
    material: [188, 22, 44, 22, 'Material'], anchor: [236, 22, 40, 22, 'Anchor'], toolbar: [4, 22, 312, 22, 'Toolbar'],
    viewport: [4, 48, 222, 148, 'Your 3D world'], explorer: [230, 48, 86, 70, 'Explorer'], properties: [230, 122, 86, 74, 'Properties'],
  };
  function studioMap(where) {
    const box = (id, hot) => {
      const [x, y, w, hh, label] = MAP[id];
      return `<rect x="${x}" y="${y}" width="${w}" height="${hh}" fill="${hot ? '#ffd43b' : '#3c4654'}" stroke="${hot ? '#ff3b30' : '#000'}" stroke-width="${hot ? 3 : 1.5}"/>` +
        `<text x="${x + w / 2}" y="${y + Math.min(hh / 2 + 4, 13)}" font-family="Lexend, sans-serif" font-size="${hh < 16 ? 7.5 : 8.5}" font-weight="700" text-anchor="middle" fill="${hot ? '#000' : '#fff'}">${label}</text>`;
    };
    const ids = ['file', 'play', 'test', 'assistant', 'tools', 'part', 'color', 'material', 'anchor', 'viewport', 'explorer', 'properties'];
    const hot = [].concat(where || []);
    return `<svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Map of the Studio window"><rect width="320" height="200" fill="#1f252d"/>` +
      (hot.includes('toolbar') ? box('toolbar', true) : '') + ids.filter(i => !(hot.includes('toolbar') && ['tools', 'part', 'color', 'material', 'anchor'].includes(i))).map(i => box(i, hot.includes(i))).join('') +
      `<rect x="70" y="150" width="90" height="10" fill="#5a9e3a" stroke="#000"/></svg>`;
  }
  E.studioMap = studioMap;

  GAMES.studiotask = function (r, key, done) {
    const steps = r.steps || [];
    const SAVE = `y3:studio:${L.id}:${key}`;
    let si = Math.min(store.get(SAVE, 0), Math.max(0, steps.length - 1));
    const passed = new Set(store.get(SAVE + ':ok', []));
    const card = h('div', { class: 'stk-card' });
    const dots = h('div', { class: 'stk-dots' });
    let over = false;
    function show() {
      const s = steps[si];
      store.set(SAVE, si);
      put(dots, steps.map((_, k) => h('span', { class: 'stk-dot' + (k === si ? ' on' : '') + (passed.has(k) ? ' ok' : '') }, String(k + 1))));
      const showMe = h('div', { class: 'stk-show', hidden: true },
        s.where && h('div', { class: 'stk-map', html: studioMap(s.where) }),
        s.tip && h('p', { html: fmt(s.tip, false) }),
        s.clip && h('a', { class: 'btn', href: `https://www.youtube.com/watch?v=${s.clip.id}${s.clip.time ? '&t=' + s.clip.time : ''}`, target: '_blank', rel: 'noopener' }, `📺 Watch how: ${s.clip.title}`));
      const next = h('button', { class: 'btn big ready', type: 'button', hidden: !passed.has(si) || !s.check, onclick: advance }, si < steps.length - 1 ? 'Next step ▶' : 'Mission complete ✔');
      const check = s.check ? h('div', { class: 'stk-check' },
        h('div', { class: 'stk-check-tag' }, '🔎 Check it on the computer'),
        questionWidget(s.check, el => {
          if (!passed.has(si)) { passed.add(si); store.set(SAVE + ':ok', [...passed]); award(`${key}:step${si}`, el); }
          sfx.good(); say(s.yes || 'You did it in the real Studio!'); next.hidden = false; drawDots();
        }, el => { say(s.check.hint || 'Look again on the computer screen.'); shake(el); })) : null;
      const doneBtn = !s.check && h('button', { class: 'btn big ready', type: 'button', onclick() { passed.add(si); store.set(SAVE + ':ok', [...passed]); advance(); } }, si < steps.length - 1 ? '✔ Done! Next step ▶' : 'Mission complete ✔');
      put(card,
        h('div', { class: 'stk-banner' }, h('span', { class: 'stk-pc' }, '💻'), h('span', null, `STEP ${si + 1} of ${steps.length}: `, h('b', null, s.title))),
        s.pic && pic(s.pic, 'stk-pic'),
        h('ol', { class: 'stk-do' }, [].concat(s.do || []).map(t => h('li', { html: fmt(t, false) }))),
        s.keys && h('div', { class: 'stk-keys' }, h('span', null, 'Shortcut: '), [].concat(s.keys).map(k => h('kbd', null, k))),
        s.grownup && h('p', { class: 'stk-grownup' }, h('span', null, '👪 Grown-up: '), s.grownup),
        h('div', { class: 'btn-row' },
          si > 0 && h('button', { class: 'btn', type: 'button', onclick() { sfx.tap(); si--; show(); } }, '◀ Back'),
          (s.where || s.tip || s.clip) && h('button', { class: 'btn', type: 'button', onclick() { sfx.tap(); showMe.hidden = !showMe.hidden; } }, '💡 Show me')),
        showMe, check, h('div', { class: 'btn-row' }, next, doneBtn));
      say(s.say || (si === 0 ? (r.say || 'Over to the computer! Do each step in Studio, then check it here.') : 'Next step on the computer!'));
    }
    function drawDots() { [...dots.children].forEach((d, k) => d.classList.toggle('ok', passed.has(k))); }
    function advance() {
      sfx.tap();
      if (si < steps.length - 1) { si++; show(); return; }
      if (over) return;
      over = true; store.set(SAVE, 0);
      put(card, h('div', { class: 'results' }, h('div', { class: 'trophy' }, '🏆'), h('h2', null, 'STUDIO MISSION COMPLETE!'), h('p', { class: 'lead', html: fmt(r.finish || 'You did it for real in the Studio. Remember to save: File → Save to Roblox.', false) })));
      done();
    }
    const root = h('div', { class: 'game studiotask' }, h('div', { class: 'stk-head' }, h('span', { class: 'lab-mission-tag' }, '💻 STUDIO MISSION'), dots), card);
    root._test = { get step() { return si; }, get passed() { return [...passed]; }, advance, show };
    if (steps.length) show(); else setTimeout(done);
    return root;
  };
});
