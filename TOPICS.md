# Year 3 Lesson Library — Topic Ideas (UK National Curriculum)

Each lesson is about 30–40 minutes: Start → Recap of last lesson → Read → Video quest → Game → Read → Video quest → Game → Brain Break → Boss Battle quiz.

## 🔬 Science
| Unit | Lesson ideas |
|------|--------------|
| Plants | Parts of a plant & their jobs ✅ *(Plant Detectives)* · What plants need to grow + how water travels up a stem ✅ *(What Do Plants Need?)* · next: Flower life cycle (pollination, seeds, seed dispersal) |

**Plants style:** mascot Professor Bolt, `finishAch: 'gardener'` (Green Thumb, unlocks the gardener's straw hat); shop pet Sunny the sunflower. Bosses so far: Weedzilla, King Gloom.
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
- Time: o'clock, half past, quarter past/to, 5‑minute past/to ✅ *(Tick Tock Time)* · to the minute, a.m./p.m., midnight/midday, Roman numeral clocks, seconds/minutes/hours ✅ *(Clock Quest: To the Minute)* · next: 24‑hour clocks, durations (how long?), days in each month

**Maths Mine style:** load `../shared/clock.js` for clock lessons (`Clock.svg('3:45', { halves, ring: 'pastto' | 'minutes', roman })` for pictures, `Clock.words()`). Mascot Tock the Clock-Bot (`Pixel.sprites.tock`) for time lessons; `finishAch: 'miner'` unlocks the miner helmet. Bosses so far: Count Clockula, The Time Bandit. Numbers inside clocks, LCDs and arcade labels use the Lexend font, because in the pixel font a 5 looks like an S.
- Measuring: m/cm/mm, kg/g, l/ml; perimeter
- Shapes: 2D & 3D, right angles, horizontal / vertical / parallel / perpendicular lines
- Statistics: bar charts, pictograms, tables

## 📚 English
- Prefixes (un‑, dis‑, mis‑, re‑, sub‑, super‑, auto‑) ✅ *(Prefix Power)* and suffixes (‑ful, ‑less, ‑ly, ‑ous, ‑ation) ✅ *(Suffix Squad)*
- Homophones (there/their/they're, hear/here …) and *a* vs *an*
- Conjunctions (when, if, because, although) & adverbs of time
- Prepositions; present perfect tense
- Punctuating speech with inverted commas
- Reading genres: fairy tales, myths & legends (e.g. Theseus), poetry, non‑fiction (headings, glossaries)
- Reading skills: predicting, inferring feelings, finding the main idea, dictionary skills

**Word Kingdom style:** mascot Quill the Wizard (`Pixel.sprites.wizard`), boss Grumblegob the spelling goblin (`Pixel.sprites.goblin`), `finishAch: 'speller'` (unlocks the golden quill). Keep grammar explanations to one or two short sentences per card. **Every English lesson has a dedicated 🪄 Spell Test stage** (a `game` stage with `icon: '🪄', kind: 'Spelling test'`) placed before the brain break, with three rounds: a warm-up (`spelltest` `peek` or `fix`), the real test (`spelltest` `listen`, 8–10 words from the lesson or age-suitable verbs/adjectives), and a Letter Blaster (`invaders` spelling waves). Vary the `scene` between lessons.

## 🚀 Future Skills (curated – beyond the school curriculum)
Practical, modern skills for growing up with AI and the internet. Always grown-up guided; no child accounts on 13+ tools.
| Unit | Lesson ideas |
|------|--------------|
| AI & Computers | How Does AI Work? ✅ · Asking Great Questions (talking to AI & search engines) |
| Thinking Online | Real or Fake? (edited / AI pictures, adverts) · Search Detective · Staying Safe Online |
| Coding | Think Like a Coder (instructions, loops, debugging) |
| Creative Tech | Pixel Art Studio ✅ · Design a Poster ✅ (graphic design) · Video Editing: Tell a Story |
| Life Skills | Money Smarts · Be the Boss of Screen Time |

## 🌍 Wonders of the World (strange-but-true facts – reading comprehension first)
Inspired by "amazing facts" videos (e.g. Zack D Films). Each lesson is one wonder told as a story, with lots of inference questions. Lessons go in `wonders/`, with `subject: 'wonders'` (ocean-blue theme) and `finishAch: 'wonder'`. Finishing any Wonders lesson unlocks the 🌍 explorer hat.
| Unit | Lesson ideas |
|------|--------------|
| Amazing Animals | Tardigrades: The Unkillable Water Bear? ✅ · The Immortal Jellyfish ✅ · Octopus: 3 Hearts & Blue Blood · Animal Superpowers |
| Ancient Wonders | Pyramids of Giza · The Great Wall of China · Pompeii: The City Frozen in Time · The Terracotta Army |
| Incredible Inventions | Oops! Accidental Inventions (ice lollies, crisps, penicillin) · The Wright Brothers Take Off · The Eiffel Tower Grows in Summer |
| Wild Planet | Volcanoes · The Deepest Ocean · The Northern Lights |
| Your Amazing Body | Your Body's Secret Superpowers |

**Wonders style:** a "Fact or Fiction?" `truefalse` round, plus a "Myth-buster!" card in every lesson. Use kid-safe videos only (Peekaboo Kidz, Wild Kratts, SciShow Kids, Nat Geo Kids, TED-Ed as a bonus). Check every Zack D Films Short first, because some are gory or scary.

## 👕 Avatar & Wardrobe
- Every 💎 earned in any lesson also goes into a wallet (`y3:wallet`). The **Wardrobe & Shop** (`avatar.html`) spends it on pixel clothes, hair, hats, extras and pets (catalogue in `shared/avatar.js`).
- Some items are secret and unlock with achievements (`unlock: 'boss' | 'artist' | 'designer' | 'perfect' | 'video'`).
- The avatar appears on the library page and lesson start screens, is the hero in the Platformer and Block Builder, and is shown on certificates.
- **Scenes** (🌄 tab): Sunny (free), Sunset, Night sky, Snowy, Underwater, Jungle, Space galaxy, Chocolate factory, and Rainbow land (secret – reach level 5). The chosen scene restyles the page sky/decorations/ground on every page (via CSS variables set by `Avatar.applyScene`), the avatar backdrops, the Block Builder sky and the Platformer level.
- Every lesson page must load `../shared/avatar.js` (after `pixel.js`, before the lesson script).

## Making a new lesson
1. Copy `science/magnets.html` into the right subject folder (e.g. `maths/fractions.html`).
2. Change the `window.LESSON = { … }` data: `id`, `subject` (`science` / `maths` / `english` / `future` sets the colours), title, mascot, glossary, and the stages.
3. Add it to the `LIBRARY` list in `index.html` by setting its `file`.

**Stage types:** `welcome`, `review` ("Last time…" recap: `from`, `facts`, `questions` — put one in every lesson after the first), `read`, `video` (YouTube `id` + questions), `game`, `break` (wiggle moves and/or a `tryit` activity, plus 🕹️ Brain Games – boss tic-tac-toe, steady hand, maze, hangman (uses the lesson's glossary words as a theme) – added automatically; `games: ['maze']` picks some, `games: false` turns them off), `quiz` (add `boss` for a boss battle).
**Game types available:** `sort`, `match`, `label`, `order`, `truefalse`, `questions` (read a table/picture, then answer), `wordsearch` (`words`, `size`), `crossword` (`entries` of `{answer, clue}`; the layout is built automatically), `trainai` (teach the robot with labelled examples, then judge its guesses), `pixelcopy` (copy a target sprite on a pixel grid; `mirror: true` for symmetry), `pixelstudio` (free drawing with a design `brief`; saves to the device's gallery and downloads PNGs), `poster` (drag-and-drop poster editor with a `start` layout, `brief` and `checklist` — items with `auto: bigTitle | contrast | clutter | picture | inside` tick themselves)
**Spelling:** `spelltest` (`words` of `{word, sentence: 'The ___ …', clue, hint, wrong}`; `mode`: `listen` = hear the word in a sentence (British text-to-speech) | `peek` = look, cover, write, check | `fix` = correct the misspelt `wrong` word; `scene`: `potion` (ingredients fill a cauldron) | `egg` (cracks a dragon egg until it hatches); `prize` names it). First-try spellings earn a gem, two misses reveal the word to copy, and the report card offers a practice re-run of tricky words.
**Arcade games:** `invaders` (`waves` of `{prompt, items:[{label, ok, why}]}` – shoot the right answers; or spelling waves `{spell, clue, decoys}` – shoot the letters in order), `platformer` (`prompt`, `items`, optional `ice: true` for slippery low-friction patches – collect right answers, reach the flag), `blocks` (Block Builder: a `map` of terrain letters g/d/s/w with R = robot and F = flag, plus `blocks` with counts; blocks with `sinks: true` splash into water – build a path so the robot reaches the flag). Put one arcade round in every lesson. — a game stage can have several `rounds`.
**Clock game:** `clock` with `mode: 'set'` (drag the hands to a time; `times`, `show: words | digital | both`, `step` 5 or 1, `helper: on | off | none` for the PAST/TO ring, `roman: true`, `start`) or `mode: 'read'` (read the clock: tap the hour, type the minutes). Hints spot the classic mistakes (wrong side of the clock, quarter to the wrong hour), and after 2 misses faint ghost hands show the answer. The `match` game takes `html: true` for clock pictures.
**Quiz types:** `mcq`, `tf`, `gap`, `order`. Set `optionsHtml: true` to use pictures (HTML) as the answer buttons.
**Pixel sprites:** `Pixel.sprites.robot / magnet / magnetron`, or draw your own with `Pixel.svg(rows, palette)`.
**Video tip:** check a video exists and read its transcript before writing questions about it.

**Question-writing rules (so children read rather than scan):**
- Answers are shuffled automatically, so write the right answer anywhere. Use `keepOrder: true` only if the order matters.
- Reading-page checks should test understanding, not word-matching. Ask about a **new example** or a **"what would happen if…"**, and word the right answer differently from the page. Avoid "X is called a…" questions where the answer is the highlighted word.
- Keep **bold** out of reading-page text (yellow [[glossary]] words are fine). Never bold the exact phrase a question asks about.
- Wrong options should be believable, not silly, at least for the reading checks.
- Only a first-try answer earns the gem on a reading page; a wrong guess makes the child re-read for a few seconds.
**Text tricks:** `**bold**` and `[[word]]` (tappable glossary word — add the word to `glossary`).
