# Year 3 Lesson Library — Topic Ideas (UK National Curriculum)

Each lesson is about 30–40 minutes: Start → Recap of last lesson (or a Warm-up when it starts a new topic) → Read → Video quest → Game → Read → Video quest → Game → Brain Break → Boss Battle quiz.

## 🔬 Science
| Unit | Lesson ideas |
|------|--------------|
| Plants | Parts of a plant & their jobs ✅ *(Plant Detectives)* · What plants need to grow + how water travels up a stem ✅ *(What Do Plants Need?)* · Flower life cycle: germination, flower parts, pollination, seeds & seed dispersal ✅ *(Flower Power Life Cycle)* |

**Force Lab (`forces` game):** hands-on physics. Gesture tasks `{ thing, label, force: 'push'|'pull', effect, yes }`: swipe ▶ = push (away from you), swipe ◀ = pull, tap = press (push). Slide tasks `{ slide: 'ice'|'wood'|'carpet'|'grass'|'sand', thing, label }`: flick so friction stops it in the green zone. Magnet mode: `hold: '🧲', snap: true, noTap: true, words: {...}` relabels the arrows (e.g. ATTRACT/REPEL, STICKS/NO STICK) and tasks add `holdTag`/`tag` for facing poles (e.g. 'N ▶', '◀ S'). Used in Magnet Magic (will it stick? + pole power), Pushes, Pulls & Friction (rounds) and as a hands-on warm-up in recap stages via `review.game`. Keep task labels free of the words push/pull.

**Simulated experiments (for when real tools aren't available):** `ramp` (Ramp Lab: stack 1–4 books, pick a floor from towel/sand/grass/carpet/wood/tiles/ice, let the car go, results table; `missions: [{ text, need: { surface, height }, yes, ask }]`) and `garden` (Seed Garden: drag seeds into pots, drag pots between sunny window and dark cupboard, pour from the watering can, fast-forward 2 weeks; `missions: [{ text, pots, goal: 'healthy'|'lightTest'|'waterTest'|'dryTest', yes, fix, ask }]`). Add tactile interaction wherever possible in new lessons.

**Plants style:** mascot Professor Bolt, `finishAch: 'gardener'` (Green Thumb, unlocks the gardener's straw hat); shop pet Sunny the sunflower. Bosses so far: Weedzilla, King Gloom, Mowbot 3000. Shop pets: Sunny the sunflower, Busy bee.

**Bee Flight (`pollinate` game):** touch/drag and the bee flies there; hovering on a flower's middle drinks nectar and picks up its pollen (dots in that flower's colour), and pollen delivered to a DIFFERENT flower of the SAME kind pollinates it (petals drop, it grows an apple, seed pod or seed head). `missions: [{ text, flowers: ['apple' | 'poppy' | 'sunflower' | 'daisy', …], goal: 'collect' | 'all', yes, ask }]`.
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
- Time: o'clock, half past, quarter past/to, 5‑minute past/to ✅ *(Tick Tock Time)* · to the minute, a.m./p.m., midnight/midday, Roman numeral clocks, seconds/minutes/hours ✅ *(Clock Quest: To the Minute)* · 24‑hour clock, days/weeks/fortnights, days in each month (knuckle trick), leap years ✅ *(Night & Day: The 24-Hour Clock)* · durations: start/end times, hopping on a time line, end and start times, timetables ✅ *(How Long? Time Hops)*

**Maths Mine style:** load `../shared/clock.js` for clock lessons (`Clock.svg('3:45', { halves, ring: 'pastto' | 'minutes', roman })` for pictures, `Clock.words()`). Mascot Tock the Clock-Bot (`Pixel.sprites.tock`) for time lessons; `finishAch: 'miner'` unlocks the miner helmet. Bosses so far: Count Clockula, The Time Bandit, The Night Owl, Slowcoach the Snail. Shop items: Sleepy nightcap, Speedy snail. Numbers inside clocks, LCDs and arcade labels use the Lexend font, because in the pixel font a 5 looks like an S.
- Measuring: m/cm/mm, kg/g, l/ml; perimeter
- Shapes: 2D & 3D, right angles, horizontal / vertical / parallel / perpendicular lines
- Statistics: bar charts, pictograms, tables

## 📚 English
- Prefixes (un‑, dis‑, mis‑, re‑, sub‑, super‑, auto‑) ✅ *(Prefix Power)* and suffixes (‑ful, ‑less, ‑ly, ‑ous, ‑ation) ✅ *(Suffix Squad)*
- Homophones (there/their/they're, hear/here, to/two/too …) ✅ *(Homophone Hunters)* and *a* vs *an* ✅ *(A or An?)*
- Conjunctions (and, but, or, so, because, when, before, after, while, until, if) ✅ *(Conjunction Junction)* · adverbs of time
- Prepositions; present perfect tense
- Punctuating speech with inverted commas
- Reading genres: fairy tales, myths & legends (e.g. Theseus), poetry, non‑fiction (headings, glossaries)
- Reading skills: predicting, inferring feelings, finding the main idea, dictionary skills

**Word Kingdom style:** mascot Quill the Wizard (`Pixel.sprites.wizard`), boss Grumblegob the spelling goblin (`Pixel.sprites.goblin`), `finishAch: 'speller'` (unlocks the golden quill). Keep grammar explanations to one or two short sentences per card. **Every English lesson has a dedicated 🪄 Spell Test stage** (a `game` stage with `icon: '🪄', kind: 'Spelling test'`) placed before the brain break, with three rounds: a warm-up (`spelltest` `peek` or `fix`), the real test (`spelltest` `listen`, 8–10 words from the lesson or age-suitable verbs/adjectives), and a Letter Blaster (`invaders` spelling waves). Vary the `scene` between lessons (potion: Prefix Power · egg: Suffix Squad · castle: Homophone Hunters · rocket: A or An? · train: Conjunction Junction). Word Kingdom lessons can bring their own boss: Grumblegob (prefixes, suffixes), Echo the Mix-Up Ghost (homophones), Snatchit the Magpie (a/an), Stopsy the Full-Stop Gremlin (conjunctions). Shop pets: Echo the ghost, An octopus.

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

**Boss ammo & dodge rounds:** `attack` can be one emoji, a list (`['💧', '☂️']`) or `Pixel.svg` pictures (e.g. a ninja star); `spin: true` makes them twirl. Dodge rounds mix a wall/laser pattern (pink crusher walls closing in from the sides, flashing laser beams) with a bullet pattern (rain, sweep, aimed, ring, spiral, bounce); `patterns: ['crush', 'spiral']` picks a boss's own set.

**Wonders style:** a "Fact or Fiction?" `truefalse` round, plus a "Myth-buster!" card in every lesson. Use kid-safe videos only (Peekaboo Kidz, Wild Kratts, SciShow Kids, Nat Geo Kids, TED-Ed as a bonus). Check every Zack D Films Short first, because some are gory or scary.

## 🗺️ Around the World (countries & culture – curated, beyond the curriculum)
One country per lesson: find it on the map, then the history and culture children love (food, characters, games, greetings, festivals). The player lives in **Thailand**: every map shows a 🏠 home pin there (`World.HOME` in `shared/world.js`), and lessons compare places with home (distance, flight time, weather). Each lesson also adds **one map skill**.
| Lesson | Map skill | Culture |
|------|------|------|
| Japan: Land of the Rising Sun ✅ | 7 continents & 5 oceans, island countries | bowing + greetings, sushi chef, Anpanman pixel art, samurai, Setsubun (boss Grumbly Oni) |
| England: Castles, Kings & Cups of Tea ✅ | compass N/E/S/W, the 4 UK nations + capitals | Flag Studio (paint a UK flag of your choice), afternoon tea, Royal Guard pixel art, London (boss Sir Soggy the Drizzle Dragon) |
| Thailand: Welcome Home! ✅ | neighbours, the equator & climate, comparing flight times from home | wai + Thai phrases, Thai kitchen, elephant pixel art, Songkran, Loy Krathong (boss the Mango Bandit) |
| The USA: Space Rockets & Hot Dogs ✅ | the other side of the world: day & night, time zones, east/west coasts | Apollo 11 moon landing, Statue of Liberty, Grand Canyon & Yellowstone, American diner, American vs British words, rocket/flag/Liberty pixel art (boss Bigfoot, who swiped Lady Liberty's torch) |
| Next ideas | China, South Korea, India, Italy, France, Egypt, Kenya, Mexico, Brazil, Australia | |

**Around the World style:** lessons go in `world/`, `subject: 'world'` (coral theme), `finishAch: 'traveller'` (unlocks the pilot cap), `stamp: { id: 'JPN', name, flag }` (a passport stamp on the library page, saved in `y3:passport`). Mascot Professor Bolt in the country's costume (`Pixel.sprites.boltJapan` / `boltEngland` / `boltThailand` / `boltUSA` – add one per new country: something simple but recognisable). Load `../shared/world-map.js` and `../shared/world.js` before `engine.js`. Every lesson has a Map Explorer round, a Chef round, a pixel-art copy of something iconic, an arcade round, and (for non-English countries) a Say it! greetings round. Recaps can end with a quick map round via `review.game`. Shop items so far: happi coat, Anpanman costume, Royal Guard costume, Marmalade bear, baby elephant, Thai elephant trousers, Songkran water blaster, astronaut helmet (+ Astronaut costume), Lady Liberty costume (crown, robe, torch), bald eagle pet.
**Map Explorer:** `worldmap` (`view`: world | europe | asia | eastasia | uk | ukfrance | japan | home | thailand | usa; `colour: 'countries'` + `colours: { ENG: '#…' }`; `labels`, `equator: true`, `compass: true`; `tasks`: `{ find }` tap a place, `{ place, pin }` drag a flag onto it, `{ fly, hours }` drag the ✈️ from home – shows km and hours; targets are continents (`asia`), oceans (`pacific`), map units (`JPN`, `ENG`, `SCT`, `USA`, `CAN`, `MEX`, `FXX` = France; `USA` includes Alaska and Hawaii) or `GBR`; any task can add `from` + `dir` (a compass arrow), `then: [questions]` and `zoom: [lon, lat, 2]` to start zoomed in on a small country). The map fills the screen width, and children can zoom with ➕/➖ or a pinch and drag to look around. The map is generated from Natural Earth by `tools/build-world.js` (0.5° world grid plus sharper UK/Japan/South-East Asia close-ups).
**Chef:** `cook` (`recipes: [{ name, emoji, customer, fact, steps: [{ add, label, emoji, makes } | { do: roll | slice | pour | squeeze | stir, label, makes }] }]`, `pantry` decoys with a `why`, `memory: true` + `par` seconds for a timed rush, `yum`). Emoji or `Pixel.svg` pictures both work.
**Say it!:** `phrases` (`lang: 'ja-JP' | 'th-TH'`, `phrases: [{ text, roman, means, emoji, sound }]`, `quiz` situation questions, `gesture: { kind: 'bow' | 'wai', say }`). 🔊 uses a native voice only when the device has one; otherwise it shows the "say it like" spelling.

## 👕 Avatar & Wardrobe
- Every 💎 earned in any lesson also goes into a wallet (`y3:wallet`). The **Wardrobe & Shop** (`avatar.html`) spends it on pixel clothes, hair, hats, extras and pets (catalogue in `shared/avatar.js`).
- Some items are secret and unlock with achievements (`unlock: 'boss' | 'artist' | 'designer' | 'perfect' | 'video' | 'traveller' …`).
- The avatar appears on the library page and lesson start screens, is the hero in the Platformer and Block Builder, and is shown on certificates.
- **Scenes** (🌄 tab): Sunny (free), Sunset, Night sky, Snowy, Underwater, Jungle, Space galaxy, Chocolate factory, and Rainbow land (secret – reach level 5). The chosen scene restyles the page sky/decorations/ground on every page (via CSS variables set by `Avatar.applyScene`), the avatar backdrops, the Block Builder sky and the Platformer level.
- Every lesson page must load `../shared/avatar.js` (after `pixel.js`, before the lesson script).

## Making a new lesson
1. Copy `science/magnets.html` into the right subject folder (e.g. `maths/fractions.html`).
2. Change the `window.LESSON = { … }` data: `id`, `subject` (`science` / `maths` / `english` / `future` / `wonders` / `world` sets the colours), title, mascot, glossary, and the stages.
3. Add it to the `LIBRARY` list in `index.html` by setting its `file`.

**Stage types:** `welcome`, `review` ("Last time…" recap: `from: { title, emoji, url }`, `facts`, `questions`; or a 🔥 warm-up when `from` has no url — see **Roads, recaps and warm-ups** below), `read`, `video` (YouTube `id` + questions), `game`, `break` (wiggle moves and/or a `tryit` activity, plus 🕹️ Brain Games – boss tic-tac-toe, steady hand, maze, hangman (uses the lesson's glossary words as a theme) – added automatically; `games: ['maze']` picks some, `games: false` turns them off), `quiz` (add `boss` for a boss battle).
**Quick brain-games break:** the engine adds a short `Games` stage (pick Tic-Tac-Toe, Steady Hand, Maze or Hangman) after the first game stage of every lesson. Set `midBreak: false` on the lesson to skip it, or pass `{ title, say, games }` to customise it.

**Game types available:** `sort`, `match`, `label`, `order`, `truefalse`, `questions` (read a table/picture, then answer), `wordsearch` (`words`, `size`), `crossword` (`entries` of `{answer, clue}`; the layout is built automatically), `trainai` (teach the robot with labelled examples, then judge its guesses), `pixelcopy` (copy a target sprite on a pixel grid; `mirror: true` for symmetry; "I'm finished!" scores a % and unlocks the next round; `choices: [{ label, level 1–3, target, colors, names, tips, say, done }]` lets the player pick what to draw), `pixelstudio` (free drawing with a design `brief`; saves to the device's gallery and downloads PNGs), `poster` (drag-and-drop poster editor with a `start` layout, `brief` and `checklist` — items with `auto: bigTitle | contrast | clutter | picture | inside` tick themselves)
**Spelling:** `spelltest` (`words` of `{word, sentence: 'The ___ …', clue, hint, wrong}`; `mode`: `listen` = hear the word in a sentence (British text-to-speech) | `peek` = look, cover, write, check | `fix` = correct the misspelt `wrong` word; `scene`: `potion` (ingredients fill a cauldron) | `egg` (cracks a dragon egg until it hatches) | `castle` (builds a castle tower row by row) | `rocket` (fuels a rocket that blasts off) | `train` (couples a carriage onto the engine for each word); `prize` names it). First-try spellings earn a gem, two misses reveal the word to copy, and the report card offers a practice re-run of tricky words.
**Arcade games:** `runner` (Lane Runner – the default word-sorting arcade round: the avatar runs by itself and the words come in pairs, one per lane (top / bottom); tap a half, swipe or use ⬆ / ⬇ to pick the right one. Same data as the platformer: `prompt`, `items: [{ label, ok, why, yes }]`; right and wrong words are paired automatically, and a wrong pick shows `why` and comes round again. `speed` optional), `invaders` (`waves` of `{prompt, items:[{label, ok, why}]}` – shoot the right answers; or spelling waves `{spell, clue, decoys}` – shoot the letters in order; like the arcade original the aliens drop zig-zag bombs to dodge – a hit stuns the ship for a second but never costs gems, a wave with no hits earns a bonus gem – and a mystery UFO flies over now and then: shoot it for a bonus gem, 3 per game at most), `platformer` (`prompt`, `items`, optional `ice: true` – collect right answers, reach the flag; retired from lessons in favour of `runner` because long words were hard to jump), `blocks` (Block Builder: a `map` of terrain letters g/d/s/w with R = robot and F = flag, plus `blocks` with counts; blocks with `sinks: true` splash into water – build a path so the robot reaches the flag). Put one arcade round in every lesson. — a game stage can have several `rounds`.
**Day Dial (`daydial`):** drag the sun and moon along a whole day; a clock, the 12-hour and the 24-hour time follow along. `missions: [{ time: '19:30', show: '12' | '24' | 'words', hide: ['24'], yes, ask }]` (one readout stays 🔒 locked so the child converts), `events: [{ time, emoji }]`, `step`, `nudge`, `start`. Hints spot the a.m./p.m. mix-up.
**Time Hops (`timehops`):** a frog hops along a time line. `missions: [{ from: '3:45', to: '4:20' } (how long? then pick the total – the wrong options include the take-away-like-normal-numbers trap) | { from: '5:50', add: 25 } (when does it end? includes the "5:75" trap)]`, `hops: [60, 10, 5, 1]`, `clock: '24'`.
**Knuckle months (`knuckles`):** tap along two pixel fists, knuckle = 31 days, dip = 30 (February 28); `ask` questions afterwards.
**Clock game:** `clock` with `mode: 'set'` (drag the hands to a time; `times` (each can add `start` and an `ask` puzzle, e.g. a start time + a duration), `show: words | digital | both`, `step` 5 or 1, `helper: on | off | none` for the PAST/TO ring, `roman: true`, `start`) or `mode: 'read'` (read the clock: tap the hour, type the minutes). Hints spot the classic mistakes (wrong side of the clock, quarter to the wrong hour), and after 2 misses faint ghost hands show the answer. The `match` game takes `html: true` for clock pictures.
**Proofreader:** `fixit` (`sentences` of `{ text, wrong, fix, options, why, hint }` or `{ text, ok: true, why }`; tap the wrong word, then drag the right word onto it; `noOk: true` hides the "No mistakes!" button). Works well in recaps via `review.game`.
**Quiz types:** `mcq`, `tf`, `gap`, `order` (label the two ends with `ends: ['SHORTEST', 'LONGEST']` – default FIRST / LAST; `start: true` fills in step 1 for long sequences; in a boss fight the first slip in an order question is a free hint). Only use `order` when there is ONE obvious order a child can see (time, size, a life cycle, a word growing); never for a list of method steps where two could swap. Set `optionsHtml: true` to use pictures (HTML) as the answer buttons.
**Pixel sprites:** `Pixel.sprites.robot / magnet / magnetron`, or draw your own with `Pixel.svg(rows, palette)`.
**Video tip:** check a video exists and read its transcript before writing questions about it.

**Hands-on question types (work in quizzes, video quests, the `questions` game, boss battles AND as reading-page `check`s):**
- `evidence` — tap the sentence that proves it. `{ q, answer: 'a few words from the right sentence' }` (or a list when several sentences prove it). As a reading check the page's own sentences become tappable; anywhere else add `passage: 'text'` (or a list of paragraphs).
- `hotspot` — tap the right place on a picture. `{ q, img: svg or emoji, spots: [{ x, y, r, label }] (% of the picture; r = radius, default 12), answer: spot index or a list of right spots }`. A wrong tap shows that spot's `label`.
- `slider` — drag a marker on a number line. `{ q, min, max, step, answer, tolerance, unit, ticks (gaps, default 10), from, endsOnly (label only the ends), hideValue (for estimating), format: v => … }`. A wrong answer says "too high" or "too low".
- `oddone` — odd one out, then WHY. `{ q, items, answer, why, reasons, reason }`.
- `build` — tap tiles into a word or sentence. `{ q, answer: ['un', 'happy'], extra: ['re'] (decoys), join: '' (word) or ' ' (sentence) }`.
- `type` — write the answer. `{ q, answer: '12' or ['colour', 'color'], before, after, placeholder }`. Capitals, spaces and punctuation are ignored.
- `predict` — guess first (never marked wrong), see the reveal, then explain. `{ q, options, answer (the real outcome, optional), reveal, revealPic, then: { q, options, answer, explain } }`.

**Comic pages:** a read card can use `comic: [{ who: 'mascot' | 'me' | emoji/svg, name, say, pic }]` instead of `text` – each line becomes a comic panel with a speech bubble ('me' is the child's own avatar and name). Checks (including `evidence`) work the same. Good for explaining an idea as a conversation (see the "Meet AI" card in `future/ai.html`).
**Mystery word (`mystery` game):** `words: [{ word, clues: [hardest first, usually 3], options (optional: tap instead of type), explain }]`. Clues appear one at a time; solving on clue 1 = 3 gems, clue 2 = 2, then 1. A wrong guess shows the next clue; after two wrong guesses the first letter is given. Use it instead of a word search or crossword.

**Roads, recaps and warm-ups (the home page quest map):** each world on index.html is a road. A lesson follows the one listed before it in `LIBRARY`, or the lesson named by `after: '<title>'`, which starts a branch (a fork splits the road into two lanes that meet again at the world's goal). A stop unlocks once the stop before it is cleared. A lesson in the **same unit** as the stop before it opens with a recap of that lesson (`from.url` set). A lesson that **starts a new unit** (including the first lesson after a fork into a new unit) opens with a **warm-up** instead: a `review` stage whose `from` names what the child already knows (no url), e.g. `{ title: 'Living things you already know', emoji: '🌳' }`. Its facts and questions draw on everyday or earlier knowledge the lesson builds on, without giving away the lesson's content. `tools/lesson-check.js` checks both rules.

**Quest-map NPCs (`shared/npcs.js`):** people by the road on the home page map, who talk in an Undertale-style text box. Every world has the same cast, written as data in `NPCS[world]`: `{ id, name, role, at: '<lesson title>' (null = by START), look, say: { lines } }`. They appear once the stop they live by is cleared. Roles: a **trader** (by START) sells 3 items with `unlock: 'trader-<world>'`. A **challenger** asks 3 questions from the lessons cleared on the road up to them (from `shared/question-bank.js`). The first win gives their `prize`; after that a daily rematch pays 3 💎. A **side quest** (`QUESTS`) has a **giver** ("Could you help me?" YES/NO) who wants an item from a **helper** standing earlier on the same road. The helper hands it over after 3 questions (it goes in the 🎒 backpack). Handing it to the giver ends with one `check` question, then the `rewards` (items with `unlock: 'npc'`). Lines a NPC leaves out come from `DEFAULT_SAY`. Reward and trader items live in `avatar.js` and can't be bought in the shop. Cast: Science: Market Mo, Professor Pip, Tinker Max → Gardener Rosa. Maths: Digger Dee, Clockmaker Clara, Night-Owl Nell → Miner Moss. English: Pedlar Penny, Dame Spellalot, Bellmaker Bea → Town Crier Tom. Future: Nova, Coder Kai, Inventor Ivy → Designer Dex. Wonders: Captain Coral, Dr Deep, Mossy Meg → Professor Mara. World: Globetrotter Gus, Pilot Priya, Guide Kenji → Grandma Malee. A new quest or NPC must stand by a lesson that is already built. **After adding or changing a lesson, run `node tools/build-question-bank.js`** so the challengers can ask about it. It collects the boss-battle questions that work without a picture.

**What he finds tricky (`parents.html`):** `shared/engine.js` saves the first try at every question in `y3:tries` (`track(kind, q, first)`): reading checks, recaps and warm-ups, video quests, quizzes, boss battles, questions inside games (`runQuestions`) and spelling-test words (with his first wrong spelling). The parent page shows what is still tricky, each lesson's first-try score and what he has since got right. Challenger NPCs put up to 2 of his last-time misses into their 3 questions. New question flows should call `track` too.

**Check every new or changed lesson:** `node tools/lesson-check.js <file>` validates the data (answer indexes, evidence answers found on the page, hotspot and slider answers you can actually reach, runner items with both right and wrong words). Reading-page checks can be multiple choice or a hands-on type (`evidence`, `hotspot`, `slider`, `oddone`, `build`, `type`, `predict`), but not `tf`, `gap` or `order`.

**Keep lessons varied (check with `node tools/activity-audit.js`):**
- At most ONE word puzzle (`crossword` or `wordsearch`) per lesson, and none in about half of lessons. Never in two lessons in a row of the same world. Other vocabulary practice: `build`, picture↔word `match`, `type`.
- Don't repeat an arcade game (`invaders`, `runner`, `platformer`, `blocks`) from the previous lesson of the same world.
- Multiple choice should be at most 60% of a lesson's questions. Mix in `evidence` and `type` reading checks, `hotspot` for pictures and diagrams, `slider` for numbers, and `oddone` / `predict` for reasoning.
- Every activity must make the child do the lesson's thinking (recall, apply, explain, predict, create). A game only wraps that thinking.

**Question-writing rules (so children read rather than scan):**
- Answers are shuffled automatically, so write the right answer anywhere. Use `keepOrder: true` only if the order matters.
- Reading-page checks should test understanding, not word-matching. Ask about a **new example** or a **"what would happen if…"**, and word the right answer differently from the page. Avoid "X is called a…" questions where the answer is the highlighted word.
- Keep **bold** out of reading-page text (yellow [[glossary]] words are fine). Never bold the exact phrase a question asks about.
- Wrong options should be believable, not silly, at least for the reading checks.
- Only a first-try answer earns the gem on a reading page; a wrong guess makes the child re-read for a few seconds.
**Read to me:** every reading card and recap gets a 🔊 Read to me button automatically (built-in British voice, free). Each word lights up as it is spoken (read-along), and it stops when the page changes. No lesson data needed.
**Text tricks:** `**bold**` and `[[word]]` (tappable glossary word — add the word to `glossary`).
