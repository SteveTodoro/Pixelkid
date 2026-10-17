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
    { id: 'skin-undyne', name: 'Fish blue', price: 60, special: true, s: '#5fa8e8', S: '#3f86c6' },
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
    { id: 'hair-bob', cat: 'hair', name: 'Bob cut', price: 20, rows: ['............', '...hhhhhh...', '..hhhhhhhh..', '..hhhhhhhh..', '.hhhhhhhhhh.', '.hh......hh.', '.hh......hh.', '.hh......hh.'] },
    { id: 'undyne-ponytail', cat: 'hair', name: 'Undyne ponytail', price: 60, special: true, rows: ['........hhh.', '...hhhhhhhhh', '..hhhhhhhh.h', '..hHhhhhhh.h', '..hh....hh.h', '..h......h..'], pal: { h: '#e53935', H: '#ff6b5e' } },
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
    // special costumes: pricey tributes, shown with a gold ★ SPECIAL ribbon in the shop
    { id: 'ff-hoodie', cat: 'top', name: 'Foltyn Family hoodie', price: 150, special: true, y: 8, rows: ['..TttttttT..', '.tttttttttt.', '.ttKKKtKKKt.', '.ttKtttKttt.', '.ttKKttKKtt.', '...KtttKt...'], pal: { t: '#fafafa', T: '#c9ced6', K: '#1b1b1b' } },
    { id: 'ninja-gi', cat: 'top', name: 'Ninja suit', price: 80, special: true, y: 9, rows: ['.ggggkkgggg.', '.gggggkgggg.', '.gggggggggg.', '.gggggggggg.', '...RRRRRR...'], pal: { g: '#2d3139', k: '#15171b', R: '#e53935' } },
    { id: 'chef-jacket', cat: 'top', name: 'Chef jacket', price: 70, special: true, y: 8, rows: ['...rrrrrr...', '.tttttttttt.', '.tttbttbttt.', '.tttttttttt.', '.tttbttbttt.', '...tttttt...'], pal: { t: '#ffffff', b: '#1b1b1b', r: '#e53935' } },
    { id: 'sans-hoodie', cat: 'top', name: 'Sans hoodie', price: 100, special: true, y: 9, rows: ['.ffffffffff.', '.jjjwwwwjjj.', '.jjjwwwwjjj.', '.jjjwwwwjjj.', '...jjjjjj...'], pal: { f: '#e6ecf2', j: '#3b8fe0', w: '#ffffff' } },
    { id: 'frisk-jumper', cat: 'top', name: 'Frisk stripy jumper', price: 80, special: true, y: 9, rows: ['.bbbbbbbbbb.', '.pppppppppp.', '.bbbbbbbbbb.', '.pppppppppp.', '...bbbbbb...'], pal: { b: '#4a7fd8', p: '#c459d1' } },
    { id: 'papyrus-armour', cat: 'top', name: 'Papyrus battle body', price: 100, special: true, y: 9, rows: ['yyyttttttyyy', '.tttttttttt.', '.ttTttttTtt.', '.tttttttttt.', '.rr.bbbb.rr.'], pal: { y: '#ffcc33', t: '#ffffff', T: '#d6dbe1', r: '#e53935', b: '#2f5fd0' } },
    { id: 'undyne-top', cat: 'top', name: 'Undyne tank top', price: 50, special: true, y: 9, rows: ['..kkkkkkkk..', '..kkkkkkkk..', '..kkkkkkkk..', '..kkkkkkkk..', '...kkkkkk...'], pal: { k: '#1b1b1b' } },
    { id: 'happi-coat', cat: 'top', name: 'Happi festival coat', price: 30, y: 9, rows: ['.tWttttttWt.', '.ttWttttWtt.', '.tttWttWttt.', '.tttttttttt.', '...tWWWWt...'], pal: { t: '#1f3c88', W: '#ffffff' } },
    { id: 'anpan-suit', cat: 'top', name: 'Anpanman suit', price: 50, special: true, y: 9, rows: ['.tttttttttt.', '.ttttyytttt.', '.ttttyytttt.', '.tttttttttt.', '...yyyyyy...'], pal: { t: '#e53935', y: '#ffd43b' } },
    { id: 'liberty-robe', cat: 'top', name: 'Lady Liberty robe', price: 40, special: true, y: 9, rows: ['.gggggGgggg.', '.ggggGggggg.', '.gggGgggggg.', '.ggGggggggg.', '...gggGgg...'], pal: { g: '#4fb39a', G: '#2e7d6b' } },
    { id: 'guard-tunic', cat: 'top', name: 'Royal Guard tunic', price: 50, special: true, y: 9, rows: ['.tttttttttt.', '.ttttyttttt.', '.ttttyttttt.', '.ttttyttttt.', '...wwwwww...'], pal: { t: '#d32f2f', y: '#ffd43b', w: '#ffffff' } },
    // ----- bottoms -----
    { id: 'jeans', cat: 'legs', name: 'Jeans', price: 0, y: 14, rows: ['...llllll...', '...ll..ll...', '...ll..ll...', '...ll..ll...'], pal: { l: '#2f5d9e' } },
    { id: 'shorts', cat: 'legs', name: 'Shorts', price: 10, y: 14, rows: ['...llllll...', '...ll..ll...'], pal: { l: '#8a5a32' } },
    { id: 'trousers-black', cat: 'legs', name: 'Black trousers', price: 10, y: 14, rows: ['...llllll...', '...ll..ll...', '...ll..ll...', '...ll..ll...'], pal: { l: '#2b2b2b' } },
    { id: 'leggings-rainbow', cat: 'legs', name: 'Rainbow legs', price: 25, y: 14, rows: ['...aaaaaa...', '...bb..bb...', '...cc..cc...', '...dd..dd...'], pal: { a: '#e53935', b: '#ffb800', c: '#2e9e3e', d: '#1e6fd9' } },
    { id: 'space-legs', cat: 'legs', name: 'Space trousers', price: 30, y: 14, rows: ['...llllll...', '...ll..ll...', '...LL..LL...', '...ll..ll...'], pal: { l: '#f2f2f2', L: '#ff8c1a' } },
    { id: 'ninja-trousers', cat: 'legs', name: 'Ninja trousers', price: 40, special: true, y: 14, rows: ['...llllll...', '...ll..ll...', '...ll..ll...', '...LL..LL...'], pal: { l: '#2d3139', L: '#15171b' } },
    { id: 'chef-trousers', cat: 'legs', name: 'Chef check trousers', price: 40, special: true, y: 14, rows: ['...lLlLlL...', '...Ll..Ll...', '...lL..lL...', '...Ll..Ll...'], pal: { l: '#ffffff', L: '#1b1b1b' } },
    { id: 'sans-shorts', cat: 'legs', name: 'Sans shorts', price: 40, special: true, y: 14, rows: ['...kkkkkk...', '...wk..kw...'], pal: { k: '#1b1b1b', w: '#ffffff' } },
    { id: 'papyrus-shorts', cat: 'legs', name: 'Papyrus shorts', price: 40, special: true, y: 14, rows: ['...bbbbbb...', '...bb..bb...'], pal: { b: '#2f5fd0' } },
    { id: 'liberty-legs', cat: 'legs', name: 'Lady Liberty robe (long)', price: 25, special: true, y: 14, rows: ['...gggggg...', '...gGgggg...', '...ggggGg...', '..gggggggg..'], pal: { g: '#4fb39a', G: '#2e7d6b' } },
    { id: 'elephant-pants', cat: 'legs', name: 'Thai elephant trousers', price: 25, y: 14, rows: ['...pPpPpP...', '...Pp..pP...', '...pP..Pp...', '...Pp..pP...'], pal: { p: '#6a1b9a', P: '#ffd43b' } },
    { id: 'anpan-legs', cat: 'legs', name: 'Anpanman trousers', price: 30, special: true, y: 14, rows: ['...llllll...', '...ll..ll...', '...ll..ll...', '...ll..ll...'], pal: { l: '#e53935' } },
    // ----- shoes -----
    { id: 'trainers', cat: 'shoes', name: 'Trainers', price: 0, y: 18, rows: ['...oo..oo...', '..oOo..oOo..'], pal: { o: '#ffffff', O: '#1e6fd9' } },
    { id: 'trainers-red', cat: 'shoes', name: 'Red kicks', price: 10, y: 18, rows: ['...oo..oo...', '..oOo..oOo..'], pal: { o: '#e53935', O: '#ffffff' } },
    { id: 'boots', cat: 'shoes', name: 'Boots', price: 15, y: 17, rows: ['...oo..oo...', '...oo..oo...', '..ooo..ooo..'], pal: { o: '#4a2f1a' } },
    { id: 'gold-kicks', cat: 'shoes', name: 'Gold kicks', price: 40, y: 18, rows: ['...oo..oo...', '..oOo..oOo..'], pal: { o: '#ffd43b', O: '#ffffff' } },
    { id: 'ninja-tabi', cat: 'shoes', name: 'Ninja tabi', price: 30, special: true, y: 18, rows: ['...kk..kk...', '..kkk..kkk..'], pal: { k: '#15171b' } },
    { id: 'sans-slippers', cat: 'shoes', name: 'Pink slippers', price: 40, special: true, y: 18, rows: ['...pp..pp...', '..ppp..ppp..'], pal: { p: '#ff9cc7' } },
    { id: 'papyrus-boots', cat: 'shoes', name: 'Red boots', price: 40, special: true, y: 17, rows: ['...rr..rr...', '...rr..rr...', '..rrr..rrr..'], pal: { r: '#e53935' } },
    // ----- hats -----
    { id: 'hat-none', cat: 'hat', name: 'No hat', price: 0, rows: [] },
    { id: 'cap', cat: 'hat', name: 'Cap', price: 15, rows: ['............', '..cccccccc..', '..cccccccc..', '.CCCCCCCCCC.'], pal: { c: '#e53935', C: '#a31515' } },
    { id: 'beanie', cat: 'hat', name: 'Beanie', price: 15, rows: ['.....cc.....', '..cccccccc..', '..CCCCCCCC..', '..cccccccc..'], pal: { c: '#8e5cff', C: '#ffffff' } },
    { id: 'headphones', cat: 'hat', name: 'Headphones', price: 25, y: 1, rows: ['..kkkkkkkk..', '.k........k.', '.k........k.', 'cc........cc', 'cc........cc'], pal: { k: '#1b1b1b', c: '#2ee6d6' } },
    { id: 'wizard', cat: 'hat', name: 'Wizard hat', price: 40, rows: ['.....cc.....', '....cyyc....', '...cccccc...', '.CCCCCCCCCC.'], pal: { c: '#3d1f99', y: '#ffd43b', C: '#2a1270' } },
    { id: 'crown', cat: 'hat', name: 'Crown', price: 60, rows: ['..y..yy..y..', '..yryyyyry..'], pal: { y: '#ffd43b', r: '#e53935' } },
    { id: 'knight', cat: 'hat', name: 'Knight helmet', price: 0, unlock: 'boss', rows: ['.....rr.....', '..mmmmmmmm..', '.mmmmmmmmmm.', '.mmmmmmmmmm.', '.mmmmmmmmmm.', '.mkkkkkkkkm.', '.mmmmmmmmmm.', '.mmm.mm.mmm.', '..mmmmmmmm..'], pal: { m: '#b8c2cc', k: '#1b1b1b', r: '#e53935' } },
    { id: 'beret', cat: 'hat', name: 'Artist beret', price: 0, unlock: 'artist', rows: ['......c.....', '...cccccc...', '.cccccccccc.'], pal: { c: '#e53935' } },
    { id: 'miner-helmet', cat: 'hat', name: 'Miner helmet', price: 0, unlock: 'miner', rows: ['.....yy.....', '....yLLy....', '..cccccccc..', '.cccccccccc.', 'CCCCCCCCCCCC'], pal: { c: '#ffb800', C: '#c98a00', y: '#1b1b1b', L: '#fff59d' } },
    { id: 'explorer-hat', cat: 'hat', name: 'Explorer hat', price: 0, unlock: 'wonder', rows: ['...cccccc...', '..cccccccc..', '..CCCCCCCC..', 'cccccccccccc'], pal: { c: '#d8b77a', C: '#7a5230' } },
    { id: 'straw-hat', cat: 'hat', name: "Gardener's straw hat", price: 0, unlock: 'gardener', rows: ['...cCcCcc...', '..cCcCcCcc..', '..rrrrrrpy..', 'cCcCcCcCcCcC'], pal: { c: '#f2d16b', C: '#d9b24a', r: '#e53935', p: '#ff7eb6', y: '#ffcc33' } },
    { id: 'pilot-cap', cat: 'hat', name: 'Pilot cap & goggles', price: 0, unlock: 'traveller', rows: ['...cccccc...', '..cccccccc..', '.ckkcccckkc.', '.kgGkcckgGk.', '.ckkcccckkc.', '.cc......cc.', '.cc......cc.'], pal: { c: '#7a4b2a', k: '#1b1b1b', g: '#7fd0ff', G: '#ffffff' } },
    { id: 'anpan-head', cat: 'hat', name: 'Anpanman head', price: 70, special: true, hideHair: true, y: 1, rows: ['...kkkkkk...', '..kbbbbbbk..', '.kbkkbbkkbk.', '.kbbkbbkbbk.', 'kbrrbrrbrrbk', 'kbrrbrrbrrbk', '.kbbkkkkbbk.', '..kbbbbbbk..', '...kkkkkk...'], pal: { k: '#5a3214', b: '#eba45a', r: '#e53935' } },
    { id: 'astro-helmet', cat: 'hat', name: 'Astronaut helmet', price: 60, special: true, hideHair: true, rows: ['...GGGGGG...', '..GwwwwwwG..', '.GwwwwwwwwG.', '.Gwgg....wG.', '.Gwg.....wG.', '.Gw......wG.', '.Gw......wG.', '.Gw......wG.', '.GwwwwwwwwG.', '..GGrwwbGG..'], pal: { w: '#f2f2f2', G: '#8e9aa8', g: '#bfe8ff', r: '#e53935', b: '#1f3c88' } },
    { id: 'liberty-crown', cat: 'hat', name: 'Lady Liberty crown', price: 40, special: true, rows: ['.g..g..g..g.', '.gg.gggg.gg.', '..gggggggg..', '..gGgGGgGg..'], pal: { g: '#4fb39a', G: '#2e7d6b' } },
    { id: 'bearskin', cat: 'hat', name: 'Royal Guard bearskin', price: 50, special: true, hideHair: true, rows: ['..kkkkkkkk..', '..kkkKkkkk..', '..kkkkkkkk..', '..kkkkkkkk..', '..y......y..', '..y......y..', '...y....y...', '....yyyy....'], pal: { k: '#15171b', K: '#3a3a3a', y: '#ffd43b' } },
    // hideHair: covers the whole head, so the hair layer is skipped
    { id: 'ninja-mask', cat: 'hat', name: 'Ninja mask', price: 80, special: true, hideHair: true, y: 1, rows: ['...kkkkkk...', '..kkkkkkkk..', '..RRRRRRRRRR', '..kkkkkkkk.R', '..k......k..', '..kkkkkkkk..', '..kkkkkkkk..', '...kkkkkk...'], pal: { k: '#22252b', R: '#e53935' } },
    { id: 'chef-hat', cat: 'hat', name: 'Chef hat', price: 60, special: true, rows: ['.cccccccccc.', '.ccCccccCcc.', '..cccccccc..', '..CCCCCCCC..'], pal: { c: '#ffffff', C: '#d6dbe1' } },
    { id: 'sans-skull', cat: 'hat', name: 'Sans skull', price: 120, special: true, hideHair: true, y: 2, rows: ['..wwwwwwww..', '.wwwwwwwwww.', '.wkkkwwkkkw.', '.wkWkwwkWkw.', '.wkkkwwkkkw.', '.wwwwkkwwww.', '..wkkkkkkw..'], pal: { w: '#f4f4f0', k: '#1b1b1b', W: '#ffffff' } },
    { id: 'papyrus-skull', cat: 'hat', name: 'Papyrus skull', price: 120, special: true, hideHair: true, y: 1, rows: ['...wwwwww...', '..wwwwwwww..', '..wwwwwwww..', '..wkkwwkkw..', '..wkkwwkkw..', '..wwwwkwww..', '..wkkkkkkw..', '...wkwkwk...'], pal: { w: '#f4f4f0', k: '#1b1b1b' } },
    // ----- extras -----
    { id: 'extra-none', cat: 'extra', name: 'Nothing', price: 0, rows: [] },
    { id: 'shades', cat: 'extra', name: 'Cool shades', price: 20, y: 5, rows: ['..kwkkkkwk..'], pal: { k: '#1b1b1b', w: '#ffffff' } },
    { id: 'glasses', cat: 'extra', name: 'Glasses', price: 15, y: 4, rows: ['..kkk..kkk..', '..kWKkkKWk..'], pal: { k: '#1b1b1b', W: '#ffffff', K: '#1b1b1b' } },
    { id: 'glasses-3d', cat: 'extra', name: '3D glasses', price: 0, unlock: 'video', y: 4, rows: ['..kkkkkkkk..', '..kRRkkBBk..'], pal: { k: '#ffffff', R: '#e53935', B: '#2ee6d6' } },
    { id: 'cape-red', cat: 'extra', name: 'Hero cape', price: 50, behind: true, y: 9, rows: ['.cccccccccc.', 'cccccccccccc', 'cccccccccccc', 'cccccccccccc', 'cccccccccccc', 'cccccccccccc', 'cccccccccccc', 'cccccccccccc', 'cccccccccccc', '.cccccccccc.'], pal: { c: '#d9433b' } },
    { id: 'cape-gold', cat: 'extra', name: 'Champion cape', price: 0, unlock: 'perfect', behind: true, y: 9, rows: ['.cccccccccc.', 'cccccccccccc', 'cccccccccccc', 'cccccccccccc', 'cccccccccccc', 'cccccccccccc', 'cccccccccccc', 'cccccccccccc', 'cccccccccccc', '.cccccccccc.'], pal: { c: '#ffb800' } },
    { id: 'wings', cat: 'extra', name: 'Wings', price: 80, behind: true, y: 8, rows: ['w..........w', 'ww........ww', 'wWw......wWw', 'wWw......wWw', 'ww........ww', 'w..........w'], pal: { w: '#ffffff', W: '#bfefff' } },
    { id: 'pocket-watch', cat: 'extra', name: 'Pocket watch', price: 40, y: 9, rows: ['...y........', '....y.......', '.....y..yyy.', '......yykwy.', '........yyy.'], pal: { y: '#ffd43b', w: '#ffffff', k: '#1b1b1b' } },
    { id: 'golden-quill', cat: 'extra', name: 'Golden quill', price: 0, unlock: 'speller', y: 6, rows: ['...........y', '..........yy', '..........yy', '.........yy.', '.........k..', '........k...'], pal: { y: '#ffd43b', k: '#1b1b1b' } },
    { id: 'designer-scarf', cat: 'extra', name: 'Designer scarf', price: 0, unlock: 'designer', y: 8, rows: ['..cccccccc..', '..cCcCcCcc..', '.......cc...', '.......Cc...'], pal: { c: '#8e5cff', C: '#ffd43b' } },
    { id: 'papyrus-scarf', cat: 'extra', name: 'Papyrus scarf', price: 70, special: true, y: 8, rows: ['..cccccccc..', '..cccccccc..', '.......cc...', '.......cc...', '........cc..'], pal: { c: '#e53935' } },
    { id: 'undyne-patch', cat: 'extra', name: 'Eye patch & grin', price: 50, special: true, y: 4, rows: ['..kkkk......', '..kkk..y....', '............', '....wwww....'], pal: { k: '#1b1b1b', y: '#ffd43b', w: '#ffffff' } },
    { id: 'water-blaster', cat: 'extra', name: 'Songkran water blaster', price: 40, y: 11, rows: ['..........ww', '........bb.w', '.......bbbbb', '.......bcc..', '.......b....'], pal: { b: '#1e88e5', c: '#ffd43b', w: '#7fd0ff' } },
    { id: 'liberty-torch', cat: 'extra', name: 'Liberty torch', price: 40, special: true, y: 1, rows: ['...........o', '..........oy', '..........yo', '..........gg', '...........g', '...........g', '...........g', '...........g'], pal: { o: '#ff8c1a', y: '#ffd43b', g: '#4fb39a' } },
    // ----- pets -----
    { id: 'pet-none', cat: 'pet', name: 'No pet', price: 0, rows: [] },
    { id: 'pet-cat', cat: 'pet', name: 'Pixel cat', price: 40, rows: ['.o....o.', '.oo..oo.', '.oooooo.', '.ogoogo.', '.oooooo.', '..oppo..', '.oooooo.', '.o.oo.o.'], pal: { o: '#ff8c1a', g: '#2e9e3e', p: '#ff7eb6' } },
    { id: 'pet-dog', cat: 'pet', name: 'Pixel dog', price: 40, rows: ['bb....bb', 'bbbbbbbb', '.bkbbkb.', '.bbbbbb.', '.bbkkbb.', '..bbbb..', '.bbbbbb.', '.b.bb.b.'], pal: { b: '#a86b3c', k: '#1b1b1b' } },
    { id: 'pet-robot', cat: 'pet', name: 'Mini Bolt', price: 50, rows: ['...yy...', '.kkkkkk.', '.kcllck.', '.kllllk.', '.kkkkkk.', '.gggggg.', '.g.gg.g.', '.k.kk.k.'], pal: { y: '#ffcc33', k: '#1b1b1b', c: '#2ee6d6', l: '#d9dde3', g: '#8e9aa8' } },
    { id: 'pet-owl', cat: 'pet', name: 'Spelling owl', price: 60, rows: ['b......b', 'bbbbbbbb', 'bwkbbkwb', 'bwwbbwwb', '.bbyybb.', '.bBBBBb.', '.bBBBBb.', '..y..y..'], pal: { b: '#8a5a32', w: '#ffffff', k: '#1b1b1b', y: '#ff8c1a', B: '#e9cfa6' } },
    { id: 'pet-dragon', cat: 'pet', name: 'Baby dragon', price: 100, rows: ['.p.gg.p.', '.pggggp.', 'pgkggkgp', '.gggggg.', '.gyyyyg.', '..gyyg..', '.gg..gg.', '.g....g.'], pal: { g: '#2e9e3e', p: '#8e5cff', k: '#1b1b1b', y: '#ffd43b' } },
    { id: 'pet-annoying-dog', cat: 'pet', name: 'Annoying Dog', price: 100, special: true, rows: ['ww....ww', 'wwwwwwww', '.wkwwkw.', '.wwwwww.', '.wwkkww.', '..wwww..', '.wwwwww.', '.w.ww.w.'], pal: { w: '#ffffff', k: '#1b1b1b' } },
    { id: 'pet-jellyfish', cat: 'pet', name: 'Immortal jelly', price: 100, special: true, rows: ['..kkkk..', '.kPPPPk.', 'kPPrrPPk', 'kPrrrrPk', 'kPkPPkPk', 'kkkkkkkk', '.t.tt.t.', 't.t..t.t'], pal: { k: '#5b2a6e', P: '#ffd1ec', r: '#e53935', t: '#f7a8d8' } },
    { id: 'pet-bear', cat: 'pet', name: 'Marmalade bear', price: 80, special: true, rows: ['.rrrrrr.', 'rrrrrrrr', '.bbbbbb.', '.bkbbkb.', '.bbnnbb.', '.CCCCCC.', '.CCyCCC.', '.bb..bb.'], pal: { r: '#d32f2f', b: '#a86b3c', k: '#1b1b1b', n: '#5a3214', C: '#1e5fbf', y: '#ffd43b' } },
    { id: 'pet-elephant', cat: 'pet', name: 'Baby elephant', price: 100, special: true, rows: ['...gggg.', '..gggggg', 'gGGkgggg', 'gGGggggg', 'g.gggggg', 'g.gggggg', '..gg.gg.', '..gg.gg.'], pal: { g: '#9aa4ae', G: '#7b8590', k: '#1b1b1b' } },
    { id: 'pet-clockcroc', cat: 'pet', name: 'Tick-Tock Croc', price: 100, special: true, rows: ['.kk.kk..', 'kggggggk', 'kgwkgggk', 'kggggggg', 'kgwwwwgk', 'kggywygk', '.kgkkgk.', 'kgk..kgk'], pal: { k: '#1b4d1b', g: '#4caf50', w: '#ffffff', y: '#ffd43b' } },
    { id: 'pet-sunflower', cat: 'pet', name: 'Sunny the sunflower', price: 100, special: true, rows: ['.y.yy.y.', 'yybbbbyy', 'ybkbbkby', 'ybbkkbby', 'yybbbbyy', '.y.gg.y.', '..lgg...', '...ggl..'], pal: { y: '#ffcc33', b: '#8a5a32', k: '#1b1b1b', g: '#2e9e3e', l: '#5bbf3a' } },
    { id: 'pet-tardigrade', cat: 'pet', name: 'Water bear', price: 100, special: true, rows: ['.kkkkkk.', 'kppppppk', 'kpkppkpk', 'kppooppk', 'kpPppPpk', 'kppppppk', '.kkkkkk.', 'k.k..k.k'], pal: { k: '#4a3426', p: '#e9cfa6', P: '#c9a477', o: '#e57373' } },
    { id: 'pet-echo', cat: 'pet', name: 'Echo the ghost', price: 100, special: true, rows: ['..wwww..', '.wwwwww.', 'wwkwwkww', 'wwkwwkww', 'wwwbbwww', 'wwwwwwww', 'wwwwwwww', 'w.ww.ww.'], pal: { w: '#eef3ff', k: '#1b1b1b', b: '#7aa2ff' } },
    { id: 'pet-octopus', cat: 'pet', name: 'An octopus', price: 100, special: true, rows: ['..oooo..', '.oooooo.', 'owkoowko', 'oooooooo', '.oooooo.', 'o.o.o.o.', '.o.o.o.o', 'o.o.o.o.'], pal: { o: '#ff6f91', w: '#ffffff', k: '#1b1b1b' } },
    { id: 'pet-eagle', cat: 'pet', name: 'Bald eagle', price: 80, special: true, rows: ['..wwww..', '.wwwwkw.', '.wwwwwyy', '..bbbbb.', '.bbbbbbb', 'bbbbbbb.', '.bbbbb..', '..y..y..'], pal: { w: '#ffffff', k: '#1b1b1b', y: '#ffb300', b: '#5a3214' } },
    { id: 'pet-bee', cat: 'pet', name: 'Busy bee', price: 60, rows: ['..cc.cc.', '..ccccc.', '.kkkkkk.', 'kwkyykyk', 'kkkyykyk', 'kkkyykyk', '.kkkkkk.', '.k....k.'], pal: { k: '#1b1b1b', y: '#ffd43b', c: '#cfefff', w: '#ffffff' } },
    // ----- level rewards: unlocked by reaching a player level (see LEVEL_REWARDS) -----
    { id: 'pet-bunny', cat: 'pet', name: 'Bouncy bunny', price: 0, unlock: 'lvl:3', rows: ['.w....w.', '.wp..pw.', '.wp..pw.', '.wwwwww.', 'wwkwwkww', 'wwwppwww', '.wwwwww.', '.ww..ww.'], pal: { w: '#f4f4f4', p: '#ffb3cf', k: '#1b1b1b' } },
    { id: 'pirate-hat', cat: 'hat', name: 'Pirate hat', price: 0, unlock: 'lvl:7', rows: ['...kkkkkk...', '..kkkwwkkk..', '.kkkkkkkkkk.', 'kkyyyyyyyykk'], pal: { k: '#1b1b1b', w: '#ffffff', y: '#ffd43b' } },
    { id: 'pirate-coat', cat: 'top', name: 'Pirate coat', price: 0, unlock: 'lvl:7', y: 9, rows: ['.ccccwwcccc.', '.cccywwyccc.', '.ccccwwcccc.', '.cccywwyccc.', '...kkkkkk...'], pal: { c: '#8b1e1e', w: '#ffffff', y: '#ffd43b', k: '#1b1b1b' } },
    { id: 'pirate-trousers', cat: 'legs', name: 'Pirate stripes', price: 0, unlock: 'lvl:7', y: 14, rows: ['...llllll...', '...LL..LL...', '...ll..ll...', '...LL..LL...'], pal: { l: '#f4f4f4', L: '#1e3f8a' } },
    { id: 'parrot', cat: 'extra', name: 'Shoulder parrot', price: 0, unlock: 'lvl:7', y: 5, rows: ['.........rr.', '........rkry', '.........rr.', '.........rb.', '.........rb.'], pal: { r: '#e53935', k: '#1b1b1b', y: '#ffd43b', b: '#1e6fd9' } },
    { id: 'robot-head', cat: 'hat', name: 'Robot head', price: 0, unlock: 'lvl:12', hideHair: true, y: 1, rows: ['.....yy.....', '..mmmmmmmm..', '..mkkkkkkm..', '..mkckkckm..', '..mkkkkkkm..', '..mmrrrrmm..', '..mmmmmmmm..', '...mmmmmm...'], pal: { m: '#b8c2cc', k: '#1b1b1b', c: '#2ee6d6', y: '#ffcc33', r: '#e53935' } },
    { id: 'robot-body', cat: 'top', name: 'Robot body', price: 0, unlock: 'lvl:12', y: 9, rows: ['.mmmmmmmmmm.', '.mmmkkkkmmm.', '.mmmkgrkmmm.', '.mmmkkkkmmm.', '...MMMMMM...'], pal: { m: '#b8c2cc', M: '#8e9aa8', k: '#1b1b1b', g: '#7cfc3a', r: '#e53935' } },
    { id: 'robot-legs', cat: 'legs', name: 'Robot legs', price: 0, unlock: 'lvl:12', y: 14, rows: ['...MMMMMM...', '...mm..mm...', '...MM..MM...', '...mm..mm...'], pal: { m: '#b8c2cc', M: '#8e9aa8' } },
    { id: 'robot-boots', cat: 'shoes', name: 'Robot boots', price: 0, unlock: 'lvl:12', y: 18, rows: ['...kk..kk...', '..kkk..kkk..'], pal: { k: '#5a6470' } },
    { id: 'pet-phoenix', cat: 'pet', name: 'Fire phoenix', price: 0, unlock: 'lvl:18', rows: ['...rr...', '..rooy..', '.rokoyr.', 'rroooorr', 'roooooor', '.rooyor.', '..ryyr..', '..r..r..'], pal: { r: '#e53935', o: '#ff8c1a', y: '#ffd43b', k: '#1b1b1b' } },
    { id: 'legend-helm', cat: 'hat', name: 'Legend helmet', price: 0, unlock: 'lvl:20', hideHair: true, rows: ['.....rr.....', 'w..yyyyyy..w', 'ww.yYyyyy.ww', '.wyyyyyyyyw.', '..y......y..'], pal: { y: '#ffcc33', Y: '#fff3a8', w: '#ffffff', r: '#2ee6d6' } },
    { id: 'legend-armour', cat: 'top', name: 'Legend armour', price: 0, unlock: 'lvl:20', y: 9, rows: ['yyyyyyyyyyyy', '.yyyYYYYyyy.', '.yyyYccYyyy.', '.yyyYYYYyyy.', '...kkyykk...'], pal: { y: '#ffcc33', Y: '#c98a00', c: '#2ee6d6', k: '#1b1b1b' } },
    { id: 'legend-legs', cat: 'legs', name: 'Legend greaves', price: 0, unlock: 'lvl:20', y: 14, rows: ['...yyyyyy...', '...yy..yy...', '...YY..YY...', '...yy..yy...'], pal: { y: '#ffcc33', Y: '#c98a00' } },
    { id: 'legend-boots', cat: 'shoes', name: 'Legend boots', price: 0, unlock: 'lvl:20', y: 18, rows: ['...yy..yy...', '..yyy..yyy..'], pal: { y: '#c98a00' } },
    { id: 'legend-cape', cat: 'extra', name: 'Legend cape', price: 0, unlock: 'lvl:20', behind: true, y: 9, rows: ['.cccccccccc.', 'cccccccccccc', 'cccccccccccc', 'cccccccccccc', 'cccccccccccc', 'cccccccccccc', 'cccccccccccc', 'cccccccccccc', 'cCcCcCcCcCcC', '.CCCCCCCCCC.'], pal: { c: '#7c4dff', C: '#ffd43b' } },
    { id: 'pet-unicorn', cat: 'pet', name: 'Rainbow unicorn', price: 0, unlock: 'lvl:30', rows: ['......y.', '.....yw.', '..m.www.', '.mwwwkw.', 'mbwwwww.', 'mwwwww..', '.ww.ww..', '.w..w...'], pal: { w: '#ffffff', y: '#ffd43b', m: '#ff7eb6', b: '#8e5cff', k: '#1b1b1b' } },
  ];
  // ---------- background scenes (change the sky, decorations and ground everywhere) ----------
  const svgURI = (w, hh, inner) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${hh}' viewBox='0 0 ${w} ${hh}' shape-rendering='crispEdges'>${inner}</svg>`)}")`;
  const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const scatter = (n, w, hh, seed, f) => { const r = rng(seed); let s = ''; for (let i = 0; i < n; i++) s += f(Math.floor(r() * w), Math.floor(r() * hh), r()); return s; };
  const cloudSVG = fill => svgURI(400, 120, `<g fill='${fill}' opacity='.85'><rect x='40' y='20' width='60' height='10'/><rect x='30' y='30' width='90' height='10'/><rect x='20' y='40' width='110' height='10'/><rect x='250' y='60' width='40' height='10'/><rect x='240' y='70' width='70' height='10'/><rect x='230' y='80' width='100' height='10'/></g>`);
  const starsSVG = (seed, n = 30) => svgURI(300, 300, scatter(n, 300, 300, seed, (x, y, r) => r > 0.85
    ? `<rect x='${x - 2}' y='${y}' width='5' height='1' fill='#fff'/><rect x='${x}' y='${y - 2}' width='1' height='5' fill='#fff'/>`
    : `<rect x='${x}' y='${y}' width='${r > 0.5 ? 3 : 2}' height='${r > 0.5 ? 3 : 2}' fill='${r > 0.7 ? '#ffe9a8' : '#ffffff'}'/>`));
  const SCENES = [
    { id: 'scene-sunny', name: 'Sunny day', price: 0, sky: ['#5fb8f5', '#c4e8ff'], deco: cloudSVG('#ffffff'), decoSize: '900px 270px', repeat: 'repeat-x', ground: ['#5bbf3a', '#3d8a26', '#8a5a32', '#6b4425'], game: 'clouds' },
    { id: 'scene-sunset', name: 'Sunset', price: 20, sky: ['#ff8a5c', '#ffd88a'], deco: cloudSVG('#ffd1e0'), decoSize: '900px 270px', repeat: 'repeat-x',
      deco2: svgURI(200, 200, `<circle cx='100' cy='100' r='70' fill='#ffe66b'/><circle cx='100' cy='100' r='56' fill='#fff3a8'/>`), deco2Pos: 'right 8% top 160px', deco2Size: '200px', ground: ['#5bbf3a', '#3d8a26', '#8a5a32', '#6b4425'], game: 'clouds' },
    { id: 'scene-night', name: 'Night sky', price: 30, sky: ['#0b1446', '#2a3a7a'], deco: starsSVG(7), decoSize: '300px 300px', repeat: 'repeat',
      deco2: svgURI(160, 160, `<circle cx='80' cy='80' r='54' fill='#fff6c2'/><circle cx='60' cy='65' r='9' fill='#e8dc9a'/><circle cx='98' cy='98' r='12' fill='#e8dc9a'/><circle cx='95' cy='55' r='6' fill='#e8dc9a'/>`), deco2Pos: 'right 8% top 130px', deco2Size: '150px', ground: ['#2f7a22', '#1f5416', '#5a3a20', '#432a16'], game: 'stars' },
    { id: 'scene-snow', name: 'Snowy', price: 30, sky: ['#7fa9d6', '#d9ecfa'], deco: svgURI(240, 240, scatter(26, 240, 240, 11, (x, y, r) => `<rect x='${x}' y='${y}' width='${r > 0.6 ? 4 : 3}' height='${r > 0.6 ? 4 : 3}' fill='#ffffff'/>`)), decoSize: '240px 240px', repeat: 'repeat',
      ground: ['#ffffff', '#cfe3f2', '#8a5a32', '#6b4425'], game: 'snow' },
    { id: 'scene-sea', name: 'Underwater', price: 50, sky: ['#0a5ea8', '#46b8e8'], deco: svgURI(260, 260, scatter(14, 260, 260, 23, (x, y, r) => `<circle cx='${x}' cy='${y}' r='${Math.round(3 + r * 7)}' fill='none' stroke='#ffffff' stroke-opacity='.6' stroke-width='2'/>`)), decoSize: '260px 260px', repeat: 'repeat',
      deco2: svgURI(160, 90, `<g><rect x='20' y='30' width='40' height='20' fill='#ff8c1a'/><rect x='60' y='34' width='10' height='12' fill='#ff8c1a'/><rect x='10' y='26' width='12' height='28' fill='#ff8c1a'/><rect x='48' y='34' width='5' height='5' fill='#1b1b1b'/><rect x='95' y='55' width='30' height='14' fill='#ffd43b'/><rect x='125' y='58' width='8' height='8' fill='#ffd43b'/><rect x='88' y='52' width='9' height='20' fill='#ffd43b'/><rect x='116' y='58' width='4' height='4' fill='#1b1b1b'/></g>`), deco2Pos: 'left 6% top 200px', deco2Size: '220px', ground: ['#f2d48a', '#d9b866', '#c9a35a', '#a9843f'], game: 'bubbles' },
    { id: 'scene-jungle', name: 'Jungle', price: 50, sky: ['#3f8f55', '#a9e0a0'], deco: svgURI(240, 200, `<g fill='#1f6b2a'>${[[20, 120], [110, 170], [190, 80]].map(([x, len]) => { let g = ''; for (let y = 0; y < len; y += 10) g += `<rect x='${x + ((y / 10) % 2 ? 2 : 0)}' y='${y}' width='6' height='10'/>`; for (let y = 20; y < len; y += 30) g += (y / 30) % 2 < 1 ? `<rect x='${x - 14}' y='${y}' width='14' height='8' fill='#3f9e2c'/><rect x='${x - 10}' y='${y + 8}' width='8' height='4' fill='#3f9e2c'/>` : `<rect x='${x + 8}' y='${y}' width='14' height='8' fill='#3f9e2c'/><rect x='${x + 12}' y='${y + 8}' width='8' height='4' fill='#3f9e2c'/>`; return g; }).join('')}</g>`), decoSize: '300px 240px', repeat: 'repeat-x',
      ground: ['#3f9e2c', '#28701b', '#5e3b1d', '#452a14'], game: 'leaves' },
    { id: 'scene-space', name: 'Space galaxy', price: 70, sky: ['#0b0624', '#4a1a6b'], deco: starsSVG(31, 40), decoSize: '300px 300px', repeat: 'repeat',
      deco2: svgURI(220, 160, `<ellipse cx='110' cy='82' rx='100' ry='22' fill='none' stroke='#ffd43b' stroke-width='8'/><circle cx='110' cy='80' r='50' fill='#ff7eb6'/><rect x='70' y='58' width='80' height='10' fill='#ff9cc7'/><rect x='66' y='86' width='88' height='8' fill='#e05a9a'/><path d='M14 90 A100 22 0 0 0 206 90' fill='none' stroke='#ffd43b' stroke-width='8'/><circle cx='196' cy='24' r='12' fill='#9ad7ff'/>`), deco2Pos: 'right 6% top 130px', deco2Size: '240px', ground: ['#c4c4d4', '#9a9aae', '#6e6e84', '#55556a'], game: 'stars' },
    { id: 'scene-choc', name: 'Chocolate factory', price: 70, sky: ['#ffc2dc', '#ffe6f0'],
      deco: svgURI(240, 240, scatter(10, 220, 220, 5, (x, y, r) => r < 0.33
        ? `<rect x='${x + 6}' y='${y + 12}' width='3' height='16' fill='#ffffff'/><circle cx='${x + 7}' cy='${y + 8}' r='9' fill='${r < 0.16 ? '#e53935' : '#2ee6d6'}'/><circle cx='${x + 7}' cy='${y + 8}' r='4' fill='#ffffff'/>`
        : r < 0.66 ? `<rect x='${x}' y='${y + 4}' width='18' height='12' fill='#8e5cff'/><path d='M${x} ${y + 10} l-7 -6 v12 z M${x + 18} ${y + 10} l7 -6 v12 z' fill='#8e5cff'/>`
          : `<rect x='${x}' y='${y}' width='22' height='14' fill='#5a2d0c'/><rect x='${x + 2}' y='${y + 2}' width='8' height='4' fill='#7a3f17'/><rect x='${x + 12}' y='${y + 2}' width='8' height='4' fill='#7a3f17'/><rect x='${x + 2}' y='${y + 8}' width='8' height='4' fill='#7a3f17'/><rect x='${x + 12}' y='${y + 8}' width='8' height='4' fill='#7a3f17'/>`)),
      decoSize: '380px 380px', repeat: 'repeat', stripes: true,
      deco2: svgURI(240, 400, `<rect x='0' y='40' width='150' height='34' fill='#8e9aa8'/><rect x='0' y='40' width='150' height='8' fill='#c9d1da'/><rect x='130' y='30' width='40' height='54' fill='#6f7a87'/><rect x='134' y='84' width='32' height='316' fill='#5a2d0c'/><rect x='142' y='84' width='8' height='316' fill='#7a3f17'/><rect x='156' y='120' width='4' height='280' fill='#3d1d08'/><rect x='110' y='370' width='80' height='30' fill='#5a2d0c'/><rect x='100' y='360' width='14' height='12' fill='#7a3f17'/><rect x='186' y='358' width='14' height='12' fill='#7a3f17'/><rect x='20' y='96' width='70' height='40' fill='#5a2d0c'/><rect x='24' y='100' width='14' height='14' fill='#7a3f17'/><rect x='42' y='100' width='14' height='14' fill='#7a3f17'/><rect x='60' y='100' width='14' height='14' fill='#7a3f17'/><rect x='24' y='118' width='14' height='14' fill='#7a3f17'/><rect x='42' y='118' width='14' height='14' fill='#7a3f17'/><rect x='60' y='118' width='14' height='14' fill='#7a3f17'/><rect x='72' y='96' width='22' height='40' fill='#e53935'/>`), deco2Pos: 'left 2% bottom 40px', deco2Size: '240px 400px',
      ground: ['#7a3f17', '#5a2d0c', '#3d1d08', '#2e1405'], game: 'sweets' },
    { id: 'scene-rainbow', name: 'Rainbow land', price: 0, unlock: 'lvl:5', sky: ['#a8dcff', '#fff0fb'], deco: cloudSVG('#ffffff'), decoSize: '900px 270px', repeat: 'repeat-x',
      deco2: svgURI(300, 160, ['#e53935', '#ff8c1a', '#ffd43b', '#2e9e3e', '#1e6fd9', '#8e5cff'].map((c, i) => `<path d='M${20 + i * 12} 160 A${130 - i * 12} ${130 - i * 12} 0 0 1 ${280 - i * 12} 160' fill='none' stroke='${c}' stroke-width='12'/>`).join('')), deco2Pos: 'left 4% top 150px', deco2Size: '340px',
      ground: ['#ff9ccf', '#e86fae', '#b0698f', '#8c4f72'], game: 'sweets' },
    { id: 'scene-volcano', name: 'Volcano island', price: 0, unlock: 'lvl:10', sky: ['#2a0a0a', '#ff7a3a'],
      deco: svgURI(240, 240, scatter(22, 240, 240, 41, (x, y, r) => `<rect x='${x}' y='${y}' width='${r > 0.6 ? 4 : 3}' height='${r > 0.6 ? 4 : 3}' fill='${r > 0.5 ? '#ffd43b' : '#ff8c1a'}'/>`)), decoSize: '240px 240px', repeat: 'repeat',
      deco2: svgURI(260, 200, `<path d='M0 200 L90 60 L110 50 L150 50 L170 60 L260 200 Z' fill='#3a2a24'/><path d='M110 50 L150 50 L142 96 L132 72 L122 110 Z' fill='#ff6a00'/><rect x='116' y='22' width='26' height='22' fill='#7a6a64' opacity='.7'/><rect x='104' y='0' width='34' height='18' fill='#7a6a64' opacity='.5'/>`), deco2Pos: 'right 4% bottom 40px', deco2Size: '300px',
      ground: ['#ff6a00', '#c43d00', '#3a2a24', '#241915'], game: 'stars' },
    { id: 'scene-castle', name: 'Castle at dusk', price: 0, unlock: 'lvl:15', sky: ['#2b1d5c', '#8a6fd1'], deco: starsSVG(53, 25), decoSize: '300px 300px', repeat: 'repeat',
      deco2: svgURI(280, 220, `<g fill='#3b3f5c'><rect x='20' y='60' width='50' height='160'/><rect x='210' y='60' width='50' height='160'/><rect x='70' y='110' width='140' height='110'/><rect x='110' y='40' width='60' height='180'/>${[20, 210, 110].map(x => [0, 20, 40].map(d => `<rect x='${x + d}' y='${x === 110 ? 28 : 48}' width='12' height='12'/>`).join('')).join('')}</g><rect x='128' y='170' width='24' height='50' fill='#1b1b2e'/><g fill='#ffd43b'><rect x='38' y='100' width='12' height='16'/><rect x='228' y='100' width='12' height='16'/><rect x='134' y='80' width='12' height='16'/></g><rect x='139' y='4' width='3' height='26' fill='#1b1b2e'/><rect x='142' y='4' width='18' height='10' fill='#e53935'/>`), deco2Pos: 'right 4% bottom 40px', deco2Size: '320px',
      ground: ['#4c8a3a', '#2f5e24', '#6b6b78', '#4a4a55'], game: 'stars' },
    { id: 'scene-aurora', name: 'Northern lights', price: 0, unlock: 'lvl:25', sky: ['#04122b', '#0d3b4f'], deco: starsSVG(77, 30), decoSize: '300px 300px', repeat: 'repeat',
      deco2: svgURI(600, 200, ['#7cfc3a', '#2ee6d6', '#8e5cff'].map((c, i) => `<path d='M0 ${60 + i * 30} Q150 ${10 + i * 30} 300 ${70 + i * 30} T600 ${50 + i * 30}' fill='none' stroke='${c}' stroke-opacity='.55' stroke-width='18'/>`).join('')), deco2Pos: 'center top 90px', deco2Size: '900px 300px',
      ground: ['#ffffff', '#cfe3f2', '#5a6a7a', '#3e4a57'], game: 'snow' },
  ];
  // Scene → CSS variables used by lesson.css (page background, ground strip, avatar backdrops)
  function sceneVars(sc) {
    return {
      '--sky1': sc.sky[0], '--sky2': sc.sky[1],
      '--deco': sc.deco || 'none', '--deco-size': sc.decoSize || 'auto', '--deco-repeat': sc.repeat || 'repeat',
      '--deco2': sc.deco2 || 'none', '--deco2-pos': sc.deco2Pos || 'right top', '--deco2-size': sc.deco2Size || 'auto',
      '--stripes': sc.stripes ? 'repeating-linear-gradient(135deg, rgba(255,255,255,.35) 0 22px, transparent 22px 44px)' : 'none',
      '--g1': sc.ground[0], '--g2': sc.ground[1], '--g3': sc.ground[2], '--g4': sc.ground[3],
    };
  }
  function applyScene(id) {
    const sc = SCENES.find(s => s.id === id) || SCENES[0];
    Object.entries(sceneVars(sc)).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
    return sc;
  }
  // a CSS background for a small box (avatar backdrop / scene tile)
  function sceneBox(id) {
    const sc = SCENES.find(s => s.id === id) || SCENES[0];
    return `${sc.deco2 ? sc.deco2 + ' right 4px top 4px / 45% no-repeat, ' : ''}${sc.deco ? sc.deco + ' 0 0 / 160px ' + sc.repeat + ', ' : ''}linear-gradient(transparent 76%, ${sc.ground[0]} 76%, ${sc.ground[0]} 82%, ${sc.ground[2]} 82%), ${sc.stripes ? 'repeating-linear-gradient(135deg, rgba(255,255,255,.35) 0 10px, transparent 10px 20px), ' : ''}linear-gradient(${sc.sky[0]}, ${sc.sky[1]})`;
  }

  // Costumes: whole outfits bought and worn in one go. Price = the parts you don't own yet.
  const COSTUMES = [
    { id: 'set-ff', name: 'Foltyn Family', special: true, parts: { top: 'ff-hoodie', hat: 'hat-none' } },
    { id: 'set-ninja', name: 'Ninja', special: true, parts: { hat: 'ninja-mask', top: 'ninja-gi', legs: 'ninja-trousers', shoes: 'ninja-tabi', extra: 'extra-none' } },
    { id: 'set-chef', name: 'Chef', special: true, parts: { hat: 'chef-hat', top: 'chef-jacket', legs: 'chef-trousers', extra: 'extra-none' } },
    { id: 'set-sans', name: 'Sans', special: true, parts: { hat: 'sans-skull', top: 'sans-hoodie', legs: 'sans-shorts', shoes: 'sans-slippers', extra: 'extra-none' } },
    { id: 'set-papyrus', name: 'Papyrus', special: true, parts: { hat: 'papyrus-skull', top: 'papyrus-armour', legs: 'papyrus-shorts', shoes: 'papyrus-boots', extra: 'papyrus-scarf' } },
    { id: 'set-undyne', name: 'Undyne', special: true, parts: { skin: 'skin-undyne', hair: 'undyne-ponytail', hat: 'hat-none', top: 'undyne-top', legs: 'jeans', shoes: 'boots', extra: 'undyne-patch' } },
    { id: 'set-anpan', name: 'Anpanman', special: true, parts: { hat: 'anpan-head', top: 'anpan-suit', legs: 'anpan-legs', shoes: 'boots', extra: 'cape-red' } },
    { id: 'set-guard', name: 'Royal Guard', special: true, parts: { hat: 'bearskin', top: 'guard-tunic', legs: 'trousers-black', shoes: 'boots', extra: 'extra-none' } },
    { id: 'set-astronaut', name: 'Astronaut', special: true, parts: { hat: 'astro-helmet', top: 'space-top', legs: 'space-legs', shoes: 'boots', extra: 'extra-none' } },
    { id: 'set-liberty', name: 'Lady Liberty', special: true, parts: { hat: 'liberty-crown', top: 'liberty-robe', legs: 'liberty-legs', shoes: 'boots', extra: 'liberty-torch' } },
    { id: 'set-frisk', name: 'Frisk', special: true, parts: { hair: 'hair-bob', hairColor: 'hc-brown', hat: 'hat-none', top: 'frisk-jumper', legs: 'jeans', shoes: 'boots', extra: 'extra-none' } },
    // level-reward costumes: every part unlocks at the same level
    { id: 'set-pirate', name: 'Pirate', unlock: 'lvl:7', parts: { hat: 'pirate-hat', top: 'pirate-coat', legs: 'pirate-trousers', extra: 'parrot' } },
    { id: 'set-robot', name: 'Robot', unlock: 'lvl:12', parts: { hat: 'robot-head', top: 'robot-body', legs: 'robot-legs', shoes: 'robot-boots', extra: 'extra-none' } },
    { id: 'set-legend', name: 'Legend', unlock: 'lvl:20', parts: { hat: 'legend-helm', top: 'legend-armour', legs: 'legend-legs', shoes: 'legend-boots', extra: 'legend-cape' } },
  ];

  // ---------- player level: one level for the whole game, from every gem ever earned ----------
  // Spending gems never lowers it. Each level needs 5 more gems than the one before (10, 15, 20, …).
  const XP_BASE = 10, XP_STEP = 5;
  const TITLES = [[1, 'Rookie'], [5, 'Explorer'], [10, 'Adventurer'], [15, 'Hero'], [20, 'Champion'], [25, 'Legend'], [30, 'Mythic']];
  const LEVEL_REWARDS = [
    { level: 3, id: 'pet-bunny', label: '🐾 Bouncy bunny pet' },
    { level: 5, id: 'scene-rainbow', label: '🌄 Rainbow land scene' },
    { level: 7, id: 'set-pirate', label: '🎭 Pirate costume' },
    { level: 10, id: 'scene-volcano', label: '🌄 Volcano island scene' },
    { level: 12, id: 'set-robot', label: '🎭 Robot costume' },
    { level: 15, id: 'scene-castle', label: '🌄 Castle at dusk scene' },
    { level: 18, id: 'pet-phoenix', label: '🐾 Fire phoenix pet' },
    { level: 20, id: 'set-legend', label: '🎭 Legend costume' },
    { level: 25, id: 'scene-aurora', label: '🌄 Northern lights scene' },
    { level: 30, id: 'pet-unicorn', label: '🐾 Rainbow unicorn pet' },
  ];
  // gems needed to reach a level, from zero
  const xpFor = lvl => { let n = 0; for (let k = 1; k < lvl; k++) n += XP_BASE + XP_STEP * (k - 1); return n; };
  function levelInfo(xp = wallet().earned) {
    let level = 1;
    while (xp >= xpFor(level + 1)) level++;
    const start = xpFor(level), need = xpFor(level + 1) - start;
    const title = TITLES.filter(t => level >= t[0]).pop()[1];
    return { level, xp, into: xp - start, need, toNext: start + need - xp, title, next: LEVEL_REWARDS.find(r => r.level > level) || null };
  }
  const levelOfUnlock = u => (/^lvl:(\d+)$/.exec(u || '') || [])[1] | 0;
  // Rewards reached since the player last saw them (shown once as a pop-up), then remembered as seen.
  const SEENKEY = 'y3:levelSeen';
  function newRewards(level = levelInfo().level) {
    const seen = store.get(SEENKEY, 1);
    return LEVEL_REWARDS.filter(r => r.level > seen && r.level <= level);
  }
  const markSeen = (level = levelInfo().level) => store.set(SEENKEY, Math.max(level, store.get(SEENKEY, 1)));

  const UNLOCK_TEXT = {
    boss: 'Beat any boss to unlock',
    artist: 'Finish Pixel Art Studio to unlock',
    designer: 'Finish Design a Poster to unlock',
    wonder: 'Finish any Wonders of the World lesson to unlock',
    speller: 'Finish any Word Kingdom lesson to unlock',
    miner: 'Finish any Maths Mine lesson to unlock',
    gardener: 'Finish any Plants lesson to unlock',
    traveller: 'Finish any Around the World lesson to unlock',
    perfect: 'Get a perfect boss score to unlock',
    video: 'Finish any video quest to unlock',
  };
  const CATS = [
    ['costume', '🎭 Costumes'], ['skin', '🙂 Skin'], ['hair', '💇 Hair'], ['hairColor', '🎨 Hair colour'], ['top', '👕 Tops'], ['legs', '👖 Bottoms'],
    ['shoes', '👟 Shoes'], ['hat', '🎩 Hats'], ['extra', '✨ Extras'], ['pet', '🐾 Pets'], ['scene', '🌄 Scenes'],
  ];
  const DEFAULT_LOOK = { skin: 'skin1', hairColor: 'hc-brown', hair: 'hair-short', top: 'tee-grey', legs: 'jeans', shoes: 'trainers', hat: 'hat-none', extra: 'extra-none', pet: 'pet-none', scene: 'scene-sunny' };
  const byId = id => ITEMS.find(i => i.id === id) || SKINS.find(i => i.id === id) || HAIR_COLOURS.find(i => i.id === id) || SCENES.find(i => i.id === id) || COSTUMES.find(i => i.id === id);

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
  const unlockText = u => levelOfUnlock(u) ? `Reach player level ${levelOfUnlock(u)} to unlock` : UNLOCK_TEXT[u] || 'Keep playing to unlock!';
  const unlocked = u => levelOfUnlock(u) ? levelInfo().level >= levelOfUnlock(u) : !!achievements()[u];
  function isFree(it) { return !it.price && !it.unlock; }
  const partsOf = it => Object.values(it.parts).map(byId);
  function owns(it, a = load()) {
    if (it.parts) return partsOf(it).every(p => owns(p, a));
    return isFree(it) || a.owned.includes(it.id) || (it.unlock && unlocked(it.unlock));
  }
  function priceOf(it, a = load()) { return it.parts ? partsOf(it).filter(p => !owns(p, a)).reduce((n, p) => n + (p.price || 0), 0) : it.price || 0; }
  function buy(id) {
    const it = byId(id), a = load(), w = wallet();
    if (!it || owns(it, a) || it.unlock || w.balance < priceOf(it, a)) return false;
    store.set(WKEY, { earned: w.earned, spent: w.spent + priceOf(it, a) });
    (it.parts ? partsOf(it).filter(p => !owns(p, a)) : [it]).forEach(p => a.owned.push(p.id));
    save({ owned: a.owned });
    return true;
  }
  function wear(id) {
    const it = byId(id); if (!it) return;
    if (it.parts) { const a = load(); Object.assign(a.look, it.parts); save({ look: a.look }); return; }
    const cat = SKINS.includes(it) ? 'skin' : HAIR_COLOURS.includes(it) ? 'hairColor' : SCENES.includes(it) ? 'scene' : it.cat;
    const a = load(); a.look[cat] = id; save({ look: a.look });
    if (cat === 'scene') applyScene(id);
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
    const hideHair = part('hat') && part('hat').hideHair;
    ['legs', 'shoes', 'top', 'hair', 'hat'].forEach(cat => { if (!(cat === 'hair' && hideHair)) layer(part(cat)); });
    if (extra && !extra.behind) layer(extra);
    if (withPet) { const p = part('pet'); paint(ctx, p.rows, p.pal, W + 2, H - p.rows.length, s); }
    return c;
  }
  const dataURL = (look, opts) => draw(look, opts).toDataURL();

  const sceneDef = () => SCENES.find(s => s.id === load().look.scene) || SCENES[0];
  window.Avatar = { ITEMS, SKINS, HAIR_COLOURS, SCENES, COSTUMES, CATS, UNLOCK_TEXT, LEVEL_REWARDS, levelInfo, levelOfUnlock, unlockText, newRewards, markSeen, DEFAULT_LOOK, byId, load, save, wallet, earn, achievements, owns, priceOf, buy, wear, draw, dataURL, isFree, applyScene, sceneBox, sceneDef };
  // every page that loads this file shows the player's chosen scene
  applyScene(load().look.scene);
})();
