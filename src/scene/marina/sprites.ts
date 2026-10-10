import { mulberry32 } from '../pixels';
import { blank, fromRows, wisp, type Drifter, type Sprite } from '../sprites';
import { shoreY } from './backdrop';
import type { MarinaKey } from './palette';

type S = Sprite<MarinaKey>;
type Legend = Record<string, MarinaKey>;

/** A Western Gull on a piling, facing left: white head, grey back, black wingtips, yellow bill with a red spot. */
const GULL_LEGEND: Legend = { W: 'gull', G: 'gullGrey', D: 'gullDark', B: 'bill', R: 'billSpot', E: 'eye', L: 'gullLeg' };

export const GULL = {
  idle: fromRows(
    ['..WWW......', '.WEWW......', 'BBWWW......', '.R.WWW.....', '...WWGGGG..', '...WWWGGGDD', '....WWWGG..', '.....L.L...', '.....L.L...'],
    GULL_LEGEND,
  ),
  call: fromRows(
    ['B..........', '.BWW.......', '.RWEW......', '..WWWW.....', '...WWGGGG..', '...WWWGGGDD', '....WWWGG..', '.....L.L...', '.....L.L...'],
    GULL_LEGEND,
  ),
};

/** A black-crowned night heron hunched on the piling: dark cap and back, grey wings, red eye. */
const HERON_LEGEND: Legend = { D: 'heronDark', G: 'heron', L: 'heronLight', E: 'heronEye', Y: 'bill' };

export const HERON = {
  idle: fromRows(
    ['...DDD...', '..LEDD...', 'DDLLDDD..', '..LLDDDD.', '..LLGGGGG', '...LGGGGG', '...LLGGG.', '....Y.Y..', '....Y.Y..'],
    HERON_LEGEND,
  ),
  call: fromRows(
    ['.D.DD....', '..DEDD...', '.D.LDDD..', '..LLDDDD.', '..LLGGGGG', '...LGGGGG', '...LLGGG.', '....Y.Y..', '....Y.Y..'],
    HERON_LEGEND,
  ),
};

/** Canada geese on the grass: black neck and head, white chinstrap, brown body. */
const GOOSE_LEGEND: Legend = { D: 'gooseDark', G: 'goose', L: 'gooseLight' };
const GOOSE_UP = ['.......DD.', '.......DLD', '.......D..', '.......D..', '.GGGGGGD..', 'GGGGGGGLL.', '.GGGGGLL..', '..D...D...'];
const GOOSE_HONK = ['......DD.D', '.......LD.', '.......D..', '.......D..', '.GGGGGGD..', 'GGGGGGGLL.', '.GGGGGLL..', '..D...D...'];
const GOOSE_GRAZE = ['..........', '..........', '..........', '..........', '.GGGGGGG..', 'GGGGGGGLDD', '.GGGGGLLDL', '..D...D...'];

function flock(lead: string[], second: string[]): S {
  const { sprite, set } = blank<MarinaKey>(40, 9);
  const put = (rows: string[], ox: number, oy: number, flip: boolean) => {
    const s = fromRows(rows, GOOSE_LEGEND);
    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        const k = s.px[y * s.w + (flip ? s.w - 1 - x : x)];
        if (k) set(ox + x, oy + y, k);
      }
    }
  };
  put(GOOSE_GRAZE, 0, 1, false);
  put(second, 13, 0, true);
  put(lead, 28, 1, false);
  return sprite;
}

export const GEESE = { idle: flock(GOOSE_UP, GOOSE_UP), honk: flock(GOOSE_HONK, GOOSE_UP), answer: flock(GOOSE_UP, GOOSE_HONK) };

/** California sea lions hauled out on the float: two lying flat, one propped up on its flippers. */
const SEALION_LEGEND: Legend = { B: 'sealion', D: 'sealionDark', L: 'sealionLight', E: 'eye' };
const LYING = ['.BB........', 'BEBBBBBB...', '.BBBBBBBBBB', '..LBBBBBBDD'];
const LYING_UP = ['BB.........', 'EBB........', '.BBBBBBB...', '..LBBBBBBDD'];
const SITTING = ['..BB....', '.BEB....', 'BBBB....', '..BBB...', '..LBBBB.', '..LBBBBD'];
const SITTING_BARK = ['.B......', 'B.BB....', '.BEB....', '..BB....', '..LBBBB.', '..LBBBBD'];

function haulOut(a: string[], b: string[], sit: string[]): S {
  const { sprite, set } = blank<MarinaKey>(32, 7);
  const put = (rows: string[], ox: number, oy: number) => {
    const s = fromRows(rows, SEALION_LEGEND);
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (s.px[y * s.w + x]) set(ox + x, oy + y, s.px[y * s.w + x]!);
  };
  put(sit, 12, 1);
  put(a, 0, 3);
  put(b, 21, 3);
  return sprite;
}

export const SEALIONS = {
  idle: haulOut(LYING, LYING, SITTING),
  bark: haulOut(LYING_UP, LYING, SITTING_BARK),
};

/** The fog bank rolling in over the Marin Headlands, lumpy on top and flat underneath. */
function fogBank(w: number, h: number, seed: number): S {
  const { sprite, set } = blank<MarinaKey>(w, h);
  const rng = mulberry32(seed);
  const bumps: [number, number, number][] = [];
  for (let x = 5; x < w - 4; x += 5 + rng() * 5) {
    const edge = Math.min(x, w - x) / (w / 2);
    bumps.push([x, h - 3 - edge * (h - 10) - rng(), 3 + edge * 2.5 + rng() * 1.5]);
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let inside = y >= h - 4 && x > 4 && x < w - 5;
      let lit = false;
      for (const [cx, cy, r] of bumps) {
        const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.2);
        if (d < r) {
          inside = true;
          if (y + 0.5 - cy < -r * 0.3) lit = true;
        }
      }
      if (inside) set(x, y, y >= h - 3 ? 'fogShade' : lit ? 'fogLight' : 'fog');
    }
  }
  return sprite;
}

export const FOG = fogBank(76, 16, 5);
export const FOG_POS = { x: 248, y: 77 };

/** Water lapping at the shore: frames of foam riding up and slipping back along the rocks. */
export const FOAM_POS = { x: 0, y: 128 };
const FOAM_W = 320;
const FOAM_H = 18;

function foam(phase: number): S {
  const { sprite, set } = blank<MarinaKey>(FOAM_W, FOAM_H);
  for (let x = 0; x < FOAM_W; x++) {
    const shore = shoreY(x) - FOAM_POS.y;
    const reach = 1 + Math.round(1.5 + 1.5 * Math.sin(phase + x * 0.09) + Math.sin(phase * 0.5 + x * 0.23));
    for (let j = 0; j < reach; j++) set(x, shore - 1 - j, j === reach - 1 ? 'foamShade' : 'foam');
    if (Math.sin(phase * 1.3 + x * 0.5) > 0.7) set(x, shore - reach - 2, 'foamShade');
  }
  return sprite;
}

export const FOAM = Array.from({ length: 8 }, (_, i) => foam((i / 8) * Math.PI * 2));

/** Small sailboats far out on the bay: a mainsail, a jib and a white hull. */
const SAILBOAT = fromRows(
  ['...M...', '..SM...', '.SSM...', '.SSMs..', 'SSSMss.', 'SSSMss.', '...M...', 'HHHHHHH', '.HHHHH.'],
  { S: 'sail', s: 'sailShade', M: 'rod', H: 'hull' } as Legend,
);
const SMALL_BOAT = fromRows(['..M..', '.SMs.', 'SSMs.', '..M..', 'HHHHH'], { S: 'sail', s: 'sailShade', M: 'rod', H: 'hull' } as Legend);

export const BOATS: Drifter<MarinaKey>[] = [
  { sprite: SMALL_BOAT, y: 94, x0: 60, speed: 0.35 },
  { sprite: SAILBOAT, y: 99, x0: 250, speed: 0.6 },
  { sprite: SMALL_BOAT, y: 96, x0: 170, speed: 0.45 },
];

export const WISPS: Drifter<MarinaKey>[] = [
  { sprite: wisp(36, [[0.3, 0.6], [0.12, 0.85], [0, 1], [0.15, 0.7]]), y: 40, x0: 130, speed: 1 / 8 },
  { sprite: wisp(24, [[0.35, 0.7], [0.1, 1], [0.2, 0.8]]), y: 56, x0: 250, speed: 1 / 10 },
  { sprite: wisp(48, [[0.2, 0.45], [0.05, 0.75], [0, 1], [0.1, 0.9]]), y: 66, x0: 20, speed: 1 / 9 },
  { sprite: wisp(30, [[0.4, 0.75], [0.15, 0.9], [0, 1], [0.25, 0.65]]), y: 30, x0: 300, speed: 1 / 12 },
];

/** Inventory tiles. */
export const WAVES_TILE = fromRows(
  [
    '.....FFF.....',
    '...FFwwwF....',
    '..FwwwWWwF...',
    '.FwwWW..wF...',
    '.FwW.....F...',
    'FwW..........',
    'FwW.....FFF..',
    'wwWW..FFwwwF.',
    'WwwWWWwwWWwwF',
    'WWwwwwwWWWwww',
  ],
  { F: 'foam', w: 'water1', W: 'water3' } as Legend,
);

export const FOG_TILE = fromRows(
  [
    '...FFF.......',
    '..FFFFF.FF...',
    '.FFFFFFFFFF..',
    'FFFFFFFFFFFF.',
    'ssssssssssss.',
    '.............',
    '..B.......B..',
    '..B.......B..',
    '.BBB.....BBB.',
    'WWWWWWWWWWWWW',
  ],
  { F: 'fogLight', s: 'fogShade', B: 'bridge', W: 'water2' } as Legend,
);

export const SEALION_TILE = fromRows(['..BB.......', '.BEB.......', 'BBBB.......', '..BBB......', '..LBBBBB...', '..LBBBBBBDD'], SEALION_LEGEND);
export const GOOSE_TILE = fromRows(GOOSE_UP, GOOSE_LEGEND);
