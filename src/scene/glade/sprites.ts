import { blank, cricket, fromRows, rainCloud, wisp, type Drifter, type Sprite } from '../sprites';
import type { GladeKey } from './palette';

/** A front of rain clouds spread across the sky so the rain covers the Glade. */
export const RAIN_CLOUDS: { sprite: Sprite<GladeKey>; x: number; y: number }[] = (
  [
    [56, 16, -6, 40],
    [60, 18, 48, 24],
    [66, 20, 108, 8],
    [60, 18, 172, 22],
    [58, 16, 232, 32],
    [48, 16, 286, 44],
  ] as const
).map(([w, h, x, y], i) => ({ sprite: rainCloud(w, h, i + 1), x, y }));

export const WISPS: Drifter<GladeKey>[] = [
  { sprite: wisp(34, [[0.3, 0.6], [0.12, 0.85], [0, 1], [0.15, 0.7]]), y: 42, x0: 30, speed: 1 / 8 },
  { sprite: wisp(22, [[0.35, 0.7], [0.1, 1], [0.2, 0.8]]), y: 58, x0: 210, speed: 1 / 10 },
  { sprite: wisp(48, [[0.2, 0.45], [0.05, 0.75], [0, 1], [0.1, 0.9]]), y: 72, x0: 110, speed: 1 / 9 },
  { sprite: wisp(28, [[0.4, 0.75], [0.15, 0.9], [0, 1], [0.25, 0.65]]), y: 88, x0: 270, speed: 1 / 12 },
  { sprite: wisp(40, [[0.25, 0.55], [0.05, 0.8], [0.1, 1]]), y: 100, x0: 170, speed: 1 / 14 },
  { sprite: wisp(26, [[0.3, 0.7], [0, 0.9], [0.2, 1]]), y: 52, x0: 100, speed: 1 / 11 },
  { sprite: wisp(36, [[0.35, 0.6], [0.1, 0.9], [0, 1], [0.2, 0.75]]), y: 93, x0: 40, speed: 1 / 13 },
];

/** Extra streaks that only gather at sunset. */
export const SUNSET_WISPS: typeof WISPS = [
  { sprite: wisp(30, [[0.3, 0.65], [0.05, 0.9], [0.15, 1]]), y: 32, x0: 200, speed: 1 / 9 },
  { sprite: wisp(44, [[0.2, 0.5], [0, 0.8], [0.05, 1], [0.3, 0.85]]), y: 64, x0: 20, speed: 1 / 11 },
  { sprite: wisp(24, [[0.3, 0.7], [0, 1], [0.25, 0.8]]), y: 80, x0: 240, speed: 1 / 10 },
  { sprite: wisp(32, [[0.4, 0.7], [0.1, 0.95], [0, 1]]), y: 47, x0: 330, speed: 1 / 12 },
  { sprite: wisp(50, [[0.25, 0.6], [0.05, 0.85], [0, 1], [0.2, 0.9]]), y: 106, x0: 300, speed: 1 / 15 },
];

/**
 * Sather Tower, front face: gold finial and lantern, pyramidal copper spire,
 * belfry with three arched openings, clock stage and a long granite shaft.
 */
function campanile(): Sprite<GladeKey> {
  const w = 16;
  const h = 80;
  const { sprite, set } = blank<GladeKey>(w, h);
  const wall = (x: number): GladeKey => (x >= 12 ? (x === 15 ? 'campDark' : 'campShadow') : x === 0 ? 'campMid' : 'campLight');

  // Finial and lantern.
  set(7, 0, 'gold');
  for (let x = 6; x <= 8; x++) set(x, 1, 'gold');
  set(7, 2, 'gold');
  for (let y = 3; y < 6; y++) for (let x = 6; x <= 8; x++) set(x, y, x === 8 ? 'campShadow' : 'campLight');
  set(7, 4, 'campArch');

  // Spire: left face lit, right face in shade, a bright ridge down the middle.
  for (let y = 6; y < 26; y++) {
    const half = 1.5 + ((y - 6) / 19) * 6;
    const x0 = Math.round(7.5 - half);
    const x1 = Math.round(7.5 + half) - 1;
    for (let x = x0; x <= x1; x++) {
      let key: GladeKey = x < 8 ? 'copper' : 'copperDark';
      if (x === x0 || x === 7) key = 'copperLight';
      else if (x < 7 && (y - 6) % 5 === 4) key = 'copperDark';
      set(x, y, key);
    }
  }

  // Cornice under the spire.
  for (let x = 0; x < w; x++) {
    set(x, 26, x >= 12 ? 'campShadow' : 'campLight');
    set(x, 27, x % 2 === 0 ? 'campDark' : x >= 12 ? 'campShadow' : 'campMid');
  }

  // Belfry with three arched openings and the bells inside.
  for (let y = 28; y < 40; y++) for (let x = 0; x < w; x++) set(x, y, wall(x));
  for (const [a, b] of [
    [2, 4],
    [6, 9],
    [11, 13],
  ]) {
    for (let y = 29; y < 39; y++) {
      for (let x = a; x <= b; x++) {
        if (y === 29 && (x === a || x === b)) continue;
        set(x, y, 'campArch');
      }
    }
    const mid = Math.floor((a + b) / 2);
    set(mid, 31, 'campBell');
    for (let x = mid - (b - a > 2 ? 1 : 0); x <= mid + 1 && x <= b; x++) set(x, 32, 'campBell');
  }

  // Balcony rail.
  for (let x = 0; x < w; x++) {
    set(x, 40, x >= 12 ? 'campShadow' : 'campLight');
    set(x, 41, x % 2 === 0 ? 'campDark' : wall(x));
    set(x, 42, 'campShadow');
  }

  // Clock stage.
  for (let y = 43; y < 53; y++) for (let x = 0; x < w; x++) set(x, y, wall(x));
  for (let y = 43; y < 53; y++) {
    for (let x = 2; x < 13; x++) {
      const d = Math.hypot(x + 0.5 - 7.5, y + 0.5 - 47.5);
      if (d < 4) set(x, y, d > 3 ? 'campDark' : 'clockFace');
    }
  }
  for (let y = 45; y < 48; y++) set(7, y, 'clockHand');
  set(8, 47, 'clockHand');
  set(9, 47, 'clockHand');
  for (let x = 0; x < w; x++) set(x, 53, x >= 12 ? 'campDark' : 'campMid');

  // Long shaft with corner piers and narrow slit windows.
  for (let y = 54; y < h; y++) {
    for (let x = 0; x < w; x++) set(x, y, x === 2 || x === 11 ? 'campMid' : wall(x));
  }
  for (const top of [57, 66, 75]) {
    for (let y = top; y < top + 4; y++) {
      set(6, y, 'campArch');
      set(7, y, 'campArch');
    }
  }
  return sprite;
}

export const CAMPANILE = campanile();

const BIRD_LEGEND: Record<string, GladeKey> = {
  B: 'birdBody',
  L: 'birdLight',
  D: 'birdDark',
  W: 'birdBelly',
  K: 'beak',
  E: 'eye',
};

/** A California scrub jay, facing right. Feet sit on the bottom row. */
export const BIRD_IDLE = fromRows(
  [
    '....BBB....',
    '...BLLBB...',
    '...BLBEBKK.',
    '..DBBBBW...',
    '.DDLLBWWW..',
    'DD.DLBWWW..',
    'D...DBWW...',
    '.....K.K...',
  ],
  BIRD_LEGEND,
);

export const BIRD_SING = fromRows(
  [
    '....BBB....',
    '...BLLBB.K.',
    '...BLBEBK..',
    '..DBBBBWK..',
    '.DDLLBWWW..',
    'DD.DLBWWW..',
    'D...DBWW...',
    '.....K.K...',
  ],
  BIRD_LEGEND,
);

/** A tiny field cricket on the lawn, facing left. */
export const CRICKET = cricket<GladeKey>({ eye: 'eye', body: 'deerDark', wing: 'basket', leg: 'deer' });

/** A great horned owl facing out: open, blinking and hooting with a puffed white throat. */
const OWL_LEGEND: Record<string, GladeKey> = { B: 'deer', D: 'deerDark', L: 'deerLight', G: 'gold', E: 'eye' };
const owl = (eyes: string, throat: string[]) =>
  fromRows(['D.....D', 'DBBBBBD', 'BLLBLLB', eyes, 'BLLDLLB', ...throat, '..BBB..', '..D.D..'], OWL_LEGEND);

export const OWL = {
  open: owl('LGELEGL', ['.BLLLB.', '.BLDLB.']),
  blink: owl('LDDLDDL', ['.BLLLB.', '.BLDLB.']),
  hoot: owl('LGELEGL', ['BLLLLLB', '.BLLLB.']),
};

/**
 * A mourning dove facing right like the songbird on the same branch: small
 * head, pink-buff breast, black wing spots and a long pointed tail. The second
 * frame lowers the head and puffs the breast to coo.
 */
const DOVE_LEGEND: Record<string, GladeKey> = { B: 'dove', D: 'doveDark', L: 'doveLight', E: 'eye', K: 'doveDark' };

export const DOVE = [
  fromRows(
    ['........BB.', '.......BEBK', '.......BBB.', '..BBBBBLLB.', 'DDBDBBLLLB.', 'D..BBDBLL..', '....BBBB...', '.....D.D...'],
    DOVE_LEGEND,
  ),
  fromRows(
    ['...........', '........BB.', '.......BEBK', '..BBBBLLLB.', 'DDBDBLLLLL.', 'D..BBDLLLL.', '....BBBB...', '.....D.D...'],
    DOVE_LEGEND,
  ),
];

/** A fox squirrel facing left, tail curled over its back; the second frame flicks the tail. */
const SQUIRREL_LEGEND: Record<string, GladeKey> = { B: 'deer', D: 'deerDark', L: 'deerLight', E: 'eye' };

export const SQUIRREL = [
  fromRows(
    ['........DDD.', '.D.....DBBBD', 'BBB....DBLBD', 'BEBB...DBBD.', 'BBBBB..DBD..', '.LLBBBBBD...', '..LLBBBBD...', '..B.B..BB...'],
    SQUIRREL_LEGEND,
  ),
  fromRows(
    ['.........DDD', '.D......DBBB', 'BBB.....DBLB', 'BEBB....DBBD', 'BBBBB..DBD..', '.LLBBBBBD...', '..LLBBBBD...', '..B.B..BB...'],
    SQUIRREL_LEGEND,
  ),
];

const DEER_LEGEND: Record<string, GladeKey> = {
  B: 'deer',
  D: 'deerDark',
  L: 'deerLight',
  E: 'eye',
};

/**
 * A spotted doe, facing right: big ears, cream spots along a russet back, pale
 * belly and a flicked-up tail. Hooves sit on the bottom row.
 */
const DOE_TOP = [
  '.........D..D..',
  '.........BB.B..',
  '..........BBB..',
  '..........BEBB.',
  '..........BBBBD',
  '.........BB....',
  'L........BB....',
  'BBBLBBLBBBB....',
  'BLBBBLBBLBB....',
  '.BBBBBBBBBL....',
  '.BLLLLLLLB.....',
];

export const DEER_WALK = [
  fromRows([...DOE_TOP, '.B.B....B.B....', '.B.B....B.B....', '.D.D....D.D....'], DEER_LEGEND),
  fromRows([...DOE_TOP, '..BB.....BB....', '..BB.....BB....', '..DD.....DD....'], DEER_LEGEND),
];

export const DEER_GRAZE = fromRows(
  [
    '...............',
    '...............',
    '...............',
    '...............',
    '...............',
    '...............',
    'L..............',
    'BBBLBBLBBBB....',
    'BLBBBLBBLBBB...',
    '.BBBBBBBBBBBD..',
    '.BLLLLLLLBBBBD.',
    '.B.B....B.BEBBD',
    '.B.B....B.B....',
    '.D.D....D.D....',
  ],
  DEER_LEGEND,
);

/** Inventory tiles. */
export const WIND_TILE = fromRows<GladeKey>(
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

export const CLOUD_TILE = fromRows<GladeKey>(
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

export const BELL_TILE = fromRows<GladeKey>(
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
