import { fromRows } from '../scene/sprites';

export const SUN = [
  '.....#.....',
  '.#...#...#.',
  '..#.....#..',
  '....###....',
  '...#####...',
  '##.#####.##',
  '...#####...',
  '....###....',
  '..#.....#..',
  '.#...#...#.',
  '.....#.....',
];

/** Cal bear head for the CalScape label. */
export const BEAR = fromRows(
  [
    'BB...BB',
    'BBBBBBB',
    'BDBBBDB',
    'BBLLLBB',
    'BLLDLLB',
    '.BBBBB.',
  ],
  { B: 'deer', L: 'deerLight', D: 'eye' },
);

/** Little pine for the scene label. */
export const PINE = fromRows(
  [
    '..P..',
    '.LPp.',
    '.LPp.',
    'LPPPp',
    'LLPpp',
    '..T..',
  ],
  { L: 'pineLight', P: 'pine', p: 'pineDark', T: 'trunk' },
);

export const SUNSET = [
  '.....#.....',
  '.#...#...#.',
  '..#.....#..',
  '...........',
  '....###....',
  '#..#####..#',
  '..#######..',
  '...........',
  '###########',
  '...........',
  '.#########.',
];

export const MOON = [
  '...####....',
  '..###......',
  '.###.......',
  '.##........',
  '###........',
  '###........',
  '###........',
  '.###.......',
  '.####...##.',
  '..#######..',
  '...####....',
];

export const SPEAKER = [
  '....##.....',
  '...###...#.',
  '######.#..#',
  '######..#.#',
  '######..#.#',
  '######.#..#',
  '...###...#.',
  '....##.....',
];

export const SPEAKER_MUTED = [
  '....##.....',
  '...###.....',
  '######.#..#',
  '######..##.',
  '######..##.',
  '######.#..#',
  '...###.....',
  '....##.....',
];

export const MINUS = ['.......', '.......', '.......', '#######', '.......', '.......', '.......'];

export const PLUS = ['...#...', '...#...', '...#...', '#######', '...#...', '...#...', '...#...'];

export const REMOVE = [
  '..###..',
  '#######',
  '.......',
  '.#####.',
  '.#.#.#.',
  '.#.#.#.',
  '.#.#.#.',
  '.#####.',
];

export const FULLSCREEN = [
  '###...###',
  '#.......#',
  '#.......#',
  '.........',
  '.........',
  '.........',
  '#.......#',
  '#.......#',
  '###...###',
];

export const EXIT_FULLSCREEN = [
  '..#...#..',
  '..#...#..',
  '###...###',
  '.........',
  '.........',
  '.........',
  '###...###',
  '..#...#..',
  '..#...#..',
];

export const WIND_TILE = fromRows(
  [
    '....LLL......',
    '..LLLLLLl....',
    '.LLLLLLLll...',
    '.LLLLLLlll.WW',
    'LLLLLLllll...',
    '.LLLLllll.WWW',
    '..lllll......',
    '.....T...WW..',
    '.....T.......',
    '....TTT......',
  ],
  { L: 'leafLight', l: 'leafMid', T: 'trunk', W: 'cloudLight' },
);

export const SPRINKLER_TILE = fromRows(
  [
    '...wwww.....',
    '.ww....ww...',
    'w........w..',
    'w....K...w..',
    '....KSK.....',
    '.....S......',
    'g..SSSSS..g.',
    'gggggggggggg',
  ],
  { w: 'birdLight', K: 'lampPost', S: 'stoneMid', g: 'lawn' },
);

export const GUITAR_TILE = fromRows(
  [
    '..........kk',
    '.........kk.',
    '........n...',
    '.......n....',
    '..bbb.n.....',
    '.bBBBn......',
    'bBBhBBb.....',
    'bBhhhBb.....',
    'bBBhBBb.....',
    '.bBBBb......',
    '..bbb.......',
  ],
  { b: 'trunk', B: 'basket', h: 'trunkDark', n: 'trunkDark', k: 'trunkDark' },
);

export const CLOUD_TILE = fromRows(
  [
    '....LLL......',
    '..LLLLLLL....',
    '.LLLLLLLLLL..',
    'LLLLLLLLLLLL.',
    'MMMMMMMMMMMMM',
    '.DDDDDDDDDDD.',
    '.............',
    '..R...R...R..',
    '..R...R...R..',
    '....R...R....',
    '....R...R....',
  ],
  { L: 'cloudLight', M: 'cloudMid', D: 'cloudDark', R: 'birdLight' },
);

export const BELL_TILE = fromRows(
  [
    '......O......',
    '.....YGO.....',
    '....YGGGO....',
    '...YGGGGGO...',
    '...YGGGGGO...',
    '...YGGGGGO...',
    '..YGGGGGGGO..',
    '..YGGGGGGGO..',
    '.YGGGGGGGGGO.',
    'OOOOOOOOOOOOO',
    '.....OKO.....',
    '......O......',
  ],
  { Y: 'lampGlass', G: 'gold', O: 'campBell', K: 'clockHand' },
);
