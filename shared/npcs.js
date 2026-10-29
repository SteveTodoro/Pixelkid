/* Pixelkid quest-map NPCs: people standing by the road who talk in an Undertale-style text box.
 * Every world has the same cast, set out as data in NPCS (who stands where, what they say) and QUESTS:
 *   trader     – sells items you can only get from them, for gems (stock: item ids with unlock 'trader-<world>').
 *   challenger – 3 quick questions on the lessons cleared on the road up to them. Their own item (prize) the first time,
 *                then a few gems once a day (so reviewing old lessons keeps paying a little, but can't be farmed).
 *   giver      – asks "Could you help me?" (YES / NO) and wants an item that the quest's helper has: a side quest.
 *                Handing it over ends with one quick question (the quest's check), then thank-you items.
 *   helper     – stands earlier on the same road and hands over the quest item after 3 quick questions.
 * Quest items live in the 🎒 backpack (the slot next to the gems on the home page).
 * Needs avatar.js and question-bank.js (made by tools/build-question-bank.js). The home page's map places the NPCs:
 *   NPC.forWorld(key)   the NPCs in a world: { id, name, role, at: '<lesson title they live by>' (null: by START), look }
 *   NPC.marker(npc)     what floats over their head: '!' (something for you), '?' (they want what you carry), '🛒', '⚔️' or ''
 *   NPC.talk(npc, { pool: [lesson ids cleared up to them], changed() })   open the conversation
 *   NPC.backpack()      show what you carry and the quests you're on · NPC.bagCount()
 * Saved in localStorage 'y3:npc': { quests: { id: 'active' | 'done' }, bag: [item ids], got: { npc: true }, day: { npc: date } }
 */
(function () {
  'use strict';
  const KEY = 'y3:npc';
  const fresh = () => ({ quests: {}, bag: [], got: {}, day: {} });
  const load = () => { try { return Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return fresh(); } };
  const save = st => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignore */ } };
  const update = fn => { const st = load(); fn(st); save(st); };
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  const playerName = () => { try { return JSON.parse(localStorage.getItem('y3:settings') || '{}').name || 'explorer'; } catch (e) { return 'explorer'; } };
  const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };


  // ---------- side quests: the giver wants an item that the helper has ----------
  // find: the backpack's hint until you have the item. check: the hand-in question. rewards: [avatar item id, what the giver says].
  const QUESTS = {
    sunflower: {
      name: 'The Drooping Sunflowers', giver: 'rosa', helper: 'max', item: { id: 'watering-can', icon: '🚿', name: 'Watering can' },
      find: 'Find a watering can for Gardener Rosa. Tinker Max might have one.',
      check: { type: 'mcq', q: 'Which part of the sunflower drinks up the water?', options: ['the roots', 'the petals', 'the leaves'], answer: 0, hint: "It's the part hidden under the soil!" },
      explain: "The roots soak up water from the soil, and the stem carries it up to the leaves and flowers. Look – they're standing tall already!",
      rewards: [['sunflower-hat', 'Please take my sunflower hat to say thank you…'], ['pet-ladybird', '…and this little ladybird. She loves sunflowers!']],
    },
    train: {
      name: 'The Late Train', giver: 'moss', helper: 'nell', item: { id: 'alarm-clock', icon: '⏰', name: 'Alarm clock' },
      find: 'Find an alarm clock for Miner Moss. Night-Owl Nell might have one.',
      check: { type: 'mcq', q: 'The mine train leaves at 14:30. What is that on a 12-hour clock?', options: ['2:30 p.m.', '4:30 p.m.', '2:30 a.m.'], answer: 0, hint: 'Take 12 away from the hours. Is it before or after midday?' },
      explain: "14 take away 12 is 2, and it's after midday, so 14:30 is 2:30 p.m. I'll set my alarm for 2 o'clock. Plenty of time!",
      rewards: [['mine-lantern', 'Please take my spare mine lantern to say thank you…'], ['pet-bat', '…and Batty here wants to come too. He loves the dark!']],
    },
    bell: {
      name: 'The Lost Bell', giver: 'tom', helper: 'bea', item: { id: 'bell', icon: '🔔', name: 'Bell' },
      find: 'Find a bell for Town Crier Tom. Bellmaker Bea might have one.',
      check: { type: 'gap', q: 'Hear ye! The king is hungry ___ the cook is fast asleep!', options: ['but', 'or', 'because'], answer: 0, hint: "The second part is a surprise – it doesn't match the first part." },
      explain: '"But" joins two ideas that don\'t match: the king wants food, but the cook is asleep! DING DING! Hear ye, hear ye!',
      rewards: [['crier-hat', 'Please take my spare hat to say thank you…'], ['pet-frog-prince', "…and this frog. He says he's a prince. Maybe he is!"]],
    },
    poster: {
      name: 'The Space Fair Poster', giver: 'dex', helper: 'ivy', item: { id: 'paint-set', icon: '🎨', name: 'Paint set' },
      find: 'Find some paints for Designer Dex. Inventor Ivy might have some.',
      check: { type: 'mcq', q: 'My poster is white. Which colour should the big title be, so it is easy to read?', options: ['dark navy', 'pale yellow', 'light grey'], answer: 0, hint: 'Pick the colour that stands out most against white.' },
      explain: 'Dark navy on white stands out the most, so people can read it in one quick look. The 3-second test – passed!',
      rewards: [['paint-palette', 'Please take my spare palette to say thank you…'], ['pet-chameleon', '…and this chameleon. She changes colour, just like my posters!']],
    },
    polyps: {
      name: 'A Closer Look', giver: 'mara', helper: 'meg', item: { id: 'microscope', icon: '🔬', name: 'Microscope' },
      find: 'Find a microscope for Professor Mara. Mossy Meg might have one.',
      check: { type: 'mcq', q: 'An immortal jellyfish gets hurt. What amazing thing can it do?', options: ['turn back into a polyp and start again', 'grow a brand new brain', 'turn into a fish'], answer: 0, hint: 'Think of a butterfly turning back into a caterpillar!' },
      explain: "It can turn back into a polyp and grow up all over again! And look – there's one under the microscope now.",
      rewards: [['shell-necklace', 'Please take this shell necklace to say thank you…'], ['pet-seahorse', "…and this little seahorse. She'll be a great friend!"]],
    },
    yuki: {
      name: 'A Friend from Japan', giver: 'malee', helper: 'kenji', item: { id: 'phrasebook', icon: '📖', name: 'Japanese phrasebook' },
      find: 'Find a Japanese phrasebook for Grandma Malee. Guide Kenji might have one.',
      check: { type: 'mcq', q: 'What do families in Japan say before a meal?', options: ['itadakimasu', 'sayōnara', 'ohayō'], answer: 0, hint: "It's a way of saying thank you for the food." },
      explain: 'Itadakimasu! Yuki smiled so much when I said it. Now she says the mango sticky rice is "aroi mak" – very tasty, in Thai!',
      rewards: [['flower-garland', 'Please take this jasmine garland to say thank you…'], ['pet-paper-crane', '…and Yuki folded this paper crane just for you!']],
    },
  };
  const questOf = n => QUESTS[n.quest];
  const itemOf = id => Object.values(QUESTS).map(q => q.item).find(it => it.id === id);

  // ---------- who lives where ----------
  // say: their lines ({name} is the player). Anything left out falls back to the role's lines in DEFAULT_SAY.
  const NPCS = {
    science: [
      { id: 'mo', name: 'Market Mo', role: 'trader', at: null, stock: ['field-vest', 'magnifier', 'pet-worm'],
        look: { skin: 'skin3', hair: 'hair-curly', hairColor: 'hc-black', top: 'tee-red', legs: 'trousers-black', shoes: 'boots', hat: 'cap' },
        say: { hello: "Hello there, explorer! I'm Mo. I sell things you won't find in any shop!" } },
      { id: 'pip', name: 'Professor Pip', role: 'challenger', at: 'Magnet Magic!', prize: 'lab-goggles',
        look: { skin: 'skin1', hair: 'hair-spiky', hairColor: 'hc-blonde', top: 'labcoat', legs: 'trousers-black', shoes: 'trainers', extra: 'glasses' },
        say: { hello: "Ah, a young scientist! I'm Professor Pip. Answer my three quick questions about what you've learned, and I'll give you something special.",
          notNow: 'Off you go, then. My questions will be waiting!', again: "Not quite! A good scientist checks and tries again. Another go? I'll ask different questions.",
          win: 'Splendid! All three right! Here are my spare lab goggles – every scientist needs a pair.', gems: 'Brilliant! Here are your 3 💎. See you tomorrow!' } },
      { id: 'max', name: 'Tinker Max', role: 'helper', quest: 'sunflower', at: 'Pushes, Pulls & Friction',
        look: { skin: 'skin2', hair: 'hair-short', hairColor: 'hc-black', top: 'hoodie-blue', legs: 'jeans', shoes: 'boots', hat: 'beanie', extra: 'pocket-watch' },
        say: { idle: "I'm Tinker Max. I fix things! Push a lever, pull a rope – forces make everything work.", done: 'Rosa says her sunflowers are standing tall again. Nice work, {name}!',
          waiting: 'Take that watering can to Rosa – her sunflowers are thirsty!', offer: "A watering can for Rosa? I've got a spare one! But first, show me you know your forces. Three quick questions!",
          notNow: "No rush. I'll keep the can safe.", give: 'Here you go – one watering can, good as new! Take it to Gardener Rosa.' } },
      { id: 'rosa', name: 'Gardener Rosa', role: 'giver', quest: 'sunflower', at: 'Plant Detectives',
        look: { skin: 'skin2', hair: 'hair-plaits', hairColor: 'hc-brown', top: 'jumper-green', legs: 'jeans', shoes: 'boots', hat: 'straw-hat' },
        say: { problem: ['Oh dear, oh dear… my sunflowers are drooping! My watering can has a hole in it.'], ask: 'Could you help me find another one?',
          yes: 'Thank you! Tinker Max lives by the Pushes, Pulls & Friction stop. He might have a spare watering can!',
          nudge: 'Any luck? Tinker Max, by the Pushes, Pulls & Friction stop, might have a watering can.',
          found: 'You found one! Thank you! Before I water them… a quick question.', done: 'My sunflowers have never looked happier. Thank you, {name}!' } },
    ],
    maths: [
      { id: 'dee', name: 'Digger Dee', role: 'trader', at: null, stock: ['mine-overalls', 'pickaxe', 'pet-mole'],
        look: { skin: 'skin3', hair: 'hair-ponytail', hairColor: 'hc-ginger', top: 'mine-overalls', legs: 'jeans', shoes: 'boots', hat: 'miner-helmet', extra: 'pickaxe' },
        say: { hello: "Mind your head down here! I'm Digger Dee. I dig up things you won't find in any shop!", back: 'Back in the mine, {name}? Fresh finds today!',
          bye: 'Happy digging!', sold: 'A fine find!' } },
      { id: 'clara', name: 'Clockmaker Clara', role: 'challenger', at: 'Clock Quest: To the Minute', prize: 'clock-hat',
        look: { skin: 'skin1', hair: 'hair-bob', hairColor: 'hc-white', top: 'dress-purple', legs: 'legs-none', shoes: 'boots', hat: 'clock-hat', extra: 'glasses' },
        say: { hello: "Tick, tock! I'm Clockmaker Clara. Answer my three quick time questions, and I'll give you something I made myself.",
          notNow: "Off you go – but don't be late coming back!", again: "Not quite! Even clocks need fixing sometimes. Another go? I'll ask different questions.",
          win: "Right on time! All three correct! Here's a clockwork top hat – it ticks when you nod.", gems: 'Perfect timing! Here are your 3 💎. See you tomorrow!' } },
      { id: 'nell', name: 'Night-Owl Nell', role: 'helper', quest: 'train', at: 'Night & Day: The 24-Hour Clock',
        look: { skin: 'skin2', hair: 'hair-long', hairColor: 'hc-black', top: 'hoodie-blue', legs: 'trousers-black', shoes: 'trainers', hat: 'nightcap' },
        say: { idle: "I'm Night-Owl Nell. I work the night shift – my day starts at 22:00!", done: 'Moss caught his train! He says thank you, {name}.',
          waiting: 'Hurry – take that alarm clock to Miner Moss before his train goes!', offer: "An alarm clock for Moss? I've got a spare – I sleep all day, so I need lots! But first, three quick time questions.",
          notNow: "No rush. I'll be up all night anyway!", give: 'Here – one alarm clock, ticking nicely. Take it to Miner Moss!' } },
      { id: 'moss', name: 'Miner Moss', role: 'giver', quest: 'train', at: 'How Long? Time Hops',
        look: { skin: 'skin1', hair: 'hair-short', hairColor: 'hc-white', top: 'tee-grey', legs: 'trousers-black', shoes: 'boots', hat: 'miner-helmet' },
        say: { problem: ['Oh no, oh no! My alarm clock is broken, and the mine train leaves at 14:30!'], ask: "If I nap, I'll miss it! Could you find me an alarm clock?",
          no: "Righto. I'll try very hard to stay awake… *yawn*", yes: 'Thank you! Night-Owl Nell, by the Night & Day stop, might have a spare alarm clock!',
          nudge: 'Any luck? Night-Owl Nell, by the Night & Day stop, might have an alarm clock.',
          found: 'An alarm clock! Thank you! Now, one quick question so I set it right…', done: 'I caught the 14:30 train! Thank you, {name}!' } },
    ],
    english: [
      { id: 'penny', name: 'Pedlar Penny', role: 'trader', at: null, stock: ['jester-hat', 'storybook', 'pet-hedgehog'],
        look: { skin: 'skin2', hair: 'hair-bunches', hairColor: 'hc-brown', top: 'dress-purple', legs: 'legs-none', shoes: 'boots', hat: 'jester-hat', extra: 'storybook' },
        say: { hello: "Roll up, roll up! I'm Pedlar Penny. I sell treasures from far-off stories!", bye: 'Fare thee well!', sold: 'A fine choice!' } },
      { id: 'spellalot', name: 'Dame Spellalot', role: 'challenger', at: 'Suffix Squad', prize: 'spell-shield',
        look: { skin: 'skin1', hair: 'hair-long', hairColor: 'hc-ginger', top: 'knight-dress', legs: 'legs-none', shoes: 'boots', hat: 'knight', extra: 'spell-shield' },
        say: { hello: 'Halt! I am Dame Spellalot, guardian of words. Answer my three questions, and you shall have a spelling shield!',
          rematch: "A rematch, brave word knight? Win again and I'll give you 3 💎. (Once a day!)", notNow: 'Very well. My questions shall wait!',
          again: "Not quite! Even the bravest knight misses sometimes. Again? I'll ask different questions.",
          win: 'Huzzah! All three right! Take my spare spelling shield – it guards against spelling mistakes!', gems: 'Huzzah! Here are your 3 💎. Until tomorrow!' } },
      { id: 'bea', name: 'Bellmaker Bea', role: 'helper', quest: 'bell', at: 'Homophone Hunters',
        look: { skin: 'skin3', hair: 'hair-buns', hairColor: 'hc-black', top: 'tee-teal', legs: 'shorts', shoes: 'trainers-red' },
        say: { idle: "I'm Bellmaker Bea. I make bells – not belles! Those are homophones.", done: "Tom's bell is ringing all over the kingdom. Nice work, {name}!",
          waiting: 'Take that bell to Town Crier Tom – the kingdom is waiting for news!', offer: "A bell for Tom? I've just made a shiny new one! But first, three quick word questions.",
          notNow: "No rush. I'll keep it polished.", give: 'Here you go – one bell, freshly made! Ring-a-ding! Take it to Town Crier Tom.' } },
      { id: 'tom', name: 'Town Crier Tom', role: 'giver', quest: 'bell', at: 'Conjunction Junction',
        look: { skin: 'skin1', hair: 'hair-curly', hairColor: 'hc-brown', top: 'guard-tunic', legs: 'trousers-black', shoes: 'boots', hat: 'crier-hat' },
        say: { problem: ["Hear ye, hear ye! Oh… nobody can hear me. I've lost my bell!"], no: 'Very well! I shall just shout extra loudly.',
          yes: 'Thank you! Bellmaker Bea, by the Homophone Hunters stop, makes bells!', nudge: 'Any luck? Bellmaker Bea, by the Homophone Hunters stop, makes bells.',
          found: 'My new bell! Thank you! Now help me with my news – which joining word fits?', done: 'Ding, ding! Everyone can hear my news again. Thank you, {name}!' } },
    ],
    future: [
      { id: 'nova', name: 'Nova', role: 'trader', at: null, stock: ['jetpack', 'neon-visor', 'pet-ufo'],
        look: { skin: 'skin2', hair: 'hair-buns', hairColor: 'hc-blue', top: 'space-top', legs: 'space-legs', shoes: 'boots', extra: 'jetpack' },
        say: { hello: "Greetings, Earthling! I'm Nova. I sell gadgets from the future!", back: 'Welcome back, {name}! New gadgets just landed!',
          bye: 'Beam back any time!', sold: 'Excellent upgrade!' } },
      { id: 'kai', name: 'Coder Kai', role: 'challenger', at: 'Pixel Art Studio', prize: 'antenna-cap',
        look: { skin: 'skin3', hair: 'hair-spiky', hairColor: 'hc-green', top: 'hoodie-blue', legs: 'jeans', shoes: 'trainers-red', hat: 'antenna-cap' },
        say: { hello: "Hi! I'm Coder Kai. Answer my three quick questions, and I'll give you an antenna cap. It picks up good ideas!",
          notNow: "Okay! I'll save my questions for later.", again: "Bug found! Every coder fixes bugs. Try again? I'll ask different questions.",
          win: "All three right – no bugs! Here's my spare antenna cap.", gems: 'Nice! Here are your 3 💎. See you tomorrow!' } },
      { id: 'ivy', name: 'Inventor Ivy', role: 'helper', quest: 'poster', at: 'How Does AI Work?',
        look: { skin: 'skin1', hair: 'hair-ponytail', hairColor: 'hc-pink', top: 'labcoat', legs: 'trousers-black', shoes: 'trainers', hat: 'headphones', extra: 'glasses' },
        say: { idle: "I'm Inventor Ivy. I build robots – and I always check what they tell me!", done: "Dex's poster looks amazing. Nice work, {name}!",
          waiting: 'Take that paint set to Designer Dex – the Space Fair is soon!', offer: 'Paints for Dex? My robot made too many! But first, three quick questions.',
          notNow: 'No rush. My robot will keep them safe.', give: 'Here you go – a fresh paint set! Take it to Designer Dex.' } },
      { id: 'dex', name: 'Designer Dex', role: 'giver', quest: 'poster', at: 'Design a Poster',
        look: { skin: 'skin2', hair: 'hair-mohawk', hairColor: 'hc-pink', top: 'tee-pink', legs: 'jeans', shoes: 'sparkle-shoes', hat: 'beret', extra: 'designer-scarf' },
        say: { problem: ["Oh no! I'm making the poster for the Space Fair, and all my paints have dried up!"], ask: 'Could you help me find some new ones?',
          no: "That's okay. Maybe I'll draw it in pencil…", yes: 'Thank you! Inventor Ivy, by the How Does AI Work? stop, might have some paints!',
          nudge: 'Any luck? Inventor Ivy, by the How Does AI Work? stop, might have some paints.',
          found: 'Paints! Thank you! One quick question before I start…', done: 'Everyone is coming to the Space Fair, thanks to you, {name}!' } },
    ],
    brain: [
      { id: 'miko', name: 'Master Miko', role: 'trader', at: null, stock: ['karate-gi', 'blossom-bow', 'pet-panda'],
        look: { skin: 'skin2', hair: 'hair-buns', hairColor: 'hc-black', top: 'karate-gi', legs: 'trousers-black', shoes: 'trainers', hat: 'blossom-bow' },
        say: { hello: "Welcome to the dojo! I'm Master Miko. A calm mind needs a calm outfit. Take a look!", back: 'Welcome back, {name}! Breathe in… and shop!',
          bye: 'Stay focused, young ninja!', sold: 'A wise choice!' } },
    ],
    wonders: [
      { id: 'coral', name: 'Captain Coral', role: 'trader', at: null, stock: ['sailor-top', 'snorkel-mask', 'pet-crab'],
        look: { skin: 'skin3', hair: 'hair-long', hairColor: 'hc-blonde', top: 'sailor-top', legs: 'shorts', shoes: 'boots', extra: 'snorkel-mask' },
        say: { hello: "Ahoy, explorer! I'm Captain Coral. I sell treasures from the deep blue sea!", back: 'Ahoy again, {name}! Fancy something new?',
          bye: 'Fair winds!', sold: 'Shipshape!' } },
      { id: 'deep', name: 'Dr Deep', role: 'challenger', at: 'Tardigrades: The Unkillable Water Bear?', prize: 'captain-hat',
        look: { skin: 'skin2', hair: 'hair-short', hairColor: 'hc-black', top: 'labcoat', legs: 'trousers-black', shoes: 'boots', hat: 'captain-hat', extra: 'glasses' },
        say: { hello: "Hello! I'm Dr Deep. I study the strangest creatures on Earth. Answer my three questions, and a sea captain hat is yours!",
          notNow: "Off you go. The ocean isn't going anywhere!", again: "Not quite! Scientists check and try again. Another go? I'll ask different questions.",
          win: "Wonderful! All three right! Here's my spare sea captain hat.", gems: 'Wonderful! Here are your 3 💎. See you tomorrow!' } },
      { id: 'meg', name: 'Mossy Meg', role: 'helper', quest: 'polyps', at: 'Tardigrades: The Unkillable Water Bear?',
        look: { skin: 'skin1', hair: 'hair-plaits', hairColor: 'hc-ginger', top: 'jumper-green', legs: 'jeans', shoes: 'boots', hat: 'explorer-hat', extra: 'magnifier' },
        say: { idle: "I'm Mossy Meg. I look for tardigrades in wet moss. They're everywhere, if you look closely!", done: 'Mara has seen her baby jellyfish now. Nice work, {name}!',
          waiting: "Take that microscope to Professor Mara – she's waiting by the jellyfish!", offer: "A microscope for Mara? I've got a spare! But first, three quick questions.",
          notNow: "No rush. I'll keep it safe.", give: 'Here you go – one microscope! Take it to Professor Mara.' } },
      { id: 'mara', name: 'Professor Mara', role: 'giver', quest: 'polyps', at: 'The Immortal Jellyfish: Can It Live Forever?',
        look: { skin: 'skin3', hair: 'hair-curly', hairColor: 'hc-black', top: 'tee-teal', legs: 'shorts', shoes: 'trainers', extra: 'shades' },
        say: { problem: ["I've found some tiny baby jellyfish, called polyps, but they're too small to see properly!"], ask: 'Could you help me find a microscope?',
          no: "That's all right. I'll squint really hard…", yes: 'Thank you! Mossy Meg, by the Tardigrades stop, uses one to spot water bears!',
          nudge: 'Any luck? Mossy Meg, by the Tardigrades stop, might have a microscope.',
          found: 'A microscope! Thank you! A quick question before I look…', done: 'Those polyps are amazing up close. Thank you, {name}!' } },
    ],
    world: [
      { id: 'gus', name: 'Globetrotter Gus', role: 'trader', at: null, stock: ['bucket-hat', 'travel-camera', 'pet-turtle'],
        look: { skin: 'skin1', hair: 'hair-short', hairColor: 'hc-brown', top: 'field-vest', legs: 'shorts', shoes: 'boots', hat: 'bucket-hat', extra: 'travel-camera' },
        say: { hello: "Hello, traveller! I'm Globetrotter Gus. I bring back things from all over the world!", back: 'Welcome back, {name}! Where are you off to next?',
          bye: 'Safe travels!', sold: 'A great pick!' } },
      { id: 'priya', name: 'Pilot Priya', role: 'challenger', at: 'England: Castles, Kings & Cups of Tea', prize: 'world-medal',
        look: { skin: 'skin3', hair: 'hair-ponytail', hairColor: 'hc-black', top: 'tee-red', legs: 'trousers-black', shoes: 'boots', hat: 'pilot-cap', extra: 'world-medal' },
        say: { hello: "Hi! I'm Pilot Priya. I fly all over the world. Answer my three quick questions about the countries you've visited, and I'll give you a traveller's medal!",
          notNow: 'Okay! Come back before my next flight!', again: "Not quite! Even pilots double-check. Another go? I'll ask different questions.",
          win: "Great flying! All three right! This traveller's medal is yours.", gems: 'Great flying! Here are your 3 💎. See you tomorrow!' } },
      { id: 'kenji', name: 'Guide Kenji', role: 'helper', quest: 'yuki', at: 'Japan: Land of the Rising Sun',
        look: { skin: 'skin2', hair: 'hair-short', hairColor: 'hc-black', top: 'happi-coat', legs: 'jeans', shoes: 'trainers', hat: 'cap' },
        say: { idle: "Konnichiwa! I'm Guide Kenji. I show visitors around Japan.", done: 'Yuki loved her visit to Thailand. Thank you, {name}!',
          waiting: 'Take that phrasebook to Grandma Malee in Thailand!', offer: "A phrasebook for Grandma Malee? Here's one I made for visitors! But first, three quick questions.",
          give: 'Here you go – my Japanese phrasebook! Take it to Grandma Malee.' } },
      { id: 'malee', name: 'Grandma Malee', role: 'giver', quest: 'yuki', at: 'Thailand: Welcome Home!',
        look: { skin: 'skin3', hair: 'hair-buns', hairColor: 'hc-white', top: 'dress-purple', legs: 'legs-none', shoes: 'trainers', extra: 'glasses' },
        say: { problem: ["Sawasdee! My friend Yuki is visiting from Japan, and I'm making her mango sticky rice!", "I'd love to say something to her in Japanese, but I don't know any words…"],
          ask: 'Could you find me a little Japanese phrasebook?', no: 'Mai pen rai – never mind! Come back if you change your mind.',
          yes: 'Thank you! Guide Kenji, by the Japan stop, might have one!', nudge: 'Any luck? Guide Kenji, by the Japan stop, might have a phrasebook.',
          found: 'A phrasebook! Thank you! Now, Yuki is sitting down to eat…', done: 'Yuki and I are already planning my visit to Japan! Thank you, {name}!' } },
    ],
  };
  const byId = id => Object.values(NPCS).flat().find(n => n.id === id);

  // what each role says when an NPC doesn't have a line of their own
  const DEFAULT_SAY = {
    trader: { back: 'Welcome back, {name}! Fancy something new?', bye: 'Come back any time!', sold: 'Pleasure doing business!' },
    challenger: { rematch: "Back for a rematch? Win again and I'll give you 3 💎. (Once a day!)", notNow: 'Come back any time!',
      again: "Not quite! Another go? I'll ask different questions.", later: 'Come back any time!',
      beaten: "You've beaten me today, {name}! Come back tomorrow for a rematch." },
    helper: { notNow: "No rush. I'll keep it safe.", again: "So close! Try again? I'll ask different ones.", later: "Come back when you're ready!" },
    giver: { ask: 'Could you help me find another one?', no: "That's all right. Come back if you change your mind!", yes: 'Thank you!' },
  };
  const line = (n, k) => (n.say && n.say[k]) || DEFAULT_SAY[n.role][k];

  function marker(n) {
    const st = load(), q = questOf(n), has = q && st.bag.includes(q.item.id), on = q && st.quests[n.quest];
    switch (n.role) {
      case 'trader': return '🛒';
      case 'challenger': return !st.got[n.id] ? '!' : st.day[n.id] === today() ? '' : '⚔️';
      case 'helper': return on === 'active' && !has ? '!' : '';
      case 'giver': return !on ? '!' : on === 'active' && has ? '?' : '';
      default: return '';
    }
  }

  // ---------- the text box ----------
  // Every step returns a promise; closing the box (✕ or Esc) stops the conversation wherever it is.
  const CLOSED = new Error('closed');
  const still = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let audio = null;
  const blip = () => { // a soft "talking" blip every couple of letters, like an RPG
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = 'square'; o.frequency.value = 520 + Math.random() * 60; g.gain.value = 0.025;
      o.connect(g); g.connect(audio.destination); o.start(); o.stop(audio.currentTime + 0.03);
    } catch (e) { /* no sound */ }
  };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  function textBox(n) {
    let closed = false, typing = null, waiters = [];
    const back = el('div', 'npc-back'), box = el('div', 'npc-box');
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', n.name);
    const face = el('div', 'npc-face');
    if (n.look && window.Avatar) face.append(Avatar.draw(Object.assign({}, Avatar.DEFAULT_LOOK, n.look), { scale: 6 }));
    else face.append(el('span', 'npc-face-icon', n.icon || '🎒'));
    const main = el('div', 'npc-main'), name = el('div', 'npc-name', n.name), text = el('div', 'npc-text'), act = el('div', 'npc-act');
    text.setAttribute('aria-live', 'polite');
    const x = el('button', 'npc-x', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Close');
    main.append(name, text, act); box.append(face, main, x); back.append(box);
    document.body.append(back);
    const close = () => { if (closed) return; closed = true; clearInterval(typing); back.remove(); document.removeEventListener('keydown', onKey); waiters.forEach(w => w(CLOSED)); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    x.onclick = close;
    document.addEventListener('keydown', onKey);
    // wait for something; rejects if the box is closed first
    const wait = setup => new Promise((ok, no) => { if (closed) return no(CLOSED); const w = v => (v === CLOSED ? no(CLOSED) : ok(v)); waiters.push(w); setup(v => { waiters = waiters.filter(f => f !== w); ok(v); }); });

    // type a line out letter by letter (a tap finishes it straight away)
    function type(line) {
      clearInterval(typing);
      const full = line.replace(/\{name\}/g, playerName());
      text.textContent = '';
      return wait(done => {
        let i = 0;
        const finish = () => { clearInterval(typing); typing = null; text.textContent = full; box.onclick = null; done(); };
        box.onclick = e => { if (e.target === x) return; finish(); };
        if (still()) return finish();
        typing = setInterval(() => { i++; text.textContent = full.slice(0, i); if (i % 2 && /\w/.test(full[i - 1])) blip(); if (i >= full.length) finish(); }, 28);
      });
    }
    const button = (label, cls) => { const b = el('button', 'npc-btn' + (cls ? ' ' + cls : ''), label); b.type = 'button'; return b; };

    const api = {
      close,
      // say a line, then wait for a tap (or the ▶ button)
      async say(line) {
        act.replaceChildren();
        await type(line);
        const more = button('▶'); more.classList.add('npc-more');
        act.replaceChildren(more); more.focus();
        await wait(done => { more.onclick = done; box.onclick = e => { if (e.target !== x) done(); }; });
        box.onclick = null;
      },
      // say a line, then pick one of the answers; returns its index
      async choose(line, labels) {
        act.replaceChildren();
        await type(line);
        const bs = labels.map(l => button(l));
        act.replaceChildren(...bs); bs[0].focus();
        return wait(done => bs.forEach((b, k) => { b.onclick = e => { e.stopPropagation(); done(k); }; }));
      },
      // one quick question. retry: wrong answers only get a hint and are crossed out; otherwise a miss shows the answer
      async ask(q, label, { retry = false } = {}) {
        act.replaceChildren();
        const type_ = q.type || 'mcq', truth = type_ === 'tf' ? (q.answer ? 'True' : 'False') : type_ === 'type' ? [].concat(q.answer)[0] : q.options[q.answer];
        const qline = (label ? label + ': ' : '') + (type_ === 'tf' ? `True or false? ${q.q}` : q.q.replace('___', '_____'));
        await type(qline);
        const hint = () => { text.textContent = qline.replace(/\{name\}/g, playerName()) + '\n💡 ' + (q.hint || 'Not quite – try again!'); };
        const verdict = async (ok, picked) => {
          if (ok) { picked && picked.classList.add('right'); await api.say(q.explain ? `✔ ${q.explain}` : '✔ Correct!'); return true; }
          await api.say(`✘ Not quite! The answer is: ${truth}.`);
          return false;
        };
        if (type_ === 'type') {
          const inp = el('input', 'npc-input'); inp.type = 'text'; inp.autocomplete = 'off'; inp.setAttribute('aria-label', 'Your answer');
          const ok = button('OK');
          act.replaceChildren(inp, ok); inp.focus();
          const clean = t => String(t).toLowerCase().replace(/[^a-z0-9£:]+/g, ' ').trim();
          for (;;) {
            const v = await wait(done => { ok.onclick = () => done(inp.value); inp.onkeydown = e => { if (e.key === 'Enter') done(inp.value); }; });
            if (!clean(v)) { inp.focus(); continue; }
            const right = [].concat(q.answer).map(clean).includes(clean(v));
            if (right || !retry) return verdict(right);
            hint(); inp.select();
          }
        }
        const opts = type_ === 'tf' ? [['True', q.answer === true], ['False', q.answer === false]] : shuffle(q.options.map((o, k) => [o, k === q.answer]));
        const bs = opts.map(([o]) => button(o));
        act.replaceChildren(...bs); bs[0].focus();
        for (;;) {
          const k = await wait(done => bs.forEach((b, j) => { b.onclick = e => { e.stopPropagation(); done(j); }; }));
          if (opts[k][1]) { bs.forEach(b => { b.disabled = true; }); return verdict(true, bs[k]); }
          bs[k].classList.add('wrong'); bs[k].disabled = true;
          if (!retry) { bs.forEach(b => { b.disabled = true; }); return verdict(false); }
          hint();
        }
      },
      // show an avatar item they've just been given, with "wear it now?"
      async reward(item, line) {
        act.replaceChildren();
        await type(line);
        const a = Avatar.load(), look = Object.assign({}, a.look, { [item.cat]: item.id });
        const card = el('div', 'npc-prize');
        card.append(Avatar.draw(look, { scale: 4, pet: item.cat === 'pet' }), el('div', 'npc-prize-name', `NEW! ${item.name}`));
        const wear = button('👕 Wear it now'), later = button('Later');
        act.replaceChildren(card, wear, later); wear.focus();
        const k = await wait(done => { wear.onclick = e => { e.stopPropagation(); done(0); }; later.onclick = e => { e.stopPropagation(); done(1); }; });
        if (k === 0) { Avatar.wear(item.id); if (window.heroAnim) heroAnim.redraw(); }
      },
      // a quest item goes into the backpack
      async gift(id, line) {
        act.replaceChildren();
        await type(line);
        const it = itemOf(id), card = el('div', 'npc-prize');
        card.append(el('div', 'npc-prize-icon', it.icon), el('div', 'npc-prize-name', `🎒 ${it.name} – in your backpack!`));
        const ok = button('▶');
        act.replaceChildren(card, ok); ok.focus();
        await wait(done => { ok.onclick = e => { e.stopPropagation(); done(); }; });
      },
      // a trader's stall: returns the item picked, or null to leave
      async shop(line, items) {
        act.replaceChildren();
        await type(line);
        const a = Avatar.load(), cards = items.map(it => {
          const b = button('', 'npc-ware'), owned = Avatar.owns(it);
          b.append(Avatar.draw(Object.assign({}, a.look, { [it.cat]: it.id }), { scale: 3, pet: it.cat === 'pet' }), el('span', 'npc-ware-name', it.name), el('span', 'npc-ware-price', owned ? '✔ OWNED' : `💎 ${it.price}`));
          if (owned) b.classList.add('owned');
          return b;
        });
        const leave = button('Just looking');
        act.replaceChildren(el('div', 'npc-wares'), leave);
        act.firstChild.append(...cards);
        (cards.find(c => !c.classList.contains('owned')) || leave).focus();
        return wait(done => { cards.forEach((c, k) => { c.onclick = e => { e.stopPropagation(); done(items[k]); }; }); leave.onclick = e => { e.stopPropagation(); done(null); }; });
      },
    };
    return api;
  }

  // the questions he got wrong on the first try last time (y3:tries, saved by the lessons), by lesson id
  const norm = t => String(t).replace(/<[^>]+>/g, '').replace(/\[\[([^\]|]+)(\|[^\]]*)?\]\]/g, '$1').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  function tricky(id) {
    try {
      const l = (JSON.parse(localStorage.getItem('y3:tries') || '{}') || {})[id];
      return new Set(Object.values((l && l.qs) || {}).filter(r => r.last === 'miss').map(r => norm(r.q)));
    } catch (e) { return new Set(); }
  }
  // three quick questions from the lessons cleared up to this NPC (up to two of them ones he missed last time); stops at the first miss
  async function challenge(box, pool) {
    const bank = window.QUESTION_BANK || {};
    const all = shuffle(pool.flatMap(id => { const t = tricky(id); return (bank[id] || []).map(q => ({ q, hard: t.has(norm(q.q)) })); }));
    const hard = all.filter(x => x.hard).slice(0, 2);
    const qs = shuffle(hard.concat(all.filter(x => !hard.includes(x)).slice(0, 3 - hard.length))).map(x => x.q);
    for (let i = 0; i < qs.length; i++) if (!(await box.ask(qs[i], `Question ${i + 1} of ${qs.length}`))) return false;
    return qs.length > 0;
  }
  // keep trying: a fresh set each time, until they win or say "later"
  async function challengeUntil(box, pool, again, later) {
    for (;;) {
      if (await challenge(box, pool)) return true;
      if ((await box.choose(again, ['Try again', 'Later'])) === 1) { await box.say(later); return false; }
    }
  }

  // ---------- what each role says and does ----------
  const SCRIPTS = {
    async trader(box, n, ctx) {
      const met = load().got[n.id];
      update(st => { st.got[n.id] = true; });
      let say = met ? line(n, 'back') : line(n, 'hello');
      for (;;) {
        const pick = await box.shop(say + `  (You have 💎 ${Avatar.wallet().balance}.)`, n.stock.map(Avatar.byId));
        if (!pick) return box.say(line(n, 'bye'));
        if (Avatar.owns(pick)) { say = 'You already have that one! Anything else?'; continue; }
        if (!Avatar.spend(pick.price)) { say = `That one costs 💎 ${pick.price}. You need ${pick.price - Avatar.wallet().balance} more – clear a quest and come back!`; continue; }
        Avatar.give(pick.id); ctx.changed();
        await box.reward(pick, line(n, 'sold'));
        say = 'Anything else?';
      }
    },
    async challenger(box, n, ctx) {
      const st = load(), first = !st.got[n.id];
      if (!first && st.day[n.id] === today()) return box.say(line(n, 'beaten'));
      const go = await box.choose(first ? line(n, 'hello') : line(n, 'rematch'), ["Let's go!", 'Not now']);
      if (go === 1) return box.say(line(n, 'notNow'));
      if (!(await challengeUntil(box, ctx.pool, line(n, 'again'), line(n, 'later')))) return;
      update(s => { s.got[n.id] = true; s.day[n.id] = today(); });
      if (first) { Avatar.give(n.prize); ctx.changed(); return box.reward(Avatar.byId(n.prize), line(n, 'win')); }
      Avatar.earn(3); ctx.changed();
      return box.say(line(n, 'gems'));
    },
    // has the quest item: 3 questions on the lessons up to them, then it goes in the backpack
    async helper(box, n, ctx) {
      const st = load(), q = questOf(n), on = st.quests[n.quest];
      if (on !== 'active') return box.say(on === 'done' ? line(n, 'done') : line(n, 'idle'));
      if (st.bag.includes(q.item.id)) return box.say(line(n, 'waiting'));
      if ((await box.choose(line(n, 'offer'), ["I'm ready!", 'Not now'])) === 1) return box.say(line(n, 'notNow'));
      if (!(await challengeUntil(box, ctx.pool, line(n, 'again'), line(n, 'later')))) return;
      update(s => { if (!s.bag.includes(q.item.id)) s.bag.push(q.item.id); });
      ctx.changed();
      return box.gift(q.item.id, line(n, 'give'));
    },
    // starts the quest; takes the item back with one question, then says thank you with the rewards
    async giver(box, n, ctx) {
      const st = load(), q = questOf(n), on = st.quests[n.quest];
      if (on === 'done') return box.say(line(n, 'done'));
      if (!on) {
        for (const l of line(n, 'problem')) await box.say(l);
        if ((await box.choose(line(n, 'ask'), ['Yes, I can help!', 'Sorry, not now'])) === 1) return box.say(line(n, 'no'));
        update(s => { s.quests[n.quest] = 'active'; });
        ctx.changed();
        return box.say(line(n, 'yes'));
      }
      if (!st.bag.includes(q.item.id)) return box.say(line(n, 'nudge'));
      await box.say(line(n, 'found'));
      await box.ask(q.check, null, { retry: true });
      await box.say(q.explain);
      update(s => { s.bag = s.bag.filter(b => b !== q.item.id); s.quests[n.quest] = 'done'; });
      q.rewards.forEach(([id]) => Avatar.give(id)); ctx.changed();
      for (const [id, l] of q.rewards) await box.reward(Avatar.byId(id), l);
    },
  };

  async function talk(n, ctx = {}) {
    const box = textBox(n);
    ctx = Object.assign({ pool: [], changed() {} }, ctx);
    try { await SCRIPTS[n.role](box, n, ctx); box.close(); } catch (e) { if (e !== CLOSED) { box.close(); throw e; } }
  }

  // the backpack: quest items and the quests you're on
  async function backpack() {
    const st = load(), box = textBox({ name: 'My backpack', icon: '🎒' });
    const items = st.bag.map(itemOf).filter(Boolean), on = Object.keys(st.quests).filter(q => st.quests[q] === 'active' && QUESTS[q]);
    const lines = [];
    const giverOf = it => byId(Object.values(QUESTS).find(q => q.item === it).giver).name;
    if (items.length) lines.push(items.map(it => `${it.icon} ${it.name} – Take it to ${giverOf(it)}.`).join('\n'));
    if (on.length) lines.push(on.map(k => { const q = QUESTS[k]; return `📜 ${q.name}: ${st.bag.includes(q.item.id) ? `Take the ${q.item.name.toLowerCase()} to ${byId(q.giver).name}.` : q.find}`; }).join('\n'));
    try { await box.say(lines.join('\n\n') || 'Your backpack is empty. Talk to people on the map – some of them need your help!'); box.close(); } catch (e) { if (e !== CLOSED) throw e; }
  }


  window.NPC = {
    forWorld: key => NPCS[key] || [],
    marker,
    look: n => Object.assign({}, window.Avatar ? Avatar.DEFAULT_LOOK : {}, n.look),
    talk,
    backpack,
    bagCount: () => load().bag.length,
    _byId: byId,
  };

  // the text box's look: black box, white border, pixel font (the Undertale feel)
  const css = document.createElement('style');
  css.textContent = `
  .npc-back { position: fixed; inset: 0; z-index: 60; display: flex; align-items: flex-end; justify-content: center; padding: 16px; background: rgba(0,0,0,.35); }
  .npc-box { position: relative; width: min(700px, 100%); display: flex; gap: 14px; align-items: flex-start; padding: 14px 16px 16px; background: #000; color: #fff;
    border: 4px solid #fff; box-shadow: 0 0 0 4px #000, 0 10px 0 rgba(0,0,0,.35); font-family: var(--pixel, monospace); cursor: default;
    max-height: calc(100vh - 32px); overflow-y: auto; }
  .npc-face { flex: none; width: 76px; height: 76px; overflow: hidden; display: grid; place-items: start center; border: 3px solid #fff; background: #2a2a2a; }
  .npc-face canvas { image-rendering: pixelated; margin-top: 2px; }
  .npc-face-icon { place-self: center; font-size: 2.6rem; }
  .npc-main { flex: 1; min-width: 0; padding-right: 34px; }
  .npc-name { margin-bottom: 4px; color: #ffd43b; font-weight: 700; font-size: .95rem; }
  .npc-text { min-height: 3.6em; white-space: pre-wrap; font-size: 1.15rem; font-weight: 700; line-height: 1.4; }
  .npc-act { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 10px; }
  .npc-btn { padding: 6px 12px; font: inherit; font-weight: 700; font-size: 1rem; color: #fff; background: #000; border: 3px solid #fff; cursor: pointer; }
  .npc-btn:hover:not(:disabled), .npc-btn:focus-visible { color: #ffd43b; border-color: #ffd43b; outline: none; }
  .npc-btn:hover:not(:disabled)::before, .npc-btn:focus-visible::before { content: "♥ "; color: #e53935; }
  .npc-btn.right { color: #7cfc3a; border-color: #7cfc3a; }
  .npc-btn.wrong { color: #ff8a80; border-color: #ff8a80; text-decoration: line-through; opacity: .7; }
  .npc-btn.npc-more { margin-left: auto; animation: npc-blink 1s steps(2) infinite; }
  @keyframes npc-blink { 50% { opacity: .35; } }
  .npc-x { position: absolute; top: 6px; right: 6px; width: 34px; height: 34px; font-size: 1rem; font-weight: 700; color: #fff; background: #000; border: 3px solid #fff; cursor: pointer; }
  .npc-input { flex: 1; min-width: 140px; padding: 6px 10px; font: inherit; font-size: 1.1rem; color: #fff; background: #111; border: 3px solid #fff; }
  .npc-prize { display: flex; align-items: center; gap: 12px; width: 100%; padding: 8px; border: 3px dashed #ffd43b; }
  .npc-prize canvas { image-rendering: pixelated; }
  .npc-prize-icon { font-size: 3rem; }
  .npc-prize-name { color: #ffd43b; font-weight: 700; }
  .npc-wares { display: flex; flex-wrap: wrap; gap: 8px; width: 100%; }
  .npc-ware { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 118px; padding: 8px 6px; }
  .npc-ware canvas { image-rendering: pixelated; }
  .npc-ware-name { font-size: .85rem; text-align: center; }
  .npc-ware-price { color: #ffd43b; font-size: .85rem; }
  .npc-ware.owned { opacity: .55; }
  @media (max-width: 520px) {
    .npc-back { padding: 10px; }
    .npc-box { gap: 10px; padding: 12px; }
    .npc-face { width: 56px; height: 56px; }
    .npc-face canvas { width: 54px; height: auto; }
    .npc-text { font-size: 1rem; }
    .npc-ware { width: calc(50% - 4px); }
  }`;
  document.head.append(css);
})();
