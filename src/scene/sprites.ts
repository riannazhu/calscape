import type { Palette } from './palette';
import { mulberry32 } from './pixels';

/** A pixel sprite: colour names per pixel, `null` for transparent. */
export interface Sprite<K extends string = string> {
  w: number;
  h: number;
  px: (K | null)[];
}

export function fromRows<K extends string>(rows: string[], legend: Record<string, K>): Sprite<K> {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const px: (K | null)[] = new Array(w * h).fill(null);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const key = legend[row[x]];
      if (key) px[y * w + x] = key;
    }
  });
  return { w, h, px };
}

export function flipX<K extends string>(s: Sprite<K>): Sprite<K> {
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

export function drawSprite<K extends string>(
  ctx: CanvasRenderingContext2D,
  s: Sprite<K>,
  ox: number,
  oy: number,
  pal: Palette<K>,
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

export function blank<K extends string>(w: number, h: number) {
  const px: (K | null)[] = new Array(w * h).fill(null);
  const set = (x: number, y: number, k: K) => {
    if (x >= 0 && y >= 0 && x < w && y < h) px[y * w + x] = k;
  };
  return { sprite: { w, h, px } as Sprite<K>, set };
}

type CloudKey = 'cloudLight' | 'cloudMid' | 'cloudShade' | 'cloudDark';

/** A puffy rain cloud: round bumps on a flat slab, lit from the top left. */
export function rainCloud(w: number, h: number, seed: number): Sprite<CloudKey> {
  const { sprite, set } = blank<CloudKey>(w, h);
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
      let key: CloudKey = lit ? 'cloudLight' : 'cloudMid';
      if (y >= h - 5) key = 'cloudShade';
      if (y >= h - 2) key = 'cloudDark';
      set(x, y, key);
    }
  }
  return sprite;
}

type WispKey = 'wispTop' | 'wispMid' | 'wispBase';

/** A flat cloud streak: pale top, soft body and an underside lit from below. */
export function wisp(w: number, rows: [number, number][]): Sprite<WispKey> {
  const keys: WispKey[] = ['wispTop', 'wispMid', 'wispMid', 'wispBase'];
  const { sprite, set } = blank<WispKey>(w, rows.length);
  rows.forEach(([a, b], y) => {
    for (let x = Math.round(a * w); x < Math.round(b * w); x++) set(x, y, keys[Math.min(y, 3)]);
  });
  return sprite;
}

export interface Drifter<K extends string> {
  sprite: Sprite<K>;
  y: number;
  x0: number;
  /** Pixels per second. */
  speed: number;
}

/** Draws clouds that drift right and wrap around the scene's width. */
export function drawDrifters<K extends string>(
  ctx: CanvasRenderingContext2D,
  list: Drifter<K>[],
  t: number,
  pal: Palette<K>,
  width: number,
  pace = 1,
) {
  for (const w of list) {
    const span = width + w.sprite.w + 40;
    const x = Math.floor(((w.x0 + t * w.speed * pace) % span) - w.sprite.w);
    drawSprite(ctx, w.sprite, x, w.y, pal);
  }
}

/** A tiny field cricket facing left; the second frame lifts its wings to chirp. */
export function cricket<K extends string>(legend: { eye: K; body: K; wing: K; leg: K }): Sprite<K>[] {
  const keys = { E: legend.eye, B: legend.body, W: legend.wing, K: legend.leg };
  return [fromRows(['E.....', '.EBWKK', 'E.E.E.'], keys), fromRows(['E..W..', '.EWBKK', 'E.E.E.'], keys)];
}
