import type { Palette, PaletteKey } from './palette';
import { mulberry32 } from './pixels';

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

export function flipX(s: Sprite): Sprite {
  const px = s.px.slice();
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) px[y * s.w + x] = s.px[y * s.w + (s.w - 1 - x)];
  }
  return { ...s, px };
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

function blank(w: number, h: number) {
  const px: (PaletteKey | null)[] = new Array(w * h).fill(null);
  const set = (x: number, y: number, k: PaletteKey) => {
    if (x >= 0 && y >= 0 && x < w && y < h) px[y * w + x] = k;
  };
  return { sprite: { w, h, px } as Sprite, set };
}

/** A puffy rain cloud: round bumps on a flat slab, lit from the top left. */
function rainCloud(w: number, h: number, seed: number): Sprite {
  const { sprite, set } = blank(w, h);
  const rng = mulberry32(seed);
  const n = Math.max(3, Math.round(w / 13));
  const bumps: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const centre = 1 - Math.abs((i + 0.5) / n - 0.5) * 2;
    const r = 4 + centre * (h * 0.42 - 4) + rng() * 2;
    bumps.push([5 + (i + 0.5) * ((w - 10) / n), h - 5 - r * 0.55, r]);
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let inside = false;
      let lit = false;
      for (const [cx, cy, r] of bumps) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy > r * r) continue;
        inside = true;
        if (dy < -r * 0.3 && dx < r * 0.35) lit = true;
      }
      const slabInset = y >= h - 2 ? 5 : 3;
      if (y >= h - 6 && x >= slabInset && x < w - slabInset) inside = true;
      if (!inside) continue;
      let key: PaletteKey = lit ? 'cloudLight' : 'cloudMid';
      if (y >= h - 5) key = 'cloudShade';
      if (y >= h - 2) key = 'cloudDark';
      set(x, y, key);
    }
  }
  return sprite;
}

/** A front of rain clouds spread across the sky so the rain covers the Glade. */
export const RAIN_CLOUDS: { sprite: Sprite; x: number; y: number }[] = (
  [
    [56, 16, -6, 40],
    [60, 18, 48, 24],
    [66, 20, 108, 8],
    [60, 18, 172, 22],
    [58, 16, 232, 32],
    [48, 16, 286, 44],
  ] as const
).map(([w, h, x, y], i) => ({ sprite: rainCloud(w, h, i + 1), x, y }));

/** A thin sunset cloud streak. */
function wisp(w: number): Sprite {
  const { sprite, set } = blank(w, 3);
  for (let x = 0; x < w; x++) {
    if (x >= Math.round(w * 0.25) && x < Math.round(w * 0.7)) set(x, 0, 'wispLight');
    set(x, 1, x < 2 || x >= w - 2 ? 'wispShade' : 'wispMid');
    if (x >= Math.round(w * 0.1) && x < Math.round(w * 0.85)) set(x, 2, 'wispShade');
  }
  return sprite;
}

export const WISPS: { sprite: Sprite; y: number; x0: number; speed: number }[] = [
  { sprite: wisp(30), y: 50, x0: 30, speed: 1 / 8 },
  { sprite: wisp(22), y: 64, x0: 210, speed: 1 / 10 },
  { sprite: wisp(40), y: 80, x0: 110, speed: 1 / 9 },
  { sprite: wisp(26), y: 96, x0: 270, speed: 1 / 12 },
];

/**
 * Sather Tower, front face: gold finial and lantern, pyramidal copper spire,
 * belfry with three arched openings, clock stage and a long granite shaft.
 */
function campanile(): Sprite {
  const w = 16;
  const h = 80;
  const { sprite, set } = blank(w, h);
  const wall = (x: number): PaletteKey => (x >= 12 ? (x === 15 ? 'campDark' : 'campShadow') : x === 0 ? 'campMid' : 'campLight');

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
      let key: PaletteKey = x < 8 ? 'copper' : 'copperDark';
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

const BIRD_LEGEND: Record<string, PaletteKey> = {
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
