/* Pixelkid Lesson mode – the calm home page: a world's lessons as a grid of tiles, grouped by topic, with no map, hero walk
 * or NPCs. index.html calls drawGrid(world, lessons, stateOf) instead of drawMap when the player picks 📚 Lessons.
 * It uses the map's questStops (so a quest unlocks at the same time in both modes) and its quest card (questCard).
 * Styles: shared/lesson-grid.css.
 */
'use strict';
function drawGrid(key, lessons, stateOf) {
  if (mapHero) { mapHero.stop(); mapHero = null; } // coming from the map: stop its hero
  cancelAnimationFrame(walking);
  const stops = questStops(lessons, stateOf);
  const grid = document.createElement('div');
  grid.className = 'lgrid';
  // one block per topic, in road order (a topic that comes back later on another branch joins its first block)
  const units = new Map();
  stops.forEach(s => { if (!units.has(s.l.unit)) units.set(s.l.unit, []); units.get(s.l.unit).push(s); });
  units.forEach((list, unit) => {
    const sec = document.createElement('section');
    sec.className = 'lunit';
    const h = document.createElement('h2');
    h.textContent = (LANDMARK[unit] ? LANDMARK[unit] + ' ' : '') + unit;
    const row = document.createElement('div');
    row.className = 'ltiles';
    list.forEach(s => {
      const glow = glowsNext(stops, s);
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'ltile ' + s.st + (glow ? ' next' : '');
      b.innerHTML = '<span class="lt-icon"></span><span class="lt-title"></span><span class="lt-tag"></span>';
      b.querySelector('.lt-icon').textContent = s.l.emoji;
      b.querySelector('.lt-title').textContent = s.l.title;
      b.querySelector('.lt-tag').textContent = glow ? (s.st === 'going' ? 'KEEP GOING!' : 'NEXT') : { done: '✔ CLEARED', going: 'STARTED', new: 'OPEN', locked: '🔒 LOCKED', soon: 'SOON' }[s.st];
      b.setAttribute('aria-label', `${s.l.title}: ${{ done: 'cleared', going: 'started', new: 'open', locked: 'locked', soon: 'coming soon' }[s.st]}`);
      b.onclick = () => questCard(s, glow);
      row.append(b);
    });
    sec.append(h, row);
    grid.append(sec);
  });
  mapWrap.replaceChildren(grid);
}
