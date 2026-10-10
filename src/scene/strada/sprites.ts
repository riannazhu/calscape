import { cricket, fromRows, rainCloud, wisp, type Drifter, type Sprite } from '../sprites';
import type { StradaKey } from './palette';
import { LOOKS, cup, facing, laptop, seated, sprite, type Pose } from './people';

type S = Sprite<StradaKey>;
type Legend = Record<string, StradaKey>;

/** The one table whose friends talk over coffee: the chatter element. They sit behind the front-right railing. */
export const CHATTER_TABLE = { cx: 258, rx: 15, top: 121, floor: 150 };
export const CHATTER_POS = { x: 222, y: 92 };
/** The two friends side on: their backs, heights and which way they face. */
export const CHATTER_SEATS = [
  { x: 230, h: 48, dir: 1 as const },
  { x: 288, h: 50, dir: -1 as const },
];

function chatter(pose: { a?: Pose; b?: Pose; c?: Pose }): S {
  const t = CHATTER_TABLE;
  const [a, b] = CHATTER_SEATS;
  return sprite(CHATTER_POS.x, CHATTER_POS.y, 76, 60, (br) => {
    facing(br, t.cx, t.top, 46, LOOKS.yellow, pose.c);
    cup(br, 249, t.top);
    if (pose.b !== 'sip') cup(br, 267, t.top);
    seated(br, a.x, t.floor, a.h, LOOKS.blue, a.dir, pose.a, t.top);
    seated(br, b.x, t.floor, b.h, LOOKS.grey, b.dir, pose.b, t.top);
  });
}

export const CHATTER = {
  idle: chatter({}),
  talk: chatter({ a: 'talk' }),
  sip: chatter({ b: 'sip' }),
  nod: chatter({ c: 'nod', a: 'talk' }),
};

/**
 * People working on laptops: the typing element. Each has a table in front
 * of them; `frames` alternate the hands between keys.
 */
export const TYPISTS = [
  { x: 66, floor: 156, h: 54, dir: -1 as const, look: LOOKS.navy, table: { cx: 40, rx: 16, top: 126 }, laptop: 53, cupX: 29, box: [22, 96, 52, 62] },
  { x: 134, floor: 152, h: 50, dir: 1 as const, look: LOOKS.hoodie, table: { cx: 166, rx: 14, top: 125 }, laptop: 150, cupX: 174, box: [126, 96, 56, 58] },
].map((t) => {
  const [x0, y0, w, h] = t.box;
  const frame = (pose: Pose) =>
    sprite(x0, y0, w, h, (b) => {
      laptop(b, t.laptop, t.table.top, t.dir, t.h / 50);
      cup(b, t.cupX, t.table.top, t.h / 50);
      seated(b, t.x, t.floor, t.h, t.look, t.dir, pose, t.table.top);
    });
  return { ...t, pos: { x: x0, y: y0 }, frames: [frame('type'), frame('type2')] };
});

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

/** Rain clouds gathering in the open sky between the trees. */
export const RAIN_CLOUDS: { sprite: S; x: number; y: number }[] = (
  [
    [50, 16, 98, 26],
    [60, 18, 148, 16],
    [48, 14, 200, 32],
  ] as const
).map(([w, h, x, y], i) => ({ sprite: rainCloud(w, h, i + 11), x, y }));

export const WISPS: Drifter<StradaKey>[] = [
  { sprite: wisp(30, [[0.3, 0.6], [0.1, 0.9], [0, 1], [0.2, 0.7]]), y: 34, x0: 40, speed: 1 / 9 },
  { sprite: wisp(22, [[0.3, 0.7], [0.1, 1], [0.25, 0.8]]), y: 48, x0: 200, speed: 1 / 11 },
  { sprite: wisp(40, [[0.2, 0.5], [0.05, 0.8], [0, 1], [0.1, 0.85]]), y: 26, x0: 140, speed: 1 / 10 },
];

/** Inventory tiles. */
export const CHATTER_TILE = fromRows(
  [
    '..WWWWWWW....',
    '.WWWWWWWWW...',
    '.WW.W.W.WW...',
    '.WWWWWWWWW...',
    '..WWWWWWW....',
    '...W.....YYY.',
    '...........YY',
    '...BBB...YYYY',
    '..BBBBB.YYYYY',
    '..BCCCB......',
    '..BCCCB......',
    '...CCC.......',
  ],
  { W: 'cup', B: 'woodDark', C: 'cup', Y: 'bannerGold' } as Legend,
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
