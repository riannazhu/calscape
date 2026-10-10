import { cricket, fromRows, rainCloud, wisp, type Drifter, type Sprite } from '../sprites';
import { W } from '../stage';
import { COUPLE, TYPIST as TYPIST_ART } from './art';
import { CODES } from './backdrop';
import { artKey, type StradaKey } from './palette';

type S = Sprite<StradaKey>;
type Legend = Record<string, StradaKey>;
/** A region of a person moved by a pixel: [x0, y0, x1, y1, dx, dy]. */
type Shift = [number, number, number, number, number, number];
type Patch = { box: readonly [number, number, number, number]; pixels: string };

/**
 * People from the patio picture: the pixels where they differ from the empty
 * patio, so they sit exactly where they are drawn and leave their seats
 * empty when gone. `shifts` nudge a head or hands by a pixel for a pose.
 */
function person({ box, pixels }: Patch, shifts: Shift[] = []): { sprite: S; x: number; y: number } {
  const [x0, y0, w, h] = box;
  const codes = Uint8Array.from(atob(pixels), (c) => c.charCodeAt(0));
  const own = (x: number, y: number) => {
    if (x < x0 || y < y0 || x >= x0 + w || y >= y0 + h) return null;
    const c = codes[(y - y0) * w + (x - x0)];
    return c === CODES[y * W + x] ? null : c;
  };
  const px: (StradaKey | null)[] = new Array(w * h).fill(null);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sx = x0 + x;
      let sy = y0 + y;
      for (const [ax, ay, bx, by, dx, dy] of shifts) {
        if (sx >= ax && sx < bx && sy >= ay && sy < by) {
          sx -= dx;
          sy -= dy;
          break;
        }
      }
      const c = own(sx, sy);
      if (c !== null) px[y * w + x] = artKey(c);
    }
  }
  return { sprite: { w, h, px }, x: x0, y: y0 };
}

/** The couple talking behind the front-right railing: the chatter element. */
const HER_HEAD = { still: null, bob: [250, 102, 270, 113, 0, 1], lean: [250, 102, 270, 113, 1, 0] } as const;
const HIS_HEAD = { still: null, bob: [278, 97, 296, 110, 0, 1], lean: [278, 97, 296, 110, -1, 0] } as const;
export type HeadPose = keyof typeof HER_HEAD;

/** Every pairing of her head pose with his: a talker's head bobs, a listener nods, either leans in. */
export const CHATTER = (() => {
  const poses = {} as Record<`${HeadPose}-${HeadPose}`, ReturnType<typeof person>>;
  for (const her of Object.keys(HER_HEAD) as HeadPose[]) {
    for (const him of Object.keys(HIS_HEAD) as HeadPose[]) {
      const shifts = [HER_HEAD[her], HIS_HEAD[him]].filter((s) => s !== null) as Shift[];
      poses[`${her}-${him}`] = person(COUPLE, shifts);
    }
  }
  return { idle: poses['still-still'], pose: (her: HeadPose, him: HeadPose) => poses[`${her}-${him}`] };
})();

/**
 * The man in the hoodie on his laptop at the middle table: the typing
 * element. Only his forearm and hand move: the first frame rests on the
 * keys, the others reach along them, lift and press.
 */
export const TYPIST = (() => {
  const { sprite, x: x0, y: y0 } = person(TYPIST_ART);
  const at = (x: number, y: number) => (y - y0) * sprite.w + (x - x0);
  const key = (x: number, y: number) => sprite.px[at(x, y)] as StradaKey;
  const sleeve = new Set<StradaKey | null>();
  for (let y = 112; y <= 122; y++) for (let x = 150; x <= 155; x++) sleeve.add(key(x, y));
  // Colours picked off his hoodie and face, so they survive the art being regenerated.
  const [arm, armShade, dark, skin, light] = [key(154, 119), key(154, 112), key(155, 109), key(156, 110), key(157, 108)];
  type Px = [number, number, StradaKey];
  // Clear the hands' area in front of his chest, keeping the hoodie, then draw both hands on the keys.
  const pose = (marks: Px[]): S => {
    const px = sprite.px.slice();
    for (let y = 114; y <= 121; y++) {
      for (let x = 157; x <= 167; x++) if (!sleeve.has(px[at(x, y)]) || x > 160) px[at(x, y)] = null;
    }
    for (const [x, y, k] of marks) px[at(x, y)] = k;
    return { ...sprite, px };
  };
  const forearm = (end: number): Px[] => [
    ...Array.from({ length: end - 156 }, (_, i): Px => [157 + i, 119, arm]),
    ...Array.from({ length: end - 155 }, (_, i): Px => [156 + i, 120, arm]),
    ...Array.from({ length: end - 155 }, (_, i): Px => [156 + i, 121, armShade]),
  ];
  return {
    pos: { x: x0, y: y0 },
    frames: [
      pose([...forearm(160), [161, 120, skin], [162, 120, light], [161, 121, dark], [162, 121, skin], [163, 121, skin], [164, 120, dark], [165, 120, skin], [165, 121, dark]]),
      pose([...forearm(160), [161, 120, skin], [162, 120, skin], [161, 121, dark], [162, 121, skin], [163, 121, light], [164, 119, dark], [165, 119, skin], [165, 120, dark]]),
      pose([...forearm(160), [161, 119, skin], [162, 119, light], [161, 120, dark], [162, 120, skin], [163, 120, dark], [164, 121, skin], [165, 121, skin], [165, 120, dark]]),
      pose([...forearm(161), [162, 120, skin], [163, 120, light], [162, 121, dark], [163, 121, skin], [164, 121, skin], [166, 120, skin], [166, 121, dark]]),
    ],
  };
})();

/** A house sparrow facing left: grey crown, chestnut nape, black bib, pale cheek. */
const SPARROW_LEGEND: Legend = { C: 'sparrowCap', B: 'sparrow', D: 'sparrowDark', L: 'sparrowLight', E: 'eye', K: 'beak' };

export const SPARROW = {
  idle: fromRows(['.CC....', 'KECB...', '.LDBBBB', '.LLBDBD', '..D.D..'], SPARROW_LEGEND),
  chirp: fromRows(['KCC....', '.ECB...', 'KLDBBBB', '.LLBDBD', '..D.D..'], SPARROW_LEGEND),
};

/** An American crow facing left; the second frame opens its bill and leans in to caw. */
const CROW_LEGEND: Legend = { K: 'crow', L: 'crowLight', E: 'eye', B: 'beak' };

export const CROW = {
  idle: fromRows(['.KK......', 'BEKK.....', '.KKKKK...', '..KKLKKK.', '...KKLKKK', '...KKK..K', '....K.K..'], CROW_LEGEND),
  caw: fromRows(['.........', '.KK......', 'BEKKK....', 'B.KKKKK..', '..KKLKKKK', '...KKKK.K', '....K.K..'], CROW_LEGEND),
};

export const CRICKET = cricket<StradaKey>({ eye: 'eye', body: 'bug', wing: 'bugLight', leg: 'bug' });

/** Someone cycling along the path beyond the railing, facing right, in a helmet; two pedal positions. */
const bike = (rows: string[], helmet: StradaKey, top: StradaKey, skin: StradaKey) =>
  fromRows(rows, { H: helmet, S: skin, T: top, P: 'pants', F: 'heater', K: 'tire' } as Legend);

const BIKE_TOP = ['....HH...', '....HS...', '...TTT...', '..TTTSS..', '..PPP.F..'];

export const BIKERS = [
  { helmet: 'shirtBlue', top: 'shirtGreen', skin: 'skin1' },
  { helmet: 'shirtRed', top: 'shirtWhite', skin: 'skin3' },
  { helmet: 'hairGold', top: 'shirtNavy', skin: 'skin2' },
].map(({ helmet, top, skin }) =>
  [
    [...BIKE_TOP, '.KKP.FKK.', 'K..PFK..K', 'K..FF...K', '.KK...KK.'],
    [...BIKE_TOP, '.KK.PFKK.', 'K...FP..K', 'K..FF...K', '.KK...KK.'],
  ].map((rows) => bike(rows, helmet as StradaKey, top as StradaKey, skin as StradaKey)),
);

/**
 * Rain clouds strewn unevenly across the sky: some run off the edges or sit
 * partly behind the crowns and loggia, which hide them where they overlap.
 */
export const RAIN_CLOUDS: { sprite: S; x: number; y: number }[] = (
  [
    [58, 18, -24, 42],
    [56, 18, 78, 28],
    [62, 18, 136, 9],
    [44, 14, 166, 46],
    [52, 16, 212, 24],
  ] as const
).map(([w, h, x, y], i) => ({ sprite: rainCloud(w, h, i + 11), x, y }));

/** Thin clouds drifting across the open sky between the crowns. */
export const WISPS: Drifter<StradaKey>[] = [
  { sprite: wisp(30, [[0.3, 0.6], [0.1, 0.9], [0, 1], [0.2, 0.7]]), y: 22, x0: 40, speed: 1.4 },
  { sprite: wisp(22, [[0.3, 0.7], [0.1, 1], [0.25, 0.8]]), y: 46, x0: 200, speed: 1.1 },
  { sprite: wisp(40, [[0.2, 0.5], [0.05, 0.8], [0, 1], [0.1, 0.85]]), y: 12, x0: 140, speed: 1.7 },
  { sprite: wisp(26, [[0.25, 0.75], [0, 1], [0.15, 0.85]]), y: 58, x0: 290, speed: 0.9 },
  { sprite: wisp(34, [[0.3, 0.65], [0.05, 0.95], [0.2, 0.8]]), y: 34, x0: 330, speed: 1.2 },
];

/**
 * The Cal script logo: a looping capital C, a small "a", and a tall "l" whose
 * tail drops away and sweeps back under the word, clear of the letters.
 */
const CAL_SCRIPT = [
  '..GGG.....GG',
  '.GG..g...GG.',
  'GG.......G..',
  'GG....GG.G..',
  'GG...G.G.G..',
  '.GG..G.G.G..',
  '..GG..GG.GG.',
  '..........G.',
  '.gGGGGGGGGG.',
];

/**
 * The street banner on the lamp post: Cal navy with gold stripes and the Cal
 * script, held taut between two bracket arms. Its origin is the top arm's
 * root against the post; the fabric starts two columns out.
 */
export const BANNER = (() => {
  const w = 15;
  const inset = 2;
  const row = (s = '') => {
    const l = Math.floor((w - s.length) / 2);
    return '..L' + 'N'.repeat(Math.max(0, l - 1)) + s.replace(/\./g, 'N') + 'N'.repeat(w - s.length - l);
  };
  const stripe = '..' + 'G'.repeat(w);
  const arm = 'A'.repeat(w + inset + 1);
  const rows = [arm, row(), stripe, row(), row(), ...CAL_SCRIPT.map(row), row(), row(), stripe, row(), arm];
  const sprite = fromRows(rows, {
    A: 'bannerArm',
    N: 'bannerNavy',
    L: 'bannerNavyLight',
    G: 'bannerGold',
    g: 'bannerGoldDark',
  } as Legend);
  return { sprite, x: 135, y: 71, fabric: { x0: inset, x1: inset + w, y0: 1, y1: rows.length - 1 } };
})();

/** Inventory tiles. */
export const CHATTER_TILE = fromRows(
  [
    '.WWWWWWWWWW.',
    'WWWWWWWWWWWW',
    'WWWWWWWWWWWW',
    'WWDDWDDWDDWW',
    'WWDDWDDWDDWW',
    'WWWWWWWWWWWW',
    'WWWWWWWWWWWW',
    '.WWWWWWWWWW.',
    '..WWW.......',
    '..WW........',
    '..W.........',
  ],
  { W: 'cup', D: 'woodDark' } as Legend,
);

export const TYPING_TILE = fromRows(
  [
    '..LLLLLLLLL..',
    '..LSSSSSSSL..',
    '..LSSSSSSSL..',
    '..LSSSSSSSL..',
    '..LSSSSSSSL..',
    '..LLLLLLLLL..',
    '.LLLLLLLLLLL.',
    'LKLKLKLKLKLKL',
    'LLLLLLLLLLLLL',
  ],
  { L: 'laptop', S: 'screen', K: 'heaterDark' } as Legend,
);
