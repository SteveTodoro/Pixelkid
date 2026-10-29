/* Pixelkid library: every world and its lessons, in road order. Loaded by index.html (the quest map and Lesson mode)
 * and read by the tools (lesson-check, activity-audit, build-question-bank, smoke). */
// Add a lesson by giving it a `file`. Lessons without one show as "Coming soon".
// Each lesson follows the one listed before it on the world's road; `after: '<title>'` starts a branch after another lesson.
// A lesson in the same unit as the stop before it opens with a recap of that lesson; a lesson that starts a new unit opens
// with a warm-up instead (a review stage whose `from` has no url). tools/lesson-check.js checks both.
// On the quest map a stop's sign shows the title up to its colon (or `mapTitle`, for a long title without one).
const LIBRARY = {
  science: {
    label: '🔬 Science Lab', tab: '🔬 Science',
    lessons: [
      { id: 'science-magnets', title: 'Magnet Magic!', emoji: '🧲', unit: 'Forces & Magnets', file: 'science/magnets.html' },
      { id: 'science-friction', title: 'Pushes, Pulls & Friction', emoji: '🛷', unit: 'Forces & Magnets', file: 'science/friction.html' },
      { id: 'science-plant-parts', title: 'Plant Detectives', emoji: '🌱', unit: 'Plants', file: 'science/plant-parts.html' },
      { id: 'science-plant-needs', title: 'What Do Plants Need?', emoji: '🌻', unit: 'Plants', file: 'science/plant-needs.html' },
      { id: 'science-flower-life-cycle', title: 'Flower Power Life Cycle', emoji: '🌸', unit: 'Plants', file: 'science/flower-life-cycle.html' },
      { id: 'science-rocks', title: 'Rock Stars', emoji: '🪨', unit: 'Rocks', file: 'science/rocks.html' },
      { id: 'science-fossils', title: 'Fossil Hunters', emoji: '🦖', unit: 'Rocks', file: 'science/fossils.html' },
      { id: 'science-soil', title: 'Super Soil', emoji: '🪱', unit: 'Rocks', file: 'science/soil.html' },
      // the road forks after Friction: Plants → Rocks one way, Animals → Light the other
      { title: 'Fuel Your Body', emoji: '🥦', unit: 'Animals incl. Humans', after: 'Pushes, Pulls & Friction' },
      { title: 'Bones & Muscles', emoji: '🦴', unit: 'Animals incl. Humans' },
      { title: 'Light & Mirrors', emoji: '💡', unit: 'Light' },
      { title: 'Shadow Shapes', emoji: '👤', unit: 'Light' },
    ],
  },
  maths: {
    label: '🔢 Maths Mine', tab: '🔢 Maths',
    lessons: [
      { id: 'maths-time', title: 'Tick Tock Time', emoji: '⏰', unit: 'Time', file: 'maths/time.html' },
      { id: 'maths-clock-quest', title: 'Clock Quest: To the Minute', emoji: '🕰️', unit: 'Time', file: 'maths/clock-quest.html' },
      { id: 'maths-24-hour', title: 'Night & Day: The 24-Hour Clock', emoji: '🌙', unit: 'Time', file: 'maths/24-hour.html' },
      { id: 'maths-how-long', title: 'How Long? Time Hops', emoji: '⏳', unit: 'Time', file: 'maths/how-long.html' },
      { id: 'maths-place-value', title: 'Place Value Party', emoji: '🎉', unit: 'Numbers to 1,000', file: 'maths/place-value.html' },
      { id: 'maths-add-subtract', title: '3-Digit Add & Subtract', emoji: '➕', unit: 'Addition & Subtraction', file: 'maths/add-subtract.html' },
      { id: 'maths-money', title: 'Money Market', emoji: '💷', unit: 'Measurement', file: 'maths/money.html' },
      { title: 'Measure It!', emoji: '📏', unit: 'Measurement' },
      { title: 'Perimeter Fences', emoji: '🐑', unit: 'Measurement' },
      { title: 'Bar Chart Bonanza', emoji: '📊', unit: 'Statistics' },
      // the road forks after Place Value: adding & measuring one way, multiplying & dividing the other
      { title: 'Counting in 4s, 8s, 50s & 100s', mapTitle: 'Counting in Steps', emoji: '🐸', unit: 'Number', after: 'Place Value Party' },
      { title: 'Times Tables Tower (3, 4, 8)', emoji: '🏰', unit: 'Multiplication & Division' },
      { title: 'Fraction Pizza Shop', emoji: '🍕', unit: 'Fractions' },
      { title: 'Shape Explorers', emoji: '🔺', unit: 'Geometry' },
    ],
  },
  english: {
    label: '📚 Word Kingdom', tab: '📚 English',
    lessons: [
      { id: 'english-prefixes', title: 'Prefix Power', emoji: '🦸', unit: 'Spelling & Vocabulary', file: 'english/prefixes.html' },
      { id: 'english-suffixes', title: 'Suffix Squad', emoji: '🧩', unit: 'Spelling & Vocabulary', file: 'english/suffixes.html' },
      { id: 'english-homophones', title: 'Homophone Hunters', emoji: '👂', unit: 'Spelling & Vocabulary', file: 'english/homophones.html' },
      { id: 'english-a-or-an', title: 'A or An?', emoji: '🍎', unit: 'Grammar', file: 'english/a-or-an.html' },
      { id: 'english-conjunctions', title: 'Conjunction Junction', emoji: '🚂', unit: 'Grammar', file: 'english/conjunctions.html' },
      { id: 'english-speech-marks', title: 'Speech Marks Squad', emoji: '💬', unit: 'Punctuation', file: 'english/speech-marks.html' },
      { id: 'english-poetry', title: 'Poetry Playground', emoji: '🎵', unit: 'Poetry', file: 'english/poetry.html' },
      // the road forks after Homophones: writing (grammar & punctuation) one way, reading (stories & facts) the other
      { id: 'english-theseus', title: 'Theseus & the Minotaur', emoji: '🐂', unit: 'Myths & Legends', file: 'english/theseus.html', after: 'Homophone Hunters' },
      { title: 'Fairy Tale Twist', emoji: '🧚', unit: 'Fiction' },
      { title: 'Non-fiction Detectives', emoji: '🔎', unit: 'Non-fiction' },
      { title: 'Inference Investigators', emoji: '🕵️', unit: 'Reading Skills' },
    ],
  },
  future: {
    label: '🚀 Future Skills', tab: '🚀 Future',
    lessons: [
      { id: 'future-ai', title: 'How Does AI Work?', emoji: '🤖', unit: 'AI & Computers', file: 'future/ai.html' },
      { id: 'future-pixel-art', title: 'Pixel Art Studio', emoji: '🎨', unit: 'Creative Tech', file: 'future/pixel-art.html' },
      { id: 'future-poster', title: 'Design a Poster', emoji: '🖼️', unit: 'Creative Tech', file: 'future/poster.html' },
      { title: 'Video Editing: Tell a Story', emoji: '🎬', unit: 'Creative Tech' },
      { title: 'Think Like a Coder', emoji: '🧩', unit: 'Coding' },
      { title: 'Money Smarts', emoji: '🪙', unit: 'Life Skills' },
      // the road forks after the AI lesson: making things one way, thinking online the other
      { title: 'Asking Great Questions', emoji: '💬', unit: 'AI & Computers', after: 'How Does AI Work?' },
      { title: 'Real or Fake?', emoji: '🕵️', unit: 'Thinking Online' },
      { title: 'Search Detective', emoji: '🔎', unit: 'Thinking Online' },
      { title: 'Staying Safe Online', emoji: '🛡️', unit: 'Thinking Online' },
      { title: 'Be the Boss of Screen Time', emoji: '⏰', unit: 'Life Skills' },
    ],
  },
  wonders: {
    label: '🌍 Wonders of the World', tab: '🌍 Wonders',
    lessons: [
      { id: 'wonders-tardigrades', title: 'Tardigrades: The Unkillable Water Bear?', emoji: '🐻', unit: 'Amazing Animals', file: 'wonders/tardigrades.html' },
      { id: 'wonders-jellyfish', title: 'The Immortal Jellyfish: Can It Live Forever?', emoji: '🪼', unit: 'Amazing Animals', file: 'wonders/jellyfish.html' },
      { title: 'Octopus: 3 Hearts & Blue Blood', emoji: '🐙', unit: 'Amazing Animals' },
      { title: 'Animal Superpowers', emoji: '🦸', unit: 'Amazing Animals' },
      { title: "Your Body's Secret Superpowers", emoji: '🧠', unit: 'Your Amazing Body' },
      { title: 'Oops! Accidental Inventions', emoji: '🍭', unit: 'Incredible Inventions' },
      { title: 'The Wright Brothers Take Off', emoji: '✈️', unit: 'Incredible Inventions' },
      { title: 'The Eiffel Tower Grows in Summer', mapTitle: 'The Growing Eiffel Tower', emoji: '🗼', unit: 'Incredible Inventions' },
      // the road forks after the Jellyfish: living things (and inventions) one way, places on the planet the other
      { title: 'Pyramids of Giza', emoji: '🔺', unit: 'Ancient Wonders', after: 'The Immortal Jellyfish: Can It Live Forever?' },
      { title: 'The Great Wall of China', emoji: '🧱', unit: 'Ancient Wonders' },
      { title: 'Pompeii: The City Frozen in Time', emoji: '🏺', unit: 'Ancient Wonders' },
      { title: 'The Terracotta Army', emoji: '🗿', unit: 'Ancient Wonders' },
      { title: 'Volcanoes: Earth Blows Its Top', emoji: '🌋', unit: 'Wild Planet' },
      { title: 'The Deepest Ocean', emoji: '🌊', unit: 'Wild Planet' },
      { title: 'The Northern Lights', emoji: '🌌', unit: 'Wild Planet' },
    ],
  },
  brain: {
    label: '🧠 Brain Dojo', tab: '🧠 Brain',
    lessons: [
      { id: 'brain-memory-palace', title: 'Memory Palace', emoji: '🏰', unit: 'Super Memory', file: 'brain/memory-palace.html' },
      { title: "Your Brain's Secret Paths", mapTitle: 'Secret Brain Paths', emoji: '🧠', unit: 'Super Memory' },
      { title: 'Spy School: Code Breakers', emoji: '🕵️', unit: 'Super Memory' },
      // the road forks after the Memory Palace: memory one way, focus & calm the other
      { id: 'brain-ninja-focus', title: 'Ninja Focus', emoji: '🥷', unit: 'Focus & Calm', file: 'brain/ninja-focus.html', after: 'Memory Palace' },
      { title: 'Eagle Eye: Spot It!', emoji: '🦅', unit: 'Focus & Calm' },
      { title: 'Listen Up! Story Keeper', emoji: '👂', unit: 'Focus & Calm' },
    ],
  },
  world: {
    label: '🗺️ Around the World', tab: '🗺️ World',
    lessons: [
      { id: 'world-japan', title: 'Japan: Land of the Rising Sun', emoji: '🇯🇵', unit: 'Asia', file: 'world/japan.html', stamp: 'JPN' },
      { id: 'world-england', title: 'England: Castles, Kings & Cups of Tea', emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', unit: 'Europe', file: 'world/england.html', stamp: 'ENG' },
      { id: 'world-thailand', title: 'Thailand: Welcome Home!', emoji: '🇹🇭', unit: 'Asia – home!', file: 'world/thailand.html', stamp: 'THA' },
      { id: 'world-usa', title: 'The USA: Space Rockets & Hot Dogs', emoji: '🇺🇸', unit: 'North America', file: 'world/usa.html', stamp: 'USA' },
      { title: 'China: Dragons & the Great Wall', emoji: '🇨🇳', unit: 'Asia' },
      { title: 'South Korea: K-Pop & Kimchi', emoji: '🇰🇷', unit: 'Asia' },
      { title: 'India: Colours & Elephants', emoji: '🇮🇳', unit: 'Asia' },
      { title: 'Italy: Pizza, Pasta & Volcanoes', emoji: '🇮🇹', unit: 'Europe' },
      { title: 'France: Croissants & the Eiffel Tower', emoji: '🇫🇷', unit: 'Europe' },
      { title: 'Egypt: Pyramids & Pharaohs', emoji: '🇪🇬', unit: 'Africa' },
      { title: 'Kenya: Safari Adventure', emoji: '🇰🇪', unit: 'Africa' },
      { title: 'Mexico: Piñatas & Tacos', emoji: '🇲🇽', unit: 'North America' },
      { title: 'Brazil: Rainforest & Carnival', emoji: '🇧🇷', unit: 'South America' },
      { title: 'Australia: Kangaroos & the Reef', emoji: '🇦🇺', unit: 'Oceania' },
    ],
  },
};
