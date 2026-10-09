import type { Palette, PaletteKey } from './palette';

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/** Ordered-dither threshold in (0, 1) for a pixel. */
export const bayer = (x: number, y: number) => (BAYER4[y & 3][x & 3] + 0.5) / 16;

/** Deterministic per-pixel hash in [0, 1). */
export function hash(x: number, y: number, seed = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth value noise in [0, 1) with features roughly `cell` pixels wide. */
export function noise(x: number, y: number, cell: number, seed = 0): number {
  const gx = x / cell;
  const gy = y / cell;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = gx - x0;
  const fy = gy - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0, seed);
  const b = hash(x0 + 1, y0, seed);
  const c = hash(x0, y0 + 1, seed);
  const d = hash(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

export function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function parseHex(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  // ImageData is RGBA in memory; Uint32 view is little-endian ABGR.
  return (0xff << 24) | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff);
}

/** Writes palette colours straight into a pixel buffer, then hands back a canvas. */
export class Painter {
  readonly buf: Uint32Array;
  private image: ImageData;
  private colors = new Map<PaletteKey, number>();

  constructor(
    readonly w: number,
    readonly h: number,
    private pal: Palette,
  ) {
    this.image = new ImageData(w, h);
    this.buf = new Uint32Array(this.image.data.buffer);
  }

  private color(key: PaletteKey) {
    let c = this.colors.get(key);
    if (c === undefined) {
      c = parseHex(this.pal[key]);
      this.colors.set(key, c);
    }
    return c;
  }

  set(x: number, y: number, key: PaletteKey) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.buf[y * this.w + x] = this.color(key);
  }

  rect(x: number, y: number, w: number, h: number, key: PaletteKey) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, key);
  }

  filled(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    return this.buf[y * this.w + x] !== 0;
  }

  toCanvas(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    c.getContext('2d')!.putImageData(this.image, 0, 0);
    return c;
  }
}
