import type { Palette, PaletteKey } from './palette';

/** A pixel sprite: palette keys per pixel, `null` for transparent. */
export interface Sprite {
  w: number;
  h: number;
  px: (PaletteKey | null)[];
}

export function fromRows(rows: string[], legend: Record<string, PaletteKey>): Sprite {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const px: (PaletteKey | null)[] = new Array(w * h).fill(null);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const key = legend[row[x]];
      if (key) px[y * w + x] = key;
    }
  });
  return { w, h, px };
}

export function opaque(s: Sprite, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= s.w || y >= s.h) return false;
  return s.px[y * s.w + x] !== null;
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  s: Sprite,
  ox: number,
  oy: number,
  pal: Palette,
) {
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      const key = s.px[y * s.w + x];
      if (!key) continue;
      ctx.fillStyle = pal[key];
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  }
}

type Circle = [cx: number, cy: number, r: number];

/** Builds a puffy cloud from overlapping circles, shaded top-to-bottom. */
function cloudSprite(w: number, h: number, circles: Circle[], flatBottom: number): Sprite {
  const inside = (x: number, y: number) =>
    y <= flatBottom &&
    circles.some(([cx, cy, r]) => (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r);
  const px: (PaletteKey | null)[] = new Array(w * h).fill(null);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      let key: PaletteKey = 'cloudLight';
      if (y >= flatBottom) key = 'cloudDark';
      else if (y >= flatBottom - 3) key = 'cloudMid';
      else if (!inside(x + 1, y + 1) && y > 3) key = 'cloudMid';
      px[y * w + x] = key;
    }
  }
  return { w, h, px };
}

export const RAIN_CLOUD = cloudSprite(
  44,
  17,
  [
    [9, 11, 6],
    [17, 8, 7.5],
    [27, 6, 6.5],
    [35, 10, 6],
    [23, 12, 5],
    [5, 13, 3.5],
    [40, 13, 3.5],
  ],
  15,
);

const CAMP_LEGEND: Record<string, PaletteKey> = {
  L: 'campLight',
  M: 'campMid',
  S: 'campShadow',
  D: 'campArch',
  C: 'campClock',
};

export const CAMPANILE = fromRows(
  [
    '......LM......',
    '......LM......',
    '.....LLMM.....',
    '.....LDDM.....',
    '.....LLMM.....',
    '.....LLMM.....',
    '....LLLMMM....',
    '....LLLMMM....',
    '...LLLLMMMM...',
    '...LLLLMMMM...',
    '..LLLLLMMMMM..',
    '..LLLLLMMMMM..',
    '.LLLLLLMMMMMM.',
    'LLLLLLLMMMMMMM',
    'SSSSSSSSSSSSSS',
    '.LLLLLLMMMMMM.',
    '.LLDDLLMMDDMM.',
    '.LLDDLLMMDDMM.',
    '.LLDDLLMMDDMM.',
    '.LLDDLLMMDDMM.',
    '.LLDDLLMMDDMM.',
    '.LLDDLLMMDDMM.',
    '.LLLLLLMMMMMM.',
    'SSSSSSSSSSSSSS',
    'LLLLLLLMMMMMMM',
    '.SSSSSSSSSSSS.',
    '.LLLLLLMMMMMM.',
    '.LLLCCLMMMMMM.',
    '.LLLCCLMMMMMM.',
    '.LLLLLLMMMMMM.',
    '.LLLLLLMMMMMM.',
    '.LLLSLLMMSMMM.',
    '.LLLSLLMMSMMM.',
    '.LLLSLLMMSMMM.',
    '.LLLSLLMMSMMM.',
    '.LLLSLLMMSMMM.',
    '.LLLSLLMMSMMM.',
    '.LLLSLLMMSMMM.',
    '.LLLSLLMMSMMM.',
    '.LLLSLLMMSMMM.',
    '.LLLSLLMMSMMM.',
    '.LLLSLLMMSMMM.',
    '.LLLSLLMMSMMM.',
    '.LLLSLLMMSMMM.',
    '.LLLSLLMMSMMM.',
    '.LLLSLLMMSMMM.',
    '.LLLSLLMMSMMM.',
    '.LLLSLLMMSMMM.',
    '.LLLSLLMMSMMM.',
    '.LLLSLLMMSMMM.',
    '.LLLSLLMMSMMM.',
    '.LLLSLLMMSMMM.',
    '.LLLLLLMMMMMM.',
    '.LLLLLLMMMMMM.',
    '.LLLLLLMMMMMM.',
    '.LLLLLLMMMMMM.',
    '.LLLLLLMMMMMM.',
    '.LLLLLLMMMMMM.',
    '.LLLLLLMMMMMM.',
    '.LLLLLLMMMMMM.',
    '.LLLLLLMMMMMM.',
    '.LLLLLLMMMMMM.',
  ],
  CAMP_LEGEND,
);

const BIRD_LEGEND: Record<string, PaletteKey> = {
  B: 'birdBody',
  D: 'birdDark',
  W: 'birdBelly',
  K: 'beak',
  E: 'eye',
};

/** A small scrub jay, facing left. Feet sit on the bottom row. */
export const BIRD_IDLE = fromRows(
  [
    '...BBB......',
    '..BBBBB.....',
    '.KBEBBB.....',
    '..BBBBDB....',
    '..WWBBDDB...',
    '..WWWBBDDBB.',
    '...WWWBDDDBB',
    '....WWBB..DD',
    '.....K.K....',
  ],
  BIRD_LEGEND,
);

export const BIRD_SING = fromRows(
  [
    '...BBB......',
    '..BBBBB.....',
    'KKBEBBB.....',
    '.KBBBBDB....',
    '..WWBBDDB...',
    '..WWWBBDDBB.',
    '...WWWBDDDBB',
    '....WWBB..DD',
    '.....K.K....',
  ],
  BIRD_LEGEND,
);

/** Small flat clouds that drift slowly across the sky as decoration. */
export const SKY_CLOUDS: Sprite[] = [
  fromRows(['....xxxxx.......', '..xxxxxxxxxx....', 'xxxxxxxxxxxxxxxx'], { x: 'skyCloud' }),
  fromRows(['.....xxxx...', 'xxxxxxxxxxxx'], { x: 'skyCloud' }),
  fromRows(['...xxxxxx..........', '.xxxxxxxxxxxxx.....', 'xxxxxxxxxxxxxxxxxxx'], {
    x: 'skyCloud',
  }),
];
