import type { Palette, PaletteKey } from './palette';

export const W = 320;
export const H = 180;

/** Small deterministic PRNG so the backdrop is identical on every load. */
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

type Ctx = CanvasRenderingContext2D;

function rect(ctx: Ctx, pal: Palette, key: PaletteKey, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = pal[key];
  ctx.fillRect(x, y, w, h);
}

function disc(ctx: Ctx, cx: number, cy: number, r: number, color: (dx: number, dy: number) => string | null) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy > r * r) continue;
      const c = color(dx, dy);
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

export const SUN = { x: 272, y: 24, r: 7 };

const starRng = mulberry32(7);
export const STARS: { x: number; y: number }[] = Array.from({ length: 46 }, () => ({
  x: Math.floor(starRng() * W),
  y: Math.floor(starRng() * 74),
}));

/** Sky, sun or moon, stars and the distant tree line: everything behind the Campanile. */
export function drawFar(ctx: Ctx, pal: Palette, night: boolean) {
  rect(ctx, pal, 'sky1', 0, 0, W, 34);
  rect(ctx, pal, 'sky2', 0, 34, W, 30);
  rect(ctx, pal, 'sky3', 0, 64, W, 60);
  for (let x = 0; x < W; x += 2) {
    rect(ctx, pal, 'sky1', x, 34, 1, 1);
    rect(ctx, pal, 'sky2', x + 1, 64, 1, 1);
  }

  if (night) {
    for (const s of STARS) rect(ctx, pal, 'star', s.x, s.y, 1, 1);
    disc(ctx, SUN.x, SUN.y, SUN.r - 1, (dx, dy) =>
      (dx + 3) ** 2 + (dy + 2) ** 2 < 30 ? null : pal.sun,
    );
  } else {
    disc(ctx, SUN.x, SUN.y, SUN.r, () => pal.sun);
  }

  const rng = mulberry32(11);
  for (let cx = -6; cx < W + 12; cx += 9 + Math.floor(rng() * 8)) {
    const r = 7 + rng() * 6;
    const cy = 92 + rng() * 4;
    disc(ctx, cx, cy, r, (dx, dy) => (dx + dy < -r * 0.7 ? pal.hillLight : pal.hill));
  }
  rect(ctx, pal, 'hill', 0, 92, W, 24);
}

function tree(ctx: Ctx, pal: Palette, cx: number, cy: number, r: number) {
  disc(ctx, cx, cy, r, (dx, dy) => {
    if (dx + dy > r * 0.55) return pal.treeDark;
    if (dx + dy < -r * 0.75) return pal.treeLight;
    return pal.treeMid;
  });
}

export const DOE = { left: 60, right: 296, roof: 74, base: 112 };
export const LAMP = { x: 236, capY: 95 };

/** Doe, foliage, the lamp and the lawn: everything in front of the Campanile. */
export function drawNear(ctx: Ctx, pal: Palette) {
  const { left, right } = DOE;

  // Low roof and raised central pavilion.
  rect(ctx, pal, 'roof', left + 4, 74, right - left - 8, 4);
  rect(ctx, pal, 'roof', 156, 70, 44, 4);
  rect(ctx, pal, 'doeLight', 154, 74, 48, 4);

  // Cornice, attic band and wall.
  rect(ctx, pal, 'doeLight', left, 78, right - left, 2);
  rect(ctx, pal, 'doeShadow', left, 80, right - left, 1);
  rect(ctx, pal, 'doeMid', left, 81, right - left, 3);
  rect(ctx, pal, 'doeLight', left, 84, right - left, 21);

  // Tall repeated windows along the long facade.
  const window = (x: number, w: number) => {
    rect(ctx, pal, 'window', x + 1, 87, w - 2, 1);
    rect(ctx, pal, 'window', x, 88, w, 16);
    rect(ctx, pal, 'doeMid', x + w, 87, 1, 17);
    rect(ctx, pal, 'doeMid', x - 1, 104, w + 2, 1);
  };
  for (let x = 76; x + 4 <= 150; x += 9) window(x, 4);
  for (let x = 206; x + 4 <= 282; x += 9) window(x, 4);

  // Central pavilion with three wide arched openings.
  rect(ctx, pal, 'doeShadow', 154, 78, 1, 27);
  rect(ctx, pal, 'doeShadow', 201, 78, 1, 27);
  for (const x of [161, 175, 189]) {
    rect(ctx, pal, 'window', x + 1, 86, 4, 1);
    rect(ctx, pal, 'window', x, 87, 6, 18);
    rect(ctx, pal, 'doeMid', x + 6, 86, 1, 19);
  }

  // End pavilions.
  for (const x of [left, right - 12]) {
    rect(ctx, pal, 'doeMid', x, 84, 12, 21);
    window(x + 4, 4);
  }
  rect(ctx, pal, 'doeShadow', left + 12, 81, 1, 24);
  rect(ctx, pal, 'doeShadow', right - 13, 81, 1, 24);

  // Plinth and steps.
  rect(ctx, pal, 'doeMid', left, 105, right - left, 1);
  rect(ctx, pal, 'doeShadow', left, 106, right - left, 6);
  for (let i = 0; i < 3; i++) {
    rect(ctx, pal, 'path', 158 - i * 2, 106 + i * 2, 40 + i * 4, 1);
    rect(ctx, pal, 'doeMid', 158 - i * 2, 107 + i * 2, 40 + i * 4, 1);
  }

  // Low shrubs along the base.
  for (const x of [98, 136, 220, 258]) {
    disc(ctx, x, 111, 6, (dx, dy) => (dy > 1 ? null : dx + dy > 2 ? pal.treeDark : pal.treeMid));
  }

  // Walk and lawn.
  rect(ctx, pal, 'path', 0, 112, W, 5);
  rect(ctx, pal, 'lawnDark', 0, 117, W, 1);
  rect(ctx, pal, 'lawn2', 0, 118, W, 4);
  rect(ctx, pal, 'lawn1', 0, 122, W, H - 122);
  const rng = mulberry32(3);
  for (let ty = 122; ty < H; ty += 16) {
    for (let tx = 0; tx < W; tx += 16) {
      if (rng() < 0.45) continue;
      const x = tx + 2 + Math.floor(rng() * 11);
      const y = ty + 2 + Math.floor(rng() * 11);
      rect(ctx, pal, 'lawnDark', x, y, 1, 1);
      rect(ctx, pal, 'lawnDark', x + 2, y, 1, 1);
      rect(ctx, pal, 'lawnDark', x + 1, y + 1, 1, 1);
    }
  }

  // Trees framing the Glade.
  rect(ctx, pal, 'trunk', 21, 100, 4, 20);
  tree(ctx, pal, 4, 98, 13);
  tree(ctx, pal, 16, 80, 16);
  tree(ctx, pal, 36, 92, 12);
  tree(ctx, pal, 48, 103, 8);
  rect(ctx, pal, 'trunk', 302, 100, 4, 20);
  tree(ctx, pal, 292, 98, 9);
  tree(ctx, pal, 308, 84, 14);
  tree(ctx, pal, 318, 101, 10);

  // Lamp post: the bird's perch.
  const { x, capY } = LAMP;
  rect(ctx, pal, 'lampPost', x - 3, capY, 8, 2);
  rect(ctx, pal, 'lampGlass', x - 2, capY + 2, 6, 4);
  rect(ctx, pal, 'lampPost', x - 2, capY + 6, 6, 1);
  rect(ctx, pal, 'lampPost', x, capY + 7, 2, 48);
  rect(ctx, pal, 'lampPost', x - 2, capY + 54, 6, 2);
}
