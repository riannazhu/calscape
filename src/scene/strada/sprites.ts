import { blank, cricket, flipX, fromRows, rainCloud, wisp, type Drifter, type Sprite } from '../sprites';
import type { StradaKey } from './palette';

type S = Sprite<StradaKey>;
type Legend = Record<string, StradaKey>;

/** Stamps sprites at offsets into one new sprite of the given size. */
function compose(w: number, h: number, parts: [S, number, number][]): S {
  const { sprite, set } = blank<StradaKey>(w, h);
  for (const [s, ox, oy] of parts) {
    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        const k = s.px[y * s.w + x];
        if (k) set(ox + x, oy + y, k);
      }
    }
  }
  return sprite;
}

export interface Look {
  hair: StradaKey;
  skin: StradaKey;
  skinShade: StradaKey;
  top: StradaKey;
  topShade: StradaKey;
}

/**
 * Rows use H hair, h hair shine, S skin, s skin shade, E eye, T top, t top
 * shade, P trousers, p trouser shade, D shoe, C cup.
 */
function figure(rows: string[], look: Look, facingLeft = false): S {
  const s = fromRows(rows, {
    H: look.hair,
    h: 'hairShine',
    S: look.skin,
    s: look.skinShade,
    E: 'eye',
    T: look.top,
    t: look.topShade,
    P: 'pants',
    p: 'pantsDark',
    D: 'shoe',
    C: 'cup',
  });
  return facingLeft ? flipX(s) : s;
}

export const LOOKS = {
  red: { hair: 'hairDark', skin: 'skin3', skinShade: 'skin4', top: 'shirtRed', topShade: 'shirtRedDark' },
  blue: { hair: 'hairGold', skin: 'skin1', skinShade: 'skin2', top: 'shirtBlue', topShade: 'shirtBlueDark' },
  yellow: { hair: 'hairBrown', skin: 'skin2', skinShade: 'skin3', top: 'shirtYellow', topShade: 'shirtYellowDark' },
  green: { hair: 'hairBrown', skin: 'skin1', skinShade: 'skin2', top: 'shirtGreen', topShade: 'shirtGreenDark' },
  white: { hair: 'hairDark', skin: 'skin2', skinShade: 'skin3', top: 'shirtWhite', topShade: 'shirtWhiteDark' },
  navy: { hair: 'hairDark', skin: 'skin2', skinShade: 'skin3', top: 'shirtNavy', topShade: 'shirtNavyDark' },
} satisfies Record<string, Look>;

export const CUP = fromRows(['CCC.', 'CCCC', 'CCC.'], { C: 'cup' } as Legend);

/** A seated patron at a far table, facing right; hands at row 8, seat at row 10. */
const SMALL = [
  '..HHH....',
  '.HHHSS...',
  '.HHSES...',
  '.HHSSS...',
  '..HSs....',
  '..TTTT...',
  '.TTTTTT..',
  '.tTTTTT..',
  '.tTTTTTSS',
  '.tTTTT...',
  '.PPPPPPP.',
  '......P..',
  '......P..',
  '.....DD..',
];

export const smallPatron = (look: Look, facingLeft = false) => figure(SMALL, look, facingLeft);

/** Writes `text` into a copy of `rows`, starting at the given row and column. */
const paint = (rows: string[], edits: [row: number, col: number, text: string][]) =>
  rows.map((r, i) => edits.filter(([row]) => row === i).reduce((s, [, col, t]) => s.slice(0, col) + t + s.slice(col + t.length), r));

/**
 * Someone at a near table facing right, with long hair down the back:
 * forearms out to the tabletop at row 20, seated at row 26.
 */
const LONG = [
  '......HHHHH.........',
  '....HHHHHHHHH.......',
  '...HHHHHHHHHHH......',
  '...HHHhHHHHSSH......',
  '..HHHHhHHHSSSS......',
  '..HHHhHHHHSSSSS.....',
  '..HHHhHHHSSSESS.....',
  '..HHHHHHHSSSSSS.....',
  '..HHHHHHHSSSSSs.....',
  '..HHHhHHHHSSSs......',
  '..HHHHHHHHsSS.......',
  '..HHHHHHHHHSs.......',
  '..HHHHHHHHTTT.......',
  '..HHHHHHHTTTTT......',
  '..HHHHHHTTTTTTT.....',
  '..HHHHHTTTTTTTT.....',
  '...HHtTTTTTTTTT.....',
  '...tttTTTTTTTTT.....',
  '...ttTTTTTTtTTT.....',
  '...ttTTTTTTtTTTTT...',
  '...ttTTTTTTTtTTTTSS.',
  '...ttTTTTTTTT.......',
  '...ttTTTTTTTT.......',
  '...PPPPPPPPPPPPPP...',
  '...pPPPPPPPPPPPPPP..',
  '...ppPPPPPPPPPPPPP..',
  '..............PPPp..',
  '..............PPPp..',
  '..............PPPp..',
  '..............PPPp..',
  '..............PPPp..',
  '.............DDDDDD.',
];
const SEAT = 26;

/** The same with short hair and a bare neck. */
const SHORT = [
  '.....HHHHHH.........',
  '....HHHHHHHHH.......',
  '...HHHHHHHHHHH......',
  '...HHHhHHHHHSH......',
  '...HHHhHHHSSSS......',
  '...HHHHHHSSSSSS.....',
  '...HHHHHSSSESSS.....',
  '...HHHHSSSSSSSS.....',
  '....HHHSSSSSSSs.....',
  '.....HSSSSSSSs......',
  '......sSSSSSs.......',
  '.......SSSSs........',
  '........SSs.........',
  '......TTTTTTT.......',
  '.....TTTTTTTTT......',
  '....tTTTTTTTTT......',
  ...LONG.slice(16),
].map((r, i) => (i === 16 ? '...ttTTTTTTTTTT.....' : r));

/** Mid-sentence: the near hand lifts off the table. */
const SHORT_TALK = paint(SHORT, [
  [15, 14, 'SS'],
  [16, 14, 'TS'],
  [17, 14, 'T.'],
  [19, 15, '..'],
  [20, 16, '...'],
]);

/** Lifting a cup to sip: the near arm folds up to the face. */
const LONG_SIP = paint(LONG, [
  [8, 15, 'CCC'],
  [9, 14, 'SCCCC'],
  [10, 13, 'SSCCC'],
  [11, 13, 'SS'],
  [12, 13, 'S'],
  [19, 15, '..'],
  [20, 16, '...'],
]);

/** Facing out from behind the table: head, shoulders and hands on the tabletop at row 20. */
const FACING = [
  '.......HHHHHH.......',
  '.....HHHHHHHHHH.....',
  '....HHHHHHHHHHHH....',
  '....HHHhHHHHHHHH....',
  '....HHSSSSSSSSHH....',
  '....HSSSSSSSSSSH....',
  '....HSSESSSSESSH....',
  '....HSSSSSSSSSSH....',
  '.....SSSSssSSSS.....',
  '.....SSSSSSSSSS.....',
  '......SSSSSSSS......',
  '.......sSSSSs.......',
  '........SSSS........',
  '.....TTTTTTTTTT.....',
  '...TTTTTTTTTTTTTT...',
  '..TTTTTTTTTTTTTTTT..',
  '..TTtTTTTTTTTTTtTT..',
  '..TTtTTTTTTTTTTtTT..',
  '..TTtTTTTTTTTTTtTT..',
  '..TTtTTTTTTTTTTtTT..',
  '..SSSTTTTTTTTTTSSS..',
];
const FACING_NOD = ['.', ...FACING.slice(0, 11), ...FACING.slice(12)];

export const friend = (look: Look, facingLeft = false) => figure(SHORT, look, facingLeft);
export const friendLongHair = (look: Look, facingLeft = false) => figure(LONG, look, facingLeft);
/** Row at which a seated friend's forearms rest on the tabletop. */
export const HANDS = 20;

/** The centre table where three friends talk over coffee; the table and chairs are scenery. */
export const CHATTER_TABLE = { cx: 128, rx: 20, floor: 150 };
export const CHATTER_POS = { x: CHATTER_TABLE.cx - 36, y: CHATTER_TABLE.floor - LONG.length };
export const CHATTER_SEAT = SEAT;
const CUP_Y = HANDS - 2;

function chatter(a: string[], b: string[], c: string[], bCup: boolean): S {
  const parts: [S, number, number][] = [
    [figure(c, LOOKS.yellow), 26, 0],
    [figure(a, LOOKS.red), 0, 0],
    [figure(b, LOOKS.blue, true), 55, 0],
    [CUP, 21, CUP_Y],
  ];
  if (bCup) parts.push([CUP, 48, CUP_Y]);
  return compose(75, LONG.length, parts);
}

export const CHATTER = {
  idle: chatter(SHORT, LONG, FACING, true),
  talk: chatter(SHORT_TALK, LONG, FACING, true),
  sip: chatter(SHORT, LONG_SIP, FACING, false),
  nod: chatter(SHORT, LONG, FACING_NOD, true),
};

/** A student on a laptop at the front table: long dark hair and a navy hoodie. The second frame moves the hands. */
const STUDENT_TYPING = paint(LONG, [
  [19, 17, 'S'],
  [20, 17, '.SS'],
]);

/** An open laptop side on, its screen turned toward the student on the left. */
const LAPTOP_SIDE = fromRows(
  ['............LL', '...........MLL', '...........ML.', '..........ML..', '..........ML..', '.........ML...', '.........ML...', 'LLLLLLLLLLL...'],
  { L: 'laptop', M: 'screen' } as Legend,
);

export const TYPING_TABLE = { cx: 30, rx: 13, floor: 160 };
export const TYPING_POS = { x: 6, y: TYPING_TABLE.floor - LONG.length };
export const TYPING_SEAT = SEAT;

const typing = (rows: string[]) =>
  compose(34, LONG.length, [
    [LAPTOP_SIDE, 14, 13],
    [figure(rows, LOOKS.navy), 0, 0],
    [CUP, 29, 18],
  ]);

export const TYPING = [typing(LONG), typing(STUDENT_TYPING)];

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
