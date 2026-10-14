# Year 3 Lesson Library — Topic Ideas (UK National Curriculum)

Each lesson is about 30–40 minutes: Start → Recap of last lesson → Read → Video quest → Game → Read → Video quest → Game → Brain Break → Boss Battle quiz.

## 🔬 Science
| Unit | Lesson ideas |
|------|--------------|
| Plants | Parts of a plant & their jobs · What plants need to grow · How water travels up a stem · Flower life cycle (pollination, seeds, seed dispersal) |
| Animals incl. Humans | Food groups & healthy eating · Skeletons & muscles · Animals with and without backbones |
| Rocks | Types of rock · How fossils form · What soil is made of |
| Light | We need light to see · Reflective surfaces · Keeping eyes safe from the Sun · How shadows form and change |
| Forces & Magnets | Magnetic vs non‑magnetic materials, poles attract & repel ✅ *(Magnet Magic!)* · Pushes, pulls & friction on different surfaces ✅ *(Pushes, Pulls & Friction)* |

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

## 🚀 Future Skills (curated – beyond the school curriculum)
Practical, modern skills for growing up with AI and the internet. Always grown-up guided; no child accounts on 13+ tools.
| Unit | Lesson ideas |
|------|--------------|
| AI & Computers | How Does AI Work? ✅ · Asking Great Questions (talking to AI & search engines) |
| Thinking Online | Real or Fake? (edited / AI pictures, adverts) · Search Detective · Staying Safe Online |
| Coding | Think Like a Coder (instructions, loops, debugging) |
| Creative Tech | Pixel Art Studio ✅ · Design a Poster (graphic design) · Video Editing: Tell a Story |
| Life Skills | Money Smarts · Be the Boss of Screen Time |

## Making a new lesson
1. Copy `science/magnets.html` into the right subject folder (e.g. `maths/fractions.html`).
2. Change the `window.LESSON = { … }` data: `id`, `subject` (`science` / `maths` / `english` / `future` sets the colours), title, mascot, glossary, and the stages.
3. Add it to the `LIBRARY` list in `index.html` by setting its `file`.

**Stage types:** `welcome`, `review` ("Last time…" recap: `from`, `facts`, `questions` — put one in every lesson after the first), `read`, `video` (YouTube `id` + questions), `game`, `break`, `quiz` (add `boss` for a boss battle).
**Game types available:** `sort`, `match`, `label`, `order`, `truefalse`, `questions` (read a table/picture, then answer), `wordsearch` (`words`, `size`), `crossword` (`entries` of `{answer, clue}`; the layout is built automatically), `trainai` (teach the robot with labelled examples, then judge its guesses), `pixelcopy` (copy a target sprite on a pixel grid; `mirror: true` for symmetry), `pixelstudio` (free drawing with a design `brief`; saves to the device's gallery and downloads PNGs) — a game stage can have several `rounds`.
**Quiz types:** `mcq`, `tf`, `gap`, `order`.
**Pixel sprites:** `Pixel.sprites.robot / magnet / magnetron`, or draw your own with `Pixel.svg(rows, palette)`.
**Video tip:** check a video exists and read its transcript before writing questions about it.
**Text tricks:** `**bold**` and `[[word]]` (tappable glossary word — add the word to `glossary`).
