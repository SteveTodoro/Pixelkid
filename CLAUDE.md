# Pixelkid – notes for Claude

Pixelkid is a parent-led library of compact (15–20 minute) interactive lessons for a 7-year-old (UK National Curriculum, Year 3), played mainly on an **iPad**. It's a static site: GitHub Pages serves `main` at https://stevetodoro.github.io/Pixelkid/. Pushing to `main` ships a change, and Pages rebuilds in about a minute. If a build hangs for over 5 minutes, re-trigger it with `gh api -X POST repos/SteveTodoro/Pixelkid/pages/builds`.

**TOPICS.md is the technical manual**: every stage type, game type, question type, world style and rule for writing lessons. Read it before writing or changing a lesson. This file covers who it's for, the parent's preferences and how to work.

Privacy: the repo is public. Never put the child's name in files, URLs or commit messages ("Pixelkid" was chosen for that reason). Say "the child" / "the player".

## Who it's for
- A 7-year-old boy who loves Minecraft/Roblox-style blocky games and **Undertale** (costumes, dodge rounds and bullet-hell boss fights all come from that).
- He **lives in Thailand** (Bangkok). Every map shows a 🏠 home pin there, and lessons compare places with home.
- Time-telling ("quarter to", "ten past") was a known weak spot.
- The parent plays the lessons with him and gives feedback after playtests. Ask how the latest playtest went before building more of the same.

## Look and feel (locked – don't redesign unless asked)
- Blocky pixel / video-game look: Pixelify Sans for headings and buttons, Lexend for reading text, bevelled stone panels, sky and grass strip, hotbar stage bar, XP/levels, 💎 gems, chiptune sfx. Never use real Minecraft/Roblox logos or textures.
- **Numbers in Lexend**, never the pixel font (its 5 looks like an S and its 2 like an 8).
- **Pixel icons, not emoji**: `shared/pixel-icons.js` swaps emoji for 16×16 pixel sprites automatically. Any emoji you use in a lesson needs an icon, so run `node tools/emoji-audit.js` and draw missing ones with `def()`. No face/people emoji without a pixel sprite. Flags, arrows and ✔/❌ stay as text.
- Hero celebrations glow (the aura), they don't spin or jump; the parent found big movements exaggerated.

## How lessons should feel (the parent's feedback)
- **Length and challenge:** 15–20 minutes, compact and intensive: games and hands-on activities over passive stages, and a short path to the boss battle he loves (30 minutes felt like a chore). Dense, not easy: challenging but never frustrating. No optional/skippable stages (he'd always skip them). Always give hints, the boss can't be lost, and retries are free.
- **Variety matters a lot** (the parent found lessons formulaic once):
  - at most ONE word puzzle (crossword or word search) per lesson, and none in about half of them
  - multiple choice ≤ 60% of questions
  - use the hands-on question types
  - don't repeat the previous lesson's arcade game or second-read stage type (teach / case / investigate)
  - `node tools/activity-audit.js` checks all of this
- **Tactile wherever possible:** swipes, drags and physics that react to the finger. Add **simulated experiments** for things he can't do at home, as reusable engine games with missions, a results table and a `_test` hook.
- **Every activity must make him do the lesson's thinking.** The game only wraps it.
- **Choice and freedom over fixed tasks** (e.g. pick what to draw, pick a brain game). In drawing games, any attempt counts.
- **Videos:** 1 short (~5 min) YouTube video per lesson for new lessons (the parent felt 2 may be too much for the age group; existing lessons still have 2 until playtesting decides). Use the freed time for a hands-on stage. Verify each exists (oEmbed) and read its transcript (`yt-dlp --write-auto-subs`) before writing questions, so the questions match what's actually shown. Kid-safe channels only; check Zack D Films Shorts for gore first.
- **Anti-scanning:** he matched highlighted words instead of reading. So reading checks ask about a new example in different wording, and nothing is bolded in reading text.
- **Typed questions** show the answer after 2 wrong tries ("Use it and carry on"), because they used to lock him in.
- **Put-in-order questions** only when there is ONE obvious order.
- **Bosses:** every boss gets its own themed lines in its own voice: intro, hurt[], taunt[], angry, dodge, miss, last, defeat, win, stunned, beg[3]. Set `attack` ammo themed to the lesson.
- **English (Word Kingdom):** every lesson has a 🪄 Spell Test stage (warm-up, real test, Letter Blaster). Vary the scene. Keep grammar explanations to 1–2 short sentences.
- **Around the World:** no country stereotypes (especially negative or unproven ones like "England is rainy") and no niche adult trivia. Modern pop culture kids like (anime, Mario, Pokémon…) is welcome. Theme bosses on legends or landmarks.
- **Future Skills:** curated modern skills beyond the curriculum (AI, being safe online, creative tech). Always grown-up guided, and no child accounts on 13+ tools.
- **Rewards:** every lesson loads `shared/avatar.js`. Gems go into the wallet for the Wardrobe & Shop, and the player level never resets. New clothes should include girl-friendly options too. Price items so one lesson (~50–70 gems) buys 2–3.
- **Roads and recaps:** the home page is a quest map, and each world is a road. A lesson in the same unit as the stop before it recaps that lesson. One that starts a new unit gets a 🔥 warm-up instead. `tools/lesson-check.js` enforces this.

## Workflow for a new or changed lesson
1. Write the lesson data, copying the structure of the closest existing lesson. Add its `file` to `LIBRARY` in index.html.
2. Run these checks:
   - `node tools/lesson-check.js <file>`
   - `node tools/activity-audit.js`
   - `node tools/emoji-audit.js`
   - `node tools/build-question-bank.js` (the map's challenger NPCs ask boss questions from it)
3. After any change in `shared/`, run `npm install` once (jsdom), then `node tools/smoke.js`. It takes ~5 min and plays every lesson in a simulated browser. Drive new games through their `_test` hooks in a quick jsdom script too.
4. Keep files under ~1,500 lines. The engine core is `shared/engine.js`, and games live in parts under `shared/engine/` (loaded per lesson through `PARTS`).
5. To see a page, serve the repo (`python3 -m http.server`). For screenshots, headless Chromium with `--screenshot` works. Seed `localStorage` `y3:progress:<lesson id>` to jump to a stage.

## Where things stand (October 2026)
- **Compact format (21 Oct):** every lesson moves to 1 video + a 🕹️ pick-a-game Arcade (one arcade game, Steady Hand and one lesson game such as a fixit or crossword), no brain break, a shorter spell test and boss (see "Compact format" in TOPICS.md). Suffix Squad was the pilot, and the parent found it better. **All English, Science, Maths and Future Skills lessons are now converted** (Science and Maths keep their hands-on stage, e.g. Ramp Lab, Soil Lab, clocks, blocks or the shop till, beside the Arcade; Future keeps Teach the robot, Pixel Studio and Poster Studio after it). All are waiting on the parent's playtest. Next: Wonders and World. Keep vocabulary at Year 3 level (e.g. invitation, not admiration).
- **Science:** Magnets, Friction, the Plants unit (3 lessons) and the Rocks unit (Rock Stars, Fossil Hunters, Super Soil). Next: Fuel Your Body (the other branch).
- **Maths:** the Time unit (4 lessons), Place Value Party, 3-Digit Add & Subtract and Money Market. Next: Measure It!, or Counting in 4s, 8s, 50s & 100s on the other branch.
- **English:** Prefixes → Poetry Playground (the writing branch), and Theseus & the Minotaur (the first reading-branch lesson). Next: Fairy Tale Twist.
- **Future Skills:** AI, Pixel Art, Poster.
- **Wonders:** Tardigrades, Immortal Jellyfish (next: Octopus).
- **Around the World:** Japan, England, Thailand, USA (China next).
- **Waiting on the parent:**
  - playtest feedback on the newest lessons (Speech Marks, Place Value, Rock Stars, Fossils, Add & Subtract, Poetry, Theseus, Super Soil, Money Market; the new Labyrinth, Soil Lab and Shop Till games) and on the quest-map NPCs, tap-to-walk and biomes
  - a decision on the map's terrain/topography and icon redesign
- **Home modes:** a 🗺️ Adventure / 📚 Lessons switch under the world tabs (`y3:mode`, default Adventure). Lesson mode (`shared/lesson-grid.js` + `.css`) shows the same lessons as tiles grouped by topic, with no map or NPCs; the avatar, gems and shop stay. Both modes get lock state from `questStops()` in map.js, so they always agree.
- **Quest map:** a Super Mario World–style overworld, live in every world.
  - **Code:** `shared/map.js` (layout, reveal, hero, NPCs, cards, banner), `shared/map-art.js` (the landscape kit) and `shared/map.css`.
  - **Biomes:** each world has one in `ART[world]` in map-art.js: colours, cliff texture, beach, path style, scenery, things floating in the water, sea or space. A new world needs an `ART` entry.
  - **Road:** the road is hidden until unlocked, then drawn in (`y3:mapSeen`).
  - **Living layers:** waves, clouds, blinking hill eyes, and (Science only) a waterfall river at forks, all as light CSS animation.
- **Open cleanup:**
  - move `LIBRARY` out of index.html into `shared/library.js` (the tools parse it there)
  - add a file-size warning to the tools
