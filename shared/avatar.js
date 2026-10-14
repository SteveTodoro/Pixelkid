/* Pixelkid avatar: the player's pixel character, the wardrobe catalogue and the gem wallet.
 * Used by the lessons (engine.js), the library page and the wardrobe page.
 * Everything is saved in this device's browser (localStorage).
 */
(function () {
  'use strict';
  const W = 12, H = 20;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  };

  // ---------- the body every outfit is drawn on ----------
  const BASE = [
    '............',
    '............',
    '..ssssssss..',
    '..ssssssss..',
    '..ssssssss..',
    '..sWKssKWs..',
    '..ssssssss..',
    '..sssMMsss..',
    '...ssssss...',
    '.ssssssssss.',
    '.ssssssssss.',
    '.ssssssssss.',
    '.ssssssssss.',
    '.SS.ssss.SS.',
    '...ssssss...',
    '...ss..ss...',
    '...ss..ss...',
    '...ss..ss...',
    '...ss..ss...',
    '..sss..sss..',
  ];
  // part rows start at row `y` (default 0)
  const SKINS = [
    { id: 'skin1', name: 'Tone 1', s: '#ffdbb4', S: '#e8b98c' },
    { id: 'skin2', name: 'Tone 2', s: '#f1c27d', S: '#d6a25a' },
    { id: 'skin3', name: 'Tone 3', s: '#d9a066', S: '#b9834c' },
    { id: 'skin4', name: 'Tone 4', s: '#a86b3c', S: '#8a552c' },
    { id: 'skin5', name: 'Tone 5', s: '#6b4226', S: '#52311b' },
  ];
  const HAIR_COLOURS = [
    { id: 'hc-brown', name: 'Brown', h: '#6b4423', H: '#8a5a32' },
    { id: 'hc-black', name: 'Black', h: '#1b1b1b', H: '#3a3a3a' },
    { id: 'hc-blonde', name: 'Blonde', h: '#f2c94c', H: '#fbe38e' },
    { id: 'hc-ginger', name: 'Ginger', h: '#d4652b', H: '#ec8a52' },
    { id: 'hc-white', name: 'Silver', h: '#d8d8d8', H: '#ffffff' },
    { id: 'hc-pink', name: 'Pink', h: '#ff5fa2', H: '#ff9cc7', price: 10 },
    { id: 'hc-blue', name: 'Blue', h: '#3b82f6', H: '#7fb0ff', price: 10 },
    { id: 'hc-green', name: 'Green', h: '#2e9e3e', H: '#5bd16b', price: 10 },
  ];

  // cat: hair | top | legs | shoes | hat | extra | pet
  const ITEMS = [
    // ----- hair -----
    { id: 'hair-short', cat: 'hair', name: 'Short', price: 0, rows: ['............', '...hhhhhh...', '..hhhhhhhh..', '..hHhhhhhh..', '..h......h..'] },
    { id: 'hair-spiky', cat: 'hair', name: 'Spiky', price: 15, rows: ['...h.hh.h...', '..hhhhhhhh..', '..hhHhhhhh..', '..hh.hh.hh..', '..h......h..'] },
    { id: 'hair-long', cat: 'hair', name: 'Long', price: 15, rows: ['............', '...hhhhhh...', '..hhhhhhhh..', '.hhHhhhhhhh.', '.hh......hh.', '.h........h.', '.h........h.', '.h........h.', '.hh......hh.'] },
    { id: 'hair-curly', cat: 'hair', name: 'Big & Curly', price: 20, rows: ['...hhhhhh...', '.hhhHhhhhhh.', '.hhhhhhhHhh.', '.hHhhhhhhhh.', '.hh......hh.', '.h........h.'] },
    { id: 'hair-mohawk', cat: 'hair', name: 'Mohawk', price: 20, rows: ['.....hh.....', '.....hh.....', '....hHhh....', '....hhhh....'] },
    { id: 'hair-none', cat: 'hair', name: 'No hair', price: 0, rows: [] },
    // ----- tops -----
    { id: 'tee-grey', cat: 'top', name: 'Grey tee', price: 0, y: 9, rows: ['.tttttttttt.', '.tttttttttt.', '...tttttt...', '...tttttt...', '...tttttt...'], pal: { t: '#9a9a9a' } },
    { id: 'tee-red', cat: 'top', name: 'Red tee', price: 10, y: 9, rows: ['.tttttttttt.', '.tttttttttt.', '...tttttt...', '...tttttt...', '...tttttt...'], pal: { t: '#e53935' } },
    { id: 'tee-teal', cat: 'top', name: 'Teal tee', price: 10, y: 9, rows: ['.tttttttttt.', '.tttttttttt.', '...tttttt...', '...tttttt...', '...tttttt...'], pal: { t: '#19b3a3' } },
    { id: 'hoodie-blue', cat: 'top', name: 'Blue hoodie', price: 20, y: 9, rows: ['.tttTttTttt.', '.tttttttttt.', '.tttttttttt.', '.tttTTTTttt.', '...tttttt...'], pal: { t: '#1e6fd9', T: '#0d4aa0' } },
    { id: 'jumper-green', cat: 'top', name: 'Stripy jumper', price: 20, y: 9, rows: ['.tttttttttt.', '.tttttttttt.', '.TTTTTTTTTT.', '.tttttttttt.', '...tttttt...'], pal: { t: '#2e9e3e', T: '#ffd43b' } },
    { id: 'labcoat', cat: 'top', name: 'Lab coat', price: 30, y: 9, rows: ['.ttttTTtttt.', '.ttttTTtttt.', '.ttttTTtttt.', '.ttttTTtttt.', '...ttTTtt...', '...t....t...'], pal: { t: '#ffffff', T: '#8fd3ff' } },
    { id: 'hero-suit', cat: 'top', name: 'Hero suit', price: 40, y: 9, rows: ['.tttttttttt.', '.tttTTTTttt.', '.ttttTTtttt.', '.tttttttttt.', '...yyyyyy...'], pal: { t: '#d9433b', T: '#ffd43b', y: '#ffd43b' } },
    { id: 'space-top', cat: 'top', name: 'Space suit', price: 40, y: 9, rows: ['.tttttttttt.', '.tttOOOOttt.', '.tttObcOttt.', '.tttttttttt.', '...tttttt...'], pal: { t: '#f2f2f2', O: '#ff8c1a', b: '#2ee6d6', c: '#e53935' } },
    // ----- bottoms -----
    { id: 'jeans', cat: 'legs', name: 'Jeans', price: 0, y: 14, rows: ['...llllll...', '...ll..ll...', '...ll..ll...', '...ll..ll...'], pal: { l: '#2f5d9e' } },
    { id: 'shorts', cat: 'legs', name: 'Shorts', price: 10, y: 14, rows: ['...llllll...', '...ll..ll...'], pal: { l: '#8a5a32' } },
    { id: 'trousers-black', cat: 'legs', name: 'Black trousers', price: 10, y: 14, rows: ['...llllll...', '...ll..ll...', '...ll..ll...', '...ll..ll...'], pal: { l: '#2b2b2b' } },
    { id: 'leggings-rainbow', cat: 'legs', name: 'Rainbow legs', price: 25, y: 14, rows: ['...aaaaaa...', '...bb..bb...', '...cc..cc...', '...dd..dd...'], pal: { a: '#e53935', b: '#ffb800', c: '#2e9e3e', d: '#1e6fd9' } },
    { id: 'space-legs', cat: 'legs', name: 'Space trousers', price: 30, y: 14, rows: ['...llllll...', '...ll..ll...', '...LL..LL...', '...ll..ll...'], pal: { l: '#f2f2f2', L: '#ff8c1a' } },
    // ----- shoes -----
    { id: 'trainers', cat: 'shoes', name: 'Trainers', price: 0, y: 18, rows: ['...oo..oo...', '..oOo..oOo..'], pal: { o: '#ffffff', O: '#1e6fd9' } },
    { id: 'trainers-red', cat: 'shoes', name: 'Red kicks', price: 10, y: 18, rows: ['...oo..oo...', '..oOo..oOo..'], pal: { o: '#e53935', O: '#ffffff' } },
    { id: 'boots', cat: 'shoes', name: 'Boots', price: 15, y: 17, rows: ['...oo..oo...', '...oo..oo...', '..ooo..ooo..'], pal: { o: '#4a2f1a' } },
    { id: 'gold-kicks', cat: 'shoes', name: 'Gold kicks', price: 40, y: 18, rows: ['...oo..oo...', '..oOo..oOo..'], pal: { o: '#ffd43b', O: '#ffffff' } },
    // ----- hats -----
    { id: 'hat-none', cat: 'hat', name: 'No hat', price: 0, rows: [] },
    { id: 'cap', cat: 'hat', name: 'Cap', price: 15, rows: ['............', '..cccccccc..', '..cccccccc..', '.CCCCCCCCCC.'], pal: { c: '#e53935', C: '#a31515' } },
    { id: 'beanie', cat: 'hat', name: 'Beanie', price: 15, rows: ['.....cc.....', '..cccccccc..', '..CCCCCCCC..', '..cccccccc..'], pal: { c: '#8e5cff', C: '#ffffff' } },
    { id: 'headphones', cat: 'hat', name: 'Headphones', price: 25, y: 1, rows: ['..kkkkkkkk..', '.k........k.', '.k........k.', 'cc........cc', 'cc........cc'], pal: { k: '#1b1b1b', c: '#2ee6d6' } },
    { id: 'wizard', cat: 'hat', name: 'Wizard hat', price: 40, rows: ['.....cc.....', '....cyyc....', '...cccccc...', '.CCCCCCCCCC.'], pal: { c: '#3d1f99', y: '#ffd43b', C: '#2a1270' } },
    { id: 'crown', cat: 'hat', name: 'Crown', price: 60, rows: ['..y..yy..y..', '..yryyyyry..'], pal: { y: '#ffd43b', r: '#e53935' } },
    { id: 'knight', cat: 'hat', name: 'Knight helmet', price: 0, unlock: 'boss', rows: ['.....rr.....', '..mmmmmmmm..', '.mmmmmmmmmm.', '.mmmmmmmmmm.', '.mmmmmmmmmm.', '.mkkkkkkkkm.', '.mmmmmmmmmm.', '.mmm.mm.mmm.', '..mmmmmmmm..'], pal: { m: '#b8c2cc', k: '#1b1b1b', r: '#e53935' } },
    { id: 'beret', cat: 'hat', name: 'Artist beret', price: 0, unlock: 'artist', rows: ['......c.....', '...cccccc...', '.cccccccccc.'], pal: { c: '#e53935' } },
    // ----- extras -----
    { id: 'extra-none', cat: 'extra', name: 'Nothing', price: 0, rows: [] },
    { id: 'shades', cat: 'extra', name: 'Cool shades', price: 20, y: 5, rows: ['..kwkkkkwk..'], pal: { k: '#1b1b1b', w: '#ffffff' } },
    { id: 'glasses', cat: 'extra', name: 'Glasses', price: 15, y: 4, rows: ['..kkk..kkk..', '..kWKkkKWk..'], pal: { k: '#1b1b1b', W: '#ffffff', K: '#1b1b1b' } },
    { id: 'glasses-3d', cat: 'extra', name: '3D glasses', price: 0, unlock: 'video', y: 4, rows: ['..kkkkkkkk..', '..kRRkkBBk..'], pal: { k: '#ffffff', R: '#e53935', B: '#2ee6d6' } },
    { id: 'cape-red', cat: 'extra', name: 'Hero cape', price: 50, behind: true, y: 9, rows: ['.cccccccccc.', 'cccccccccccc', 'cccccccccccc', 'cccccccccccc', 'cccccccccccc', 'cccccccccccc', 'cccccccccccc', 'cccccccccccc', 'cccccccccccc', '.cccccccccc.'], pal: { c: '#d9433b' } },
    { id: 'cape-gold', cat: 'extra', name: 'Champion cape', price: 0, unlock: 'perfect', behind: true, y: 9, rows: ['.cccccccccc.', 'cccccccccccc', 'cccccccccccc', 'cccccccccccc', 'cccccccccccc', 'cccccccccccc', 'cccccccccccc', 'cccccccccccc', 'cccccccccccc', '.cccccccccc.'], pal: { c: '#ffb800' } },
    { id: 'wings', cat: 'extra', name: 'Wings', price: 80, behind: true, y: 8, rows: ['w..........w', 'ww........ww', 'wWw......wWw', 'wWw......wWw', 'ww........ww', 'w..........w'], pal: { w: '#ffffff', W: '#bfefff' } },
    { id: 'designer-scarf', cat: 'extra', name: 'Designer scarf', price: 0, unlock: 'designer', y: 8, rows: ['..cccccccc..', '..cCcCcCcc..', '.......cc...', '.......Cc...'], pal: { c: '#8e5cff', C: '#ffd43b' } },
    // ----- pets -----
    { id: 'pet-none', cat: 'pet', name: 'No pet', price: 0, rows: [] },
    { id: 'pet-cat', cat: 'pet', name: 'Pixel cat', price: 40, rows: ['.o....o.', '.oo..oo.', '.oooooo.', '.ogoogo.', '.oooooo.', '..oppo..', '.oooooo.', '.o.oo.o.'], pal: { o: '#ff8c1a', g: '#2e9e3e', p: '#ff7eb6' } },
    { id: 'pet-dog', cat: 'pet', name: 'Pixel dog', price: 40, rows: ['bb....bb', 'bbbbbbbb', '.bkbbkb.', '.bbbbbb.', '.bbkkbb.', '..bbbb..', '.bbbbbb.', '.b.bb.b.'], pal: { b: '#a86b3c', k: '#1b1b1b' } },
    { id: 'pet-robot', cat: 'pet', name: 'Mini Bolt', price: 50, rows: ['...yy...', '.kkkkkk.', '.kcllck.', '.kllllk.', '.kkkkkk.', '.gggggg.', '.g.gg.g.', '.k.kk.k.'], pal: { y: '#ffcc33', k: '#1b1b1b', c: '#2ee6d6', l: '#d9dde3', g: '#8e9aa8' } },
    { id: 'pet-dragon', cat: 'pet', name: 'Baby dragon', price: 100, rows: ['.p.gg.p.', '.pggggp.', 'pgkggkgp', '.gggggg.', '.gyyyyg.', '..gyyg..', '.gg..gg.', '.g....g.'], pal: { g: '#2e9e3e', p: '#8e5cff', k: '#1b1b1b', y: '#ffd43b' } },
  ];
  const UNLOCK_TEXT = {
    boss: 'Beat any boss to unlock',
    artist: 'Finish Pixel Art Studio to unlock',
    designer: 'Finish Design a Poster to unlock',
    perfect: 'Get a perfect boss score to unlock',
    video: 'Finish any video quest to unlock',
  };
  const CATS = [
    ['skin', '🙂 Skin'], ['hair', '💇 Hair'], ['hairColor', '🎨 Hair colour'], ['top', '👕 Tops'], ['legs', '👖 Bottoms'],
    ['shoes', '👟 Shoes'], ['hat', '🎩 Hats'], ['extra', '✨ Extras'], ['pet', '🐾 Pets'],
  ];
  const DEFAULT_LOOK = { skin: 'skin1', hairColor: 'hc-brown', hair: 'hair-short', top: 'tee-grey', legs: 'jeans', shoes: 'trainers', hat: 'hat-none', extra: 'extra-none', pet: 'pet-none' };
  const byId = id => ITEMS.find(i => i.id === id) || SKINS.find(i => i.id === id) || HAIR_COLOURS.find(i => i.id === id);

  // ---------- saved state + wallet ----------
  const AKEY = 'y3:avatar', WKEY = 'y3:wallet';
  function load() {
    const a = store.get(AKEY, {});
    return { look: Object.assign({}, DEFAULT_LOOK, a.look), owned: a.owned || [] };
  }
  function save(a) { const old = store.get(AKEY, {}); store.set(AKEY, Object.assign(old, a)); }
  function wallet() {
    let w = store.get(WKEY, null);
    if (!w) {
      // first time: start with every gem already earned in lessons
      const rec = store.get('y3:records', {});
      w = { earned: Object.values(rec).reduce((n, r) => n + (r.stars || 0), 0), spent: 0 };
      store.set(WKEY, w);
    }
    return { earned: w.earned, spent: w.spent, balance: Math.max(0, w.earned - w.spent) };
  }
  function earn(n = 1) { const w = wallet(); store.set(WKEY, { earned: w.earned + n, spent: w.spent }); return w.earned + n; }
  function achievements() {
    const all = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('y3:progress:')) Object.assign(all, (store.get(k, {}).ach) || {});
      }
    } catch (e) { /* ignore */ }
    return all;
  }
  function isFree(it) { return !it.price && !it.unlock; }
  function owns(it, a = load()) { return isFree(it) || a.owned.includes(it.id) || (it.unlock && achievements()[it.unlock]); }
  function buy(id) {
    const it = byId(id), a = load(), w = wallet();
    if (!it || owns(it, a) || it.unlock || w.balance < (it.price || 0)) return false;
    store.set(WKEY, { earned: w.earned, spent: w.spent + it.price });
    a.owned.push(id); save({ owned: a.owned });
    return true;
  }
  function wear(id) {
    const it = byId(id); if (!it) return;
    const cat = SKINS.includes(it) ? 'skin' : HAIR_COLOURS.includes(it) ? 'hairColor' : it.cat;
    const a = load(); a.look[cat] = id; save({ look: a.look });
  }

  // ---------- drawing ----------
  function paint(ctx, rows, pal, ox, oy, s) {
    rows.forEach((r, y) => [...r].forEach((ch, x) => { const c = pal[ch]; if (c) { ctx.fillStyle = c; ctx.fillRect((ox + x) * s, (oy + y) * s, s, s); } }));
  }
  // Draw the avatar onto a new canvas. opts: { scale, pet: true|false, bob: 0|1 }
  function draw(look = load().look, opts = {}) {
    const s = opts.scale || 4, withPet = opts.pet && look.pet && look.pet !== 'pet-none';
    const c = document.createElement('canvas');
    c.width = (withPet ? W + 10 : W) * s; c.height = H * s;
    const ctx = c.getContext('2d');
    const skin = byId(look.skin) || SKINS[0], hc = byId(look.hairColor) || HAIR_COLOURS[0];
    const part = cat => byId(look[cat]);
    const layer = it => { if (it && it.rows && it.rows.length) paint(ctx, it.rows, Object.assign({ h: hc.h, H: hc.H }, it.pal || {}), 0, (it.y || 0) + (opts.bob || 0), s); };
    const extra = part('extra');
    if (extra && extra.behind) layer(extra);
    paint(ctx, BASE, { s: skin.s, S: skin.S, W: '#ffffff', K: '#1b1b1b', M: '#a0522d' }, 0, opts.bob || 0, s);
    ['legs', 'shoes', 'top', 'hair', 'hat'].forEach(cat => layer(part(cat)));
    if (extra && !extra.behind) layer(extra);
    if (withPet) { const p = part('pet'); paint(ctx, p.rows, p.pal, W + 2, H - p.rows.length, s); }
    return c;
  }
  const dataURL = (look, opts) => draw(look, opts).toDataURL();

  window.Avatar = { ITEMS, SKINS, HAIR_COLOURS, CATS, UNLOCK_TEXT, DEFAULT_LOOK, byId, load, save, wallet, earn, achievements, owns, buy, wear, draw, dataURL, isFree };
})();
