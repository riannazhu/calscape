import type { Palette, TimeOfDay } from '../palette';
import { Painter, mulberry32, rgb, type RGB } from '../pixels';
import { glowAt, overcastSky } from '../sky';
import { H, W } from '../stage';
import { COLOURS, KINDS, LIGHTS, PIXELS } from './art';
import { artKey, type StradaKey } from './palette';

type Pal = Palette<StradaKey>;

/** The patio picture: one colour code per pixel. */
export const CODES = Uint8Array.from(atob(PIXELS), (c) => c.charCodeAt(0));

const SKY = 1;
/** The far buildings, hedges and plaza beyond the railing; cyclists pass over it. */
const PLAZA = 2;
const kindAt = (x: number, y: number) => KINDS[CODES[y * W + x]];

/** The campus plaza beyond the patio: cyclists' wheels land between these rows. */
export const PATH = { top: 106, bottom: 113 };
/** The bannered street lamp: its post and the top of its cap. */
export const LAMP = { x: 134, cap: 58 };
/** Top of the front-right railing. */
export const FRONT_RAIL = 130;

const leafy = (code: number) => {
  const c = COLOURS.day[code];
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  return g > b + 12 && g >= r - 8;
};

/**
 * Where the canopy meets open sky: each entry is a pixel that a gust can
 * flip to its neighbour's colour, so leaves seem to toss along the edges.
 * `leaf` entries are sky pixels a leaf can sway into; the rest are leaf
 * pixels that can open to the sky behind.
 */
export const LEAF_EDGES: { x: number; y: number; code: number; leaf: boolean }[] = [];
for (let y = 1; y < 100; y++) {
  for (let x = 1; x < W - 1; x++) {
    const here = CODES[y * W + x];
    const sky = KINDS[here] === SKY;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1]] as const) {
      const there = CODES[(y + dy) * W + x + dx];
      const otherSky = KINDS[there] === SKY;
      if (sky && !otherSky && leafy(there)) {
        LEAF_EDGES.push({ x, y, code: there, leaf: true });
        break;
      }
      if (!sky && otherSky && leafy(here) && (x * 7 + y * 3) % 3 === 0) {
        LEAF_EDGES.push({ x, y, code: there, leaf: false });
        break;
      }
    }
  }
}

const starRng = mulberry32(11);
/** Stars in the gaps of open sky between the leaves. */
export const STARS: { x: number; y: number }[] = [];
while (STARS.length < 24) {
  const x = Math.floor(starRng() * W);
  const y = 4 + Math.floor(starRng() * 60);
  if (kindAt(x, y) === SKY) STARS.push({ x, y });
}

const OVERCAST_SKY_SHOW: Record<TimeOfDay, number> = { day: 0.12, sunset: 0.35, night: 0.3 };

function paint(pal: Pal, keep: (x: number, y: number) => boolean) {
  const p = new Painter<StradaKey>(W, H, pal);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) if (keep(x, y)) p.set(x, y, artKey(CODES[y * W + x]));
  }
  return p;
}

/** The whole picture; the cyclists, clouds and wisps pass over its sky and plaza. */
export function drawFar(pal: Pal, time: TimeOfDay, overcast = false) {
  const p = paint(pal, () => true);
  if (overcast) {
    const deck = (['cloudDark', 'cloudShade', 'cloudMid'] as const).map((k) => rgb(pal[k]));
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (kindAt(x, y) !== SKY) continue;
        const clear = rgb(pal[artKey(CODES[y * W + x])]);
        p.setRGB(x, y, overcastSky(deck, clear, OVERCAST_SKY_SHOW[time], 92, x, y));
      }
    }
  } else if (time === 'night') {
    for (const s of STARS) p.set(s.x, s.y, 'star');
  }
  return p.toCanvas();
}

/** Everything in front of the sky and the far plaza: trees, loggia, people, tables and railings. */
export function drawMid(pal: Pal) {
  return paint(pal, (x, y) => kindAt(x, y) !== SKY && kindAt(x, y) !== PLAZA).toCanvas();
}

/** The canopy's leaves on their own, so a gust can push them a pixel without moving the trunks or lights. */
export const CANOPY_BOTTOM = 104;
export function drawLeaves(pal: Pal) {
  return paint(pal, (x, y) => y < CANOPY_BOTTOM && kindAt(x, y) === 0 && leafy(CODES[y * W + x])).toCanvas();
}

/** The two heaters' burners under their caps: [x, y, halo radius]. */
const BURNERS: [number, number, number][] = [
  [80, 61.5, 12],
  [183.5, 80, 7],
];

/**
 * Halos around the street lamp, string-light bulbs, lit arch and heater
 * burners after dark, in stepped rings on a see-through layer.
 */
/**
 * The typist's laptop after dark: its screen face lit, casting a cool stepped
 * glow back over his hands and face, brighter than anything around it but the lamps.
 */
export function drawLaptopGlow(pal: Pal, time: TimeOfDay): HTMLCanvasElement | null {
  if (time === 'day') return null;
  const night = time === 'night';
  const img = new ImageData(W, H);
  const screen = rgb(pal.screen);
  const put = (x: number, y: number, a: number) => {
    const i = (y * W + x) * 4;
    if (a <= 0 || a * 255 <= img.data[i + 3]) return;
    img.data.set([screen[0], screen[1], screen[2], Math.round(a * 255)], i);
  };
  const [cx, cy, r] = [163, 114, 13];
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= Math.min(168, W - 1); x++) {
      put(x, y, (night ? 0.36 : 0.18) * glowAt(Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.2) / r, 3));
    }
  }
  for (let y = 113; y <= 121; y++) put(168, y, night ? 0.9 : 0.6);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  c.getContext('2d')!.putImageData(img, 0, 0);
  return c;
}

export function drawGlow(pal: Pal, time: TimeOfDay): HTMLCanvasElement | null {
  if (time === 'day') return null;
  const img = new ImageData(W, H);
  const night = time === 'night';
  const put = (x: number, y: number, c: RGB, a: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
    const i = (y * W + x) * 4;
    if (a * 255 <= img.data[i + 3]) return;
    img.data.set([c[0], c[1], c[2], Math.round(a * 255)], i);
  };
  const halo = (cx: number, cy: number, r: number, c: RGB, a: number, steps: number) => {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        put(x, y, c, a * glowAt(Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r, steps));
      }
    }
  };
  const bulb = rgb(pal.bulbGlow);
  const lamp = rgb(pal.lampGlow);
  const boost = night ? 1 : 0.7;
  for (const [x, y, r] of LIGHTS) {
    if (r > 20) halo(x, y, r * 0.75, lamp, 0.22 * boost, 3);
    else if (r > 6) halo(x, y + 0.5, r * 1.4, lamp, 0.45 * boost, 4);
    else halo(x + 0.5, y + 0.5, r + 1.5, bulb, 0.4 * boost, 2);
  }
  const heat = rgb(pal.heaterGlow);
  for (const [x, y, r] of BURNERS) halo(x, y, r, heat, night ? 0.55 : 0.35, 3);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  c.getContext('2d')!.putImageData(img, 0, 0);
  return c;
}
