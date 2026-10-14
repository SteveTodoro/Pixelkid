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

  };

  window.Pixel = { svg, sprites };
})();
