import type { Palette, PaletteKey } from './palette';
import { PEOPLE, drawBlanket, drawNet, stamp } from './people';
import { Painter, hash, mulberry32, noise } from './pixels';

export const W = 320;
export const H = 180;

export const SUN = { x: 56, y: 100 };
export const MOON = { x: 252, y: 24 };

/** The bird perches on the top-left branch with its feet on this row. */
export const PERCH = { x: 19, feetY: 45 };

/** Top row of the lawn: a gentle rise that crests in front of Doe. */
export const lawnTop = (x: number) => Math.round(131 + 12 * ((x - 175) / 175) ** 2);

const SKY: [number, PaletteKey][] = [
  [0, 'sky0'],
  [26, 'sky1'],
  [50, 'sky2'],
  [72, 'sky3'],
  [92, 'sky4'],
  [108, 'sky5'],
];

/** Flat sky bands joined by two rows of checkerboard. */
export function skyKey(x: number, y: number): PaletteKey {
  for (let i = SKY.length - 1; i >= 0; i--) {
    if (y < SKY[i][0]) continue;
    const next = SKY[i + 1];
    if (next) {
      const d = next[0] - y;
      if (d === 1 && (x + y) % 2 === 0) return next[1];
      if (d === 2 && (x + 2 * (y % 2)) % 4 === 0) return next[1];
    }
    return SKY[i][1];
  }
  return 'sky0';
}

const starRng = mulberry32(7);
export const STARS = Array.from({ length: 70 }, () => ({
  x: Math.floor(starRng() * W),
  y: Math.floor(starRng() * 96),
  big: starRng() < 0.08,
})).filter((s) => Math.hypot(s.x - MOON.x, s.y - MOON.y) > 10);

/** A chunky clump of leaves drawn in 2x2 blocks, lit from the upper left. */
function blob(p: Painter, cx: number, cy: number, r: number, seed: number, shade = 0) {
  for (let by = Math.floor((cy - r * 1.3) / 2); by <= (cy + r * 1.3) / 2; by++) {
    for (let bx = Math.floor((cx - r * 1.3) / 2); bx <= (cx + r * 1.3) / 2; bx++) {
      const x = bx * 2 + 1;
      const y = by * 2 + 1;
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy);
      const edge = r * (0.8 + 0.35 * noise(x, y, 5, seed));
      if (d > edge) continue;
      const v = ((-dx * 0.6 - dy * 0.8) / r) * 0.55 + (hash(bx, by, seed) - 0.5) * 0.3 + shade;
      let key: PaletteKey = v > 0.38 ? 'leafLight' : v > 0.02 ? 'leaf' : v > -0.32 ? 'leafMid' : 'leafDark';
      if (d / edge > 0.8 && dy > r * 0.25) key = shade < 0 ? 'leafDeep' : 'leafDark';
      p.rect(bx * 2, by * 2, 2, 2, key);
    }
  }
}

function conifer(p: Painter, cx: number, baseY: number, height: number, halfW: number) {
  for (let r = 0; r <= height; r++) {
    const y = baseY - height + r;
    const hw = Math.max(0.6, halfW * (r / height) * (0.7 + 0.3 * ((r % 6) / 6)));
    for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw) - 1; x++) {
      const rel = (x + 0.5 - cx) / hw;
      p.set(x, y, rel < -0.45 ? 'pineLight' : rel > 0.2 ? 'pineDark' : 'pine');
    }
  }
}

function branch(p: Painter, pts: [number, number][], from: number, to: number) {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  let run = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const len = Math.hypot(x1 - x0, y1 - y0);
    for (let s = 0; s <= len; s += 0.5) {
      const r = (from + (to - from) * ((run + s) / total)) / 2;
      const cx = x0 + ((x1 - x0) * s) / len;
      const cy = y0 + ((y1 - y0) * s) / len;
      for (let y = Math.floor(cy - r); y <= cy + r; y++) {
        for (let x = Math.floor(cx - r); x <= cx + r; x++) {
          if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > r) continue;
          p.set(x, y, y + 0.5 < cy ? 'trunk' : 'trunkDark');
        }
      }
    }
    run += len;
  }
}

function lit(seed: number, night: boolean) {
  return hash(seed, 3, 77) < (night ? 0.65 : 0.3);
}

/** A small window: warm when lit, dusky glass when not. */
function pane(p: Painter, x: number, y: number, w: number, h: number, on: boolean) {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const key = on ? (j >= h / 2 ? 'winLit2' : 'winLit') : j >= h / 2 ? 'winDark2' : 'winDark';
      p.set(x + i, y + j, key);
    }
  }
}

function farBuilding(p: Painter, x0: number, x1: number, roofTop: number, wallTop: number, night: boolean) {
  for (let y = roofTop; y < wallTop; y++) {
    const inset = wallTop - y - 1;
    for (let x = x0 + inset; x <= x1 - inset; x++) p.set(x, y, y === roofTop ? 'redRoof' : (y - roofTop) % 2 ? 'redRoofDark' : 'redRoof');
  }
  for (let y = wallTop; y < 130; y++) for (let x = x0; x <= x1; x++) p.set(x, y, x >= x1 - 1 ? 'creamShadow' : 'creamWall');
  for (let wy = wallTop + 3; wy + 3 < 128; wy += 6) {
    for (let wx = x0 + 3; wx + 2 < x1 - 1; wx += 5) pane(p, wx, wy, 2, 3, lit(wx * 7 + wy, night));
  }
}

/** Sky, sun or moon, stars, the distant tree line and far buildings. */
export function drawFar(pal: Palette, night: boolean) {
  const p = new Painter(W, H, pal);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) p.set(x, y, skyKey(x, y));

  if (!night) {
    for (let y = SUN.y - 16; y <= SUN.y + 16; y++) {
      for (let x = SUN.x - 16; x <= SUN.x + 16; x++) {
        const d = Math.hypot(x + 0.5 - SUN.x, y + 0.5 - SUN.y);
        if (d < 7) p.set(x, y, 'sun');
        else if (d < 11) p.set(x, y, 'sunGlow');
        else if (d < 15 && (x + y) % 2 === 0) p.set(x, y, 'sunGlow');
      }
    }
  } else {
    for (let y = MOON.y - 10; y <= MOON.y + 10; y++) {
      for (let x = MOON.x - 10; x <= MOON.x + 10; x++) {
        const d = Math.hypot(x + 0.5 - MOON.x, y + 0.5 - MOON.y);
        if (d < 5) p.set(x, y, (x === MOON.x + 1 && y === MOON.y - 1) || (x === MOON.x - 2 && y === MOON.y + 1) ? 'moonShade' : 'moon');
        else if (d < 9 && (x + y) % 2 === 0) p.set(x, y, 'sky5');
      }
    }
    for (const s of STARS) {
      p.set(s.x, s.y, 'star');
      if (s.big) {
        p.set(s.x - 1, s.y, 'sky5');
        p.set(s.x + 1, s.y, 'sky5');
        p.set(s.x, s.y - 1, 'sky5');
        p.set(s.x, s.y + 1, 'sky5');
      }
    }
  }

  // Distant tree line in chunky 2px columns.
  for (let bx = 0; bx < W / 2; bx++) {
    const x = bx * 2;
    const top = Math.round((108 + 6 * Math.abs(Math.sin(x * 0.07)) + 4 * noise(x, 0, 14, 3)) / 2) * 2;
    for (let y = top; y < H; y++) p.rect(x, y, 2, 1, y < top + 2 ? 'farTree' : y > 120 ? 'farTreeDark' : 'farTree');
  }
  farBuilding(p, 4, 40, 103, 108, night);
  farBuilding(p, 32, 74, 109, 113, night);
  return p.toCanvas();
}

// Doe's north facade, symmetric about the entrance between x = 223 and 224.
const DOE_L = 128;
const DOE_R = 319;
const PAV = 20;
const mirror = (x: number) => 447 - x;
const LEFT_COLUMNS = [148, 151, 163, 174, 186, 197, 209, 212];
/** Left pixel of each 2px engaged column: paired at the corners and the central bay. */
const COLUMNS = [...LEFT_COLUMNS, ...LEFT_COLUMNS.map((x) => mirror(x + 1))].sort((a, b) => a - b);

function doe(p: Painter, night: boolean) {
  // Red tile roof.
  for (let y = 70; y < 80; y++) {
    const inset = 79 - y;
    for (let x = DOE_L + inset; x <= DOE_R + 1 - inset; x++) {
      let key: PaletteKey = y === 70 ? 'roofLight' : (y - 70) % 3 === 0 ? 'roofDark' : 'roof';
      if (key === 'roof' && (x + (y % 2) * 2) % 4 === 0) key = 'roofDark';
      p.set(x, y, key);
    }
  }

  // Cornice, dentils, key-pattern frieze and architrave.
  for (let x = DOE_L - 1; x <= DOE_R + 1; x++) {
    p.set(x, 80, 'stoneLight');
    p.set(x, 81, x % 2 ? 'stone' : 'stoneShadow');
    p.set(x, 82, 'stoneShadow');
    p.set(x, 83, 'stone');
    p.set(x, 84, x % 6 < 3 ? 'stoneMid' : 'stone');
    p.set(x, 85, 'stone');
    p.set(x, 86, 'stoneMid');
  }

  // Main storey wall, sill band, rusticated basement and plinth.
  for (let x = DOE_L; x <= DOE_R; x++) {
    for (let y = 87; y < 117; y++) p.set(x, y, 'stone');
    p.set(x, 117, 'stoneLight');
    p.set(x, 118, 'stoneShadow');
    for (let y = 119; y < 130; y++) {
      const course = (y - 119) % 3 === 2;
      const joint = (x + (Math.floor((y - 119) / 3) % 2) * 3) % 6 === 0;
      p.set(x, y, course || joint ? 'stoneMid' : 'stone');
    }
    p.set(x, 130, 'stoneShadow');
    p.set(x, 131, 'stoneDark');
  }
  // End pavilions step forward slightly.
  for (let y = 80; y < 131; y++) {
    p.set(DOE_L + PAV - 1, y, 'stoneShadow');
    p.set(mirror(DOE_L + PAV - 1), y, 'stoneMid');
  }

  // Engaged fluted columns.
  for (const x of COLUMNS) {
    p.rect(x - 1, 87, 4, 1, 'stoneLight');
    p.rect(x, 88, 2, 1, 'stoneMid');
    for (let y = 89; y < 115; y++) {
      p.set(x, y, 'stoneLight');
      p.set(x + 1, y, y % 2 ? 'stoneMid' : 'stone');
    }
    p.rect(x - 1, 115, 4, 2, 'stoneMid');
  }
  // Carved garland panels between paired columns.
  for (let i = 1; i < COLUMNS.length; i++) {
    if (COLUMNS[i] - COLUMNS[i - 1] !== 3) continue;
    const gx = COLUMNS[i] - 1;
    for (let y = 90; y < 114; y++) p.set(gx, y, y % 4 === 0 ? 'stoneShadow' : 'stoneMid');
  }

  // Tall arched windows in each bay, with a basement window beneath.
  const arched = (x0: number, x1: number, y0: number, y1: number, on: boolean) => {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (y === y0 && (x === x0 || x === x1)) continue;
        let key: PaletteKey = on ? (y > (y0 + y1) / 2 ? 'winLit2' : 'winLit') : y > (y0 + y1) / 2 ? 'winDark2' : 'winDark';
        if (y === y0 + Math.round((y1 - y0) * 0.62)) key = 'winFrame';
        p.set(x, y, key);
      }
    }
    p.rect(x0 - 1, y1 + 1, x1 - x0 + 3, 1, 'stoneLight');
  };
  for (let i = 1; i < COLUMNS.length; i++) {
    const b0 = COLUMNS[i - 1] + 2;
    const b1 = COLUMNS[i] - 1;
    if (b1 - b0 < 5 || b0 >= 214 && b1 <= 233) continue;
    arched(b0 + 2, b1 - 2, 90, 112, lit(b0, night));
    const mid = Math.floor((b0 + b1) / 2);
    pane(p, mid - 1, 122, 3, 4, lit(b0 + 1, night));
  }
  for (const x0 of [135, mirror(140)]) {
    arched(x0, x0 + 5, 91, 112, lit(x0, night));
    pane(p, x0 + 1, 122, 4, 4, lit(x0 + 2, night));
  }

  // Central bay: window between two small columns, then the entrance portal.
  arched(220, 227, 90, 105, true);
  for (const x of [217, 229]) {
    for (let y = 90; y < 106; y++) {
      p.set(x, y, 'stoneLight');
      p.set(x + 1, y, 'stoneMid');
    }
  }
  p.rect(215, 106, 18, 1, 'stoneLight');
  p.rect(215, 107, 18, 1, 'stoneShadow');
  p.rect(216, 108, 1, 2, 'stoneMid');
  p.rect(231, 108, 1, 2, 'stoneMid');
  p.rect(218, 108, 12, 24, 'stoneLight');
  p.rect(223, 108, 2, 2, 'campBell');
  for (let y = 111; y < 132; y++) {
    for (let x = 220; x < 228; x++) {
      const grid = x % 2 === 0 || (y - 111) % 4 === 0;
      p.set(x, y, grid ? 'door' : night ? 'winLit' : 'winDark');
    }
  }
}

function leftWing(p: Painter, night: boolean) {
  const x0 = 84;
  const x1 = DOE_L - 1;
  for (let y = 92; y < 98; y++) {
    for (let x = x0 + (97 - y); x <= x1; x++) p.set(x, y, y === 92 ? 'roofLight' : (y - 92) % 2 ? 'roof' : 'roofDark');
  }
  for (let x = x0; x <= x1; x++) {
    p.set(x, 98, 'stoneLight');
    p.set(x, 99, 'stoneShadow');
    for (let y = 100; y < 130; y++) p.set(x, y, y === 118 ? 'stoneMid' : 'stone');
    p.set(x, 130, 'stoneShadow');
    p.set(x, 131, 'stoneDark');
  }
  for (let wx = 88; wx + 3 < x1; wx += 6) {
    pane(p, wx, 103, 3, 6, lit(wx, night));
    pane(p, wx, 111, 3, 5, lit(wx + 50, night));
    pane(p, wx, 122, 3, 4, lit(wx + 90, night));
  }
}

export const LAMPS = [205, 242];

function lamps(p: Painter, night: boolean) {
  for (const x of LAMPS) {
    if (night) {
      for (let y = 102; y <= 120; y++) {
        for (let gx = x - 9; gx <= x + 10; gx++) {
          const d = Math.hypot(gx + 0.5 - (x + 1), y + 0.5 - 111);
          if (d < 9 && (d < 5 || (gx + y) % 2 === 0)) p.set(gx, y, 'lampGlow');
        }
      }
    }
    p.rect(x, 114, 2, 21, 'lampPost');
    p.rect(x - 1, 134, 4, 1, 'lampPost');
    p.rect(x - 1, 109, 4, 1, 'lampPost');
    p.rect(x - 1, 110, 4, 3, 'lampGlass');
    p.rect(x - 1, 113, 4, 1, 'lampPost');
  }
}

function hedges(p: Painter) {
  // Paved terrace along Doe's base, showing where the lawn falls away.
  for (let x = 0; x < W; x++) {
    for (let y = 130; y <= lawnTop(x); y++) {
      if (x < 84) p.set(x, y, 'lawnDark');
      else if (y >= 132) p.set(x, y, y === 132 ? 'pathLight' : y % 3 === 0 ? 'pathDark' : 'path');
    }
  }
  const rng = mulberry32(17);
  for (let x = 84; x < W + 6; ) {
    const r = 4 + rng() * 3;
    if (x > 210 && x < 238) {
      x = 238;
      continue;
    }
    blob(p, x, 131 - r * 0.2, r, 60 + x);
    x += r * 1.3 + rng() * 2;
  }
  conifer(p, 212, 136, 18, 3.5);
  conifer(p, 236, 136, 18, 3.5);
}

function trees(p: Painter) {
  conifer(p, 70, 136, 40, 6);
  conifer(p, 79, 136, 52, 7);
  conifer(p, 88, 136, 32, 5);
  p.rect(18, 112, 3, 26, 'trunkDark');
  p.rect(19, 112, 1, 26, 'trunk');
  const left: [number, number, number][] = [
    [12, 104, 15], [34, 110, 13], [4, 122, 11], [26, 124, 10], [50, 124, 8], [40, 130, 7],
  ];
  left.forEach(([x, y, r], i) => blob(p, x, y, r, 80 + i));
  p.rect(310, 116, 3, 22, 'trunkDark');
  const right: [number, number, number][] = [
    [314, 106, 14], [300, 118, 10], [318, 126, 10],
  ];
  right.forEach(([x, y, r], i) => blob(p, x, y, r, 90 + i));
}

function lawn(p: Painter) {
  for (let x = 0; x < W; x++) {
    const top = lawnTop(x);
    for (let y = top; y < H; y++) {
      let key: PaletteKey = y - top < 2 ? 'lawnLight' : 'lawn';
      if (y > 158 || (y === 158 && x % 2 === 0) || (y === 157 && x % 4 === 0)) key = 'lawnMid';
      p.set(x, y, key);
    }
  }
  // Tufts and flowers on a 2px grid so they read as chunky pixels.
  for (let by = 66; by < H / 2; by++) {
    for (let bx = 0; bx < W / 2; bx++) {
      const x = bx * 2;
      const y = by * 2;
      if (y < lawnTop(x) + 3) continue;
      const h = hash(bx, by, 11);
      if (h < 0.06) {
        p.set(x, y + 1, 'lawnDark');
        p.set(x + 1, y, 'lawnDark');
        p.set(x + 2, y + 1, 'lawnDark');
      } else if (h < 0.09) {
        p.set(x, y, 'lawnLight');
      } else if (h < 0.1) {
        p.set(x, y, hash(bx, by, 12) < 0.6 ? 'flowerWhite' : 'flowerYellow');
        p.set(x, y + 1, 'lawnDark');
      }
    }
  }
  // Shade under the left trees.
  for (let y = 139; y < 147; y++) {
    for (let x = 0; x < 62; x++) {
      if (((x - 28) / 32) ** 2 + ((y - 143) / 3.5) ** 2 < 1 && y >= lawnTop(x) + 1) p.set(x, y, 'lawnMid');
    }
  }
}

function path(p: Painter) {
  for (let i = 0; i < 3; i++) {
    const y = 132 + i;
    p.rect(216 - i * 2, y, 16 + i * 4, 1, i === 0 ? 'pathLight' : 'path');
  }
  for (let y = 135; y < H; y++) {
    const t = (y - 135) / (H - 135);
    const cx = 224 + 92 * t ** 1.7;
    const hw = 5 + 15 * t;
    for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
      let key: PaletteKey = 'path';
      if (x <= cx - hw + 1) key = 'pathLight';
      else if (x >= cx + hw - 1) key = 'pathDark';
      else if (hash(x >> 1, y >> 1, 8) < 0.08) key = 'pathDark';
      p.set(x, y, key);
    }
  }
}

/** Buildings, hedges, lamps, trees, lawn, path and people: in front of the Campanile. */
export function drawMid(pal: Palette, night: boolean) {
  const p = new Painter(W, H, pal);
  leftWing(p, night);
  doe(p, night);
  lamps(p, night);
  trees(p);
  hedges(p);
  lawn(p);
  path(p);
  drawBlanket(p);
  drawNet(p);
  for (const person of PEOPLE) stamp(p, person);
  return p.toCanvas();
}

/** Overhanging canopies that frame the top corners. */
export function drawFg(pal: Palette) {
  const p = new Painter(W, H, pal);
  const leftBack: [number, number, number][] = [
    [6, 10, 18], [32, 4, 16], [58, 2, 14], [80, 0, 10], [-2, 32, 12], [22, 26, 12],
  ];
  leftBack.forEach(([x, y, r], i) => blob(p, x, y, r, 300 + i, -0.35));
  branch(p, [[-4, 56], [10, 50], [24, 46], [44, 40], [66, 32]], 5, 2);
  const left: [number, number, number][] = [
    [2, 6, 14], [24, 0, 14], [48, 4, 12], [70, 0, 10], [88, 6, 6], [-2, 26, 10], [14, 20, 10],
    [36, 18, 9], [58, 16, 7], [4, 40, 7], [74, 26, 5],
  ];
  left.forEach(([x, y, r], i) => blob(p, x, y, r, 100 + i));

  const rightBack: [number, number, number][] = [[314, 8, 16], [292, 2, 12], [322, 30, 10]];
  rightBack.forEach(([x, y, r], i) => blob(p, x, y, r, 400 + i, -0.35));
  branch(p, [[324, 42], [308, 36], [292, 28], [278, 20]], 4, 2);
  const right: [number, number, number][] = [
    [318, 4, 13], [298, 0, 10], [282, 6, 7], [310, 22, 8], [322, 36, 7],
  ];
  right.forEach(([x, y, r], i) => blob(p, x, y, r, 200 + i));
  return p.toCanvas();
}
