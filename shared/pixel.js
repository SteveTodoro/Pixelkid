/* Pixel-art helper: turn rows of letters into a crisp blocky SVG.
 * Pixel.svg(rows, palette) — each character is one pixel; '.' (or any letter not in the palette) is see-through.
 * Pixel.sprites — ready-made sprites any lesson can use.
 */
(function () {
  'use strict';
  function svg(rows, pal) {
    const hgt = rows.length, w = Math.max(...rows.map(r => r.length));
    let rects = '';
    rows.forEach((r, y) => {
      for (let x = 0; x < r.length; x++) {
        const c = pal[r[x]];
        if (c) rects += `<rect x="${x}" y="${y}" width="1.03" height="1.03" fill="${c}"/>`;
      }
    });
    return `<svg viewBox="0 0 ${w} ${hgt}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" role="img">${rects}</svg>`;
  }

  const K = '#1b1b1b';
  const sprites = {
    robot: svg([
      '.....yy.....',
      '.....kk.....',
      '..kkkkkkkk..',
      '.kllllllllk.',
      '.klccllcclk.',
      '.klccllcclk.',
      '.kllllllllk.',
      '.kllkkkkllk.',
      '.kllllllllk.',
      '..kkkkkkkk..',
      '.kkggggggkk.',
      'kgkgrggygkgk',
      'kgkggggggkgk',
      '..kggggggk..',
      '..kgk..kgk..',
      '..kkk..kkk..',
    ], { k: K, l: '#d9dde3', c: '#2ee6d6', g: '#8e9aa8', y: '#ffcc33', r: '#ff5252' }),

    // Bolt in costume for the Around the World lessons
    boltJapan: svg([ // rising-sun headband (hachimaki) and a festival happi coat
      '.....yy.....',
      '.....kk.....',
      '..kkkkkkkk..',
      'wwwwwrrwwwww',
      '.klccllcclww',
      '.klccllcclk.',
      '.kllllllllk.',
      '.kllkkkkllk.',
      '.kllllllllk.',
      '..kkkkkkkk..',
      '.kkbWbbWbkk.',
      'kbkbWbbWbkbk',
      'kbkbWbbWbkbk',
      '..kbWbbWbk..',
      '..kgk..kgk..',
      '..kkk..kkk..',
    ], { k: K, l: '#d9dde3', c: '#2ee6d6', g: '#8e9aa8', y: '#ffcc33', w: '#ffffff', r: '#e53935', b: '#1f3c88', W: '#ffffff' }),
    boltEngland: svg([ // the King's Guard: a tall bearskin hat and a red tunic
      '...kkkkkk...',
      '..kkkKkkkk..',
      '..kkkkkkkk..',
      '..kkkkkkkk..',
      '..kkkkkkkk..',
      '.kllllllllk.',
      '.klccllcclk.',
      '.klccllcclk.',
      '.kllkkkkllk.',
      '.kyllllllyk.',
      '..kkkkkkkk..',
      '.kkrrrrrrkk.',
      'krkrrYrrrkrk',
      'krkrrYrrrkrk',
      '..kwwwwwwk..',
      '..kkk..kkk..',
      '..kkk..kkk..',
    ], { k: K, K: '#3a3a3a', l: '#d9dde3', c: '#2ee6d6', y: '#ffd43b', Y: '#ffd43b', r: '#d32f2f', w: '#ffffff' }),
    boltThailand: svg([ // a golden chada crown (like Thai dancers wear) and a silk top
      '.....yy.....',
      '....yyyy....',
      '....yYYy....',
      '...yyyyyy...',
      '..yyyyyyyy..',
      '..yYyyyyYy..',
      '.kllllllllk.',
      '.klccllcclk.',
      '.klccllcclk.',
      '.kllkkkkllk.',
      '.kllllllllk.',
      '..kkkkkkkk..',
      '.kkyyyyyykk.',
      'kpkppyyppkpk',
      'kpkppppppkpk',
      '..kpppppkk..',
      '..kgk..kgk..',
      '..kkk..kkk..',
    ], { k: K, l: '#d9dde3', c: '#2ee6d6', g: '#8e9aa8', y: '#ffcc33', Y: '#e53935', p: '#8e24aa' }),

    boltUSA: svg([ // the Statue of Liberty: a spiky green crown and a green robe
      '.g..g..g..g.',
      '.gg.gggg.gg.',
      '..gggggggg..',
      '..gGgGGgGg..',
      '.kllllllllk.',
      '.klccllcclk.',
      '.klccllcclk.',
      '.kllkkkkllk.',
      '.kllllllllk.',
      '..kkkkkkkk..',
      '.kkggggggkk.',
      'kgkgggGggkgk',
      'kgkggGgggkgk',
      '..kggggggk..',
      '..kgk..kgk..',
      '..kkk..kkk..',
    ], { k: K, l: '#d9dde3', c: '#2ee6d6', g: '#4fb39a', G: '#2e7d6b' }),

    magnet: svg([
      'kkkk....kkkk',
      'kwwk....kwwk',
      'kwwk....kwwk',
      'khrk....khrk',
      'khrk....khrk',
      'khrk....khrk',
      'khrkkkkkkhrk',
      'khrrrrrrrrrk',
      'krrrrrrrrrrk',
      '.krrrrrrrrk.',
      '..kkkkkkkk..',
    ], { k: K, w: '#e6e6e6', r: '#e53935', h: '#ff8a80' }),

    magnetron: svg([
      'kkkk....kkkk',
      'kwwk....kwwk',
      'kwwk....kwwk',
      'krrk....krrk',
      'krrk....krrk',
      'krrkkkkkkrrk',
      'krrrrrrrrrrk',
      'krkkrrrrkkrk',
      'krrwkrrkwrrk',
      'krrrrrrrrrrk',
      'krrkwwwwkrrk',
      '.krrkkkkrrk.',
      '..kkkkkkkk..',
    ], { k: K, w: '#ffffff', r: '#b71c1c' }),

    // Quill the Word Wizard (Word Kingdom mascot): pointy hat, big beard, magic quill
    wizard: svg([
      '.....kk.......',
      '....kppk......',
      '....kpppk.....',
      '...kpypppk....',
      '...kppppppk...',
      '..kkkkkkkkkk..',
      '...kssssssk...',
      '...kskssksk..y',
      '...kssssssk.yk',
      '...kwwwwwwk.k.',
      '..kpwwwwwwpkk.',
      '.kppwwwwwwppk.',
      '.kpppwwwwpppk.',
      '.kpppppppppk..',
      '..kpppppppk...',
      '..kkk...kkk...',
    ], { k: K, p: '#6a3cc9', y: '#ffd43b', s: '#f2c9a0', w: '#f4f4f4' }),

    // Grumblegob the spelling goblin (Word Kingdom boss)
    goblin: svg([
      'k..........k',
      'gk..kkkk..kg',
      'ggkkggggkkgg',
      '.kggggggggk.',
      '.kgykggykgk.',
      '.kggggggggk.',
      '.kgkwkwkwgk.',
      '..kgkkkkgk..',
      '.kbbbbbbbbk.',
      'kgbbbbbbbbgk',
      'k.kbbbbbbk.k',
      '..kgk..kgk..',
      '..kkk..kkk..',
    ], { k: K, g: '#6bbf3a', y: '#ffd43b', w: '#ffffff', b: '#8a5a32' }),

    // Tock the Clock-Bot (Maths Mine mascot for time lessons)
    tock: svg([
      '....kkkkk....',
      '..kkwwrwwkk..',
      '.kwbwwrwwbwk.',
      '.kwbwwrwwbwk.',
      'kwwwwwrwwwwwk',
      'kwwwwwykkkwwk',
      'kwwwwwwwwwwwk',
      '.kwwkwwwkwwk.',
      '.kwwwkkkwwwk.',
      '..kkwwwwwkk..',
      '....kkkkk....',
      '.....kgk.....',
      '..kkkgggkkk..',
      '.kgggggggggk.',
      'kgkggggyggkgk',
      'k.kgggggggk.k',
      '..kgk...kgk..',
      '..kkk...kkk..',
    ], { k: K, w: '#ffffff', r: '#d9433b', y: '#ffd43b', b: '#1e88e5', g: '#e09a00' }),

  };

  window.Pixel = { svg, sprites };
})();
