# Year 3 Lesson Library — Topic Ideas (UK National Curriculum)

Each lesson is about 30 minutes: Start → Read → Video quest → Game → Read → Video quest → Game → Brain Break → Boss Battle quiz.

## 🔬 Science
| Unit | Lesson ideas |
|------|--------------|
| Plants | Parts of a plant & their jobs · What plants need to grow · How water travels up a stem · Flower life cycle (pollination, seeds, seed dispersal) |
| Animals incl. Humans | Food groups & healthy eating · Skeletons & muscles · Animals with and without backbones |
| Rocks | Types of rock · How fossils form · What soil is made of |
| Light | We need light to see · Reflective surfaces · Keeping eyes safe from the Sun · How shadows form and change |
| Forces & Magnets | Pushes & pulls · Friction on different surfaces · Magnetic vs non‑magnetic materials ✅ *(Magnet Magic!)* · Poles attract & repel ✅ |

## 🔢 Maths
- Place value to 1,000; counting in 4s, 8s, 50s and 100s
- Adding & subtracting 3‑digit numbers (mental + column)
- 3, 4 and 8 times tables; multiplication & division word problems
- Fractions: unit fractions, tenths, equivalents, comparing, adding with the same denominator
- Money (£ and p, giving change)
- Time: Roman numerals I–XII, analogue / 12‑hour / 24‑hour clocks, days in each month
- Measuring: m/cm/mm, kg/g, l/ml; perimeter
- Shapes: 2D & 3D, right angles, horizontal / vertical / parallel / perpendicular lines
- Statistics: bar charts, pictograms, tables

## 📚 English
- Prefixes (un‑, dis‑, mis‑, re‑, sub‑, super‑, auto‑) and suffixes (‑ly, ‑ous, ‑ation)
- Homophones (there/their/they're, hear/here …) and *a* vs *an*
- Conjunctions (when, if, because, although) & adverbs of time
- Prepositions; present perfect tense
- Punctuating speech with inverted commas
- Reading genres: fairy tales, myths & legends (e.g. Theseus), poetry, non‑fiction (headings, glossaries)
- Reading skills: predicting, inferring feelings, finding the main idea, dictionary skills

## Making a new lesson
1. Copy `science/magnets.html` into the right subject folder (e.g. `maths/fractions.html`).
2. Change the `window.LESSON = { … }` data: `id`, `subject` (`science` / `maths` / `english` sets the colours), title, mascot, glossary, and the stages.
3. Add it to the `LIBRARY` list in `index.html` by setting its `file`.

**Stage types:** `welcome`, `read`, `video` (YouTube `id` + questions), `game`, `break`, `quiz` (add `boss` for a boss battle).
**Game types available:** `sort`, `match`, `label`, `order`, `truefalse`, `questions` (read a table/picture, then answer) — a game stage can have several `rounds`.
**Quiz types:** `mcq`, `tf`, `gap`, `order`.
**Pixel sprites:** `Pixel.sprites.robot / magnet / magnetron`, or draw your own with `Pixel.svg(rows, palette)`.
**Video tip:** check a video exists and read its transcript before writing questions about it.
**Text tricks:** `**bold**` and `[[word]]` (tappable glossary word — add the word to `glossary`).
