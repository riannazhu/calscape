import { stamp } from '../figures';
import { blob, branch } from '../foliage';
import type { Palette, TimeOfDay } from '../palette';
import { Painter, hash, mulberry32, noise, rgb, type RGB } from '../pixels';
import { clamp01, glowAt, overcastSky, steppedSky, type Glow, type Sky } from '../sky';
import { H, W } from '../stage';
import type { GladeKey } from './palette';
import { drawBlanket, drawNet, peopleFor } from './people';

type P = Painter<GladeKey>;

/** High in the east at midday, sinking behind the far trees at sunset. */
export const SUN: Record<'day' | 'sunset', { x: number; y: number; r: number }> = {
  day: { x: 238, y: 26, r: 6 },
  sunset: { x: 46, y: 106, r: 7 },
};
export const MOON = { x: 252, y: 24 };

/** The bird perches on the top-left branch with its feet on this row. */
export const PERCH = { x: 36, feetY: 42 };

/** Top row of the lawn: a gentle rise that crests in front of Doe. */
export const lawnTop = (x: number) => Math.round(131 + 12 * ((x - 175) / 175) ** 2);

const SKY_KEYS: GladeKey[] = ['sky0', 'sky1', 'sky2', 'sky3', 'sky4', 'sky5'];

/** Colour ramps from the deepest sky to its brightest point. */
const SKY_RAMP: Record<TimeOfDay, GladeKey[]> = {
  day: SKY_KEYS,
  sunset: [...SKY_KEYS, 'glow', 'sun'],
  night: SKY_KEYS,
};
/** How many solid colour steps each ramp is broken into. */
const SKY_LEVELS: Record<TimeOfDay, number> = { day: 22, sunset: 34, night: 16 };

/**
 * Where a point sits on its sky ramp, 0 deepest to 1 brightest. Sunset bands
 * arc around the low sun; the day sky tilts gently toward it.
 */
function skyField(time: TimeOfDay, x: number, y: number) {
  const v = clamp01(y / 122);
  if (time === 'night') return v;
  const sun = SUN[time];
  if (time === 'day') return clamp01(0.8 * v + 0.2 * (1 - Math.hypot(x - sun.x, y - sun.y) / 360));
  return clamp01(0.4 * v + 0.6 * (1 - Math.hypot(x - sun.x, (y - sun.y) * 1.5) / 300));
}

/** Stepped rings of light: a soft wash around the moon, a subtle glow around the sun. */
const SKY_GLOWS: Record<TimeOfDay, Glow[]> = {
  night: [
    { x: MOON.x, y: MOON.y, r: 40, a: 0.35, steps: 4 },
    { x: MOON.x, y: MOON.y, r: 14, a: 0.45, steps: 2 },
  ],
  day: [{ x: SUN.day.x, y: SUN.day.y, r: 16, a: 0.4, steps: 3 }],
  sunset: [{ x: SUN.sunset.x, y: SUN.sunset.y, r: 18, a: 0.45, steps: 3 }],
};

const skies = new Map<TimeOfDay, Sky>();

/** The clear sky colour at a pixel. */
export function skyColor(time: TimeOfDay, pal: Palette<GladeKey>, x: number, y: number): RGB {
  let sky = skies.get(time);
  if (!sky) {
    sky = {
      ramp: SKY_RAMP[time].map((k) => rgb(pal[k])),
      levels: SKY_LEVELS[time],
      field: (fx, fy) => skyField(time, fx, fy),
      glows: SKY_GLOWS[time],
      glow: rgb(pal.glow),
    };
    skies.set(time, sky);
  }
  return steppedSky(sky, x, y);
}

/** How much of the clear sky still tints the cloud deck, so the hour stays legible. */
const OVERCAST_SKY_SHOW: Record<TimeOfDay, number> = { day: 0.12, sunset: 0.35, night: 0.3 };

/** A rainy sky: a low cloud deck with no sun, moon or stars breaking through. */
function overcastColor(time: TimeOfDay, pal: Palette<GladeKey>, x: number, y: number): RGB {
  const deck = (['cloudDark', 'cloudShade', 'cloudMid'] as const).map((k) => rgb(pal[k]));
  return overcastSky(deck, skyColor(time, pal, x, y), OVERCAST_SKY_SHOW[time], 122, x, y);
}

type Clump = [x: number, y: number, r: number];

/**
 * Leaf clumps of the corner trees. The left canopy stays left of x = 88 so the
 * Campanile's spire keeps clear sky around it.
 */
const CANOPY: Record<'leftBack' | 'left' | 'rightBack' | 'right', Clump[]> = {
  leftBack: [[12, -2, 12], [42, -4, 10], [56, 30, 8], [-6, 46, 9]],
  left: [
    [32, 4, 10], [52, 6, 9], [68, 2, 7], [52, 26, 7], [-4, 30, 8], [-2, 62, 7],
    [44, 52, 8], [62, 46, 8], [77, 39, 7], [33, 56, 6],
  ],
  rightBack: [[318, 2, 15], [298, -4, 11], [306, 24, 8]],
  right: [[316, 10, 13], [294, 12, 10], [280, 22, 8], [324, 34, 9], [320, 56, 7]],
};

const starRng = mulberry32(7);
/** Stars that would peek through gaps between leaves are left out. */
const underCanopy = (x: number, y: number) =>
  Object.values(CANOPY).some((list) => list.some(([cx, cy, r]) => Math.hypot(x - cx, y - cy) < r * 1.15 + 3));

export const STARS = Array.from({ length: 80 }, () => {
  const s = { x: Math.floor(starRng() * W), y: Math.floor(starRng() * 96) };
  starRng();
  return s;
}).filter((s) => Math.hypot(s.x - MOON.x, s.y - MOON.y) > 10 && !underCanopy(s.x, s.y));

function conifer(p: P, cx: number, baseY: number, height: number, halfW: number) {
  for (let r = 0; r <= height; r++) {
    const y = baseY - height + r;
    const hw = Math.max(0.6, halfW * (r / height) * (0.7 + 0.3 * ((r % 6) / 6)));
    for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw) - 1; x++) {
      const rel = (x + 0.5 - cx) / hw;
      p.set(x, y, rel < -0.45 ? 'pineLight' : rel > 0.2 ? 'pineDark' : 'pine');
    }
  }
}

const LIT_SHARE: Record<TimeOfDay, number> = { day: 0.12, sunset: 0.3, night: 0.65 };

function lit(seed: number, time: TimeOfDay) {
  return hash(seed, 3, 77) < LIT_SHARE[time];
}

/** A small window: warm when lit, dusky glass when not. */
function pane(p: P, x: number, y: number, w: number, h: number, on: boolean) {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const key = on ? (j >= h / 2 ? 'winLit2' : 'winLit') : j >= h / 2 ? 'winDark2' : 'winDark';
      p.set(x + i, y + j, key);
    }
  }
}

function farBuilding(p: P, x0: number, x1: number, roofTop: number, wallTop: number, time: TimeOfDay) {
  for (let y = roofTop; y < wallTop; y++) {
    const inset = wallTop - y - 1;
    for (let x = x0 + inset; x <= x1 - inset; x++) p.set(x, y, y === roofTop ? 'redRoof' : (y - roofTop) % 2 ? 'redRoofDark' : 'redRoof');
  }
  for (let y = wallTop; y < 130; y++) for (let x = x0; x <= x1; x++) p.set(x, y, x >= x1 - 1 ? 'creamShadow' : 'creamWall');
  for (let wy = wallTop + 3; wy + 3 < 128; wy += 6) {
    for (let wx = x0 + 3; wx + 2 < x1 - 1; wx += 5) pane(p, wx, wy, 2, 3, lit(wx * 7 + wy, time));
  }
}

/** Sky, sun or moon, stars, the distant tree line and far buildings; overcast when raining. */
export function drawFar(pal: Palette<GladeKey>, time: TimeOfDay, overcast = false) {
  const p = new Painter<GladeKey>(W, H, pal);
  const sky = overcast ? overcastColor : skyColor;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) p.setRGB(x, y, sky(time, pal, x, y));

  if (overcast) {
    // The cloud deck hides the sun, moon and stars.
  } else if (time !== 'night') {
    const sun = SUN[time];
    for (let y = sun.y - sun.r; y <= sun.y + sun.r; y++) {
      for (let x = sun.x - sun.r; x <= sun.x + sun.r; x++) {
        if (Math.hypot(x + 0.5 - sun.x, y + 0.5 - sun.y) < sun.r) p.set(x, y, 'sun');
      }
    }
  } else {
    for (let y = MOON.y - 5; y <= MOON.y + 5; y++) {
      for (let x = MOON.x - 5; x <= MOON.x + 5; x++) {
        if (Math.hypot(x + 0.5 - MOON.x, y + 0.5 - MOON.y) >= 5) continue;
        const crater = (x === MOON.x + 1 && y === MOON.y - 1) || (x === MOON.x - 2 && y === MOON.y + 1);
        p.set(x, y, crater ? 'moonShade' : 'moon');
      }
    }
    for (const s of STARS) p.set(s.x, s.y, 'star');
  }

  // Distant tree line in chunky 2px columns.
  for (let bx = 0; bx < W / 2; bx++) {
    const x = bx * 2;
    const top = Math.round((108 + 6 * Math.abs(Math.sin(x * 0.07)) + 4 * noise(x, 0, 14, 3)) / 2) * 2;
    for (let y = top; y < H; y++) p.rect(x, y, 2, 1, y < top + 2 ? 'farTree' : y > 120 ? 'farTreeDark' : 'farTree');
  }
  farBuilding(p, 4, 40, 103, 108, time);
  farBuilding(p, 32, 74, 109, 113, time);
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

function doe(p: P, time: TimeOfDay) {
  // Red tile roof.
  for (let y = 70; y < 80; y++) {
    const inset = 79 - y;
    for (let x = DOE_L + inset; x <= DOE_R + 1 - inset; x++) {
      let key: GladeKey = y === 70 ? 'roofLight' : (y - 70) % 3 === 0 ? 'roofDark' : 'roof';
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
        let key: GladeKey = on ? (y > (y0 + y1) / 2 ? 'winLit2' : 'winLit') : y > (y0 + y1) / 2 ? 'winDark2' : 'winDark';
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
    arched(b0 + 2, b1 - 2, 90, 112, lit(b0, time));
    const mid = Math.floor((b0 + b1) / 2);
    pane(p, mid - 1, 122, 3, 4, lit(b0 + 1, time));
  }
  for (const x0 of [135, mirror(140)]) {
    arched(x0, x0 + 5, 91, 112, lit(x0, time));
    pane(p, x0 + 1, 122, 4, 4, lit(x0 + 2, time));
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
      p.set(x, y, grid ? 'door' : time === 'night' ? 'winLit' : 'winDark');
    }
  }
}

function leftWing(p: P, time: TimeOfDay) {
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
    pane(p, wx, 103, 3, 6, lit(wx, time));
    pane(p, wx, 111, 3, 5, lit(wx + 50, time));
    pane(p, wx, 122, 3, 4, lit(wx + 90, time));
  }
}

const LAMPS = [205, 242];

const LAMP_GLOW_R = 15;

/** Warm light around each lamp head: solid rings on the 2px block grid. */
function lamps(p: P, time: TimeOfDay) {
  const glow = rgb(p.pal.lampGlow);
  for (const x of LAMPS) {
    if (time === 'night') {
      for (let y = 111 - LAMP_GLOW_R; y <= 111 + LAMP_GLOW_R; y++) {
        for (let gx = x + 1 - LAMP_GLOW_R; gx <= x + 1 + LAMP_GLOW_R; gx++) {
          const d = Math.hypot((gx | 1) - (x + 1), (y | 1) - 111) / LAMP_GLOW_R;
          p.blend(gx, y, glow, 0.85 * glowAt(d, 4));
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

function hedges(p: P) {
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

function trees(p: P) {
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

function lawn(p: P) {
  for (let x = 0; x < W; x++) {
    const top = lawnTop(x);
    for (let y = top; y < H; y++) {
      let key: GladeKey = y - top < 2 ? 'lawnLight' : 'lawn';
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

function path(p: P) {
  for (let i = 0; i < 3; i++) {
    const y = 132 + i;
    p.rect(216 - i * 2, y, 16 + i * 4, 1, i === 0 ? 'pathLight' : 'path');
  }
  for (let y = 135; y < H; y++) {
    const t = (y - 135) / (H - 135);
    const cx = 224 + 92 * t ** 1.7;
    const hw = 5 + 15 * t;
    for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
      let key: GladeKey = 'path';
      if (x <= cx - hw + 1) key = 'pathLight';
      else if (x >= cx + hw - 1) key = 'pathDark';
      else if (hash(x >> 1, y >> 1, 8) < 0.08) key = 'pathDark';
      p.set(x, y, key);
    }
  }
}

/** Buildings, hedges, lamps, trees, lawn, path and people: in front of the Campanile. */
export function drawMid(pal: Palette<GladeKey>, time: TimeOfDay) {
  const p = new Painter<GladeKey>(W, H, pal);
  leftWing(p, time);
  doe(p, time);
  lamps(p, time);
  trees(p);
  hedges(p);
  lawn(p);
  path(p);
  if (time !== 'night') drawBlanket(p);
  if (time === 'day') drawNet(p);
  for (const person of peopleFor(time)) stamp(p, person);
  return p.toCanvas();
}

/** Overhanging canopies that frame the top corners. */
export function drawFg(pal: Palette<GladeKey>) {
  const p = new Painter<GladeKey>(W, H, pal);
  const clumps = (list: Clump[], seed: number, shade = 0) =>
    list.forEach(([x, y, r], i) => blob(p, x, y, r, seed + i, shade));

  // Left tree: a thick trunk rising up and to the right, a sturdy branch the
  // bird sits on in open sky, leaves hanging below it and a light crown above.
  clumps(CANOPY.leftBack, 300, -0.35);
  branch(p, [[-8, 86], [2, 66], [10, 46], [18, 26], [26, 6], [30, -6]], 11, 7);
  branch(p, [[8, 52], [18, 48], [32, 47], [48, 43], [64, 39], [78, 36]], 7, 4);
  branch(p, [[20, 22], [36, 16], [52, 10], [66, 4]], 5, 3);
  branch(p, [[48, 43], [52, 34], [54, 26]], 4, 3);
  clumps(CANOPY.left, 100);

  // Right tree: the same build, mirrored and a little smaller.
  clumps(CANOPY.rightBack, 400, -0.35);
  branch(p, [[324, 24], [310, 14], [298, 4]], 3, 2);
  branch(p, [[326, 62], [316, 48], [304, 38], [292, 30], [282, 24]], 6, 2);
  branch(p, [[304, 38], [300, 26], [294, 14]], 3, 2);
  clumps(CANOPY.right, 200);
  return p.toCanvas();
}
