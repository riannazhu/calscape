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

/** Coffee cup for the scene label. */
export const CUP = fromRows(
  [
    '.S.S..',
    'WCCCW.',
    'WWWWWW',
    'WWWW.W',
    'WWWWW.',
    '.WWW..',
  ],
  { W: 'shirtWhite', C: 'trunk', S: 'wispBase' },
);

/** Sailboat for the scene label. */
export const BOAT = fromRows(
  [
    '...M..',
    '..SMs.',
    '.SSMs.',
    'SSSMss',
    '...M..',
    'HHHHHH',
  ],
  { S: 'wispTop', s: 'stone', M: 'trunk', H: 'birdBody' },
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
